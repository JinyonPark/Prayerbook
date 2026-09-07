export const PRODUCTION_ORIGIN = "https://prayer-book-chi.vercel.app";

export function originFromUrl(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function resolveConfiguredSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) {
    return originFromUrl(explicit) ?? PRODUCTION_ORIGIN;
  }
  if (process.env.VERCEL_ENV === "production") {
    return PRODUCTION_ORIGIN;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/^https?:\/\//, "")}`;
  }
  return "http://localhost:3000";
}
