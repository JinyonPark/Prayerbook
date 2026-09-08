import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("conceived_show_all_names migration", () => {
  const sql = readFileSync(path.join(process.cwd(), "supabase/migrations/20240909000019_conceived_show_all_names.sql"), "utf8");

  it("완료 횟수와 기존 이력을 변경하지 않는다", () => {
    expect(sql).not.toMatch(/update public\.user_prayer_progress/i);
    expect(sql).not.toMatch(/delete from public\.user_prayer_progress/i);
    expect(sql).not.toMatch(/delete from public\.prayer_progress_operations/i);
    expect(sql).not.toMatch(/update auth\.users/i);
  });

  it("태신자 이름 표시 기본값을 처음만으로 추가한다", () => {
    expect(sql).toContain("conceived_show_all_names boolean not null default false");
  });
});
