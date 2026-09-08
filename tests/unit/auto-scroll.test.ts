import { describe, expect, it } from "vitest";
import {
  nextAutoScrollPosition,
  isManualScrollKey,
  hasAutoScrollDelayElapsed,
  remainingAutoScrollDelay,
  shouldIgnoreAutoScrollCancel,
  shouldStartAutoScroll,
  nextReaderChromeVisible,
  chromeVisibleFromFingerMove,
} from "@/lib/prayers/auto-scroll";
import { defaultPreferences, parseAutoScrollEnabled } from "@/lib/theme/preferences";

describe("자동 스크롤", () => {
  it("경과 시간에 비례해 이동하고 끝에서 종료한다", () => {
    const mid = nextAutoScrollPosition(0, 1000, 50, 1000);
    expect(mid.y).toBe(50);
    expect(mid.finished).toBe(false);
    const end = nextAutoScrollPosition(990, 1000, 50, 1000);
    expect(end.finished).toBe(true);
    expect(end.y).toBe(1000);
  });

  it("본문 높이가 아직 없으면 종료하지 않는다", () => {
    const pending = nextAutoScrollPosition(0, 0, 42, 16);
    expect(pending.finished).toBe(false);
    expect(pending.y).toBe(0);
  });

  it("주사율이 달라도 같은 경과 시간이면 이동량이 같다", () => {
    const one = nextAutoScrollPosition(0, 5000, 42, 16);
    const two = nextAutoScrollPosition(one.y, 5000, 42, 16);
    const combined = nextAutoScrollPosition(0, 5000, 42, 32);
    expect(two.y).toBeCloseTo(combined.y);
  });

  it("화살표와 스페이스만 수동 스크롤 키로 본다", () => {
    expect(isManualScrollKey("ArrowDown")).toBe(true);
    expect(isManualScrollKey(" ")).toBe(true);
    expect(isManualScrollKey("Tab")).toBe(false);
    expect(isManualScrollKey("Enter")).toBe(false);
  });

  it("설정 기본값은 꺼짐이다", () => {
    expect(defaultPreferences.autoScrollEnabled).toBe(false);
    expect(defaultPreferences.conceivedShowAllNames).toBe(false);
    expect(parseAutoScrollEnabled(undefined)).toBe(false);
    expect(parseAutoScrollEnabled(null)).toBe(false);
    expect(parseAutoScrollEnabled(false)).toBe(false);
    expect(parseAutoScrollEnabled("false")).toBe(false);
    expect(parseAutoScrollEnabled(true)).toBe(true);
    expect(parseAutoScrollEnabled("true")).toBe(true);
  });

  it("1초가 지나기 전에는 시작하지 않는다", () => {
    expect(hasAutoScrollDelayElapsed(999)).toBe(false);
    expect(hasAutoScrollDelayElapsed(1000)).toBe(true);
    expect(remainingAutoScrollDelay(0, 0)).toBe(1000);
    expect(remainingAutoScrollDelay(0, 400)).toBe(600);
    expect(remainingAutoScrollDelay(0, 1000)).toBe(0);
    expect(shouldIgnoreAutoScrollCancel(0, 200)).toBe(true);
    expect(shouldIgnoreAutoScrollCancel(0, 500)).toBe(false);
  });

  it("아래로 스크롤하면 메뉴를 숨기고 위로 스크롤하면 다시 보인다", () => {
    expect(nextReaderChromeVisible({ current: true, scrollY: 80, deltaY: 20 })).toBe(false);
    expect(nextReaderChromeVisible({ current: false, scrollY: 40, deltaY: -20 })).toBe(true);
    expect(nextReaderChromeVisible({ current: false, scrollY: 4, deltaY: 20 })).toBe(true);
    expect(nextReaderChromeVisible({ current: false, scrollY: 80, deltaY: 1 })).toBe(false);
    expect(nextReaderChromeVisible({ current: true, scrollY: 8, deltaY: 1, autoRunning: true })).toBe(false);
    expect(nextReaderChromeVisible({ current: true, scrollY: 80, deltaY: 1, autoRunning: true })).toBe(false);
    expect(chromeVisibleFromFingerMove(20, false)).toBe(true);
    expect(chromeVisibleFromFingerMove(-20, true)).toBe(false);
  });

  it("위치 복원 전이나 수동 스크롤이면 시작하지 않는다", () => {
    expect(
      shouldStartAutoScroll({
        enabled: true,
        restored: false,
        visible: true,
        overlayOpen: false,
        cancelled: false,
      }),
    ).toBe(false);
    expect(
      shouldStartAutoScroll({
        enabled: true,
        restored: true,
        visible: true,
        overlayOpen: false,
        cancelled: true,
      }),
    ).toBe(false);
    expect(
      shouldStartAutoScroll({
        enabled: true,
        restored: true,
        visible: true,
        overlayOpen: false,
        cancelled: false,
      }),
    ).toBe(true);
  });
});
