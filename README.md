# 기도훈련집

기존 [기도훈련집](https://52-prayer-trainning-book.neocities.org/)의 기도문을 기반으로, 사용자별 완료 횟수와 읽기 위치를 서버에 저장하는 반응형 PWA 웹앱입니다.

## 주요 기능

- 이메일 회원가입, 로그인, 비밀번호 재설정, 로그아웃, 회원 탈퇴
- 기본 기도 1~27번과 추가 기도 3개(소원 기도, 태신자 기도, 영적 대적 기도)
- 기도 완료 버튼으로만 횟수 증가
- Total N독 = 기본 기도 27개 완료 횟수의 최솟값
- 마지막 읽은 항목과 스크롤 비율 저장, 이어 기도하기
- 주간/야간 모드, 글자 크기, 줄 간격
- 항목별 횟수 수정/초기화, 현재 독수 초기화, 기본 기도 전체 초기화, 모든 기록 초기화, 일괄 설정
- 변경 이력
- 설치 가능한 PWA, 기기별 설치 안내
- 오프라인에서 캐시된 기도문 읽기(완료 저장은 온라인만)

## 기술 스택

- Next.js App Router, TypeScript strict, Tailwind CSS
- Supabase Auth, PostgreSQL, Row Level Security, RPC
- Zod 입력 검증
- Vitest 단위 테스트, Playwright E2E
- Vercel 배포 가능한 구조
- 설치 가능한 PWA(Web App Manifest + 직접 작성한 Service Worker)

PWA에 폐기된 `next-pwa` 패키지를 사용하지 않았습니다. 인증 응답과 진행 데이터 API를 캐시하지 않기 위해 Service Worker를 `public/sw.js`에 직접 구현했습니다.

## 디렉터리 구조

```
app/                 # App Router 페이지와 API
components/          # UI, 대시보드, 기도, 설정, PWA
content/prayers/     # 저장된 기도문 Markdown과 원본 HTML
lib/                 # 계산, 검증, Supabase, PWA
scripts/             # import, 검증, 아이콘 생성
supabase/            # migration, seed
tests/unit|e2e       # 테스트
public/              # manifest, Service Worker, 아이콘
```

## 요구 Node.js 버전

Node.js 22 이상이 필요합니다. `@supabase/supabase-js` 최신 버전이 Node 20 지원을 종료했기 때문입니다. Vercel에서는 Node 22.x를 사용하세요.

## 의존성 설치

```bash
npm install
```

## 개발 서버

```bash
npm run dev
```

브라우저에서 `http://localhost:3000`으로 접속합니다.

## 환경 변수

`.env.example`을 복사해 `.env.local`을 만듭니다. `.env.local`은 Git에 커밋하지 않습니다.

```bash
copy .env.example .env.local
```

| 변수 | 설명 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL. 클라이언트에 포함됩니다. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key. 클라이언트에 포함됩니다. |
| `SUPABASE_SERVICE_ROLE_KEY` | 서버 전용. 회원 탈퇴 Route Handler에서만 사용합니다. 브라우저에 노출하지 않습니다. |
| `NEXT_PUBLIC_SITE_URL` | 로컬은 `http://localhost:3000`, 배포 시 `https://your-domain.vercel.app` |

환경 변수가 없으면 로그인 화면에 설정 안내를 표시합니다. 빌드 시 실제 비밀값을 요구하도록 하드코딩하지 않았습니다.

## Supabase 프로젝트 생성

1. [Supabase](https://supabase.com)에서 프로젝트를 만듭니다.
2. Project Settings → API에서 URL, anon key, service role key를 복사합니다.
3. Authentication → Providers에서 Email을 활성화합니다.

## SQL migration 적용

Supabase CLI를 사용하는 경우:

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push
```

대시보드를 사용하는 경우 SQL Editor에서 다음 파일을 순서대로 실행합니다.

1. `supabase/migrations/20240904000001_create_tables.sql`
2. `supabase/migrations/20240904000002_rls.sql`
3. `supabase/migrations/20240904000003_rpc_complete_and_edit.sql`
4. `supabase/migrations/20240904000004_rpc_resets.sql`

## seed 적용

```bash
npm run import:prayers
```

생성된 `supabase/seed.sql`을 SQL Editor에서 실행하거나:

```bash
npx supabase db execute --file supabase/seed.sql
```

## 기존 기도문 import

원본 HTML은 `content/prayers/source/`에 저장되어 있습니다. 런타임에는 Neocities HTML을 렌더링하지 않습니다.

```bash
npm run import:prayers
npm run validate:prayers
```

네트워크에서 다시 가져오려면:

```bash
npm run import:prayers -- --from-network
```

원문을 가져오지 못하면 내용을 추측하지 않고 실패합니다.

## Supabase Auth redirect URL

Authentication → URL Configuration에 다음을 등록합니다.

로컬:

- Site URL: `http://localhost:3000`
- Redirect URLs: `http://localhost:3000/auth/callback`, `http://localhost:3000/auth/update-password`

Vercel:

- Site URL: `https://your-domain.vercel.app`
- Redirect URLs:
  - `https://your-domain.vercel.app/auth/callback`
  - `https://your-domain.vercel.app/auth/update-password`
  - `https://your-domain.vercel.app/login`

비밀번호 재설정 메일의 redirect는 `NEXT_PUBLIC_SITE_URL/auth/callback?next=/auth/update-password`입니다.
메일 링크를 열면 새 비밀번호를 입력하는 화면으로 이동합니다.

## 로컬 테스트

```bash
npm run test
npm run test:e2e
```

인증/RLS 통합 테스트는 실제 Supabase 환경 변수가 있을 때만 가능합니다.

## lint / typecheck / 단위 테스트 / Playwright / production build

```bash
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
```

Playwright 최초 실행 전:

```bash
npx playwright install chromium
```

## Vercel 배포

1. 이 저장소를 Vercel에 연결합니다.
2. Environment Variables에 `.env.example`과 같은 키를 등록합니다. `NEXT_PUBLIC_SITE_URL`은 배포 URL로 설정합니다.
3. Supabase Auth redirect에 배포 URL을 추가합니다.
4. Framework Preset은 Next.js입니다.

## PWA 설치

브라우저에서 앱을 그대로 사용할 수 있습니다. 설치는 선택입니다.

- 프로그래밍 방식 설치 프롬프트가 있는 브라우저에서만 `앱 설치` 버튼이 활성화됩니다.
- iPhone/iPad는 공유 메뉴 → 홈 화면에 추가를 안내합니다.
- Windows Chrome/Edge는 주소창 또는 브라우저 메뉴의 앱 설치를 안내합니다.
- 기기에 각각 설치해야 합니다.
- 앱을 삭제해도 서버의 기도 기록은 삭제되지 않습니다. 다시 설치하고 같은 계정으로 로그인하면 기록이 복원됩니다.

임시 아이콘은 `public/icons/`에 있습니다. 원본 사이트에 로고가 없어 교체하기 쉬운 임시 아이콘으로 분리했습니다.

```bash
npm run generate:icons
```

## 데이터베이스 구조

- `profiles` 사용자 프로필
- `prayer_items` 기도문 카탈로그
- `user_prayer_progress` 항목별 완료 횟수. 행이 없으면 0회
- `user_reading_state` 마지막 기도 항목과 `scroll_ratio`(0~1)
- `user_preferences` 테마, 글자 크기, 줄 간격
- `prayer_progress_operations` / `prayer_progress_operation_items` 변경 이력

완료 횟수 쓰기는 클라이언트 직접 update가 아니라 RPC만 사용합니다.

## Total N독 계산 방식

```
totalCompleted = min(itemCount[1] ... itemCount[27])
currentRound = totalCompleted + 1
currentCompletedCount = itemCount[i] >= currentRound 인 기본 기도 개수
progressPercent = currentCompletedCount / 27 * 100
```

추가 기도는 Total 계산에서 제외합니다. Total 컬럼을 따로 증가시키지 않습니다.

## 완료 횟수 수정 및 초기화

설정 → 기도 횟수 관리에서 다음을 수행합니다.

- 항목별 수정: 0 이상의 정수만 허용
- 항목별 0회 초기화
- 현재 진행 독수 초기화: `completion_count > totalCompleted`인 기본 기도만 `totalCompleted`로 내림
- 기본 기도 전체 초기화: 확인 문구 `초기화` 입력
- 모든 기록 초기화: 확인 문구 `모든 기록 초기화` 입력. 회원 탈퇴와 별도
- 기본 기도 일괄 설정: 1~27번을 같은 횟수로 덮어씀

모든 변경은 `client_event_id`로 중복 적용을 막습니다.

## 오프라인에서 완료 저장이 제한되는 이유

1차 버전은 오프라인 큐와 자동 동기화를 구현하지 않습니다. 저장되지 않은 값을 저장된 것처럼 보여주지 않기 위해, 완료 버튼은 온라인에서만 동작합니다. 이전에 불러온 기도문 HTML/정적 자원은 Service Worker가 캐시하여 읽을 수 있습니다. 사용자 진행 API와 Supabase 쓰기 요청은 캐시하지 않습니다.
