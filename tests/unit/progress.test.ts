import { describe, expect, it } from "vitest";
import { MAIN_PRAYER_COUNT } from "@/lib/prayers/catalog";
import {
  calculateProgress,
  calculateProgressFromItems,
  findNextIncomplete,
  previewComplete,
  previewCurrentRoundReset,
  type PrayerCountItem,
} from "@/lib/progress/calculate";

function counts(values: number[]): number[] {
  return values;
}

function itemsFromMain(values: number[], extra = 0): PrayerCountItem[] {
  const main: PrayerCountItem[] = values.map((completionCount, index) => ({
    id: `main-${index + 1}`,
    category: "main",
    countsTowardTotal: true,
    itemNumber: index + 1,
    displayOrder: index + 1,
    completionCount,
  }));
  main.push({
    id: "hope",
    category: "supplementary",
    countsTowardTotal: false,
    itemNumber: null,
    displayOrder: MAIN_PRAYER_COUNT + 1,
    completionCount: extra,
  });
  return main;
}

describe("Total N독 계산", () => {
  it("모든 완료 횟수가 0이면 Total 0독", () => {
    const result = calculateProgress(Array(MAIN_PRAYER_COUNT).fill(0));
    expect(result).toMatchObject({
      totalCompleted: 0,
      currentRound: 1,
      currentCompletedCount: 0,
    });
  });

  it(`한 항목만 1회이면 Total 0독, 진행 1/${MAIN_PRAYER_COUNT}`, () => {
    const values = Array(MAIN_PRAYER_COUNT).fill(0);
    values[0] = 1;
    const result = calculateProgress(values);
    expect(result.totalCompleted).toBe(0);
    expect(result.currentRound).toBe(1);
    expect(result.currentCompletedCount).toBe(1);
  });

  it(`1~${MAIN_PRAYER_COUNT}번이 모두 1회이면 Total 1독`, () => {
    const result = calculateProgress(Array(MAIN_PRAYER_COUNT).fill(1));
    expect(result.totalCompleted).toBe(1);
    expect(result.currentRound).toBe(2);
    expect(result.currentCompletedCount).toBe(0);
  });

  it(`${MAIN_PRAYER_COUNT - 1}개가 10회이고 1개가 9회이면 Total 9독, 진행 ${MAIN_PRAYER_COUNT - 1}/${MAIN_PRAYER_COUNT}`, () => {
    const values = Array(MAIN_PRAYER_COUNT).fill(10);
    values[MAIN_PRAYER_COUNT - 1] = 9;
    const result = calculateProgress(values);
    expect(result.totalCompleted).toBe(9);
    expect(result.currentRound).toBe(10);
    expect(result.currentCompletedCount).toBe(MAIN_PRAYER_COUNT - 1);
    expect(result.progressPercent).toBeCloseTo(((MAIN_PRAYER_COUNT - 1) / MAIN_PRAYER_COUNT) * 100);
  });

  it("마지막 항목을 1회 증가시키면 Total 10독", () => {
    const values = Array(MAIN_PRAYER_COUNT).fill(10);
    values[MAIN_PRAYER_COUNT - 1] = 9;
    const after = [...values];
    after[MAIN_PRAYER_COUNT - 1] = 10;
    const result = calculateProgress(after);
    expect(result.totalCompleted).toBe(10);
    expect(result.currentRound).toBe(11);
    expect(result.currentCompletedCount).toBe(0);
  });

  it(`한 항목이 5회이고 나머지가 2회이면 Total 2독, 진행 1/${MAIN_PRAYER_COUNT}`, () => {
    const values = Array(MAIN_PRAYER_COUNT).fill(2);
    values[2] = 5;
    const result = calculateProgress(values);
    expect(result.totalCompleted).toBe(2);
    expect(result.currentRound).toBe(3);
    expect(result.currentCompletedCount).toBe(1);
  });

  it("추가 기도 완료 횟수는 Total에 영향 없음", () => {
    const withoutExtra = calculateProgressFromItems(itemsFromMain(Array(MAIN_PRAYER_COUNT).fill(1), 0));
    const withExtra = calculateProgressFromItems(itemsFromMain(Array(MAIN_PRAYER_COUNT).fill(1), 40));
    expect(withExtra.totalCompleted).toBe(withoutExtra.totalCompleted);
    expect(withExtra.currentCompletedCount).toBe(withoutExtra.currentCompletedCount);
  });

  it("progress row가 없으면 0회로 계산", () => {
    const result = calculateProgress([]);
    expect(result.totalCompleted).toBe(0);
    expect(result.currentRound).toBe(1);
  });

  it("항목 횟수를 줄이면 Total이 정상적으로 감소", () => {
    const before = calculateProgress(Array(MAIN_PRAYER_COUNT).fill(3));
    const afterValues = Array(MAIN_PRAYER_COUNT).fill(3);
    afterValues[0] = 1;
    const after = calculateProgress(afterValues);
    expect(before.totalCompleted).toBe(3);
    expect(after.totalCompleted).toBe(1);
  });

  it("현재 독수 초기화 후 완료된 Total은 유지", () => {
    const values = Array(MAIN_PRAYER_COUNT).fill(3);
    values[0] = 5;
    values[1] = 4;
    const items = itemsFromMain(values, 7);
    const reset = previewCurrentRoundReset(items);
    const result = calculateProgressFromItems(reset);
    expect(result.totalCompleted).toBe(3);
    expect(result.currentCompletedCount).toBe(0);
    expect(reset.find((item) => item.id === "hope")?.completionCount).toBe(7);
  });

  it("다음 미완료 기도는 display_order가 앞선 미완료 항목", () => {
    const values = Array(MAIN_PRAYER_COUNT).fill(1);
    values[0] = 2;
    values[2] = 0;
    const items = itemsFromMain(values);
    const next = findNextIncomplete(items, 2);
    expect(next?.itemNumber).toBe(2);
  });

  it("완료 미리보기는 해당 항목만 1 증가", () => {
    const items = itemsFromMain(counts(Array(MAIN_PRAYER_COUNT).fill(0)));
    const after = previewComplete(items, "main-1");
    expect(after[0]?.completionCount).toBe(1);
    expect(after[1]?.completionCount).toBe(0);
  });
});
