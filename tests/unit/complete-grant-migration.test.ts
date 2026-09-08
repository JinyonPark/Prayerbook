import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("complete grants migration", () => {
  const sql = readFileSync(path.join(process.cwd(), "supabase/migrations/20240908000013_complete_grants_indexes.sql"), "utf8");

  it("완료 횟수와 기존 이력을 변경하지 않는다", () => {
    expect(sql).not.toMatch(/update public\.user_prayer_progress/i);
    expect(sql).not.toMatch(/delete from public\.user_prayer_progress/i);
    expect(sql).not.toMatch(/delete from public\.prayer_progress_operations/i);
    expect(sql).not.toMatch(/update auth\.users/i);
  });

  it("complete_prayer 실행 권한을 재확인한다", () => {
    expect(sql).toContain("grant execute on function public.complete_prayer(uuid, uuid) to authenticated");
  });
});
