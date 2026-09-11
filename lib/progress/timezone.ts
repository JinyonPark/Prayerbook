export const DEFAULT_TIME_ZONE = "Asia/Seoul";

export function isValidIanaTimeZone(value: string): boolean {
  if (!value || value.length > 64) return false;
  try {
    Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function normalizeTimeZone(value: unknown): string {
  if (typeof value === "string" && isValidIanaTimeZone(value.trim())) {
    return value.trim();
  }
  return DEFAULT_TIME_ZONE;
}

export function detectBrowserTimeZone(): string {
  try {
    return normalizeTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

function timeZoneOffsetMs(utcDate: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: normalizeTimeZone(timeZone),
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(utcDate);
  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") map[part.type] = part.value;
  }
  let hour = Number(map.hour);
  if (hour === 24) hour = 0;
  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    hour,
    Number(map.minute),
    Number(map.second),
  );
  return asUtc - utcDate.getTime();
}

export function zonedDayStartUtc(localDate: string, timeZone: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(localDate);
  if (!match) {
    throw new Error("INVALID_LOCAL_DATE");
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const zone = normalizeTimeZone(timeZone);
  let utc = Date.UTC(year, month - 1, day, 0, 0, 0);
  for (let i = 0; i < 4; i += 1) {
    const offset = timeZoneOffsetMs(new Date(utc), zone);
    utc = Date.UTC(year, month - 1, day, 0, 0, 0) - offset;
  }
  return new Date(utc);
}

export function addCalendarDays(localDate: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(localDate);
  if (!match) throw new Error("INVALID_LOCAL_DATE");
  const next = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days));
  return [
    next.getUTCFullYear(),
    String(next.getUTCMonth() + 1).padStart(2, "0"),
    String(next.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

export function zonedDayRangeUtc(localDate: string, timeZone: string): { start: Date; end: Date } {
  const start = zonedDayStartUtc(localDate, timeZone);
  const end = zonedDayStartUtc(addCalendarDays(localDate, 1), timeZone);
  return { start, end };
}

export function localDateString(now: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: normalizeTimeZone(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function getLocalDateString(timeZone: string, now = new Date()): string {
  return localDateString(now, timeZone);
}

export function formatKoreanDate(localDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(localDate);
  if (!match) return localDate;
  return `${Number(match[1])}년 ${Number(match[2])}월 ${Number(match[3])}일`;
}

export function isInstantInLocalDate(iso: string, localDate: string, timeZone: string): boolean {
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) return false;
  const { start, end } = zonedDayRangeUtc(localDate, timeZone);
  return instant >= start && instant < end;
}

export function msUntilNextMidnight(now: Date, timeZone: string): number {
  const today = localDateString(now, timeZone);
  const { end } = zonedDayRangeUtc(today, timeZone);
  return Math.max(1000, end.getTime() - now.getTime());
}
