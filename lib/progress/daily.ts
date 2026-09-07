import {
  DEFAULT_TIME_ZONE,
  formatKoreanDate,
  isInstantInLocalDate,
  localDateString,
  normalizeTimeZone,
} from "@/lib/progress/timezone";
import { PRODUCTION_ORIGIN } from "@/lib/auth/site-url";

export const APP_PUBLIC_URL = `${PRODUCTION_ORIGIN}/`;
export const APP_DISPLAY_NAME = "기도훈련집";
export const DAILY_SHARE_TITLE = "기도훈련집 오늘의 기록";

export type DailyPrayerItemSummary = {
  prayer_item_id: string;
  prayer_title: string;
  item_number: number | null;
  category: "main" | "supplementary";
  completion_count: number;
};

export type DailyPrayerSummary = {
  local_date: string;
  time_zone: string;
  total_completion_count: number;
  unique_prayer_count: number;
  main_prayer_completion_count: number;
  supplementary_prayer_completion_count: number;
  items: DailyPrayerItemSummary[];
};

export type DailyOperationRecord = {
  client_event_id: string;
  operation_type: string;
  created_at: string;
  prayer_item_id: string;
  prayer_title: string;
  item_number: number | null;
  category: "main" | "supplementary";
  display_order: number;
};

export type DailyShareProgress = {
  totalCompleted: number;
  currentRound: number;
  currentCompletedCount: number;
  eligibleCount: number;
};

export function emptyDailySummary(timeZone = DEFAULT_TIME_ZONE, localDate?: string): DailyPrayerSummary {
  return {
    local_date: localDate ?? "",
    time_zone: normalizeTimeZone(timeZone),
    total_completion_count: 0,
    unique_prayer_count: 0,
    main_prayer_completion_count: 0,
    supplementary_prayer_completion_count: 0,
    items: [],
  };
}

export function normalizeDailySummary(value: unknown, fallbackTimeZone = DEFAULT_TIME_ZONE): DailyPrayerSummary {
  const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const items = Array.isArray(row.items)
    ? row.items
        .map((item) => {
          const current = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
          return {
            prayer_item_id: String(current.prayer_item_id ?? ""),
            prayer_title: String(current.prayer_title ?? "기도"),
            item_number: typeof current.item_number === "number" ? current.item_number : null,
            category: current.category === "supplementary" ? "supplementary" : "main",
            completion_count: Number(current.completion_count ?? 0),
          } satisfies DailyPrayerItemSummary;
        })
        .filter((item) => item.prayer_item_id)
    : [];
  return {
    local_date: String(row.local_date ?? ""),
    time_zone: normalizeTimeZone(row.time_zone ?? fallbackTimeZone),
    total_completion_count: Number(row.total_completion_count ?? 0),
    unique_prayer_count: Number(row.unique_prayer_count ?? items.length),
    main_prayer_completion_count: Number(row.main_prayer_completion_count ?? 0),
    supplementary_prayer_completion_count: Number(row.supplementary_prayer_completion_count ?? 0),
    items,
  };
}

export function summarizeDailyCompletions(
  operations: DailyOperationRecord[],
  options: { timeZone: string; localDate?: string; now?: Date },
): DailyPrayerSummary {
  const timeZone = normalizeTimeZone(options.timeZone);
  const localDate = options.localDate ?? localDateString(options.now ?? new Date(), timeZone);
  const seenEvents = new Set<string>();
  const grouped = new Map<string, DailyPrayerItemSummary & { display_order: number }>();

  for (const operation of operations) {
    if (operation.operation_type !== "complete") continue;
    if (seenEvents.has(operation.client_event_id)) continue;
    if (!isInstantInLocalDate(operation.created_at, localDate, timeZone)) continue;
    seenEvents.add(operation.client_event_id);
    const existing = grouped.get(operation.prayer_item_id);
    if (existing) {
      existing.completion_count += 1;
      continue;
    }
    grouped.set(operation.prayer_item_id, {
      prayer_item_id: operation.prayer_item_id,
      prayer_title: operation.prayer_title,
      item_number: operation.item_number,
      category: operation.category,
      completion_count: 1,
      display_order: operation.display_order,
    });
  }

  const items = [...grouped.values()].sort((left, right) => left.display_order - right.display_order);
  let mainCount = 0;
  let supplementaryCount = 0;
  for (const item of items) {
    if (item.category === "supplementary") supplementaryCount += item.completion_count;
    else mainCount += item.completion_count;
  }

  return {
    local_date: localDate,
    time_zone: timeZone,
    total_completion_count: seenEvents.size,
    unique_prayer_count: items.length,
    main_prayer_completion_count: mainCount,
    supplementary_prayer_completion_count: supplementaryCount,
    items: items.map((item) => ({
      prayer_item_id: item.prayer_item_id,
      prayer_title: item.prayer_title,
      item_number: item.item_number,
      category: item.category,
      completion_count: item.completion_count,
    })),
  };
}

