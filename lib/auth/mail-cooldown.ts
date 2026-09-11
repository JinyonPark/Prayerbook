import { NextResponse } from "next/server";
import { AUTH_MESSAGES, MAIL_COOLDOWN_COOKIE, MAIL_COOLDOWN_SECONDS } from "@/lib/auth/messages";

export function hasMailCooldownCookie(request: Request): boolean {
  const cookieHeader = request.headers.get("cookie") ?? "";
  return cookieHeader.split(";").some((part) => part.trim().startsWith(`${MAIL_COOLDOWN_COOKIE}=`));
}

export function applyMailCooldownCookie(response: NextResponse, seconds = MAIL_COOLDOWN_SECONDS) {
  response.cookies.set(MAIL_COOLDOWN_COOKIE, "1", {
    maxAge: seconds,
    path: "/",
    httpOnly: true,
    sameSite: "lax",
  });
  return response;
}

export function jsonRateLimitResponse(
  retryAfter = MAIL_COOLDOWN_SECONDS,
  error = AUTH_MESSAGES.rateLimitWait(retryAfter),
  setCookie = false,
) {
  const response = NextResponse.json({ error, retryAfter, code: "rate_limit" as const }, { status: 429 });
  response.headers.set("Retry-After", String(retryAfter));
  if (setCookie) applyMailCooldownCookie(response, retryAfter);
  return response;
}

export function signupRateLimitResponse(retryAfter = MAIL_COOLDOWN_SECONDS, error = AUTH_MESSAGES.rateLimitWait(retryAfter)) {
  return jsonRateLimitResponse(retryAfter, error, true);
}
