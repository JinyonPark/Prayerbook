import { describe, expect, it } from "vitest";
import { InMemoryProgressStore } from "@/lib/progress/store";
import { parseCountInput } from "@/lib/validation/count";
import { MAIN_PRAYER_COUNT } from "@/lib/prayers/catalog";
import type { PrayerCountItem } from "@/lib/progress/calculate";

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

describe("횟수 수정 및 초기화", () => {
  it("항목 횟수 3회 → 5회", () => {
    const store = new InMemoryProgressStore(catalog());
    store.seedUser("a", { m1: 3 });
    const result = store.setCount("a", "m1", 5, crypto.randomUUID());
    expect(result.affectedItems[0]?.afterCount).toBe(5);
  });

  it("항목 횟수 5회 → 2회", () => {
    const store = new InMemoryProgressStore(catalog());
    store.seedUser("a", { m1: 5 });
    const result = store.setCount("a", "m1", 2, crypto.randomUUID());
    expect(result.affectedItems[0]?.afterCount).toBe(2);
  });

  it("0회 설정 가능", () => {
    const store = new InMemoryProgressStore(catalog());
    store.seedUser("a", { m1: 4 });
    store.setCount("a", "m1", 0, crypto.randomUUID());
    expect(store.summary("a").totalCompleted).toBe(0);
  });

  it("음수 입력 거부", () => {
    expect(parseCountInput("-1").ok).toBe(false);
    const store = new InMemoryProgressStore(catalog());
    store.seedUser("a");
    expect(() => store.setCount("a", "m1", -1, crypto.randomUUID())).toThrow("INVALID_COUNT");
  });

  it("소수 입력 거부", () => {
    expect(parseCountInput("1.5").ok).toBe(false);
    const store = new InMemoryProgressStore(catalog());
    store.seedUser("a");
    expect(() => store.setCount("a", "m1", 1.5, crypto.randomUUID())).toThrow("INVALID_COUNT");
  });

  it("문자 입력 거부", () => {
    expect(parseCountInput("열번").ok).toBe(false);
  });

  it("특정 항목 초기화 시 그 항목만 0회", () => {
    const store = new InMemoryProgressStore(catalog());
    store.seedUser("a", { m1: 6, m2: 4 });
    store.resetItem("a", "m1", crypto.randomUUID());
    expect(store.summary("a").totalCompleted).toBe(0);
  });

  it("현재 독수 초기화 시 초과 횟수만 Total 수준으로 감소", () => {
    const counts: Record<string, number> = {};
    for (let i = 1; i <= MAIN_PRAYER_COUNT; i += 1) counts[`m${i}`] = 3;
    counts.m1 = 5;
    counts.s1 = 9;
    const store = new InMemoryProgressStore(catalog());
    store.seedUser("a", counts);
    const result = store.resetCurrentRound("a", crypto.randomUUID());
    expect(result.currentTotal).toBe(3);
    expect(result.currentCompletedCount).toBe(0);
  });

  it(`기본 기도 초기화 시 1~${MAIN_PRAYER_COUNT}번만 0회`, () => {
    const counts: Record<string, number> = { s1: 4 };
    for (let i = 1; i <= MAIN_PRAYER_COUNT; i += 1) counts[`m${i}`] = 2;
    const store = new InMemoryProgressStore(catalog());
    store.seedUser("a", counts);
    store.resetMain("a", crypto.randomUUID());
    expect(store.summary("a").totalCompleted).toBe(0);
  });

  it("모든 기록 초기화 시 추가 기도까지 0회", () => {
    const store = new InMemoryProgressStore(catalog());
    store.seedUser("a", { m1: 2, s1: 8 });
    const result = store.resetAll("a", crypto.randomUUID());
    expect(result.affectedItems.some((item) => item.prayerItemId === "s1" && item.afterCount === 0)).toBe(true);
  });

  it("일괄 10회 설정 시 Total 10독", () => {
    const store = new InMemoryProgressStore(catalog());
    store.seedUser("a");
    const result = store.bulkSetMain("a", 10, crypto.randomUUID());
    expect(result.currentTotal).toBe(10);
    expect(result.currentRound).toBe(11);
    expect(result.currentCompletedCount).toBe(0);
  });

  it("수정 후 Total과 진행률 즉시 재계산", () => {
    const store = new InMemoryProgressStore(catalog());
    const counts: Record<string, number> = {};
    for (let i = 1; i <= MAIN_PRAYER_COUNT; i += 1) counts[`m${i}`] = 1;
    store.seedUser("a", counts);
    const result = store.setCount("a", `m${MAIN_PRAYER_COUNT}`, 0, crypto.randomUUID());
    expect(result.currentTotal).toBe(0);
    expect(result.currentCompletedCount).toBe(MAIN_PRAYER_COUNT - 1);
  });

  it("작업 중 실패 시 전체 트랜잭션 롤백", () => {
    const store = new InMemoryProgressStore(catalog());
    store.seedUser("a", { m1: 4 });
    expect(() => store.setCount("a", "missing", 1, crypto.randomUUID())).toThrow();
    expect(store.summary("a").totalCompleted).toBe(0);
  });

  it("동일 client_event_id가 중복 적용되지 않음", () => {
    const store = new InMemoryProgressStore(catalog());
    store.seedUser("a");
    const eventId = crypto.randomUUID();
    store.complete("a", "m1", eventId);
    const again = store.complete("a", "m1", eventId);
    expect(again.idempotent).toBe(true);
    expect(again.affectedItems[0]?.afterCount).toBe(1);
  });
});
