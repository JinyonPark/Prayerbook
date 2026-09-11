import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimitUserMessage } from "@/lib/auth/gotrue-error";
import { parseEmailInput } from "@/lib/auth/email";
import { isSyntheticAuthEmail } from "@/lib/auth/identifier";
import { applyMailCooldownCookie, hasMailCooldownCookie, jsonRateLimitResponse, signupRateLimitResponse } from "@/lib/auth/mail-cooldown";
import { AUTH_MESSAGES, MAIL_COOLDOWN_SECONDS } from "@/lib/auth/messages";
import { passwordResetCallbackUrl, siteUrlFromRequest } from "@/lib/auth/redirect";
import { isRateLimitFailure, parseAuthRetryAfterSeconds } from "@/lib/errors/inspect";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  email: z.string().min(1).max(254),
});

export async function POST(request: Request) {
  const parsedBody = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) {
    return NextResponse.json({ error: AUTH_MESSAGES.invalidEmail }, { status: 400 });
  }

  const parsedEmail = parseEmailInput(parsedBody.data.email);
  if ("error" in parsedEmail) {
    return NextResponse.json({ error: parsedEmail.error }, { status: 400 });
  }

  if (hasMailCooldownCookie(request)) {
    return jsonRateLimitResponse();
  }

  try {
    if (!isSyntheticAuthEmail(parsedEmail.email)) {
      const supabase = await createServerSupabaseClient();
      const { error } = await supabase.auth.resetPasswordForEmail(parsedEmail.email, {
        redirectTo: passwordResetCallbackUrl(siteUrlFromRequest(request)),
      });
      if (error && isRateLimitFailure(error)) {
        const parsed = parseAuthRetryAfterSeconds(error);
        const retryAfter = parsed ?? MAIL_COOLDOWN_SECONDS;
        return signupRateLimitResponse(retryAfter, rateLimitUserMessage(parsed));
      }
    }

    const response = NextResponse.json({ ok: true, message: AUTH_MESSAGES.resetSent });
    return applyMailCooldownCookie(response);
  } catch {
    return NextResponse.json({ error: AUTH_MESSAGES.network }, { status: 503 });
  }
}
