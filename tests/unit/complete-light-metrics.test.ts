import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("경량 완료 RPC", () => {
  const sql = readFileSync(
    path.join(process.cwd(), "supabase/migrations/20240909000023_complete_light_metrics.sql"),
    "utf8",
  );

  it("완료 이력과 사용자를 삭제하지 않는다", () => {
    expect(sql).not.toMatch(/delete from public\.prayer_progress_operations/i);
    expect(sql).not.toMatch(/delete from public\.user_prayer_progress/i);
    expect(sql).not.toMatch(/update auth\.users/i);
    expect(sql).not.toMatch(/delete from auth\.users/i);
  });

  it("complete_prayer는 전체 snapshot 대신 숫자만 계산한다", () => {
    const completeFn = sql.slice(sql.indexOf("create or replace function public.complete_prayer"));
    const nextFn = completeFn.indexOf("create or replace function public.get_home_dashboard_summary");
    const body = completeFn.slice(0, nextFn);
    expect(body).toContain("internal_total_completed");
    expect(body).toContain("internal_progress_metrics");
    expect(body).not.toContain("internal_progress_snapshot");
    expect(body).not.toContain("'items'");
    expect(body).toContain("today_completion_count");
    expect(body).toContain("lifetime_completion_count");
    expect(body).toContain("internal_apply_daily_complete");
    expect(body).toContain("internal_apply_lifetime_complete");
    expect(body).not.toContain("prayer_progress_operations");
  });

  it("홈 요약 RPC와 경량 함수를 추가한다", () => {
    expect(sql).toContain("create or replace function public.internal_total_completed");
    expect(sql).toContain("create or replace function public.internal_progress_metrics");
    expect(sql).toContain("create or replace function public.get_home_dashboard_summary");
    expect(sql).toContain("grant execute on function public.get_home_dashboard_summary() to authenticated");
  });
});
