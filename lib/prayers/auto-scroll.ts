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
