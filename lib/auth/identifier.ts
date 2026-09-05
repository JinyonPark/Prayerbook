export type AuthIdentifier =
  | { kind: "email"; email: string }
  | { kind: "loginId"; loginId: string };

const LOGIN_ID_RE = /^[a-z0-9][a-z0-9._-]{2,19}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  const loginId = value.toLowerCase();
  if (!LOGIN_ID_RE.test(loginId)) {
    return { error: "아이디는 3~20자의 영문, 숫자와 ., _, - 만 사용할 수 있습니다." };
  }
  return { kind: "loginId", loginId };
}

export function syntheticAuthEmail(loginId: string): string {
  return `u-${loginId}@id.prayerbook.app`;
}
