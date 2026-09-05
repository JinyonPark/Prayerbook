import { MAIN_PRAYER_COUNT } from "@/lib/prayers/catalog";

export const MAIN_PRAYER_TOTAL = MAIN_PRAYER_COUNT;
export const MAX_COMPLETION_COUNT = 10_000;

export type ProgressCounts = {
  mainCounts: number[];
  supplementaryCounts?: number[];
};

export type ProgressSummary = {
  totalCompleted: number;
  currentRound: number;
  currentCompletedCount: number;
  progressPercent: number;
};

export type PrayerCountItem = {
  id: string;
  category: "main" | "supplementary";
  countsTowardTotal: boolean;
  itemNumber: number | null;
  displayOrder: number;
  completionCount: number;
};

export function normalizeCount(value: number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return value;
}

export function calculateProgress(mainCounts: Array<number | null | undefined>): ProgressSummary {
  const counts = Array.from({ length: MAIN_PRAYER_TOTAL }, (_, index) =>
    normalizeCount(mainCounts[index]),
  );
  const totalCompleted = counts.length === 0 ? 0 : Math.min(...counts);
  const currentRound = totalCompleted + 1;
  const currentCompletedCount = counts.filter((count) => count >= currentRound).length;
  const progressPercent = (currentCompletedCount / MAIN_PRAYER_TOTAL) * 100;

  return {
    totalCompleted,
    currentRound,
    currentCompletedCount,
    progressPercent,
  };
}

export function calculateProgressFromItems(items: PrayerCountItem[]): ProgressSummary {
  const mainItems = items
    .filter((item) => item.category === "main" && item.countsTowardTotal)
    .sort((a, b) => (a.itemNumber ?? 0) - (b.itemNumber ?? 0));

  const counts = Array.from({ length: MAIN_PRAYER_TOTAL }, (_, index) => {
    const item = mainItems.find((candidate) => candidate.itemNumber === index + 1);
    return item ? item.completionCount : 0;
  });

  return calculateProgress(counts);
}

export function isCompletedInCurrentRound(
  completionCount: number,
  currentRound: number,
): boolean {
  return completionCount >= currentRound;
}

export function findNextIncomplete(items: PrayerCountItem[], currentRound: number): PrayerCountItem | null {
  const incomplete = items
    .filter(
      (item) =>
        item.category === "main" &&
        item.countsTowardTotal &&
        item.completionCount < currentRound,
    )
    .sort((a, b) => a.displayOrder - b.displayOrder);

  return incomplete[0] ?? null;
}

export function previewCurrentRoundReset(items: PrayerCountItem[]): PrayerCountItem[] {
  const { totalCompleted } = calculateProgressFromItems(items);
  return items.map((item) => {
    if (item.category !== "main" || !item.countsTowardTotal) return item;
    if (item.completionCount > totalCompleted) {
      return { ...item, completionCount: totalCompleted };
    }
    return item;
  });
}

export function previewMainFullReset(items: PrayerCountItem[]): PrayerCountItem[] {
  return items.map((item) =>
    item.category === "main" ? { ...item, completionCount: 0 } : item,
  );
}

export function previewAllFullReset(items: PrayerCountItem[]): PrayerCountItem[] {
  return items.map((item) => ({ ...item, completionCount: 0 }));
}

export function previewBulkSetMain(items: PrayerCountItem[], newCount: number): PrayerCountItem[] {
  return items.map((item) =>
    item.category === "main" ? { ...item, completionCount: newCount } : item,
  );
}

export function previewSetCount(
  items: PrayerCountItem[],
  prayerItemId: string,
  newCount: number,
): PrayerCountItem[] {
  return items.map((item) =>
    item.id === prayerItemId ? { ...item, completionCount: newCount } : item,
  );
}

export function previewItemReset(items: PrayerCountItem[], prayerItemId: string): PrayerCountItem[] {
  return previewSetCount(items, prayerItemId, 0);
}

export function previewComplete(items: PrayerCountItem[], prayerItemId: string): PrayerCountItem[] {
  return items.map((item) =>
    item.id === prayerItemId ? { ...item, completionCount: item.completionCount + 1 } : item,
  );
}
