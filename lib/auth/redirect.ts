import { resolveConfiguredSiteUrl } from "@/lib/auth/site-url";

const DEFAULT_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://prayer-book-chi.vercel.app",
  "https://prayer-book-820710.vercel.app",
];

export const AUTH_PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/auth",
  "/install",
  "/manifest.webmanifest",
  "/sw.js",
  "/offline.html",
];

export function isAuthPublicPath(pathname: string): boolean {
  if (pathname.startsWith("/icons/") || pathname.startsWith("/api/auth/")) return true;
  return AUTH_PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export function safeNextPath(next: string | null | undefined, fallback = "/"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("://")) {
    return fallback;
  }
  return next;
}

export function passwordResetCallbackUrl(siteUrl: string): string {
  const origin = siteUrl.replace(/\/$/, "");
  return `${origin}/auth/callback?next=/reset-password`;
}

export function signupConfirmCallbackUrl(siteUrl: string): string {
  const origin = siteUrl.replace(/\/$/, "");
  return `${origin}/auth/callback?next=/login`;
}

export function allowedAuthOrigins(siteUrl?: string): Set<string> {
  const origins = new Set(DEFAULT_ORIGINS);
  for (const candidate of [siteUrl, process.env.NEXT_PUBLIC_SITE_URL, resolveConfiguredSiteUrl()]) {
    if (!candidate) continue;
    try {
      origins.add(new URL(candidate).origin);
    } catch {
      /* ignore invalid env */
    }
  }
  return origins;
}

export function siteUrlFromRequest(request: Request, fallback = resolveConfiguredSiteUrl()): string {
  const allowed = allowedAuthOrigins(fallback);
  const fallbackOrigin = (() => {
    try {
      return new URL(fallback).origin;
    } catch {
      return resolveConfiguredSiteUrl();
    }
  })();

  for (const candidate of [request.headers.get("origin"), request.headers.get("referer")]) {
    if (!candidate) continue;
    try {
      const origin = new URL(candidate).origin;
      if (allowed.has(origin)) return origin;
    } catch {
      /* ignore */
    }
  }
  return fallbackOrigin;
}
