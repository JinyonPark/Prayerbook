export function safeNextPath(next: string | null | undefined, fallback = "/"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("://")) {
    return fallback;
  }
  return next;
}

export function passwordResetCallbackUrl(siteUrl: string): string {
  const origin = siteUrl.replace(/\/$/, "");
  return `${origin}/auth/callback?next=/auth/update-password`;
}
