export function nextAutoScrollPosition(
  currentY: number,
  maxY: number,
  pxPerSecond: number,
  elapsedMs: number,
): { y: number; finished: boolean } {
  if (maxY <= 1) {
    return { y: Math.max(0, currentY), finished: false };
  }
  const nextY = currentY + (pxPerSecond * Math.max(0, elapsedMs)) / 1000;
  if (nextY >= maxY - 1) {
    return { y: Math.max(0, maxY), finished: true };
  }
  return { y: nextY, finished: false };
}

export function isManualScrollKey(key: string): boolean {
  return key === "ArrowDown" || key === "ArrowUp" || key === "PageDown" || key === "PageUp" || key === "Home" || key === "End" || key === " ";
}

export const AUTO_SCROLL_START_DELAY_MS = 1000;
export const AUTO_SCROLL_NAV_GESTURE_GUARD_MS = 450;

export function remainingAutoScrollDelay(
  startedAtMs: number,
  nowMs: number,
  delayMs = AUTO_SCROLL_START_DELAY_MS,
): number {
  return Math.max(0, delayMs - Math.max(0, nowMs - startedAtMs));
}

export function shouldIgnoreAutoScrollCancel(
  startedAtMs: number,
  nowMs: number,
  guardMs = AUTO_SCROLL_NAV_GESTURE_GUARD_MS,
): boolean {
  return nowMs - startedAtMs < guardMs;
}

export function shouldStartAutoScroll(options: {
  enabled: boolean;
  prefsReady?: boolean;
  restored: boolean;
  visible: boolean;
  overlayOpen: boolean;
  cancelled: boolean;
}): boolean {
  return (
    options.enabled &&
    options.prefsReady !== false &&
    options.restored &&
    options.visible &&
    !options.overlayOpen &&
    !options.cancelled
  );
}

export function hasAutoScrollDelayElapsed(elapsedMs: number, delayMs = AUTO_SCROLL_START_DELAY_MS): boolean {
  return elapsedMs >= delayMs;
}

export function nextReaderChromeVisible(options: {
  current: boolean;
  scrollY: number;
  deltaY: number;
  topThreshold?: number;
  hideDelta?: number;
  showDelta?: number;
}): boolean {
  const topThreshold = options.topThreshold ?? 12;
  const hideDelta = options.hideDelta ?? 4;
  const showDelta = options.showDelta ?? 4;
  if (options.scrollY <= topThreshold) return true;
  if (options.deltaY > hideDelta) return false;
  if (options.deltaY < -showDelta) return true;
  return options.current;
}
