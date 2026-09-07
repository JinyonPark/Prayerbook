import { NextResponse } from "next/server";
import { isSyntheticAuthEmail } from "@/lib/auth/identifier";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const admin = createAdminSupabaseClient();
  const { data: mapping } = await admin
    .from("user_login_ids")
    .select("login_id, auth_email")
    .eq("user_id", user.id)
    .maybeSingle();

  const authEmail = mapping?.auth_email || user.email || "";
  const recoveryEmail = authEmail && !isSyntheticAuthEmail(authEmail) ? authEmail : null;

  return NextResponse.json({
    loginId: mapping?.login_id ?? null,
    recoveryEmail,
  });
}
