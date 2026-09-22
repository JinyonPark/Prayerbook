import { describe, expect, it } from "vitest";
import {
  nextAutoScrollPosition,
  isManualScrollKey,
  hasAutoScrollDelayElapsed,
  remainingAutoScrollDelay,
  shouldIgnoreAutoScrollCancel,
  shouldStartAutoScroll,
  shouldRetryAutoScrollStart,
  shouldCancelAutoStartFromUserScroll,
  shouldWriteAutoScrollFrame,
  isUserScrollGestureLockActive,
  didViewportOrientationFlip,
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
    expect(
      shouldStartAutoScroll({
        enabled: true,
        restored: true,
        visible: true,
        overlayOpen: false,
        cancelled: false,
        hasOverflow: false,
      }),
    ).toBe(false);
  });

  it("레이아웃이 늦게 잡혀도 시작 재시도 창 안에서는 다시 시도한다", () => {
    expect(
      shouldRetryAutoScrollStart({
        enabled: true,
        cancelled: false,
        enteredAtMs: 0,
        nowMs: 1000,
      }),
    ).toBe(true);
    expect(
      shouldRetryAutoScrollStart({
        enabled: true,
        cancelled: false,
        enteredAtMs: 0,
        nowMs: 4000,
      }),
    ).toBe(false);
    expect(
      shouldRetryAutoScrollStart({
        enabled: true,
        cancelled: true,
        enteredAtMs: 0,
        nowMs: 500,
      }),
    ).toBe(false);
  });

  it("이전 페이지 스크롤 위치로는 시작을 취소하지 않고, 복원 후 40px만 취소한다", () => {
    expect(
      shouldCancelAutoStartFromUserScroll({
        restored: false,
        restoring: false,
        cancelled: false,
        enteredAtMs: 0,
        nowMs: 800,
        startY: 0,
        currentY: 400,
      }),
    ).toBe(false);
    expect(
      shouldCancelAutoStartFromUserScroll({
        restored: true,
        restoring: true,
        cancelled: false,
        enteredAtMs: 0,
        nowMs: 800,
        startY: 0,
        currentY: 400,
      }),
    ).toBe(false);
    expect(
      shouldCancelAutoStartFromUserScroll({
        restored: true,
        restoring: false,
        cancelled: false,
        enteredAtMs: 0,
        nowMs: 200,
        startY: 0,
        currentY: 80,
      }),
    ).toBe(false);
    expect(
      shouldCancelAutoStartFromUserScroll({
        restored: true,
        restoring: false,
        cancelled: false,
        enteredAtMs: 0,
        nowMs: 800,
        startY: 0,
        currentY: 20,
      }),
    ).toBe(false);
    expect(
      shouldCancelAutoStartFromUserScroll({
        restored: true,
        restoring: false,
        cancelled: false,
        enteredAtMs: 0,
        nowMs: 800,
        startY: 0,
        currentY: 40,
      }),
    ).toBe(true);
  });

  it("터치·제스처 잠금 중에는 auto-scroll frame을 쓰지 않는다", () => {
    expect(
      shouldWriteAutoScrollFrame({
        running: true,
        userInteracting: false,
        gestureLock: false,
        restoring: false,
        visible: true,
        overlayOpen: false,
        reachedEnd: false,
      }),
    ).toBe(true);
    expect(
      shouldWriteAutoScrollFrame({
        running: true,
        userInteracting: true,
        gestureLock: false,
        restoring: false,
        visible: true,
        overlayOpen: false,
        reachedEnd: false,
      }),
    ).toBe(false);
    expect(
      shouldWriteAutoScrollFrame({
        running: true,
        userInteracting: false,
        gestureLock: true,
        restoring: false,
        visible: true,
        overlayOpen: false,
        reachedEnd: false,
      }),
    ).toBe(false);
    expect(isUserScrollGestureLockActive(true, 0, 500)).toBe(true);
    expect(isUserScrollGestureLockActive(true, 0, 1200)).toBe(false);
    expect(isUserScrollGestureLockActive(false, 0, 100)).toBe(false);
  });

  it("주소창 높이 변화는 회전으로 보지 않고 가로·세로 전환만 회전으로 본다", () => {
    expect(didViewportOrientationFlip(390, 844, 390, 700)).toBe(false);
    expect(didViewportOrientationFlip(390, 844, 844, 390)).toBe(true);
    expect(didViewportOrientationFlip(844, 390, 390, 844)).toBe(true);
  });
});
