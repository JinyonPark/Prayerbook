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
export const AUTO_SCROLL_START_RETRY_MS = 4000;
export const AUTO_SCROLL_CANCEL_PX = 40;

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
  hasOverflow?: boolean;
}): boolean {
  return (
    options.enabled &&
    options.prefsReady !== false &&
    options.restored &&
    options.visible &&
    !options.overlayOpen &&
    !options.cancelled &&
    options.hasOverflow !== false
  );
}

export function shouldCancelAutoStartFromUserScroll(options: {
  restored: boolean;
  restoring: boolean;
  cancelled: boolean;
  enteredAtMs: number;
  nowMs: number;
  startY: number;
  currentY: number;
  thresholdPx?: number;
}): boolean {
  if (!options.restored || options.restoring || options.cancelled) return false;
  if (shouldIgnoreAutoScrollCancel(options.enteredAtMs, options.nowMs)) return false;
  return Math.abs(options.currentY - options.startY) >= (options.thresholdPx ?? AUTO_SCROLL_CANCEL_PX);
}

export function shouldRetryAutoScrollStart(options: {
  enabled: boolean;
  cancelled: boolean;
  enteredAtMs: number;
  nowMs: number;
  retryWindowMs?: number;
}): boolean {
  if (!options.enabled || options.cancelled) return false;
  return options.nowMs - options.enteredAtMs < (options.retryWindowMs ?? AUTO_SCROLL_START_RETRY_MS);
}

export const AUTO_SCROLL_RESUME_IDLE_MS = 1200;

export function shouldWriteAutoScrollFrame(options: {
  running: boolean;
  userInteracting: boolean;
  gestureLock: boolean;
  restoring: boolean;
  visible: boolean;
  overlayOpen: boolean;
  reachedEnd: boolean;
}): boolean {
  return (
    options.running &&
    !options.userInteracting &&
    !options.gestureLock &&
    !options.restoring &&
    options.visible &&
    !options.overlayOpen &&
    !options.reachedEnd
  );
}

export function isUserScrollGestureLockActive(
  lock: boolean,
  lastInputAtMs: number,
  nowMs: number,
  idleMs = AUTO_SCROLL_RESUME_IDLE_MS,
): boolean {
  if (!lock) return false;
  return nowMs - lastInputAtMs < idleMs;
}

export function didViewportOrientationFlip(
  previousWidth: number,
  previousHeight: number,
  nextWidth: number,
  nextHeight: number,
): boolean {
  if (previousWidth < 1 || previousHeight < 1 || nextWidth < 1 || nextHeight < 1) return false;
  const wasLandscape = previousWidth > previousHeight;
  const isLandscape = nextWidth > nextHeight;
  return wasLandscape !== isLandscape && Math.abs(nextWidth - previousWidth) > 40;
}

export function hasAutoScrollDelayElapsed(elapsedMs: number, delayMs = AUTO_SCROLL_START_DELAY_MS): boolean {
  return elapsedMs >= delayMs;
}

export function nextReaderChromeVisible(options: {
  current: boolean;
  scrollY: number;
  deltaY: number;
  autoRunning?: boolean;
  topThreshold?: number;
  hideDelta?: number;
  showDelta?: number;
}): boolean {
  if (options.autoRunning) return false;
  const topThreshold = options.topThreshold ?? 12;
  const hideDelta = options.hideDelta ?? 4;
  const showDelta = options.showDelta ?? 4;
  if (options.scrollY <= topThreshold) return true;
  if (options.deltaY > hideDelta) return false;
  if (options.deltaY < -showDelta) return true;
  return options.current;
}

export function chromeVisibleFromFingerMove(
  fingerDeltaY: number,
  current: boolean,
  threshold = 8,
): boolean {
  if (fingerDeltaY > threshold) return true;
  if (fingerDeltaY < -threshold) return false;
  return current;
}
