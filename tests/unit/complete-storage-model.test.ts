import { describe, expect, it } from "vitest";
import { InMemoryProgressStore } from "@/lib/progress/store";
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
  ];
}

describe("완료 저장 최적화(메모리 모델)", () => {
  it("서로 다른 client_event_id 20개는 +20, 같은 id 20개는 +1", () => {
    const store = new InMemoryProgressStore(catalog());
    store.seedUser("a");
    for (let i = 0; i < 20; i += 1) store.complete("a", "m1", crypto.randomUUID());
    expect(store.completionCount("a", "m1")).toBe(20);

    const store2 = new InMemoryProgressStore(catalog());
    store2.seedUser("b");
    const eventId = crypto.randomUUID();
    for (let i = 0; i < 20; i += 1) store2.complete("b", "m1", eventId);
    expect(store2.completionCount("b", "m1")).toBe(1);
  });
});
