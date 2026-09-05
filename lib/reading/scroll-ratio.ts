export function getScrollRatio(scroller: HTMLElement | Window = window): number {
  if (scroller instanceof Window) {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (max <= 0) return 0;
    return clampRatio(window.scrollY / max);
  }
  const max = scroller.scrollHeight - scroller.clientHeight;
  if (max <= 0) return 0;
  return clampRatio(scroller.scrollTop / max);
}

export function restoreScrollRatio(ratio: number, scroller: HTMLElement | Window = window) {
  const safeRatio = clampRatio(ratio);
  if (scroller instanceof Window) {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo({ top: max * safeRatio, behavior: "instant" });
    return;
  }
  const max = scroller.scrollHeight - scroller.clientHeight;
  scroller.scrollTop = max * safeRatio;
}

export function clampRatio(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function formatScrollPercent(ratio: number): string {
  return `${Math.round(clampRatio(ratio) * 100)}%`;
}
