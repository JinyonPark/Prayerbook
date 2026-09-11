import { NextResponse } from "next/server";
import { LOCAL_HISTORY_CUTOVER_AT } from "@/lib/local-prayer-db/constants";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin.rpc("purge_short_lived_prayer_operations", {
    p_cutover: LOCAL_HISTORY_CUTOVER_AT,
    p_limit: 1000,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ deleted: data ?? 0 });
}
