export type HistoryCountMap = Record<string, number>;

export type HistoryBaseline = {
  total: number;
  items: HistoryCountMap;
};

export type HistoryClearAll = {
  clearedAt: string;
  localDate: string;
  dailyBaseline: HistoryBaseline;
  monthStart: string;
  monthlyBaseline: HistoryBaseline;
};

export type HistoryVisibilityState = {
  version: 1;
  clearAll: HistoryClearAll | null;
  dateBaselines: Record<string, HistoryBaseline>;
};

export type HistoryPrayerItem = {
  history_code: string;
  prayer_item_id: string;
  item_number: number | null;
  title: string;
  category: "main" | "supplementary";
  completion_count: number;
};

export type HistoryDailyRow = {
  local_date: string;
  total_completion_count: number;
  unique_prayer_count: number;
  items: HistoryPrayerItem[];
};

export type HistoryMonthlyRow = {
  month_start: string;
  total_completion_count: number;
  unique_prayer_count: number;
  items: HistoryPrayerItem[];
};

export function emptyHistoryVisibilityState(): HistoryVisibilityState {
  return { version: 1, clearAll: null, dateBaselines: {} };
}

export function countsFromItems(items: HistoryPrayerItem[]): HistoryCountMap {
  const itemsMap: HistoryCountMap = {};
  for (const item of items) {
    if (item.completion_count > 0) itemsMap[item.history_code] = item.completion_count;
  }
  return itemsMap;
}

export function baselineFromDaily(row: HistoryDailyRow): HistoryBaseline {
  return {
    total: row.total_completion_count,
    items: countsFromItems(row.items),
  };
}

export function baselineFromMonthly(row: HistoryMonthlyRow): HistoryBaseline {
  return {
    total: row.total_completion_count,
    items: countsFromItems(row.items),
  };
}

export function monthStartFromDate(localDate: string): string {
  return `${localDate.slice(0, 8)}01`;
}

function visibleAmount(server: number, baseline: number): number {
  return Math.max(server - baseline, 0);
}

export function subtractCountMaps(server: HistoryCountMap, baseline: HistoryCountMap): HistoryCountMap {
  const next: HistoryCountMap = {};
  for (const [code, count] of Object.entries(server)) {
    const visible = visibleAmount(count, baseline[code] ?? 0);
    if (visible > 0) next[code] = visible;
  }
  return next;
}

export function applyBaselineToRow<T extends { total_completion_count: number; items: HistoryPrayerItem[] }>(
  row: T,
  baseline: HistoryBaseline | null,
): T | null {
  if (!baseline) {
    const items = row.items.filter((item) => item.completion_count > 0);
    const total = items.reduce((sum, item) => sum + item.completion_count, 0);
    if (total <= 0) return null;
    return {
      ...row,
      total_completion_count: total,
      unique_prayer_count: items.length,
      items,
    };
  }
  const serverCounts = countsFromItems(row.items);
  const visibleCounts = subtractCountMaps(serverCounts, baseline.items);
  const items = row.items
    .map((item) => ({
      ...item,
      completion_count: visibleCounts[item.history_code] ?? 0,
    }))
    .filter((item) => item.completion_count > 0);
  const total = items.reduce((sum, item) => sum + item.completion_count, 0);
  if (total <= 0) return null;
  return {
    ...row,
    total_completion_count: total,
    unique_prayer_count: items.length,
    items,
  };
}

export function applyDailyHistoryBaseline(
  serverDailyRow: HistoryDailyRow,
  state: HistoryVisibilityState,
): HistoryDailyRow | null {
  const date = serverDailyRow.local_date;
  if (state.clearAll && date < state.clearAll.localDate) return null;
  const dateBaseline = state.dateBaselines[date];
  if (dateBaseline) return applyBaselineToRow(serverDailyRow, dateBaseline);
  if (state.clearAll && date === state.clearAll.localDate) {
    return applyBaselineToRow(serverDailyRow, state.clearAll.dailyBaseline);
  }
  return applyBaselineToRow(serverDailyRow, null);
}

