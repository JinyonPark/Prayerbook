import { AUTH_MESSAGES } from "@/lib/auth/messages";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function parseEmailInput(raw: string): { email: string } | { error: string } {
  const email = normalizeEmail(raw);
  if (!email) {
    return { error: AUTH_MESSAGES.emptyEmail };
  }
  if (email.length > 254 || !EMAIL_RE.test(email)) {
    return { error: AUTH_MESSAGES.invalidEmail };
  }
  return { email };
}

export function parseMatchingEmails(email: string, confirm: string): { email: string } | { error: string } {
  const first = parseEmailInput(email);
  if ("error" in first) return first;
  const second = parseEmailInput(confirm);
  if ("error" in second || first.email !== second.email) {
    return { error: AUTH_MESSAGES.emailMismatch };
  }
  return first;
}
