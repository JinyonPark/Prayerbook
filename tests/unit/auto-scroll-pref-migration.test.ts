import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("auto_scroll_enabled migration", () => {
  const sql = readFileSync(path.join(process.cwd(), "supabase/migrations/20240907000012_auto_scroll_enabled.sql"), "utf8");

  it("완료 횟수와 기존 이력을 변경하지 않는다", () => {
    expect(sql).not.toMatch(/update public\.user_prayer_progress/i);
    expect(sql).not.toMatch(/delete from public\.user_prayer_progress/i);
    expect(sql).not.toMatch(/delete from public\.prayer_progress_operations/i);
    expect(sql).not.toMatch(/update auth\.users/i);
  });

  it("자동 스크롤 기본값을 꺼짐으로 추가한다", () => {
    expect(sql).toContain("auto_scroll_enabled boolean not null default false");
  });
});
