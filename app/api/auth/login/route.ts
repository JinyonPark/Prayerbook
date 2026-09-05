import { NextResponse } from "next/server";
import { z } from "zod";
import { parseAuthIdentifier } from "@/lib/auth/identifier";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const bodySchema = z.object({
  identifier: z.string().min(1).max(254),
  password: z.string().min(6).max(72),
});

export async function POST(request: Request) {
  const parsedBody = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) {
    return NextResponse.json({ error: "아이디/이메일과 비밀번호를 확인해 주세요." }, { status: 400 });
  }

  const identifier = parseAuthIdentifier(parsedBody.data.identifier);
  if ("error" in identifier) {
    return NextResponse.json({ error: identifier.error }, { status: 400 });
  }

  let email = identifier.kind === "email" ? identifier.email : "";
  if (identifier.kind === "loginId") {
    const admin = createAdminSupabaseClient();
    const { data } = await admin.from("user_login_ids").select("auth_email").eq("login_id", identifier.loginId).maybeSingle();
    if (!data?.auth_email) {
      return NextResponse.json({ error: "아이디/이메일 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
    }
    email = data.auth_email;
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: parsedBody.data.password,
  });
  if (error) {
    return NextResponse.json({ error: "아이디/이메일 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
