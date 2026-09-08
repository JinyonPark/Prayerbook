import type { DailyPrayerSummary } from "@/lib/progress/daily";
import { applySuccessfulCompleteToDaily } from "@/lib/progress/daily";
import type { CompletePrayerResult, RpcProgressItem, RpcProgressSummary } from "@/lib/progress/types";

export function applyCompleteResultToSummary(
  previous: RpcProgressSummary | null,
  result: CompletePrayerResult,
  prayerItemId: string,
): RpcProgressSummary {
  const round = result.current_round;
  const nextCount = result.completion_count;
  const items = (previous?.items ?? []).map((item) => {
    const completionCount =
      item.prayer_item_id === prayerItemId && typeof nextCount === "number"
        ? nextCount
        : item.completion_count;
    return withRoundCompletion(item, completionCount, round);
  });
  if (typeof nextCount === "number" && !items.some((item) => item.prayer_item_id === prayerItemId)) {
    const affected = result.affected_items.find((item) => item.prayer_item_id === prayerItemId);
    if (affected) {
      items.push(
        withRoundCompletion(
          {
            prayer_item_id: prayerItemId,
            slug: "",
            title: "",
            item_number: null,
            category: "main",
            counts_toward_total: true,
            display_order: items.length + 1,
            completion_count: nextCount,
            is_completed_in_current_round: nextCount >= round,
          },
          nextCount,
          round,
        ),
      );
    }
  }
  return {
    total_completed: result.total_completed,
    current_round: result.current_round,
    current_completed_count: result.current_completed_count,
    progress_percent: result.progress_percent,
    eligible_count: result.eligible_count ?? previous?.eligible_count,
    spouse_prayer_selection: previous?.spouse_prayer_selection ?? result.spouse_prayer_selection,
    items,
  };
}

function withRoundCompletion(item: RpcProgressItem, completionCount: number, round: number): RpcProgressItem {
  const excluded = Boolean(item.excluded_from_progress);
  return {
    ...item,
    completion_count: completionCount,
    is_completed_in_current_round:
      item.category !== "main" || excluded ? item.is_completed_in_current_round : completionCount >= round,
  };
}

export function applyCompleteResultToDaily(
  previous: DailyPrayerSummary,
  result: CompletePrayerResult,
  input: {
    prayerItemId: string;
    prayerTitle: string;
    itemNumber: number | null;
    category: "main" | "supplementary";
  },
): DailyPrayerSummary {
  if (typeof result.today_completion_count === "number") {
    return {
      ...previous,
      total_completion_count: result.today_completion_count,
      unique_prayer_count: result.today_unique_prayer_count ?? previous.unique_prayer_count,
      lifetime_completion_count: result.lifetime_completion_count ?? previous.lifetime_completion_count,
    };
  }
  return applySuccessfulCompleteToDaily(previous, {
    ...input,
    idempotent: result.idempotent,
  });
}
