import { NextResponse } from "next/server";
import { z } from "zod";
import { parseEmailInput } from "@/lib/auth/email";
import { isUnconfirmedAuthError, rateLimitUserMessage } from "@/lib/auth/gotrue-error";
import { parseAuthIdentifier } from "@/lib/auth/identifier";
import { AUTH_MESSAGES, MAIL_COOLDOWN_SECONDS } from "@/lib/auth/messages";
import { MAX_PASSWORD_LENGTH, MIN_LOGIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { isRateLimitFailure, parseAuthRetryAfterSeconds } from "@/lib/errors/inspect";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  email: z.string().max(254).optional(),
  identifier: z.string().max(254).optional(),
  password: z.string().min(MIN_LOGIN_PASSWORD_LENGTH).max(MAX_PASSWORD_LENGTH),
});

export async function POST(request: Request) {
  const parsedBody = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) {
    return NextResponse.json({ error: AUTH_MESSAGES.loginFailed }, { status: 400 });
  }

  const rawIdentifier = parsedBody.data.email ?? parsedBody.data.identifier ?? "";
  const identifier = parseAuthIdentifier(rawIdentifier);
  if ("error" in identifier) {
    return NextResponse.json({ error: AUTH_MESSAGES.loginFailed }, { status: 400 });
  }

  let email = identifier.kind === "email" ? identifier.email : "";
  if (identifier.kind === "loginId") {
    const admin = createAdminSupabaseClient();
    const { data, error } = await admin
      .from("user_login_ids")
      .select("auth_email")
      .eq("normalized_login_id", identifier.normalizedLoginId)
      .maybeSingle();
    const fallback = error
      ? await admin.from("user_login_ids").select("auth_email").eq("login_id", identifier.normalizedLoginId).maybeSingle()
      : { data };
    if (!fallback.data?.auth_email) {
      return NextResponse.json({ error: AUTH_MESSAGES.loginFailed }, { status: 401 });
    }
    email = fallback.data.auth_email;
  }

  if (identifier.kind === "email") {
    const parsedEmail = parseEmailInput(identifier.email);
    if ("error" in parsedEmail) {
      return NextResponse.json({ error: AUTH_MESSAGES.loginFailed }, { status: 400 });
    }
    email = parsedEmail.email;
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: parsedBody.data.password,
    });
    if (error) {
      if (isUnconfirmedAuthError(error)) {
        return NextResponse.json({ error: AUTH_MESSAGES.unconfirmed, code: "unconfirmed" }, { status: 403 });
      }
      if (isRateLimitFailure(error)) {
        const parsed = parseAuthRetryAfterSeconds(error);
        const retryAfter = parsed ?? MAIL_COOLDOWN_SECONDS;
        return NextResponse.json(
          { error: rateLimitUserMessage(parsed), retryAfter, code: "rate_limit" },
          { status: 429 },
        );
      }
      return NextResponse.json({ error: AUTH_MESSAGES.loginFailed }, { status: 401 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: AUTH_MESSAGES.network }, { status: 503 });
  }
}
