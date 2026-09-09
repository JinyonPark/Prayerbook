import { describe, expect, it } from "vitest";
import {
  applyDailyHistoryBaseline,
  applyMonthlyHistoryBaseline,
  clearAllHistory,
  hideHistoryDate,
  historyVisibilityStorageKey,
  parseHistoryVisibilityState,
  type HistoryDailyRow,
  type HistoryMonthlyRow,
} from "@/lib/progress/history-visibility";

const dawn = {
  history_code: "1",
  prayer_item_id: "dawn",
  item_number: 1,
  title: "하루를 시작하며 드리는 기도",
  category: "main" as const,
  completion_count: 1,
};

function daily(date: string, counts: Record<string, number>, extras: HistoryDailyRow["items"] = []): HistoryDailyRow {
  const items = [
    { ...dawn, completion_count: counts["1"] ?? 0 },
    ...extras,
  ].filter((item) => item.completion_count > 0);
  return {
    local_date: date,
    total_completion_count: items.reduce((sum, item) => sum + item.completion_count, 0),
    unique_prayer_count: items.length,
    items,
  };
}

function monthly(month: string, counts: Record<string, number>): HistoryMonthlyRow {
  const items = Object.entries(counts).map(([code, completion_count]) => ({
    ...dawn,
    history_code: code,
    completion_count,
  }));
  return {
    month_start: month,
    total_completion_count: Object.values(counts).reduce((sum, count) => sum + count, 0),
    unique_prayer_count: items.length,
    items,
  };
}

describe("이력 로컬 숨김", () => {
  it("날짜 숨김 후 서버 값은 그대로 두고 증가분만 보여 준다", () => {
    const server = daily("2026-09-09", { "1": 5 });
    const hidden = hideHistoryDate({ version: 1, clearAll: null, dateBaselines: {} }, "2026-09-09", server);
    expect(applyDailyHistoryBaseline(server, hidden)).toBeNull();
    const after = daily("2026-09-09", { "1": 6 });
    const visible = applyDailyHistoryBaseline(after, hidden);
    expect(visible?.total_completion_count).toBe(1);
    expect(visible?.items[0]?.completion_count).toBe(1);
  });

  it("전체 숨김은 이전 날짜를 가리고 당일 증가분만 보여 준다", () => {
    const today = daily("2026-09-09", { "1": 16, "2": 2 });
    today.items.push({ ...dawn, history_code: "2", item_number: 2, title: "나라를 위한 기도", completion_count: 2 });
    today.total_completion_count = 18;
    today.unique_prayer_count = 2;
    const month = monthly("2026-09-01", { "1": 100 });
    const state = clearAllHistory({ version: 1, clearAll: null, dateBaselines: {} }, today, month, new Date("2026-09-09T05:00:00.000Z"));
    expect(state.dateBaselines).toEqual({});
    expect(applyDailyHistoryBaseline(daily("2026-09-08", { "1": 12 }), state)).toBeNull();
    const laterToday = daily("2026-09-09", { "1": 17, "2": 2 });
    laterToday.items.push({ ...dawn, history_code: "2", item_number: 2, title: "나라를 위한 기도", completion_count: 2 });
    const visible = applyDailyHistoryBaseline(laterToday, state);
    expect(visible?.total_completion_count).toBe(1);
  });

  it("날짜 숨김 횟수는 월별 요약에서도 차감한다", () => {
    const serverMonth = monthly("2026-09-01", { "1": 100 });
    const state = hideHistoryDate(
      { version: 1, clearAll: null, dateBaselines: {} },
      "2026-09-08",
      daily("2026-09-08", { "1": 12 }),
    );
    const visible = applyMonthlyHistoryBaseline(serverMonth, state);
    expect(visible?.total_completion_count).toBe(88);
  });

  it("전체 숨김 이후 날짜와 월은 그대로 보여 준다", () => {
    const today = daily("2026-09-09", { "1": 16 });
    const month = monthly("2026-09-01", { "1": 100 });
    const state = clearAllHistory({ version: 1, clearAll: null, dateBaselines: {} }, today, month, new Date("2026-09-09T05:00:00.000Z"));
    expect(applyDailyHistoryBaseline(daily("2026-09-10", { "1": 2 }), state)?.total_completion_count).toBe(2);
    expect(applyMonthlyHistoryBaseline(monthly("2026-08-01", { "1": 40 }), state)).toBeNull();
    expect(applyMonthlyHistoryBaseline(monthly("2026-10-01", { "1": 8 }), state)?.total_completion_count).toBe(8);
  });

  it("숨김 저장 키는 사용자 id로 분리한다", () => {
    expect(historyVisibilityStorageKey("user-a")).toBe("prayer-history-visibility:v1:user-a");
    expect(historyVisibilityStorageKey("user-a")).not.toBe(historyVisibilityStorageKey("user-b"));
  });

  it("저장 JSON에 이메일이나 본문을 넣지 않는다", () => {
    const parsed = parseHistoryVisibilityState(
      JSON.stringify({
        version: 1,
        clearAll: {
          clearedAt: "2026-09-09T05:00:00.000Z",
          localDate: "2026-09-09",
          dailyBaseline: { total: 1, items: { "1": 1 } },
          monthStart: "2026-09-01",
          monthlyBaseline: { total: 10, items: { "1": 10 } },
        },
        dateBaselines: {},
      }),
    );
    expect(JSON.stringify(parsed)).not.toMatch(/@/);
    expect(JSON.stringify(parsed)).not.toContain("email");
  });
});
