import { NextResponse } from "next/server";
import { z } from "zod";
import { isSyntheticAuthEmail, parseAuthIdentifier } from "@/lib/auth/identifier";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  email: z.string().min(3).max(254),
});

export async function POST(request: Request) {
  const parsedBody = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) {
    return NextResponse.json({ error: "복구 이메일을 입력해 주세요." }, { status: 400 });
  }

  const parsed = parseAuthIdentifier(parsedBody.data.email);
  if ("error" in parsed || parsed.kind !== "email") {
    return NextResponse.json({ error: "이메일 형식이 올바르지 않습니다." }, { status: 400 });
  }
  if (isSyntheticAuthEmail(parsed.email)) {
    return NextResponse.json({ error: "이 주소는 복구 메일로 사용할 수 없습니다." }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const admin = createAdminSupabaseClient();
  const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
    email: parsed.email,
    email_confirm: true,
  });
  if (updateError) {
    const message = updateError.message.toLowerCase();
    if (message.includes("already") || message.includes("registered") || message.includes("exists")) {
      return NextResponse.json({ error: "이미 다른 계정에서 사용하는 이메일입니다." }, { status: 409 });
    }
    return NextResponse.json({ error: "복구 이메일을 저장하지 못했습니다." }, { status: 500 });
  }

  const { error: mapError } = await admin
    .from("user_login_ids")
    .update({ auth_email: parsed.email })
    .eq("user_id", user.id);
  if (mapError) {
    return NextResponse.json({ error: "복구 이메일을 저장하지 못했습니다." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, recoveryEmail: parsed.email });
}
