import type { CompletionEvent, DailyHistory, UserStats } from "@/lib/local-prayer-db/types";
import { LOCAL_STATS_SCHEMA_VERSION } from "@/lib/local-prayer-db/types";

export function displayedLifetimeCount(stats: Pick<UserStats, "initialCompletionCount" | "appCompletionCount">): number {
  return stats.initialCompletionCount + stats.appCompletionCount;
}

export function uniqueItemCount(itemCounts: Record<string, number>): number {
  return Object.values(itemCounts).filter((count) => count > 0).length;
}

export function isSafeNonNegativeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

export function parseInitialCompletionCount(raw: string): { ok: true; value: number } | { ok: false; message: string } {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return { ok: false, message: "누적 기도 횟수 초기값을 입력해 주세요." };
  }
  if (!/^\d+$/.test(trimmed)) {
    if (/[가-힣a-zA-Z]/.test(trimmed)) {
      return { ok: false, message: "초기값은 숫자만 입력할 수 있습니다." };
    }
    if (trimmed.includes(".") || trimmed.includes(",")) {
      return { ok: false, message: "초기값은 소수일 수 없습니다." };
    }
    if (trimmed.startsWith("-")) {
      return { ok: false, message: "초기값은 음수일 수 없습니다." };
    }
    return { ok: false, message: "초기값은 0 이상의 정수여야 합니다." };
  }
  const value = Number(trimmed);
  if (!isSafeNonNegativeInteger(value)) {
    return { ok: false, message: "초기값이 너무 큽니다." };
  }
  return { ok: true, value };
}

export function emptyUserStats(input: {
  userId: string;
  localDate: string;
  timeZone: string;
  nowIso: string;
  bootstrapStatus?: UserStats["bootstrapStatus"];
}): UserStats {
  return {
    userId: input.userId,
    schemaVersion: LOCAL_STATS_SCHEMA_VERSION,
    initialCompletionCount: 0,
    appCompletionCount: 0,
    todayDate: input.localDate,
    todayCompletionCount: 0,
    timeZone: input.timeZone,
    bootstrapStatus: input.bootstrapStatus ?? "pending",
    bootstrappedAt: null,
    updatedAt: input.nowIso,
  };
}

export function rolloverToday(stats: UserStats, localDate: string, nowIso: string): UserStats {
  if (stats.todayDate === localDate) {
    return stats.timeZone ? stats : { ...stats, updatedAt: nowIso };
  }
  return {
    ...stats,
    todayDate: localDate,
    todayCompletionCount: 0,
    updatedAt: nowIso,
  };
}

export function incrementDailyHistory(
  previous: DailyHistory | undefined,
  input: { userId: string; localDate: string; prayerItemId: string; nowIso: string },
): DailyHistory {
  const itemCounts = { ...(previous?.itemCounts ?? {}) };
  itemCounts[input.prayerItemId] = (itemCounts[input.prayerItemId] ?? 0) + 1;
  return {
    userId: input.userId,
    localDate: input.localDate,
    totalCompletionCount: (previous?.totalCompletionCount ?? 0) + 1,
    itemCounts,
    updatedAt: input.nowIso,
  };
}

export function applyConfirmedCompletionState(input: {
  stats: UserStats;
  history: DailyHistory | undefined;
  event: CompletionEvent | undefined;
  userId: string;
  clientEventId: string;
  prayerItemId: string;
  localDate: string;
  timeZone: string;
  nowIso: string;
}): {
  applied: boolean;
  stats: UserStats;
  history: DailyHistory;
  event: CompletionEvent;
} {
  const rolled = rolloverToday(input.stats, input.localDate, input.nowIso);
  if (input.event?.status === "applied") {
    return {
      applied: false,
      stats: rolled,
      history: input.history ?? {
        userId: input.userId,
        localDate: input.localDate,
        totalCompletionCount: 0,
        itemCounts: {},
        updatedAt: input.nowIso,
      },
      event: input.event,
    };
  }

  const stats: UserStats = {
    ...rolled,
    todayCompletionCount: rolled.todayCompletionCount + 1,
    appCompletionCount: rolled.appCompletionCount + 1,
    timeZone: input.timeZone || rolled.timeZone,
    updatedAt: input.nowIso,
  };
  const history = incrementDailyHistory(input.history, {
    userId: input.userId,
    localDate: input.localDate,
    prayerItemId: input.prayerItemId,
    nowIso: input.nowIso,
  });
  const event: CompletionEvent = {
    userId: input.userId,
    clientEventId: input.clientEventId,
    prayerItemId: input.prayerItemId,
    localDate: input.localDate,
    status: "applied",
    createdAt: input.event?.createdAt ?? input.nowIso,
    appliedAt: input.nowIso,
    errorMessage: null,
  };
  return { applied: true, stats, history, event };
}

export function monthDateBounds(year: number, month: number): { start: string; end: string } {
  const mm = String(month).padStart(2, "0");
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    start: `${year}-${mm}-01`,
    end: `${year}-${mm}-${String(lastDay).padStart(2, "0")}`,
  };
}
