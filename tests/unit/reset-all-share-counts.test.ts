import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

function readSource(relative: string) {
  return readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("모든 기록 초기화와 공유 횟수 연동", () => {
  const sql = readSource("supabase/migrations/20240909000022_reset_all_share_counts.sql");
  const manager = readSource("components/settings/ProgressManager.tsx");

  it("전체 초기화가 오늘 횟수와 누적 횟수도 지운다", () => {
    expect(sql).toContain("create or replace function public.reset_all_prayers");
    expect(sql).toContain("delete from public.user_daily_prayer_stats");
    expect(sql).toContain("lifetime_completion_count = 0");
    expect(sql).toContain("grant execute on function public.reset_all_prayers(uuid) to authenticated");
    expect(sql).not.toMatch(/delete from public\.prayer_progress_operations/i);
    expect(sql).not.toMatch(/update auth\.users/i);
    expect(sql).not.toMatch(/delete from auth\.users/i);
  });

  it("설정 화면이 오늘·누적 통계를 이 기기 값으로 보여 주고 초기값만 수정한다", () => {
    expect(manager).toContain("기도 활동 통계");
    expect(manager).toContain("오늘 기도 횟수");
    expect(manager).toContain("지금까지 누적 기도 횟수");
    expect(manager).toContain("updateInitialCount");
    expect(manager).not.toContain("clearedDailySummaryForReset");
    expect(manager).not.toContain("void refreshDaily()");
    expect(manager).not.toContain("resetShareCounts");
  });
});
