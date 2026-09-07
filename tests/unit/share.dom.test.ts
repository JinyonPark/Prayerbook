import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  APP_PUBLIC_URL,
  DAILY_SHARE_TITLE,
  dailySharePayload,
  formatDailyCopyText,
  formatDailyPreviewText,
  formatDailyShareText,
  shareTextContainsForbiddenPersonalData,
  type DailyPrayerSummary,
} from "@/lib/progress/daily";
import { copyTextToClipboard, isAbortError, shareOrCopyText } from "@/lib/progress/clipboard";

const summary: DailyPrayerSummary = {
  local_date: "2026-09-07",
  time_zone: "Asia/Seoul",
  total_completion_count: 7,
  unique_prayer_count: 5,
  main_prayer_completion_count: 6,
  supplementary_prayer_completion_count: 1,
  items: [
    {
      prayer_item_id: "wish",
      prayer_title: "소원 기도",
      item_number: 27,
      category: "main",
      completion_count: 1,
    },
  ],
};

const progress = {
  totalCompleted: 3,
  currentRound: 4,
  currentCompletedCount: 8,
  eligibleCount: 26,
};

const personal = [
  "user@example.com",
  "login_id_jin",
  "박진영",
  "하준",
  "김태신",
  "건강하게 해주세요",
  "용서할사람",
  "어머니",
  "허리디스크",
  "auth-user-uuid-1234",
];

describe("오늘 기록 복사 및 공유 텍스트", () => {
  it("복사 텍스트에 날짜, 오늘 횟수, Total, 동적 진행률, URL을 포함한다", () => {
    const text = formatDailyCopyText(summary, progress);
    expect(text).toContain(DAILY_SHARE_TITLE);
    expect(text).toContain("2026년 9월 7일");
    expect(text).toContain("오늘 총 7회 기도했습니다.");
    expect(text).toContain("완료한 기도 항목: 5개");
    expect(text).toContain("Total 3독 완료");
    expect(text).toContain("4독 진행 중 8 / 26");
    expect(text).toContain(APP_PUBLIC_URL);
    expect(text).not.toContain("/ 27");
  });

  it("공유 텍스트에 title/url 분리용 본문만 넣고 항목 목록은 넣지 않는다", () => {
    const payload = dailySharePayload(summary, progress);
    expect(payload.title).toBe(DAILY_SHARE_TITLE);
    expect(payload.url).toBe(APP_PUBLIC_URL);
    expect(payload.text).toContain("2026년 9월 7일");
    expect(payload.text).toContain("오늘 총 7회 기도했습니다.");
    expect(payload.text).toContain("Total 3독 완료");
    expect(payload.text).toContain("4독 진행 중 8 / 26");
    expect(payload.text).not.toContain("소원 기도");
    expect(formatDailyPreviewText(summary, progress)).not.toContain("건강하게");
  });

  it("개인 이름, 소원, 질병명, 이메일, login_id를 포함하지 않는다", () => {
    const copy = formatDailyCopyText(summary, progress);
    const share = formatDailyShareText(summary, progress);
    const preview = formatDailyPreviewText(summary, progress);
    for (const text of [copy, share, preview]) {
      expect(shareTextContainsForbiddenPersonalData(text, personal)).toBe(false);
      expect(text).not.toContain("user@example.com");
      expect(text).not.toContain("login_id_jin");
      expect(text).not.toContain("허리디스크");
      expect(text).not.toContain("건강하게 해주세요");
    }
  });
});

describe("Clipboard 및 Web Share", () => {
  const originalClipboard = navigator.clipboard;
  const originalShare = navigator.share;
  const originalExec = document.execCommand;

  beforeEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  afterEach(() => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: originalClipboard });
    Object.defineProperty(navigator, "share", { configurable: true, value: originalShare });
    document.execCommand = originalExec;
    vi.restoreAllMocks();
  });

  it("Clipboard API 성공 시 true를 반환한다", async () => {
    await expect(copyTextToClipboard("hello")).resolves.toBe(true);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("hello");
  });

  it("Clipboard API 실패 시 fallback execCommand를 수행한다", async () => {
    vi.mocked(navigator.clipboard.writeText).mockRejectedValue(new Error("denied"));
    document.execCommand = vi.fn().mockReturnValue(true);
    await expect(copyTextToClipboard("hello")).resolves.toBe(true);
    expect(document.execCommand).toHaveBeenCalledWith("copy");
  });

  it("navigator.share 지원 환경에서 올바른 payload를 전달한다", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { configurable: true, value: share });
    const payload = dailySharePayload(summary, progress);
    await expect(shareOrCopyText(payload)).resolves.toBe("shared");
    expect(share).toHaveBeenCalledWith({
      title: payload.title,
      text: payload.text,
      url: payload.url,
    });
  });

  it("사용자가 공유를 취소하면 오류로 처리하지 않는다", async () => {
    const abort = new DOMException("The user aborted a request.", "AbortError");
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: vi.fn().mockRejectedValue(abort),
    });
    await expect(shareOrCopyText(dailySharePayload(summary, progress))).resolves.toBe("cancelled");
    expect(isAbortError(abort)).toBe(true);
  });

  it("실제 공유 실패 후 복사도 실패하면 failed를 반환한다", async () => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: vi.fn().mockRejectedValue(new Error("share failed")),
    });
    vi.mocked(navigator.clipboard.writeText).mockRejectedValue(new Error("denied"));
    document.execCommand = vi.fn().mockReturnValue(false);
    await expect(shareOrCopyText(dailySharePayload(summary, progress))).resolves.toBe("failed");
  });

  it("Web Share 미지원이면 복사 fallback을 사용한다", async () => {
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
    await expect(shareOrCopyText(dailySharePayload(summary, progress))).resolves.toBe("copied");
  });

  it("카카오톡 인앱처럼 share가 던지더라도 앱이 멈추지 않고 복사한다", async () => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: vi.fn().mockRejectedValue(new Error("not allowed")),
    });
    await expect(shareOrCopyText(dailySharePayload(summary, progress))).resolves.toBe("copied");
  });
});
