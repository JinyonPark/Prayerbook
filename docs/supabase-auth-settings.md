# Supabase Auth 수동 설정

Cursor는 이 대시보드를 바꾸지 않는다. 운영자가 직접 확인하고 저장한다.

운영 Site URL: `https://prayer-book-chi.vercel.app`

## Email Provider

Authentication → Sign In / Providers → Email

- [ ] Email Provider 활성화
- [ ] Allow new users to sign up 활성화
- [ ] Confirm Email **비활성화** (코드는 Admin `createUser`로 확인된 계정을 만들므로, 꺼 두는 것이 맞다)

이 항목을 코드로 껐다고 보고하지 말 것.

## URL Configuration

Authentication → URL Configuration

Site URL:

- production: `https://prayer-book-chi.vercel.app`
- 로컬 개발: `http://localhost:3000`

Redirect URLs:

- `https://prayer-book-chi.vercel.app/auth/callback`
- `https://prayer-book-chi.vercel.app/reset-password`
- `http://localhost:3000/auth/callback`
- `http://localhost:3000/reset-password`

와일드카드를 넓게 넣지 않는다.

## Custom SMTP

비밀번호 재설정 메일을 **팀에 없는 일반 이메일**로 보내려면 Custom SMTP가 필요하다.

Authentication → SMTP Settings

- [ ] Enable Custom SMTP
- [ ] Sender name: `기도훈련집`
- [ ] Sender email: SMTP에서 인증한 주소
- [ ] Host / Port / Username / Password

SMTP 비밀번호는 Git, README, Vercel 클라이언트 환경 변수에 넣지 않는다.

현재 상태: **연결하지 않음.** Resend 도메인 인증 작업을 중단한 상태다. 기본 발송기는 프로젝트당 시간당 약 2통이며 팀 주소로만 보낼 수 있다.

도메인 인증(SPF, DKIM, DMARC)도 SMTP 공급자에서 확인한다. 미설정이다.

## Rate Limits

Authentication → Rate Limits

확인 항목:

- 이메일 발송 한도
- 비밀번호 재설정 요청 제한
- 회원가입·로그인 요청 제한

Dashboard 실제 숫자는 이 저장소에서 확인하지 못했다. Custom SMTP를 켠 뒤에도 Supabase 한도와 SMTP 업체 한도가 함께 적용된다. 값을 코드에 하드코딩하지 않는다.

## Vercel 환경 변수

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (서버 전용. 브라우저 금지)
- `NEXT_PUBLIC_SITE_URL=https://prayer-book-chi.vercel.app`

SMTP 비밀번호를 Vercel 클라이언트 변수에 넣지 않는다. `.env.local`은 Git에 커밋하지 않는다.

## 기존 미인증 사용자

Confirm Email이 켜져 있을 때 가입만 하고 인증을 못 한 사용자는 `auth.users`에 남아 로그인되지 않을 수 있다.

원칙:

- 운영 사용자를 자동 삭제하지 않는다.
- 기도 기록이 있으면 삭제하지 않는다.
- 기존 user id를 유지한다.
- 이메일을 임의로 바꾸지 않는다.

절차:

1. Authentication → Users에서 해당 이메일을 찾는다.
2. 이메일 확인 상태를 본다.
3. 데이터가 없는 테스트 계정만 수동 삭제 후 재가입을 검토한다.
4. 실제 사용자면 아래 스크립트로 **한 명씩** 확인 처리할 수 있다.

```bash
npx tsx scripts/confirm-existing-auth-user.ts <auth-user-uuid>
```

이 스크립트는 CI나 migration에서 실행하지 않는다. service role은 서버 환경에만 둔다.

## user_login_ids

기존 테이블과 로그인 API의 아이디 해석은 유지한다. 신규 이메일 가입에는 login_id 행을 만들지 않는다. 이번 작업에서 DROP하지 않는다.
