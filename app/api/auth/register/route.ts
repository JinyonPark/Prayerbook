import { NextResponse } from "next/server";
import { z } from "zod";
import { parseMatchingEmails } from "@/lib/auth/email";
import { mapSignupAuthError, missingSignupSession } from "@/lib/auth/gotrue-error";
import { AUTH_MESSAGES } from "@/lib/auth/messages";
import { MAX_PASSWORD_LENGTH, validateNewPassword } from "@/lib/auth/password";
import { logAuthError } from "@/lib/errors/inspect";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  email: z.string().min(1).max(254),
  confirmEmail: z.string().min(1).max(254),
  password: z.string().min(1).max(MAX_PASSWORD_LENGTH),
  confirmPassword: z.string().min(1).max(MAX_PASSWORD_LENGTH),
});

export async function POST(request: Request) {
  const parsedBody = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) {
    return NextResponse.json({ error: "이메일과 비밀번호를 확인해 주세요." }, { status: 400 });
  }

  const parsedEmail = parseMatchingEmails(parsedBody.data.email, parsedBody.data.confirmEmail);
  if ("error" in parsedEmail) {
    return NextResponse.json({ error: parsedEmail.error }, { status: 400 });
  }

  const passwordError = validateNewPassword(parsedBody.data.password, parsedBody.data.confirmPassword, "signup");
  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 400 });
  }

  try {
    const admin = createAdminSupabaseClient();
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: parsedEmail.email,
      password: parsedBody.data.password,
      email_confirm: true,
    });
    if (createError) {
      logAuthError("register.createUser", createError);
      const mapped = mapSignupAuthError(createError);
      return NextResponse.json(
        { error: mapped.error, retryAfter: mapped.retryAfter, code: mapped.code },
        { status: mapped.status },
      );
    }
    if (!created.user?.id) {
      logAuthError("register.createUser", new Error("missing user"));
      const mapped = missingSignupSession();
      return NextResponse.json({ error: mapped.error, code: mapped.code }, { status: mapped.status });
    }

    const supabase = await createServerSupabaseClient();
    const { data: sessionData, error: signInError } = await supabase.auth.signInWithPassword({
      email: parsedEmail.email,
      password: parsedBody.data.password,
    });
    if (signInError || !sessionData.session || !sessionData.user) {
      logAuthError("register.signIn", signInError ?? new Error("missing session"));
      const mapped = missingSignupSession();
      return NextResponse.json({ error: mapped.error, code: mapped.code }, { status: mapped.status });
    }

    return NextResponse.json({ ok: true, email: parsedEmail.email });
  } catch (error) {
    logAuthError("register", error);
    return NextResponse.json({ error: AUTH_MESSAGES.network }, { status: 503 });
  }
}