export function applySuccessfulCompleteToDaily(
  previous: DailyPrayerSummary,
  input: {
    prayerItemId: string;
    prayerTitle: string;
    itemNumber: number | null;
    category: "main" | "supplementary";
    displayOrder?: number;
    idempotent?: boolean;
  },
): DailyPrayerSummary {
  if (input.idempotent) return previous;
  const items = previous.items.map((item) => ({ ...item }));
  const existing = items.find((item) => item.prayer_item_id === input.prayerItemId);
  if (existing) {
    existing.completion_count += 1;
  } else {
    items.push({
      prayer_item_id: input.prayerItemId,
      prayer_title: input.prayerTitle,
      item_number: input.itemNumber,
      category: input.category,
      completion_count: 1,
    });
  }
  return {
    ...previous,
    total_completion_count: previous.total_completion_count + 1,
    unique_prayer_count: items.length,
    main_prayer_completion_count:
      previous.main_prayer_completion_count + (input.category === "main" ? 1 : 0),
    supplementary_prayer_completion_count:
      previous.supplementary_prayer_completion_count + (input.category === "supplementary" ? 1 : 0),
    items,
  };
}

export function formatDailyCopyText(summary: DailyPrayerSummary, progress: DailyShareProgress): string {
  return [
    DAILY_SHARE_TITLE,
    "",
    formatKoreanDate(summary.local_date),
    `오늘 총 ${summary.total_completion_count}회 기도했습니다.`,
    `완료한 기도 항목: ${summary.unique_prayer_count}개`,
    "",
    `Total ${progress.totalCompleted}독 완료`,
    `${progress.currentRound}독 진행 중 ${progress.currentCompletedCount} / ${progress.eligibleCount}`,
    "",
    APP_DISPLAY_NAME,
    APP_PUBLIC_URL,
  ].join("\n");
}

export function formatDailyShareText(summary: DailyPrayerSummary, progress: DailyShareProgress): string {
  return [
    formatKoreanDate(summary.local_date),
    `오늘 총 ${summary.total_completion_count}회 기도했습니다.`,
    `Total ${progress.totalCompleted}독 완료`,
    `${progress.currentRound}독 진행 중 ${progress.currentCompletedCount} / ${progress.eligibleCount}`,
  ].join("\n");
}

export function formatDailyPreviewText(summary: DailyPrayerSummary, progress: DailyShareProgress): string {
  return [
    DAILY_SHARE_TITLE,
    "",
    formatKoreanDate(summary.local_date),
    `오늘 총 ${summary.total_completion_count}회 기도했습니다.`,
    `Total ${progress.totalCompleted}독 완료`,
    `${progress.currentRound}독 진행 중 ${progress.currentCompletedCount} / ${progress.eligibleCount}`,
  ].join("\n");
}

export function dailySharePayload(summary: DailyPrayerSummary, progress: DailyShareProgress) {
  return {
    title: DAILY_SHARE_TITLE,
    text: formatDailyShareText(summary, progress),
    url: APP_PUBLIC_URL,
  };
}

export function shareTextContainsForbiddenPersonalData(
  text: string,
  personalValues: Array<string | null | undefined>,
): boolean {
  return personalValues.some((value) => {
    const trimmed = value?.trim();
    return Boolean(trimmed && trimmed.length >= 2 && text.includes(trimmed));
  });
}
