import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("share format preference migration", () => {
  const sql = readFileSync(
    path.join(process.cwd(), "supabase/migrations/20240909000021_share_format_preference.sql"),
    "utf8",
  );

  it("완료 횟수와 기존 이력을 변경하지 않는다", () => {
    expect(sql).not.toMatch(/update public\.user_prayer_progress/i);
    expect(sql).not.toMatch(/delete from public\.user_prayer_progress/i);
    expect(sql).not.toMatch(/delete from public\.prayer_progress_operations/i);
    expect(sql).not.toMatch(/update auth\.users/i);
  });

  it("복사·공유 형식 저장 열을 추가한다", () => {
    expect(sql).toContain("share_selected_fields jsonb");
    expect(sql).toContain("share_custom_template text");
    expect(sql).toContain("char_length(share_custom_template) <= 2000");
  });
});
