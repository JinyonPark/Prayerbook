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
- 날짜별·월별 기도 이력(기기 로컬 숨김)
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
| `NEXT_PUBLIC_SITE_URL` | 로컬은 `http://localhost:3000`, 배포는 `https://prayer-book-chi.vercel.app` |

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
5. 이후 `supabase/migrations/`의 날짜순 파일 전부. 저장 구조 최적화는 `20240909000014`부터 `20240909000016`입니다. 날짜별·월별 이력은 `20240909000024_history_code_monthly.sql`입니다.

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
- Redirect URLs:
  - `http://localhost:3000/auth/callback`
  - `http://localhost:3000/auth/callback/**`
  - `http://localhost:3000/reset-password`
  - `http://localhost:3000/login`

Vercel production:

- Site URL: `https://prayer-book-chi.vercel.app`
- Redirect URLs:
  - `https://prayer-book-chi.vercel.app/auth/callback`
  - `https://prayer-book-chi.vercel.app/auth/callback/**`
  - `https://prayer-book-chi.vercel.app/reset-password`
  - `https://prayer-book-chi.vercel.app/login`

비밀번호 재설정 메일의 redirect는 `{SITE_URL}/auth/callback?next=/reset-password`입니다.
회원가입 확인 메일은 `{SITE_URL}/auth/callback?next=/login`입니다.

### 대시보드에서 직접 확인할 항목

- Email provider 활성화
- Confirm signup / Reset password 이메일 템플릿
- Custom SMTP: 운영에서는 기본 테스트 메일 제한(시간당 약 2통)에만 의존하지 마세요. SMTP가 없으면 메일이 스팸함으로 가거나 발송이 거절될 수 있습니다.
- 발신자 이름과 발신 이메일(SMTP 사용 시)

### Vercel 환경 변수

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (서버 전용)
- `NEXT_PUBLIC_SITE_URL=https://prayer-book-chi.vercel.app`

production 메일 링크에 `localhost`가 들어가면 `NEXT_PUBLIC_SITE_URL`이 잘못된 것입니다.

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
- `prayer_items` 기도문 카탈로그. `history_code`는 이력 JSON 키용 짧은 코드이며 한 번 배정하면 바꾸지 않습니다
- `user_prayer_progress` 항목별 완료 횟수. 행이 없으면 0회. 영구 보관
- `user_daily_prayer_stats` 사용자당 하루 1행 기도 완료 집계. 최근 30일 상세
- `user_monthly_prayer_stats` 사용자당 월 1행 기도 완료 집계. 최근 12개월
- `user_prayer_totals` 실제 완료 활동 누적. 사용자당 1행. 영구 보관
- `prayer_command_dedup` 요청 중복 방지. 최근 48시간
- `user_reading_state` 마지막 기도 항목과 `scroll_ratio`(0~1)
- `user_preferences` 테마, 글자 크기, 줄 간격, 시간대
- `prayer_progress_operations` / `prayer_progress_operation_items` 횟수 수정·초기화 감사 이력. 최근 90일. 완료 버튼은 신규 저장하지 않음
- `user_prayer_inputs` 이름·중보·소원 등 입력값. `save_prayer_inputs` RPC로만 저장

완료 횟수 쓰기는 클라이언트 직접 update가 아니라 RPC만 사용합니다.

이력 화면의 날짜 삭제와 전체 삭제는 이 기기 localStorage만 바꿉니다. Supabase 횟수와 Total은 그대로입니다.

보관 기간 정리는 스케줄이 연결되어 있지 않습니다. 관리자가 필요할 때 서비스 롤로 실행합니다.

용량 점검 SQL은 `supabase/diagnostics/history-storage.sql`입니다.

운영 DB 용량 기준(사용자 화면에는 표시하지 않음):

- 약 300MB: 사용량 점검
- 약 350MB: 보관 정책과 DAU 재검토
- 약 400MB: 즉시 정리 및 유료 플랜 검토
- 무료 한도에 가까워질 때까지 정리를 미루지 않음

```bash
npx tsx scripts/purge-prayer-storage.ts
```

이 스크립트는 `auth.uid()`가 없는 서비스 롤에서 `purge_prayer_storage()`를 호출합니다. 레거시 complete 이력은 삭제하지 않습니다. 검증 후 별도로 `purge_legacy_complete_operations()`를 실행해야 합니다.

## Total N독 계산 방식

배우자 기도를 선택하기 전에는 기존처럼 기본 기도 1~27번으로 계산합니다.

선택한 뒤에는 진행률에 넣는 항목만 사용합니다.

```
eligiblePrayerItems = counts_toward_total이 true이고 사용자 설정으로 제외되지 않은 항목
totalCompleted = eligiblePrayerItems completion_count의 최솟값
currentRound = totalCompleted + 1
currentCompletedCount = completion_count >= currentRound 인 eligible 항목 수
progressPercent = currentCompletedCount / eligibleCount * 100
```

남편을 위한 기도를 선택하면 10번 아내를 위한 기도는 분모에서 빠집니다. 아내를 위한 기도를 선택하면 9번이 빠집니다. 제외된 항목의 완료 횟수는 삭제되지 않습니다.

## 모바일 상태 표시줄 수동 확인

DOM 테스트만으로 시스템 아이콘이 보인다고 단정하지 않습니다. 아래 환경에서 시간과 배터리 아이콘을 직접 확인하세요.

- [ ] Android Chrome 일반 브라우저 / 주간
- [ ] Android Chrome 일반 브라우저 / 야간
- [ ] Android 설치형 PWA / 주간
- [ ] Android 설치형 PWA / 야간
- [ ] 카카오톡 인앱 브라우저 / 주간
- [ ] 카카오톡 인앱 브라우저 / 야간
- [ ] 앱 완전 종료 후 재실행
- [ ] 세로·가로 전환

확인 항목: 시간, 배터리, Wi-Fi, safe-area 배경, 테마 변경 반영, 헤더와 상태 표시줄 색 단절.

## 카카오톡 설치 안내창 수동 확인

Playwright는 visual viewport를 흉내 낼 수 있지만 카카오톡 앱 UI는 자동 테스트할 수 없습니다.

- [ ] 안내창 상단이 URL 표시 영역 아래에 보임
- [ ] 닫기 버튼이 보임
- [ ] 하단 확인/닫기 버튼이 도구 모음에 가려지지 않음
- [ ] 긴 안내는 내부 스크롤
- [ ] 닫은 뒤 원래 스크롤 위치 유지
- [ ] 세로·가로 전환 후 안내창 재배치


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
