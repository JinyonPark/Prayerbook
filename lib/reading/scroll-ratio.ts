import { getReaderScrollMax, getReaderScrollY, setReaderScrollY } from "@/lib/reading/scroll-owner";

export function getScrollRatio(scroller: HTMLElement | Window = window): number {
  if (scroller instanceof Window) {
    const max = getReaderScrollMax();
    if (max <= 0) return 0;
    return clampRatio(getReaderScrollY() / max);
  }
  const max = scroller.scrollHeight - scroller.clientHeight;
  if (max <= 0) return 0;
  return clampRatio(scroller.scrollTop / max);
}

export function restoreScrollRatio(ratio: number, scroller: HTMLElement | Window = window) {
  const safeRatio = clampRatio(ratio);
  if (scroller instanceof Window) {
    setReaderScrollY(getReaderScrollMax() * safeRatio);
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
