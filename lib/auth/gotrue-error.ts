import { AUTH_MESSAGES, MAIL_COOLDOWN_SECONDS } from "@/lib/auth/messages";
import { inspectError, isRateLimitFailure, parseAuthRetryAfterSeconds } from "@/lib/errors/inspect";

export type SignupAuthFailure = {
  status: 400 | 403 | 409 | 429 | 503;
  error: string;
  retryAfter?: number;
  code?:
    | "already_registered"
    | "rate_limit"
    | "signup_disabled"
    | "email_provider_disabled"
    | "email_send_unexpected"
    | "no_session";
};

export function isAlreadyRegisteredAuthError(error: unknown): boolean {
  const info = inspectError(error);
  const haystack = `${info.code} ${info.message}`.toLowerCase();
  return (
    haystack.includes("email_exists") ||
    haystack.includes("user_already_exists") ||
    haystack.includes("already registered") ||
    haystack.includes("already been registered") ||
    haystack.includes("user already exists")
  );
}

export function isUnconfirmedAuthError(error: unknown): boolean {
  const info = inspectError(error);
  return `${info.code} ${info.message}`.toLowerCase().includes("email not confirmed");
}

export function isSignupDisabledError(error: unknown): boolean {
  const haystack = `${inspectError(error).code} ${inspectError(error).message}`.toLowerCase();
  return haystack.includes("signup_disabled") || haystack.includes("signups not allowed");
}

export function isEmailProviderDisabledError(error: unknown): boolean {
  const haystack = `${inspectError(error).code} ${inspectError(error).message}`.toLowerCase();
  return haystack.includes("email_provider_disabled") || haystack.includes("email logins are disabled");
}

export function isUnexpectedSignupEmailError(error: unknown): boolean {
  const info = inspectError(error);
  const haystack = `${info.code} ${info.message}`.toLowerCase();
  return (
    haystack.includes("email_address_not_authorized") ||
    haystack.includes("over_email_send_rate_limit") ||
    haystack.includes("email rate limit") ||
    haystack.includes("confirmation email") ||
    haystack.includes("error sending")
  );
}

export function rateLimitUserMessage(retryAfter: number | null | undefined): string {
  if (retryAfter && retryAfter > 0) {
    return AUTH_MESSAGES.rateLimitWait(retryAfter);
  }
  return AUTH_MESSAGES.rateLimit;
}

export function mapSignupAuthError(error: unknown): SignupAuthFailure {
  if (isAlreadyRegisteredAuthError(error)) {
    return { status: 409, error: AUTH_MESSAGES.alreadyRegistered, code: "already_registered" };
  }
  if (isSignupDisabledError(error)) {
    return { status: 403, error: AUTH_MESSAGES.signupDisabled, code: "signup_disabled" };
  }
  if (isEmailProviderDisabledError(error)) {
    return { status: 403, error: AUTH_MESSAGES.emailProviderDisabled, code: "email_provider_disabled" };
  }
  if (isUnexpectedSignupEmailError(error)) {
    return { status: 503, error: AUTH_MESSAGES.signupFailed, code: "email_send_unexpected" };
  }
  if (isRateLimitFailure(error)) {
    const parsed = parseAuthRetryAfterSeconds(error);
    const retryAfter = parsed ?? MAIL_COOLDOWN_SECONDS;
    return {
      status: 429,
      error: rateLimitUserMessage(parsed),
      retryAfter,
      code: "rate_limit",
    };
  }
  return { status: 400, error: AUTH_MESSAGES.signupFailed };
}

export function missingSignupSession(): SignupAuthFailure {
  return { status: 503, error: AUTH_MESSAGES.signupSessionFailed, code: "no_session" };
}
