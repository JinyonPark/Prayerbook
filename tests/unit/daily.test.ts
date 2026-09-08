import { describe, expect, it } from "vitest";
import { summarizeDailyCompletions, type DailyOperationRecord } from "@/lib/progress/daily";
import { InMemoryProgressStore } from "@/lib/progress/store";
import { calculateProgressFromItems, eligibleCountFromSummary, type PrayerCountItem } from "@/lib/progress/calculate";
import { MAIN_PRAYER_COUNT } from "@/lib/prayers/catalog";
import { formatDailyShareText } from "@/lib/progress/daily";

function catalog(): PrayerCountItem[] {
  return [
    ...Array.from({ length: MAIN_PRAYER_COUNT }, (_, index) => ({
      id: `m${index + 1}`,
      category: "main" as const,
      countsTowardTotal: true,
      itemNumber: index + 1,
      displayOrder: index + 1,
      completionCount: 0,
    })),
    {
      id: "s1",
      category: "supplementary",
      countsTowardTotal: false,
      itemNumber: null,
      displayOrder: MAIN_PRAYER_COUNT + 1,
      completionCount: 0,
    },
  ];
}

function op(partial: Partial<DailyOperationRecord> & Pick<DailyOperationRecord, "client_event_id" | "created_at" | "prayer_item_id">): DailyOperationRecord {
  return {
    operation_type: "complete",
    prayer_title: partial.prayer_title ?? partial.prayer_item_id,
    item_number: partial.item_number ?? 1,
    category: partial.category ?? "main",
    display_order: partial.display_order ?? 1,
    ...partial,
  };
}

const SEOUL = "Asia/Seoul";
const TODAY = "2026-09-07";
const SEOUL_TODAY_START = "2026-09-06T15:00:00.000Z";
const SEOUL_TODAY_MORNING = "2026-09-06T15:01:00.000Z";
const SEOUL_YESTERDAY_NIGHT = "2026-09-06T14:59:00.000Z";
const UTC_SEP6_SEOUL_SEP7 = "2026-09-06T16:00:00.000Z";

