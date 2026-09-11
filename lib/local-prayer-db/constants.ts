export const LOCAL_PRAYER_DB_NAME = "prayer-book-local";
export const LOCAL_PRAYER_DB_VERSION = 1;

/** New local-history app cutover. Pre-cutover complete operations stay for one-time bootstrap. */
export const LOCAL_HISTORY_CUTOVER_AT = "2026-09-09T00:00:00.000Z";

/** Server command dedup / short-lived operation window. Do not auto-retry pending events after this. */
export const LOCAL_DEDUP_TTL_MS = 48 * 60 * 60 * 1000;

export const APPLIED_EVENT_RETENTION_MS = 14 * 24 * 60 * 60 * 1000;

export const LOCAL_DEVICE_NOTICE =
  "오늘·누적 기도 횟수와 날짜별 이력은 현재 기기에 저장됩니다. 다른 기기와 자동으로 동기화되지 않습니다.";

export const LOCAL_DEVICE_HISTORY_NOTICE = "이 기도 활동 통계와 이력은 현재 기기에 저장됩니다. 다른 기기와 자동으로 동기화되지 않습니다.";

export const INITIAL_COUNT_HELP =
  "앱 사용 전에 완료한 기도 횟수가 있다면 초기값에 입력할 수 있습니다.";

export const BOOTSTRAP_FAILED_NOTICE =
  "이전 누적 기도 횟수를 자동으로 가져오지 못했습니다. 필요한 경우 누적 기도 횟수 초기값을 입력해 주세요.";

export const LOCAL_APPLY_RETRY_NOTICE =
  "기도 완료는 서버에 저장되었습니다. 이 기기의 활동 통계 저장을 다시 시도하고 있습니다.";

export const EXPIRED_PENDING_NOTICE =
  "이전 완료 요청의 기기 통계를 자동으로 맞추지 못했습니다. 서버의 기도 진행은 유지됩니다.";
