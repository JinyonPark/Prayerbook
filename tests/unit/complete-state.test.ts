import { describe, expect, it } from "vitest";
import { applyCompleteResultToSummary } from "@/lib/progress/complete-state";
import type { CompletePrayerResult, RpcProgressSummary } from "@/lib/progress/types";

const previous: RpcProgressSummary = {
  total_completed: 0,
  current_round: 1,
  current_completed_count: 0,
  progress_percent: 0,
  eligible_count: 26,
  items: [
    {
      prayer_item_id: "m1",
      slug: "dawn",
      title: "새벽 기도",
      item_number: 1,
      category: "main",
      counts_toward_total: true,
      display_order: 1,
      completion_count: 0,
      is_completed_in_current_round: false,
    },
  ],
};

const result: CompletePrayerResult = {
  prayer_item_id: "m1",
  completion_count: 1,
  previous_count: 0,
  previous_total: 0,
  current_total: 0,
  total_completed: 0,
  total_changed: false,
  current_round: 1,
  current_completed_count: 1,
  eligible_count: 26,
  progress_percent: 100 / 26,
  today_completion_count: 3,
  today_unique_prayer_count: 2,
  lifetime_completion_count: 80,
  operation_id: null,
  affected_items: [{ prayer_item_id: "m1", before_count: 0, after_count: 1 }],
};

describe("완료 응답으로 화면 상태 갱신", () => {
  it("전체 items JSON 없이 현재 항목 횟수와 진행률을 반영한다", () => {
    const next = applyCompleteResultToSummary(previous, result, "m1");
    expect(next.items).toHaveLength(1);
    expect(next.items[0]?.completion_count).toBe(1);
    expect(next.items[0]?.is_completed_in_current_round).toBe(true);
    expect(next.current_completed_count).toBe(1);
    expect(next.total_completed).toBe(0);
  });

  it("오늘·누적 횟수는 완료 RPC 숫자가 아니라 로컬 적용 결과를 쓴다", () => {
    expect(result.today_completion_count).toBe(3);
  });
});
