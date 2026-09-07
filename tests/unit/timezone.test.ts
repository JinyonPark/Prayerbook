import { describe, expect, it } from "vitest";
import {
  detectBrowserTimeZone,
  formatKoreanDate,
  isInstantInLocalDate,
  localDateString,
  msUntilNextMidnight,
  normalizeTimeZone,
  zonedDayRangeUtc,
} from "@/lib/progress/timezone";

describe("사용자 시간대", () => {
  it("유효하지 않은 시간대는 Asia/Seoul로 되돌린다", () => {
    expect(normalizeTimeZone("Not/A_Zone")).toBe("Asia/Seoul");
    expect(normalizeTimeZone("")).toBe("Asia/Seoul");
    expect(normalizeTimeZone(null)).toBe("Asia/Seoul");
  });

  it("한국 날짜를 0시부터 다음날 0시 전까지 계산한다", () => {
    const { start, end } = zonedDayRangeUtc("2026-09-07", "Asia/Seoul");
    expect(start.toISOString()).toBe("2026-09-06T15:00:00.000Z");
    expect(end.toISOString()).toBe("2026-09-07T15:00:00.000Z");
    expect(isInstantInLocalDate("2026-09-06T15:00:00.000Z", "2026-09-07", "Asia/Seoul")).toBe(true);
    expect(isInstantInLocalDate("2026-09-07T14:59:59.999Z", "2026-09-07", "Asia/Seoul")).toBe(true);
    expect(isInstantInLocalDate("2026-09-07T15:00:00.000Z", "2026-09-07", "Asia/Seoul")).toBe(false);
  });

  it("표시 날짜는 사용자 시간대 연월일이다", () => {
    expect(formatKoreanDate("2026-09-07")).toBe("2026년 9월 7일");
    expect(localDateString(new Date("2026-09-06T16:00:00.000Z"), "Asia/Seoul")).toBe("2026-09-07");
    expect(localDateString(new Date("2026-09-06T16:00:00.000Z"), "UTC")).toBe("2026-09-06");
  });

  it("다음 자정까지 남은 시간이 초 단위 폴링이 아니다", () => {
    const now = new Date("2026-09-06T16:00:00.000Z");
    const wait = msUntilNextMidnight(now, "Asia/Seoul");
    expect(wait).toBeGreaterThan(60_000);
    expect(wait).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
  });

  it("브라우저 시간대 감지 실패 시 서울을 사용한다", () => {
    expect(typeof detectBrowserTimeZone()).toBe("string");
    expect(normalizeTimeZone(detectBrowserTimeZone())).toBeTruthy();
  });
});
