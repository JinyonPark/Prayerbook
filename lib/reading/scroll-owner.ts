export function getReaderScrollElement(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  const scrolling = document.scrollingElement;
  if (scrolling instanceof HTMLElement) return scrolling;
  return document.documentElement;
}

export function getReaderScrollY(): number {
  return getReaderScrollElement()?.scrollTop ?? 0;
}

export function getReaderScrollMax(): number {
  const el = getReaderScrollElement();
  if (!el) return 0;
  return Math.max(0, el.scrollHeight - el.clientHeight);
}

export function getReaderScrollMetrics() {
  const el = getReaderScrollElement();
  if (!el) {
    return { y: 0, max: 0, clientHeight: 0, scrollHeight: 0 };
  }
  return {
    y: el.scrollTop || 0,
    max: Math.max(0, el.scrollHeight - el.clientHeight),
    clientHeight: el.clientHeight,
    scrollHeight: el.scrollHeight,
  };
}

export function setReaderScrollY(y: number): void {
  const el = getReaderScrollElement();
  if (!el) return;
  const next = Math.max(0, y);
  if (Math.abs((el.scrollTop || 0) - next) < 0.5) return;
  el.scrollTop = next;
}

export function readerHasScrollRoom(): boolean {
  return getReaderScrollMax() > 1;
}
