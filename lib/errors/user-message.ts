import {
  inspectError,
  isAuthFailure,
  isNetworkFailure,
  isNotFoundFailure,
  isRateLimitFailure,
} from "@/lib/errors/inspect";

export const NETWORK_USER_MESSAGE = "인터넷에 연결할 수 없습니다.\n연결 상태를 확인한 후 다시 시도해 주세요.";
export const AUTH_EXPIRED_USER_MESSAGE = "로그인 시간이 만료되었습니다.\n다시 로그인해 주세요.";
export const COMPLETE_SAVE_FAILED_MESSAGE = "기도 완료 기록을 저장하지 못했습니다.\n잠시 후 다시 시도해 주세요.";
export const PRAYER_NOT_FOUND_USER_MESSAGE = "기도 정보를 확인하지 못했습니다.\n페이지를 다시 연 후 시도해 주세요.";
export const RATE_LIMIT_USER_MESSAGE = "요청이 너무 많습니다.\n잠시 후 다시 시도해 주세요.";

export function toCompleteUserMessage(error: unknown): string {
  if (isNetworkFailure(error)) return NETWORK_USER_MESSAGE;
  if (isAuthFailure(error)) return AUTH_EXPIRED_USER_MESSAGE;
  if (isNotFoundFailure(error)) return PRAYER_NOT_FOUND_USER_MESSAGE;
  if (isRateLimitFailure(error)) return RATE_LIMIT_USER_MESSAGE;
  return COMPLETE_SAVE_FAILED_MESSAGE;
}

export function toUserMessage(error: unknown): string {
  const info = inspectError(error);
  const code = info.message.replace(/^.*code:\s*/i, "").split("\n")[0]?.trim() ?? info.message;
  const combined = `${info.code} ${code}`.toLowerCase();

  if (isNetworkFailure(error)) return NETWORK_USER_MESSAGE;
  if (isAuthFailure(error)) return AUTH_EXPIRED_USER_MESSAGE;
  if (code.includes("INVALID_COUNT") || code.includes("22023")) {
    return "완료 횟수는 0 이상의 정수만 입력할 수 있습니다.";
  }
  if (isNotFoundFailure(error) || code.includes("PRAYER_NOT_FOUND") || code.includes("P0002")) {
    return "기도문을 찾을 수 없습니다.";
  }
  if (code.includes("Invalid login credentials")) {
    return "이메일 또는 비밀번호를 확인해 주세요.";
  }
  if (
    combined.includes("email_exists") ||
    combined.includes("user_already_exists") ||
    combined.includes("already registered") ||
    combined.includes("already been registered") ||
    combined.includes("user already exists")
  ) {
    return "이미 가입된 아이디 또는 이메일입니다.";
  }
  if (code.includes("23505") || combined.includes("duplicate key")) {
    return "이미 저장된 이름입니다.";
  }
  if (code.includes("Password should be")) {
    return "비밀번호는 최소 8자 이상 입력해 주세요.";
  }
  if (code.includes("Email not confirmed")) {
    return "이메일 인증이 완료되지 않았습니다.\n가입 시 입력한 이메일에서 인증 링크를 확인해 주세요.";
  }
  if (isRateLimitFailure(error)) return RATE_LIMIT_USER_MESSAGE;

  return "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}
