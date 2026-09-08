import { describe, expect, it } from "vitest";
import { getAdjacentSequentialPrayers, getNextPrayerItem, getPreviousPrayerItem, getSequentialPrayerItems } from "@/lib/prayers/sequential";
import type { SequentialPrayerItem } from "@/lib/prayers/sequential";

function items(): SequentialPrayerItem[] {
  return [
    { id: "8", slug: "home", title: "가정을 위한 기도", item_number: 8, display_order: 8, is_active: true },
    { id: "9", slug: "husband", title: "남편을 위한 기도", item_number: 9, display_order: 9, is_active: true },
    { id: "10", slug: "wife", title: "아내를 위한 기도", item_number: 10, display_order: 10, is_active: true },
    { id: "11", slug: "parents", title: "부모님을 위한 기도", item_number: 11, display_order: 11, is_active: true },
  ];
}

describe("배우자 순차 이동", () => {
  it("husband 선택 시 8번의 다음은 9번", () => {
    expect(getNextPrayerItem(items(), "home", "husband")?.item_number).toBe(9);
  });

  it("husband 선택 시 9번의 다음은 11번", () => {
    expect(getNextPrayerItem(items(), "husband", "husband")?.item_number).toBe(11);
  });

  it("husband 선택 시 11번의 이전은 9번", () => {
    expect(getPreviousPrayerItem(items(), "parents", "husband")?.item_number).toBe(9);
  });

  it("wife 선택 시 8번의 다음은 10번", () => {
    expect(getNextPrayerItem(items(), "home", "wife")?.item_number).toBe(10);
  });

  it("item_number가 없어도 slug로 아내 선택 시 남편 기도를 건너뛴다", () => {
    const rows = [
      { id: "8", slug: "home", title: "가정을 위한 기도", item_number: null, display_order: 8, is_active: true },
      { id: "9", slug: "husband", title: "남편을 위한 기도", item_number: null, display_order: 9, is_active: true },
      { id: "10", slug: "wife", title: "아내를 위한 기도", item_number: null, display_order: 10, is_active: true },
    ];
    expect(getNextPrayerItem(rows, "home", "wife")?.slug).toBe("wife");
  });

  it("wife 선택 시 10번의 다음은 11번", () => {
    expect(getNextPrayerItem(items(), "wife", "wife")?.item_number).toBe(11);
  });

  it("wife 선택 시 11번의 이전은 10번", () => {
    expect(getPreviousPrayerItem(items(), "parents", "wife")?.item_number).toBe(10);
  });

  it("선택이 없으면 8 → 9 → 10 → 11 순서를 유지한다", () => {
    expect(getSequentialPrayerItems(items(), null).map((item) => item.item_number)).toEqual([8, 9, 10, 11]);
    expect(getNextPrayerItem(items(), "home", null)?.item_number).toBe(9);
    expect(getNextPrayerItem(items(), "husband", null)?.item_number).toBe(10);
    expect(getNextPrayerItem(items(), "wife", null)?.item_number).toBe(11);
  });

  it("여러 후보 중 첫 배우자 선택을 쓴다", async () => {
    const { resolveSpousePrayerSelection } = await import("@/lib/progress/spouse");
    expect(resolveSpousePrayerSelection(null, "wife", "husband")).toBe("wife");
    expect(resolveSpousePrayerSelection(null, null, "husband")).toBe("husband");
    expect(resolveSpousePrayerSelection(null, "unknown")).toBe(null);
  });

  it("husband 선택 상태에서 10번을 직접 열면 이전 9번 다음 11번", () => {
    const adjacent = getAdjacentSequentialPrayers(items(), "wife", "husband");
    expect(adjacent.previous?.item_number).toBe(9);
    expect(adjacent.next?.item_number).toBe(11);
  });

  it("wife 선택 상태에서 9번을 직접 열면 이전 8번 다음 10번", () => {
    const adjacent = getAdjacentSequentialPrayers(items(), "husband", "wife");
    expect(adjacent.previous?.item_number).toBe(8);
    expect(adjacent.next?.item_number).toBe(10);
  });
});
