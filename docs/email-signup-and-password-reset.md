# 이메일 회원가입과 비밀번호 재설정

운영 앱: https://prayer-book-chi.vercel.app/

## 최종 인증 정책

- 회원 아이디는 이메일 주소다. 신규 가입에 별도 일반 아이디를 만들지 않는다.
- 회원가입 시 인증 메일을 보내지 않는다. 성공하면 바로 로그인되어 홈으로 이동한다.
- 이메일은 비밀번호를 잊었을 때만 사용한다.
- 재설정 링크를 연 사용자만 새 비밀번호를 설정할 수 있다.
- 기존 `auth.users` id와 기도 기록은 유지한다.

## 회원가입 흐름

1. `/signup`에서 이메일, 이메일 확인, 비밀번호, 비밀번호 확인을 입력한다.
2. 클라이언트와 `/api/auth/register`가 입력값을 검증한다.
3. 서버가 Auth Admin `createUser({ email_confirm: true })`로 확인된 계정을 만든다. 가입 확인 메일은 보내지 않는다.
4. 같은 요청에서 `signInWithPassword`로 세션 쿠키를 저장한다.
5. 홈으로 이동한다. `handle_new_user` trigger가 `profiles`, `user_preferences`, `user_reading_state`를 만든다.

가입 중 `auth.resend`와 `emailRedirectTo`를 사용하지 않는다.

## 로그인 흐름

- `/login`에서 이메일과 비밀번호로 로그인한다.
- 기존 `user_login_ids`가 있는 계정은 서버가 예전 아이디도 해석할 수 있다. 신규 가입에는 login_id를 만들지 않는다.
- 실패 문구는 기본적으로 `이메일 또는 비밀번호를 확인해 주세요.`이다.
- Confirm Email이 켜져 있던 시절의 미인증 계정은 로그인되지 않을 수 있다. 그때는 관리자 안내를 표시한다. 인증 메일 재전송 버튼은 없다.

## 비밀번호 재설정 흐름

1. `/forgot-password`에 이메일을 입력한다.
2. `/api/auth/reset`이 `resetPasswordForEmail`을 호출한다. redirect는 `{SITE_URL}/auth/callback?next=/reset-password`이다.
3. 가입 여부와 관계없이 같은 안내를 보여 준다.
4. 메일의 링크는 `/auth/callback`에서 PKCE code를 세션으로 바꾼 뒤 `/reset-password`로 보낸다.
5. `/api/auth/update-password`가 `updateUser({ password })` 후 로그아웃한다.
6. 사용자는 새 비밀번호로 다시 로그인한다. user id와 기도 기록은 그대로다.

재전송은 60초 cooldown과 `pb_mail_cooldown` 쿠키로 제한한다.

## 장애 시 오류 코드

브라우저 Network에서 `/api/auth/register`, `/api/auth/login`, `/api/auth/reset`, `/auth/v1/signup`을 확인한다.

| 코드 | 의미 |
| --- | --- |
| `already_registered` / `email_exists` | 이미 있는 이메일 |
| `no_session` | 계정은 만들었으나 세션 쿠키를 못 만듦 |
| `email_send_unexpected` | 가입 경로에서 메일을 보내려다 실패. Confirm Email·Hook 확인 |
| `over_email_send_rate_limit` | 기본 메일 한도. 재설정 메일에 Custom SMTP 필요 |
| `email_address_not_authorized` | 기본 SMTP가 팀 주소만 허용 |
| `signup_disabled` | 신규 가입 비활성 |
| `unconfirmed` | 예전 미인증 계정 |

비밀번호, access token, refresh token은 로그에 남기지 않는다.

## 테스트 방법

```bash
npm run test
npm run test:e2e
```

실제 신규 가입·재설정 메일 수신은 아래 환경 변수가 있을 때만 수행한다.

- `E2E_TEST_USER_EMAIL` / `E2E_TEST_USER_PASSWORD`
- `E2E_NEW_USER_EMAIL` / `E2E_NEW_USER_PASSWORD` (아직 없는 주소)
- `E2E_RESET_NEW_PASSWORD`
- `E2E_UNREGISTERED_EMAIL`

## 운영 배포 체크리스트

1. 이 문서와 `docs/supabase-auth-settings.md`의 Dashboard 항목을 확인한다.
2. Vercel `NEXT_PUBLIC_SITE_URL=https://prayer-book-chi.vercel.app`
3. production 재설정 링크에 `localhost`가 없어야 한다.
4. Custom SMTP가 없으면 일반 사용자에게 재설정 메일이 가지 않을 수 있다.
5. 자동 가입 공격이 늘면 Authentication에 CAPTCHA를 검토한다.

기존 미인증 사용자 처리: `docs/supabase-auth-settings.md`.
