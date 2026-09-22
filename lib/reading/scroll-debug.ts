export function debugReaderScroll(event: string, detail?: Record<string, unknown>) {
  if (process.env.NODE_ENV === "production") return;
  if (typeof window === "undefined") return;
  try {
    if (window.localStorage.getItem("prayerbook-scroll-debug") !== "1") return;
  } catch {
    return;
  }
  console.debug(`[reader-scroll] ${event}`, detail ?? {});
}
