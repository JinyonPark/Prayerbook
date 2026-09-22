export function getReaderScrollElement(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  const scrolling = document.scrollingElement;
  if (scrolling instanceof HTMLElement) return scrolling;
  return document.documentElement;
}

export function getReaderScrollY(): number {
  if (typeof window === "undefined") return 0;
  return Math.max(
    window.scrollY || window.pageYOffset || 0,
    document.documentElement?.scrollTop || 0,
    document.body?.scrollTop || 0,
  );
}

function getContentExtent(): number {
  const article = document.querySelector(".reader-article");
  if (!(article instanceof HTMLElement)) return 0;
  return article.getBoundingClientRect().bottom + getReaderScrollY();
}

export function getReaderScrollMax(): number {
  if (typeof document === "undefined") return 0;
  const doc = document.documentElement;
  const body = document.body;
  const viewHeight =
    (typeof window !== "undefined" ? window.innerHeight : 0) || doc?.clientHeight || 0;
  const scrollHeight = Math.max(
    doc?.scrollHeight ?? 0,
    body?.scrollHeight ?? 0,
    doc?.offsetHeight ?? 0,
    body?.offsetHeight ?? 0,
    getContentExtent(),
  );
  return Math.max(0, scrollHeight - viewHeight);
}

export function getReaderScrollMetrics() {
  return {
    y: getReaderScrollY(),
    max: getReaderScrollMax(),
    clientHeight: typeof window === "undefined" ? 0 : window.innerHeight,
    scrollHeight: Math.max(
      document.documentElement?.scrollHeight ?? 0,
      document.body?.scrollHeight ?? 0,
    ),
  };
}

export function setReaderScrollY(y: number): void {
  if (typeof window === "undefined") return;
  const next = Math.max(0, y);
  if (Math.abs(getReaderScrollY() - next) < 0.5) return;
  const root = document.documentElement;
  const body = document.body;
  const scrolling = getReaderScrollElement();
  window.scrollTo({ top: next, left: 0, behavior: "auto" });
  if (scrolling) scrolling.scrollTop = next;
  if (root && root !== scrolling) root.scrollTop = next;
  if (body && body !== scrolling) body.scrollTop = next;
}

export function readerHasScrollRoom(): boolean {
  return getReaderScrollMax() > 1;
}
