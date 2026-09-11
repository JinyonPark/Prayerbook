import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

function read(relative: string) {
  return readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("로컬 이력 RPC 최적화", () => {
  const sql = read(path.join("supabase/migrations/20240909000025_optimize_progress_rpc_for_local_history.sql"));

  it("새 테이블이나 데이터 컬럼을 만들지 않는다", () => {
    expect(sql).not.toMatch(/create table/i);
    expect(sql).not.toMatch(/alter table[\s\S]*add column/i);
    expect(sql).not.toContain("user_daily_prayer_stats");
    expect(sql).not.toContain("user_monthly_prayer_stats");
    expect(sql).not.toContain("user_prayer_totals");
  });

  it("complete_prayer는 operation item과 전체 snapshot을 쓰지 않는다", () => {
    const completeFn = sql.slice(sql.indexOf("create or replace function public.complete_prayer"));
    const nextFn = completeFn.indexOf("create or replace function public.get_home_dashboard_summary");
    const body = completeFn.slice(0, nextFn);
    expect(body).toContain("internal_progress_metrics");
    expect(body).toContain("internal_total_completed");
    expect(body).not.toContain("internal_progress_snapshot");
    expect(body).not.toContain("internal_apply_daily_complete");
    expect(body).not.toContain("prayer_progress_operation_items");
    expect(body).not.toContain("'items'");
    expect(body).toContain("idempotent");
  });

  it("수동 RPC는 operation item을 삽입하지 않는다", () => {
    expect(sql).toContain("create or replace function public.internal_insert_changed_item");
    expect(sql).toContain("-- Local history no longer stores per-change detail rows.");
    expect(sql).not.toMatch(/insert into public\.prayer_progress_operation_items/i);
  });

  it("reset_current_round는 배우자 eligibility를 사용한다", () => {
    const reset = sql.slice(sql.indexOf("create or replace function public.reset_current_round"));
    const next = reset.indexOf("create or replace function public.reset_main_prayers");
    const body = reset.slice(0, next);
    expect(body).toContain("internal_eligible_main_prayers");
    expect(body).not.toContain("prayer_progress_operation_items");
  });

  it("레거시 bootstrap RPC를 추가하고 정리 함수는 service_role만 실행한다", () => {
    expect(sql).toContain("get_legacy_complete_bootstrap");
    expect(sql).toContain("grant execute on function public.get_legacy_complete_bootstrap(timestamptz) to authenticated");
    expect(sql).toContain("purge_short_lived_prayer_operations");
    expect(sql).toContain("grant execute on function public.purge_short_lived_prayer_operations(timestamptz, integer) to service_role");
    expect(sql).toContain("revoke all on function public.purge_short_lived_prayer_operations(timestamptz, integer) from public, anon, authenticated");
  });
});

describe("프런트엔드는 서버 이력을 사용하지 않는다", () => {
  const files = [
    "components/providers/AppProviders.tsx",
    "lib/progress/bootstrap.ts",
    "components/history/HistoryView.tsx",
    "components/dashboard/TodayPrayerCard.tsx",
    "components/dashboard/ShareContentDialog.tsx",
    "components/prayer/PrayerReader.tsx",
    "components/settings/ProgressManager.tsx",
  ];

  it("오늘·누적·이력 화면에서 레거시 이력 RPC를 호출하지 않는다", () => {
    for (const file of files) {
      const source = read(file);
      expect(source).not.toContain("get_daily_prayer_summary");
      expect(source).not.toContain("fetchDailyPrayerSummary");
      expect(source).not.toContain("fetchRecentPrayerHistory");
      expect(source).not.toContain("fetchMonthlyPrayerHistory");
      expect(source).not.toContain("rpcDeleteHistoryOperation");
      expect(source).not.toContain("rpcDeleteAllHistory");
      expect(source).not.toContain("prayer_progress_operation_items");
    }
  });
});
