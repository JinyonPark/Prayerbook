import { NextResponse } from "next/server";
import { z } from "zod";
import { AUTH_MESSAGES } from "@/lib/auth/messages";
import { MAX_PASSWORD_LENGTH, MIN_NEW_PASSWORD_LENGTH, validateNewPassword } from "@/lib/auth/password";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  password: z.string().min(MIN_NEW_PASSWORD_LENGTH).max(MAX_PASSWORD_LENGTH),
  confirmPassword: z.string().min(MIN_NEW_PASSWORD_LENGTH).max(MAX_PASSWORD_LENGTH),
});

export async function POST(request: Request) {
  const parsedBody = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) {
    return NextResponse.json({ error: AUTH_MESSAGES.passwordTooShort }, { status: 400 });
  }

  const passwordError = validateNewPassword(parsedBody.data.password, parsedBody.data.confirmPassword);
  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: AUTH_MESSAGES.resetLinkInvalid }, { status: 401 });
  }

  const { error } = await supabase.auth.updateUser({ password: parsedBody.data.password });
  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("same password") || message.includes("should be different")) {
      return NextResponse.json({ error: "새 비밀번호는 이전 비밀번호와 달라야 합니다." }, { status: 400 });
    }
    return NextResponse.json({ error: AUTH_MESSAGES.resetLinkInvalid }, { status: 400 });
  }

  await supabase.auth.signOut();
  return NextResponse.json({ ok: true, message: AUTH_MESSAGES.passwordChanged });
}