export function applyMonthlyHistoryBaseline(
  serverMonthlyRow: HistoryMonthlyRow,
  state: HistoryVisibilityState,
): HistoryMonthlyRow | null {
  const month = serverMonthlyRow.month_start;
  if (state.clearAll && month < state.clearAll.monthStart) return null;

  let baseline: HistoryBaseline = { total: 0, items: {} };
  if (state.clearAll && month === state.clearAll.monthStart) {
    baseline = {
      total: state.clearAll.monthlyBaseline.total,
      items: { ...state.clearAll.monthlyBaseline.items },
    };
  }
  if (!(state.clearAll && month === state.clearAll.monthStart)) {
    for (const [date, dateBaseline] of Object.entries(state.dateBaselines)) {
      if (monthStartFromDate(date) !== month) continue;
      baseline = {
        total: baseline.total + dateBaseline.total,
        items: mergeCountMaps(baseline.items, dateBaseline.items),
      };
    }
  }
  const hasBaseline = baseline.total > 0 || Object.keys(baseline.items).length > 0;
  return applyBaselineToRow(serverMonthlyRow, hasBaseline ? baseline : null);
}

function mergeCountMaps(left: HistoryCountMap, right: HistoryCountMap): HistoryCountMap {
  const next = { ...left };
  for (const [code, count] of Object.entries(right)) {
    next[code] = (next[code] ?? 0) + count;
  }
  return next;
}

export function hideHistoryDate(state: HistoryVisibilityState, date: string, currentDailyRow: HistoryDailyRow): HistoryVisibilityState {
  return {
    ...state,
    dateBaselines: {
      ...state.dateBaselines,
      [date]: baselineFromDaily(currentDailyRow),
    },
  };
}

export function clearAllHistory(
  state: HistoryVisibilityState,
  currentDailyRow: HistoryDailyRow | null,
  currentMonthlyRow: HistoryMonthlyRow | null,
  now = new Date(),
): HistoryVisibilityState {
  const localDate = currentDailyRow?.local_date ?? toLocalDate(now);
  return {
    version: 1,
    clearAll: {
      clearedAt: now.toISOString(),
      localDate,
      dailyBaseline: currentDailyRow
        ? baselineFromDaily(currentDailyRow)
        : { total: 0, items: {} },
      monthStart: currentMonthlyRow?.month_start ?? monthStartFromDate(localDate),
      monthlyBaseline: currentMonthlyRow
        ? baselineFromMonthly(currentMonthlyRow)
        : { total: 0, items: {} },
    },
    dateBaselines: {},
  };
}

function toLocalDate(now: Date): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const memory = new Map<string, HistoryVisibilityState>();

export function historyVisibilityStorageKey(userId: string): string {
  return `prayer-history-visibility:v1:${userId}`;
}

export function loadHistoryVisibilityState(userId: string): HistoryVisibilityState {
  const cached = memory.get(userId);
  if (cached) return cached;
  if (typeof window === "undefined") return emptyHistoryVisibilityState();
  try {
    const raw = window.localStorage.getItem(historyVisibilityStorageKey(userId));
    const parsed = parseHistoryVisibilityState(raw);
    memory.set(userId, parsed);
    return parsed;
  } catch {
    return emptyHistoryVisibilityState();
  }
}

export function saveHistoryVisibilityState(userId: string, state: HistoryVisibilityState): void {
  memory.set(userId, state);
  if (typeof window === "undefined") return;
  window.localStorage.setItem(historyVisibilityStorageKey(userId), JSON.stringify(state));
}

export function clearHistoryVisibilityOnLogoutMemoryOnly(): void {
  memory.clear();
}

export function parseHistoryVisibilityState(raw: string | null): HistoryVisibilityState {
  if (!raw) return emptyHistoryVisibilityState();
  const parsed = JSON.parse(raw) as Partial<HistoryVisibilityState>;
  if (parsed.version !== 1 || typeof parsed !== "object") return emptyHistoryVisibilityState();
  return {
    version: 1,
    clearAll: parsed.clearAll && typeof parsed.clearAll === "object" ? parsed.clearAll : null,
    dateBaselines: parsed.dateBaselines && typeof parsed.dateBaselines === "object" ? parsed.dateBaselines : {},
  };
}
