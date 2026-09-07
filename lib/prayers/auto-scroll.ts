export function nextAutoScrollPosition(
  currentY: number,
  maxY: number,
  pxPerSecond: number,
  elapsedMs: number,
): { y: number; finished: boolean } {
  const nextY = currentY + (pxPerSecond * Math.max(0, elapsedMs)) / 1000;
  if (nextY >= maxY - 1) {
    return { y: Math.max(0, maxY), finished: true };
  }
  return { y: nextY, finished: false };
}

export function isManualScrollKey(key: string): boolean {
  return key === "ArrowDown" || key === "ArrowUp" || key === "PageDown" || key === "PageUp" || key === "Home" || key === "End" || key === " ";
}
