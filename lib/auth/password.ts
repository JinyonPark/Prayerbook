export const MIN_NEW_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 72;
export const MIN_LOGIN_PASSWORD_LENGTH = 6;

export function validateNewPassword(password: string, confirm: string): string | null {
  const value = password;
  if (!value) return "비밀번호를 입력해 주세요.";
  if (value.length < MIN_NEW_PASSWORD_LENGTH) {
    return "비밀번호는 최소 8자 이상 입력해 주세요.";
  }
  if (value.length > MAX_PASSWORD_LENGTH) {
    return "비밀번호가 너무 깁니다.";
  }
  if (value !== confirm) {
    return "새 비밀번호와 비밀번호 확인이 일치하지 않습니다.";
  }
  return null;
}
