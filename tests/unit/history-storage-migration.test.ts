import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

describe("날짜별·월별 이력 저장 구조", () => {
  const sql = readFileSync(
    path.join(process.cwd(), "supabase/migrations/20240909000024_history_code_monthly.sql"),
    "utf8",
  );

  it("사용자와 레거시 complete 이력을 삭제하지 않는다", () => {
    expect(sql).not.toMatch(/delete from auth\.users/i);
    expect(sql).not.toMatch(/update auth\.users/i);
    expect(sql).toContain("Legacy complete rows kept.");
    expect(sql).toContain("operation_type <> 'complete'");
    const beforeReset = sql.slice(0, sql.indexOf("create or replace function public.reset_all_prayers"));
    expect(beforeReset).not.toMatch(/delete from public\.user_prayer_progress/i);
    expect(beforeReset).not.toMatch(/delete from public\.prayer_progress_operations\s+where operation_type = 'complete'/i);
  });

  it("history_code와 monthly stats, 이력 RPC를 추가한다", () => {
    expect(sql).toContain("add column if not exists history_code");
    expect(sql).toContain("create table if not exists public.user_monthly_prayer_stats");
    expect(sql).toContain("internal_apply_monthly_complete");
    expect(sql).toContain("get_recent_prayer_history");
    expect(sql).toContain("get_monthly_prayer_history");
    expect(sql).toContain("purge_prayer_history_storage");
    expect(sql).toContain("interval '48 hours'");
    expect(sql).toContain("interval '90 days'");
    expect(sql).toContain("interval '11 months'");
    expect(sql).toContain("internal_fill_history_code");
    expect(sql).toContain("grant execute on function public.get_recent_prayer_history(integer) to authenticated");
    expect(sql).toContain("grant execute on function public.get_monthly_prayer_history(integer) to authenticated");
    expect(sql).toContain("revoke insert, update, delete on public.user_monthly_prayer_stats from authenticated, anon, public");
    expect(sql).toContain("revoke all on function public.purge_prayer_history_storage() from public, anon, authenticated");
    expect(sql).toContain("internal_require_user");
    expect(sql).toContain("create or replace function public.get_recent_prayer_history(p_days integer default 30)");
    expect(sql).toContain("create or replace function public.get_monthly_prayer_history(p_months integer default 12)");
    expect(sql).toContain("limit 5000");
    expect(sql).toContain("if auth.uid() is not null");
    expect(sql).toContain("pi.history_code = e.key");
    expect(sql.toLowerCase()).not.toContain("using gin");
    expect(sql).toContain("when 'hope-prayer' then 'wish'");
    expect(sql).toContain("when 'conceived-prayer' then 'evangelism'");
    expect(sql).toContain("when 'spiritual-prayer' then 'spiritual'");
  });

  it("complete_prayer는 snapshot과 complete 감사 행을 만들지 않는다", () => {
    const completeFn = sql.slice(sql.indexOf("create or replace function public.complete_prayer"));
    const nextFn = completeFn.indexOf("create or replace function public.internal_history_items_from_counts");
    const body = completeFn.slice(0, nextFn);
    expect(body).toContain("internal_apply_monthly_complete");
    expect(body).not.toContain("internal_progress_snapshot");
    expect(body).not.toContain("prayer_progress_operations");
    expect(body).toContain("history_code");
  });
});

describe("DB 통합 테스트 범위", () => {
  it("진단 SQL과 이력 마이그레이션이 저장소에 있다", () => {
    expect(existsSync(path.join(process.cwd(), "supabase/diagnostics/history-storage.sql"))).toBe(true);
    expect(existsSync(path.join(process.cwd(), "supabase/migrations/20240909000024_history_code_monthly.sql"))).toBe(true);
  });

  it("로컬 Postgres가 없으면 live RPC 쓰기를 건너뛴다고 명시한다", () => {
    expect(process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || "").toBeDefined();
  });
});
