import { displayedLifetimeCount, uniqueItemCount } from "@/lib/local-prayer-db/calc";
import type { DailyHistory, PrayerLabel, UserStats } from "@/lib/local-prayer-db/types";
import type { DailyPrayerSummary } from "@/lib/progress/daily";

export type ActivityStats = {
  todayCompletionCount: number;
  appCompletionCount: number;
  initialCompletionCount: number;
  displayedLifetimeCount: number;
  todayDate: string;
  timeZone: string;
  bootstrapStatus: UserStats["bootstrapStatus"];
};

export function activityStatsFromUserStats(stats: UserStats): ActivityStats {
  return {
    todayCompletionCount: stats.todayCompletionCount,
    appCompletionCount: stats.appCompletionCount,
    initialCompletionCount: stats.initialCompletionCount,
    displayedLifetimeCount: displayedLifetimeCount(stats),
    todayDate: stats.todayDate,
    timeZone: stats.timeZone,
    bootstrapStatus: stats.bootstrapStatus,
  };
}

export function dailySummaryFromLocal(input: {
  stats: UserStats;
  todayHistory: DailyHistory | undefined;
  prayers: PrayerLabel[];
}): DailyPrayerSummary {
  const labels = new Map(input.prayers.map((item) => [item.id, item]));
  const itemCounts = input.todayHistory?.itemCounts ?? {};
  const items = Object.entries(itemCounts)
    .filter(([, count]) => count > 0)
    .map(([prayerItemId, completion_count]) => {
      const prayer = labels.get(prayerItemId);
      return {
        prayer_item_id: prayerItemId,
        prayer_title: prayer?.title ?? "기도",
        item_number: prayer?.itemNumber ?? null,
        category: prayer?.category ?? "main",
        completion_count,
        display_order: prayer?.displayOrder ?? 9999,
      };
    })
    .sort((left, right) => {
      const leftNumber = left.item_number ?? 1000;
      const rightNumber = right.item_number ?? 1000;
      if (leftNumber !== rightNumber) return leftNumber - rightNumber;
      return left.display_order - right.display_order;
    })
    .map((item) => ({
      prayer_item_id: item.prayer_item_id,
      prayer_title: item.prayer_title,
      item_number: item.item_number,
      category: item.category,
      completion_count: item.completion_count,
    }));

  let mainCount = 0;
  let supplementaryCount = 0;
  for (const item of items) {
    if (item.category === "supplementary") supplementaryCount += item.completion_count;
    else mainCount += item.completion_count;
  }

  return {
    local_date: input.stats.todayDate,
    time_zone: input.stats.timeZone,
    total_completion_count: input.stats.todayCompletionCount,
    unique_prayer_count: uniqueItemCount(itemCounts),
    main_prayer_completion_count: mainCount,
    supplementary_prayer_completion_count: supplementaryCount,
    lifetime_completion_count: displayedLifetimeCount(input.stats),
    items,
  };
}

export function historyRowsFromDaily(
  rows: DailyHistory[],
  prayers: PrayerLabel[],
): Array<{
  localDate: string;
  totalCompletionCount: number;
  uniquePrayerCount: number;
  items: Array<{ prayerItemId: string; title: string; itemNumber: number | null; completionCount: number }>;
}> {
  const labels = new Map(prayers.map((item) => [item.id, item]));
  return rows.map((row) => {
    const items = Object.entries(row.itemCounts)
      .filter(([, count]) => count > 0)
      .map(([prayerItemId, completionCount]) => {
        const prayer = labels.get(prayerItemId);
        return {
          prayerItemId,
          title: prayer?.title ?? "기도",
          itemNumber: prayer?.itemNumber ?? null,
          completionCount,
          displayOrder: prayer?.displayOrder ?? 9999,
        };
      })
      .sort((left, right) => {
        const leftNumber = left.itemNumber ?? 1000;
        const rightNumber = right.itemNumber ?? 1000;
        if (leftNumber !== rightNumber) return leftNumber - rightNumber;
        return left.displayOrder - right.displayOrder;
      })
      .map((item) => ({
        prayerItemId: item.prayerItemId,
        title: item.title,
        itemNumber: item.itemNumber,
        completionCount: item.completionCount,
      }));
    return {
      localDate: row.localDate,
      totalCompletionCount: row.totalCompletionCount,
      uniquePrayerCount: uniqueItemCount(row.itemCounts),
      items,
    };
  });
}
