function errorCode(error: unknown): string {
  if (typeof error === "object" && error && "code" in error) {
    return String((error as { code: unknown }).code);
  }
  return "";
}

export function toUserMessage(error: unknown): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error
        ? String((error as { message: unknown }).message)
        : String(error);

  const code = raw.replace(/^.*code:\s*/i, "").split("\n")[0]?.trim() ?? raw;
  const combined = `${errorCode(error)} ${code}`.toLowerCase();

  if (code.includes("NOT_AUTHENTICATED") || code.includes("28000") || code.includes("42501")) {
    return "로그인이 필요합니다.";
  }
  if (code.includes("INVALID_COUNT") || code.includes("22023")) {
    return "완료 횟수는 0 이상의 정수만 입력할 수 있습니다.";
  }
  if (code.includes("PRAYER_NOT_FOUND") || code.includes("P0002")) {
    return "기도문을 찾을 수 없습니다.";
  }
  if (code.includes("Failed to fetch") || code.includes("NetworkError") || code.includes("fetch")) {
    return "인터넷 연결을 확인해 주세요.";
  }
  if (code.includes("Invalid login credentials")) {
    return "아이디/이메일 또는 비밀번호가 올바르지 않습니다.";
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
    return "비밀번호는 6자 이상이어야 합니다.";
  }
  if (code.includes("Email not confirmed")) {
    return "이메일 인증을 완료한 뒤 로그인해 주세요.";
  }
  if (code.includes("For security purposes")) {
    return "요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.";
  }

  return "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}