describe("오늘 기도 횟수 집계", () => {
  it("오늘 complete가 없으면 0회", () => {
    const summary = summarizeDailyCompletions([], { timeZone: SEOUL, localDate: TODAY });
    expect(summary.total_completion_count).toBe(0);
    expect(summary.unique_prayer_count).toBe(0);
  });

  it("오늘 complete 5개는 5회", () => {
    const operations = Array.from({ length: 5 }, (_, index) =>
      op({
        client_event_id: `e${index}`,
        created_at: SEOUL_TODAY_MORNING,
        prayer_item_id: `p${index}`,
        display_order: index,
      }),
    );
    const summary = summarizeDailyCompletions(operations, { timeZone: SEOUL, localDate: TODAY });
    expect(summary.total_completion_count).toBe(5);
  });

  it("같은 기도를 오늘 3번 완료하면 total 3, unique 1", () => {
    const operations = [1, 2, 3].map((index) =>
      op({
        client_event_id: `same-${index}`,
        created_at: SEOUL_TODAY_MORNING,
        prayer_item_id: "evangelism",
        prayer_title: "태신자 기도",
        item_number: 6,
      }),
    );
    const summary = summarizeDailyCompletions(operations, { timeZone: SEOUL, localDate: TODAY });
    expect(summary.total_completion_count).toBe(3);
    expect(summary.unique_prayer_count).toBe(1);
  });

  it("서로 다른 기도 4개를 각각 1번 완료하면 unique 4", () => {
    const operations = ["homeland", "church", "evangelism", "wish"].map((id, index) =>
      op({
        client_event_id: id,
        created_at: SEOUL_TODAY_MORNING,
        prayer_item_id: id,
        display_order: index,
      }),
    );
    const summary = summarizeDailyCompletions(operations, { timeZone: SEOUL, localDate: TODAY });
    expect(summary.total_completion_count).toBe(4);
    expect(summary.unique_prayer_count).toBe(4);
  });

  it("complete만 집계하고 수정·초기화·일괄 설정은 제외한다", () => {
    const operations = [
      op({ client_event_id: "c1", created_at: SEOUL_TODAY_MORNING, prayer_item_id: "a" }),
      op({ client_event_id: "c2", created_at: SEOUL_TODAY_MORNING, prayer_item_id: "b" }),
      op({ client_event_id: "c3", created_at: SEOUL_TODAY_MORNING, prayer_item_id: "c" }),
      op({
        client_event_id: "edit",
        created_at: SEOUL_TODAY_MORNING,
        prayer_item_id: "a",
        operation_type: "manual_edit",
      }),
      op({
        client_event_id: "reset",
        created_at: SEOUL_TODAY_MORNING,
        prayer_item_id: "a",
        operation_type: "item_reset",
      }),
      op({
        client_event_id: "bulk",
        created_at: SEOUL_TODAY_MORNING,
        prayer_item_id: "a",
        operation_type: "bulk_set",
      }),
    ];
    const summary = summarizeDailyCompletions(operations, { timeZone: SEOUL, localDate: TODAY });
    expect(summary.total_completion_count).toBe(3);
    expect(summary.lifetime_completion_count).toBe(3);
  });

  it("어제 완료는 오늘 횟수에 없고 누적 횟수에는 남는다", () => {
    const operations = [
      op({ client_event_id: "y", created_at: SEOUL_YESTERDAY_NIGHT, prayer_item_id: "a" }),
      op({ client_event_id: "t", created_at: SEOUL_TODAY_MORNING, prayer_item_id: "a" }),
    ];
    const summary = summarizeDailyCompletions(operations, { timeZone: SEOUL, localDate: TODAY });
    expect(summary.total_completion_count).toBe(1);
    expect(summary.lifetime_completion_count).toBe(2);
  });

  it("동일 client_event_id 중복은 한 번만 계산한다", () => {
    const store = new InMemoryProgressStore(catalog());
    store.seedUser("a");
    const eventId = crypto.randomUUID();
    store.complete("a", "m1", eventId, new Date(SEOUL_TODAY_MORNING));
    store.complete("a", "m1", eventId, new Date(SEOUL_TODAY_MORNING));
    const summary = store.dailySummary("a", { timeZone: SEOUL, localDate: TODAY });
    expect(summary.total_completion_count).toBe(1);
  });

  it("서버 저장 실패 시 오늘 횟수가 증가하지 않는다", async () => {
    const store = new InMemoryProgressStore(catalog());
    store.seedUser("a");
    let dailyCount = store.dailySummary("a", { timeZone: SEOUL, localDate: TODAY }).total_completion_count;
    await expect(
      (async () => {
        store.complete("a", "missing", crypto.randomUUID(), new Date(SEOUL_TODAY_MORNING));
        dailyCount += 1;
      })(),
    ).rejects.toThrow("PRAYER_NOT_FOUND");
    expect(dailyCount).toBe(0);
    expect(store.dailySummary("a", { timeZone: SEOUL, localDate: TODAY }).total_completion_count).toBe(0);
  });

  it("전날 23:59 완료는 제외하고 오늘 00:01만 포함한다", () => {
    const operations = [
      op({ client_event_id: "y", created_at: SEOUL_YESTERDAY_NIGHT, prayer_item_id: "a" }),
      op({ client_event_id: "t", created_at: SEOUL_TODAY_MORNING, prayer_item_id: "a" }),
    ];
    const summary = summarizeDailyCompletions(operations, { timeZone: SEOUL, localDate: TODAY });
    expect(summary.total_completion_count).toBe(1);
  });

  it("UTC 날짜와 Asia/Seoul 날짜가 달라도 서울 기준으로 집계한다", () => {
    const operations = [
      op({ client_event_id: "cross", created_at: UTC_SEP6_SEOUL_SEP7, prayer_item_id: "a" }),
      op({ client_event_id: "start", created_at: SEOUL_TODAY_START, prayer_item_id: "b" }),
    ];
    const seoul = summarizeDailyCompletions(operations, { timeZone: SEOUL, localDate: TODAY });
    const utc = summarizeDailyCompletions(operations, { timeZone: "UTC", localDate: "2026-09-06" });
    expect(seoul.total_completion_count).toBe(2);
    expect(seoul.local_date).toBe(TODAY);
    expect(utc.total_completion_count).toBe(2);
    expect(summarizeDailyCompletions(operations, { timeZone: "UTC", localDate: TODAY }).total_completion_count).toBe(0);
  });

  it("기본 기도 전체 초기화 후에도 오늘 complete 횟수는 유지된다", () => {
    const store = new InMemoryProgressStore(catalog());
    store.seedUser("a");
    const at = new Date(SEOUL_TODAY_MORNING);
    for (let i = 0; i < 5; i += 1) {
      store.complete("a", "m1", crypto.randomUUID(), at);
    }
    expect(store.dailySummary("a", { timeZone: SEOUL, localDate: TODAY }).total_completion_count).toBe(5);
    store.resetMain("a", crypto.randomUUID(), at);
    expect(store.summary("a").totalCompleted).toBe(0);
    expect(store.dailySummary("a", { timeZone: SEOUL, localDate: TODAY }).total_completion_count).toBe(5);
    expect(store.dailySummary("a", { timeZone: SEOUL, localDate: TODAY }).lifetime_completion_count).toBe(5);
  });

  it("배우자 기도 선택 변경은 오늘 횟수를 바꾸지 않고 공유 진행률 분모만 바꾼다", () => {
    const store = new InMemoryProgressStore(catalog());
    store.seedUser("a");
    const at = new Date(SEOUL_TODAY_MORNING);
    store.complete("a", "m1", crypto.randomUUID(), at);
    store.complete("a", "m2", crypto.randomUUID(), at);
    const daily = store.dailySummary("a", { timeZone: SEOUL, localDate: TODAY });
    const items = catalog().map((item, index) => ({
      ...item,
      completionCount: index < 2 ? 1 : 0,
    }));
    const allEligible = calculateProgressFromItems(items, null);
    const husbandEligible = calculateProgressFromItems(items, "husband");
    const shareAll = formatDailyShareText(daily, {
      totalCompleted: allEligible.totalCompleted,
      currentRound: allEligible.currentRound,
      currentCompletedCount: allEligible.currentCompletedCount,
      eligibleCount: allEligible.eligibleCount,
    });
    const shareHusband = formatDailyShareText(daily, {
      totalCompleted: husbandEligible.totalCompleted,
      currentRound: husbandEligible.currentRound,
      currentCompletedCount: husbandEligible.currentCompletedCount,
      eligibleCount: husbandEligible.eligibleCount,
    });
    expect(daily.total_completion_count).toBe(2);
    expect(allEligible.eligibleCount).toBe(MAIN_PRAYER_COUNT);
    expect(husbandEligible.eligibleCount).toBe(MAIN_PRAYER_COUNT - 1);
    expect(shareAll).toContain(`/ ${MAIN_PRAYER_COUNT}`);
    expect(shareHusband).toContain(`/ ${MAIN_PRAYER_COUNT - 1}`);
    expect(shareHusband).not.toContain(`/ ${MAIN_PRAYER_COUNT}`);
    expect(eligibleCountFromSummary({ eligible_count: husbandEligible.eligibleCount, items: [] })).toBe(26);
  });
});
