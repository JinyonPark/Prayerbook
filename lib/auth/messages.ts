export const AUTH_MESSAGES = {
  loginFailed: "이메일 또는 비밀번호를 확인해 주세요.",
  network: "서버에 연결할 수 없습니다.\n인터넷 연결을 확인한 후 다시 시도해 주세요.",
  rateLimit: "요청이 너무 많습니다.\n잠시 후 다시 시도해 주세요.",
  rateLimitWait: (seconds: number) => `요청이 너무 많습니다.\n${seconds}초 후 다시 시도해 주세요.`,
  unconfirmed: "이메일 인증이 완료되지 않은 계정입니다.\n관리자에게 문의해 주세요.",
  signupComplete: "회원가입이 완료되었습니다.\n기도훈련집을 시작합니다.",
  signupHint:
    "비밀번호를 잊었을 때 재설정 메일을 받을 수 있도록\n실제로 사용하는 이메일 주소를 정확하게 입력해 주세요.",
  signupEmailUsed: (email: string) =>
    `가입 이메일:\n${email}\n\n비밀번호 재설정에 사용되는 이메일입니다.\n주소가 정확한지 확인해 주세요.`,
  alreadyRegistered: "이미 가입된 이메일일 수 있습니다.\n로그인하거나 비밀번호 재설정을 이용해 주세요.",
  signupDisabled: "현재 회원가입을 진행할 수 없습니다.\n관리자에게 문의해 주세요.",
  emailProviderDisabled: "이메일 회원가입을 사용할 수 없습니다.\n관리자에게 문의해 주세요.",
  signupFailed: "회원가입을 완료하지 못했습니다.\n잠시 후 다시 시도해 주세요.",
  signupSessionFailed: "회원가입 세션을 생성하지 못했습니다.\n잠시 후 다시 시도해 주세요.",
  emailMismatch: "이메일 주소가 일치하지 않습니다.",
  passwordMismatchSignup: "비밀번호와 비밀번호 확인이 일치하지 않습니다.",
  resetSent:
    "입력한 이메일이 가입된 계정이라면\n비밀번호 재설정 링크를 보냈습니다.\n\n메일이 보이지 않으면 다음을 확인해 주세요.\n\n· 이메일 주소를 정확히 입력했는지 확인해 주세요.\n· 스팸 또는 프로모션함을 확인해 주세요.\n· 가입할 때 사용한 이메일인지 확인해 주세요.",
  resetLinkInvalid:
    "비밀번호 재설정 링크가 만료되었거나\n이미 사용된 링크입니다.\n\n새로운 재설정 링크를 요청해 주세요.",
  passwordMismatch: "새 비밀번호와 비밀번호 확인이 일치하지 않습니다.",
  passwordTooShort: "비밀번호는 최소 8자 이상 입력해 주세요.",
  passwordChanged: "비밀번호가 변경되었습니다.\n새 비밀번호로 다시 로그인해 주세요.",
  otherEmail: "가입할 때 사용한 이메일을 입력해 주세요.",
  noRecovery:
    "복구 수단이 등록되어 있지 않습니다.\n로그인 가능한 상태에서 이메일 또는 소셜 계정을 연결해 주세요.",
  invalidEmail: "올바른 이메일 주소를 입력해 주세요.",
  emptyEmail: "이메일을 입력해 주세요.",
  emptyPassword: "비밀번호를 입력해 주세요.",
  configMissing: "서버 연결 정보가 없습니다. README의 환경 변수 안내를 확인해 주세요.",
  confirmationMailDisabled: "이메일 인증 메일은 더 이상 사용하지 않습니다.",
  cooldown: (seconds: number) => `${seconds}초 후 다시 보낼 수 있습니다.`,
} as const;

export const MAIL_COOLDOWN_SECONDS = 60;
export const MAIL_COOLDOWN_COOKIE = "pb_mail_cooldown";
export const RESET_COOLDOWN_STORAGE_KEY = "pb_reset_cooldown_until";
