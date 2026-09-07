export const AUTH_MESSAGES = {
  loginFailed: "이메일 또는 비밀번호를 확인해 주세요.",
  network: "서버에 연결할 수 없습니다.\n인터넷 연결을 확인한 후 다시 시도해 주세요.",
  rateLimit: "요청이 너무 많습니다.\n잠시 후 다시 시도해 주세요.",
  unconfirmed:
    "이메일 인증이 완료되지 않았습니다.\n가입 시 입력한 이메일에서 인증 링크를 확인해 주세요.",
  signupCheckEmail:
    "회원가입 확인 메일을 보냈습니다.\n입력한 이메일의 받은편지함을 확인하고 인증 링크를 눌러 회원가입을 완료해 주세요.\n메일이 보이지 않으면 스팸 또는 프로모션함도 확인해 주세요.",
  resetSent:
    "입력한 이메일이 가입된 계정이라면 비밀번호 재설정 링크를 보냈습니다.\n메일이 오지 않는 경우 이메일 주소와 스팸 또는 프로모션함을 확인해 주세요.\n가입한 적이 없다면 회원가입을 진행해 주세요.",
  resetLinkInvalid:
    "비밀번호 재설정 링크가 만료되었거나 이미 사용된 링크입니다.\n새로운 재설정 링크를 요청해 주세요.",
  passwordMismatch: "새 비밀번호와 비밀번호 확인이 일치하지 않습니다.",
  passwordTooShort: "비밀번호는 최소 8자 이상 입력해 주세요.",
  passwordChanged: "비밀번호가 변경되었습니다.\n새 비밀번호로 다시 로그인해 주세요.",
  otherEmail:
    "다른 이메일로 가입했다면 가입에 사용한 이메일 주소로 다시 시도해 주세요.",
  invalidEmail: "이메일 형식이 올바르지 않습니다.",
  emptyEmail: "이메일을 입력해 주세요.",
  emptyPassword: "비밀번호를 입력해 주세요.",
  configMissing: "서버 연결 정보가 없습니다. README의 환경 변수 안내를 확인해 주세요.",
  cooldown: (seconds: number) => `${seconds}초 후 다시 보낼 수 있습니다.`,
} as const;

export const MAIL_COOLDOWN_SECONDS = 60;
export const MAIL_COOLDOWN_COOKIE = "pb_mail_cooldown";
