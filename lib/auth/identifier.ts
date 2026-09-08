export type AuthIdentifier =
  | { kind: "email"; email: string }
  | { kind: "loginId"; loginId: string; normalizedLoginId: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LOGIN_ID_RE = /^[0-9a-z._가-힣-]+$/iu;

export function normalizeLoginId(raw: string): string {
  return raw.normalize("NFKC").trim().toLowerCase();
}

export function parseAuthIdentifier(raw: string): AuthIdentifier | { error: string } {
  const value = raw.trim();
  if (!value) {
    return { error: "아이디 또는 이메일을 입력해 주세요." };
  }
  if (value.includes("@")) {
    const email = value.toLowerCase();
    if (!EMAIL_RE.test(email)) {
      return { error: "이메일 형식이 올바르지 않습니다." };
    }
    return { kind: "email", email };
  }
  const normalizedLoginId = normalizeLoginId(value);
  if (/\s/.test(normalizedLoginId) || normalizedLoginId.length < 3 || normalizedLoginId.length > 30 || !LOGIN_ID_RE.test(normalizedLoginId)) {
    return { error: "아이디는 3~30자의 한글, 영문, 숫자와 _, - 만 사용할 수 있습니다." };
  }
  return { kind: "loginId", loginId: value.trim(), normalizedLoginId };
}

export const SYNTHETIC_AUTH_DOMAIN = "id.prayerbook.app";

export function syntheticAuthEmail(loginId: string): string {
  return `u-${normalizeLoginId(loginId)}@${SYNTHETIC_AUTH_DOMAIN}`;
}

export function isSyntheticAuthEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith(`@${SYNTHETIC_AUTH_DOMAIN}`);
}
