import { NextResponse } from "next/server";
import { z } from "zod";
import { parseEmailInput } from "@/lib/auth/email";
import { AUTH_MESSAGES } from "@/lib/auth/messages";
import { MAX_PASSWORD_LENGTH, MIN_NEW_PASSWORD_LENGTH, validateNewPassword } from "@/lib/auth/password";
import { signupConfirmCallbackUrl, siteUrlFromRequest } from "@/lib/auth/redirect";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  email: z.string().min(1).max(254),
  password: z.string().min(MIN_NEW_PASSWORD_LENGTH).max(MAX_PASSWORD_LENGTH),
  confirmPassword: z.string().min(MIN_NEW_PASSWORD_LENGTH).max(MAX_PASSWORD_LENGTH),
});

export async function POST(request: Request) {
  const parsedBody = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) {
    return NextResponse.json({ error: "이메일과 비밀번호를 확인해 주세요." }, { status: 400 });
  }

  const parsedEmail = parseEmailInput(parsedBody.data.email);
  if ("error" in parsedEmail) {
    return NextResponse.json({ error: parsedEmail.error }, { status: 400 });
  }

  const passwordError = validateNewPassword(parsedBody.data.password, parsedBody.data.confirmPassword);
  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 400 });
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.signUp({
      email: parsedEmail.email,
      password: parsedBody.data.password,
      options: {
        emailRedirectTo: signupConfirmCallbackUrl(siteUrlFromRequest(request)),
      },
    });
    if (error) {
      const message = error.message.toLowerCase();
      if (message.includes("security purposes") || message.includes("rate")) {
        return NextResponse.json({ error: AUTH_MESSAGES.rateLimit }, { status: 429 });
      }
    }

    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData.session) {
      await supabase.auth.signOut();
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: AUTH_MESSAGES.network }, { status: 503 });
  }
}
