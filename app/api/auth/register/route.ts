import { NextResponse } from "next/server";
import { z } from "zod";
import { parseAuthIdentifier, syntheticAuthEmail } from "@/lib/auth/identifier";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

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

  const password = parsedBody.data.password;
  const admin = createAdminSupabaseClient();
  const authEmail = identifier.kind === "email" ? identifier.email : syntheticAuthEmail(identifier.loginId);

  if (identifier.kind === "loginId") {
    const { data: existing } = await admin
      .from("user_login_ids")
      .select("login_id")
      .eq("login_id", identifier.loginId)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ error: "이미 사용 중인 아이디입니다." }, { status: 409 });
    }
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: authEmail,
    password,
    email_confirm: true,
    user_metadata: identifier.kind === "loginId" ? { login_id: identifier.loginId } : {},
  });
  if (createError || !created.user) {
    const message = createError?.message ?? "";
    if (message.toLowerCase().includes("already")) {
      return NextResponse.json(
        { error: identifier.kind === "email" ? "이미 가입된 이메일입니다." : "이미 사용 중인 아이디입니다." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "회원가입을 완료하지 못했습니다." }, { status: 500 });
  }

  if (identifier.kind === "loginId") {
    const { error: insertError } = await admin.from("user_login_ids").insert({
      login_id: identifier.loginId,
      user_id: created.user.id,
      auth_email: authEmail,
    });
    if (insertError) {
      await admin.auth.admin.deleteUser(created.user.id);
      return NextResponse.json({ error: "이미 사용 중인 아이디입니다." }, { status: 409 });
    }
  }

  const supabase = await createServerSupabaseClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: authEmail,
    password,
  });
  if (signInError) {
    return NextResponse.json({ error: "가입은 되었지만 로그인에 실패했습니다. 다시 로그인해 주세요." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
