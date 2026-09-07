const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function parseEmailInput(raw: string): { email: string } | { error: string } {
  const email = normalizeEmail(raw);
  if (!email) {
    return { error: "이메일을 입력해 주세요." };
  }
  if (email.length > 254 || !EMAIL_RE.test(email)) {
    return { error: "이메일 형식이 올바르지 않습니다." };
  }
  return { email };
}
