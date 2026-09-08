import { NextResponse } from "next/server";
import { z } from "zod";
import { inspectError, isAuthFailure, isNotFoundFailure } from "@/lib/errors/inspect";
import { rpcSavePrayerInputs } from "@/lib/supabase/rpc";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { hasPublicEnv } from "@/lib/validation/env";
import { prayerItemIdSchema } from "@/lib/validation/count";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  prayerItemId: prayerItemIdSchema,
  values: z.record(z.unknown()),
});

export async function POST(request: Request) {
  if (!hasPublicEnv()) {
    return NextResponse.json({ error: "SERVER_UNAVAILABLE" }, { status: 503 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }

  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "AUTH_EXPIRED" }, { status: 401 });
    }
    const result = await rpcSavePrayerInputs(supabase, parsed.data.prayerItemId, parsed.data.values);
    return NextResponse.json(result);
  } catch (error) {
    if (isAuthFailure(error)) {
      return NextResponse.json({ error: "AUTH_EXPIRED" }, { status: 401 });
    }
    if (isNotFoundFailure(error)) {
      return NextResponse.json({ error: "PRAYER_NOT_FOUND" }, { status: 404 });
    }
    const info = inspectError(error);
    console.error("prayer inputs failed", info.code, info.message.slice(0, 180), info.status);
    return NextResponse.json(
      { error: info.code || "MUTATION_FAILED", message: info.message.slice(0, 180) },
      { status: info.status && info.status >= 400 ? info.status : 500 },
    );
  }
}
