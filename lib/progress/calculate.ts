import { MAIN_PRAYER_COUNT } from "@/lib/prayers/catalog";
import { excludedSpouseItemNumber, type SpousePrayerSelection } from "@/lib/progress/spouse";

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
  eligibleCount: number;
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

export function isProgressEligible(item: PrayerCountItem, selection: SpousePrayerSelection = null): boolean {
  if (item.category !== "main" || !item.countsTowardTotal) return false;
  const excluded = excludedSpouseItemNumber(selection);
  if (excluded !== null && item.itemNumber === excluded) return false;
  return true;
}

export function eligiblePrayerItems(
  items: PrayerCountItem[],
  selection: SpousePrayerSelection = null,
): PrayerCountItem[] {
  return items
    .filter((item) => isProgressEligible(item, selection))
    .sort((a, b) => (a.itemNumber ?? 0) - (b.itemNumber ?? 0));
}

function summaryFromEligible(eligible: PrayerCountItem[]): ProgressSummary {
  const eligibleCount = eligible.length;
  if (eligibleCount === 0) {
    return {
      totalCompleted: 0,
      currentRound: 1,
      currentCompletedCount: 0,
      progressPercent: 0,
      eligibleCount: 0,
    };
  }
  const counts = eligible.map((item) => normalizeCount(item.completionCount));
  const totalCompleted = Math.min(...counts);
  const currentRound = totalCompleted + 1;
  const currentCompletedCount = counts.filter((count) => count >= currentRound).length;
  return {
    totalCompleted,
    currentRound,
    currentCompletedCount,
    progressPercent: (currentCompletedCount / eligibleCount) * 100,
    eligibleCount,
  };
}

export function calculateProgress(mainCounts: Array<number | null | undefined>): ProgressSummary {
  const counts = Array.from({ length: MAIN_PRAYER_TOTAL }, (_, index) =>
    normalizeCount(mainCounts[index]),
  );
  return summaryFromEligible(
    counts.map((completionCount, index) => ({
      id: `main-${index + 1}`,
      category: "main",
      countsTowardTotal: true,
      itemNumber: index + 1,
      displayOrder: index + 1,
      completionCount,
    })),
  );
}

export function calculateProgressFromItems(
  items: PrayerCountItem[],
  selection: SpousePrayerSelection = null,
): ProgressSummary {
  return summaryFromEligible(eligiblePrayerItems(items, selection));
}

export function eligibleCountFromSummary(summary: {
  eligible_count?: number;
  items?: Array<{ counts_toward_total: boolean; excluded_from_progress?: boolean }>;
} | null | undefined): number {
  if (typeof summary?.eligible_count === "number") return summary.eligible_count;
  const items = summary?.items ?? [];
  return items.filter((item) => item.counts_toward_total && !item.excluded_from_progress).length;
}

export function isCompletedInCurrentRound(
  completionCount: number,
  currentRound: number,
): boolean {
  return completionCount >= currentRound;
}

export function findNextIncomplete(
  items: PrayerCountItem[],
  currentRound: number,
  selection: SpousePrayerSelection = null,
): PrayerCountItem | null {
  const incomplete = items
    .filter(
      (item) =>
        isProgressEligible(item, selection) &&
        item.completionCount < currentRound,
    )
    .sort((a, b) => a.displayOrder - b.displayOrder);

  return incomplete[0] ?? null;
}

export function previewCurrentRoundReset(
  items: PrayerCountItem[],
  selection: SpousePrayerSelection = null,
): PrayerCountItem[] {
  const { totalCompleted } = calculateProgressFromItems(items, selection);
  return items.map((item) => {
    if (!isProgressEligible(item, selection)) return item;
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
