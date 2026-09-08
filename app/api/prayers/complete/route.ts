import { NextResponse } from "next/server";
import { z } from "zod";
import { inspectError, isAuthFailure, isNotFoundFailure } from "@/lib/errors/inspect";
import { rpcComplete } from "@/lib/supabase/rpc";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { hasPublicEnv } from "@/lib/validation/env";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  prayerItemId: z.string().uuid(),
  clientEventId: z.string().uuid(),
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
    const result = await rpcComplete(supabase, parsed.data.prayerItemId, parsed.data.clientEventId);
    return NextResponse.json(result);
  } catch (error) {
    if (isAuthFailure(error)) {
      return NextResponse.json({ error: "AUTH_EXPIRED" }, { status: 401 });
    }
    if (isNotFoundFailure(error)) {
      return NextResponse.json({ error: "PRAYER_NOT_FOUND" }, { status: 404 });
    }
    const info = inspectError(error);
    return NextResponse.json(
      { error: info.code || "COMPLETE_FAILED", message: info.message.slice(0, 180) },
      { status: info.status && info.status >= 400 ? info.status : 500 },
    );
  }
}
