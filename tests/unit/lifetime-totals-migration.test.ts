import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("lifetime prayer totals migration", () => {
  const sql = readFileSync(
    path.join(process.cwd(), "supabase/migrations/20240909000020_lifetime_prayer_totals.sql"),
    "utf8",
  );

  it("완료 횟수와 기존 이력을 삭제하지 않는다", () => {
    expect(sql).not.toMatch(/delete from public\.user_prayer_progress/i);
    expect(sql).not.toMatch(/update public\.user_prayer_progress/i);
    expect(sql).not.toMatch(/delete from public\.prayer_progress_operations/i);
    expect(sql).not.toMatch(/delete from public\.user_daily_prayer_stats/i);
    expect(sql).not.toMatch(/update auth\.users/i);
    expect(sql).not.toMatch(/delete from auth\.users/i);
  });

  it("user_prayer_totals와 RLS, 완료 RPC 갱신을 추가한다", () => {
    expect(sql).toContain("create table if not exists public.user_prayer_totals");
    expect(sql).toContain("lifetime_completion_count bigint not null default 0");
    expect(sql).toContain("user_id uuid primary key references auth.users(id) on delete cascade");
    expect(sql).toContain("revoke insert, update, delete on public.user_prayer_totals");
    expect(sql).toContain("internal_apply_lifetime_complete");
    expect(sql).toContain("count(distinct op.client_event_id)");
    expect(sql).toContain("sum(s.total_completion_count)");
    expect(sql).not.toContain("from public.user_prayer_progress");
    expect(sql).toContain("lifetime_completion_count', v_lifetime");
    expect(sql).toContain("grant execute on function public.get_daily_prayer_summary(date) to authenticated");
  });

  it("complete_prayer는 중복 요청에서 lifetime을 두 번 올리지 않는다", () => {
    const completeFn = sql.slice(sql.indexOf("create or replace function public.complete_prayer"));
    const nextFn = completeFn.indexOf("create or replace function public.get_daily_prayer_summary");
    const body = completeFn.slice(0, nextFn);
    expect(body).toContain("internal_begin_command");
    expect(body).toContain("internal_apply_lifetime_complete");
    expect(body).toContain("idempotent");
    expect(body).toContain("claimed");
    expect(sql).toContain("auth.uid()");
  });
});
