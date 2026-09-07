import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("daily prayer summary migration", () => {
  const sql = readFileSync(path.join(process.cwd(), "supabase/migrations/20240907000011_daily_prayer_summary.sql"), "utf8");

  it("완료 횟수와 기존 이력을 변경하지 않는다", () => {
    expect(sql).not.toMatch(/update public\.user_prayer_progress/i);
    expect(sql).not.toMatch(/delete from public\.user_prayer_progress/i);
    expect(sql).not.toMatch(/delete from public\.prayer_progress_operations/i);
    expect(sql).not.toMatch(/update auth\.users/i);
  });

  it("time_zone 기본값과 complete 집계 RPC를 추가한다", () => {
    expect(sql).toContain("time_zone text not null default 'Asia/Seoul'");
    expect(sql).toContain("get_daily_prayer_summary");
    expect(sql).toContain("operation_type = 'complete'");
    expect(sql).toContain("internal_require_user");
    expect(sql).toContain("auth.uid()");
    expect(sql).toContain("client_event_id");
    expect(sql).toContain("prayer_progress_operations_user_type_created_idx");
    expect(sql).toContain("grant execute on function public.get_daily_prayer_summary(date) to authenticated");
  });
});
