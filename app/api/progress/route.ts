import { NextResponse } from "next/server";
import { z } from "zod";
import { inspectError, isAuthFailure, isNotFoundFailure } from "@/lib/errors/inspect";
import {
  rpcBulkSetMain,
  rpcResetAll,
  rpcResetCurrentRound,
  rpcResetItem,
  rpcResetMain,
  rpcSetCount,
} from "@/lib/supabase/rpc";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { hasPublicEnv } from "@/lib/validation/env";

export const dynamic = "force-dynamic";

const bodySchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("set_count"),
    prayerItemId: z.string().uuid(),
    newCount: z.number().int().min(0).max(10_000),
    clientEventId: z.string().uuid(),
  }),
  z.object({
    op: z.literal("reset_item"),
    prayerItemId: z.string().uuid(),
    clientEventId: z.string().uuid(),
  }),
  z.object({ op: z.literal("reset_round"), clientEventId: z.string().uuid() }),
  z.object({ op: z.literal("reset_main"), clientEventId: z.string().uuid() }),
  z.object({ op: z.literal("reset_all"), clientEventId: z.string().uuid() }),
  z.object({
    op: z.literal("bulk_set"),
    newCount: z.number().int().min(0).max(10_000),
    clientEventId: z.string().uuid(),
  }),
]);

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

    const body = parsed.data;
    const result =
      body.op === "set_count"
        ? await rpcSetCount(supabase, body.prayerItemId, body.newCount, body.clientEventId)
        : body.op === "reset_item"
          ? await rpcResetItem(supabase, body.prayerItemId, body.clientEventId)
          : body.op === "reset_round"
            ? await rpcResetCurrentRound(supabase, body.clientEventId)
            : body.op === "reset_main"
              ? await rpcResetMain(supabase, body.clientEventId)
              : body.op === "reset_all"
                ? await rpcResetAll(supabase, body.clientEventId)
                : await rpcBulkSetMain(supabase, body.newCount, body.clientEventId);

    return NextResponse.json(result);
  } catch (error) {
    if (isAuthFailure(error)) {
      return NextResponse.json({ error: "AUTH_EXPIRED" }, { status: 401 });
    }
    if (isNotFoundFailure(error)) {
      return NextResponse.json({ error: "PRAYER_NOT_FOUND" }, { status: 404 });
    }
    const info = inspectError(error);
    console.error("progress mutation failed", info.code, info.message.slice(0, 180), info.status);
    return NextResponse.json(
      { error: info.code || "MUTATION_FAILED", message: info.message.slice(0, 180) },
      { status: info.status && info.status >= 400 ? info.status : 500 },
    );
  }
}
