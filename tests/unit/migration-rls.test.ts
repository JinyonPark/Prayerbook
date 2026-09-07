import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("migration RLS", () => {
  const sql = readFileSync(path.join(process.cwd(), "supabase/migrations/20240907000010_spouse_inputs_anchors.sql"), "utf8");

  it("완료 횟수 테이블을 변경하지 않는다", () => {
    expect(sql).not.toMatch(/update public\.user_prayer_progress/i);
    expect(sql).not.toMatch(/delete from public\.user_prayer_progress/i);
    expect(sql).not.toMatch(/update auth\.users/i);
    expect(sql).not.toMatch(/delete from auth\.users/i);
  });

  it("user_prayer_inputs에 본인만 접근하는 RLS가 있다", () => {
    expect(sql).toContain("enable row level security");
    expect(sql).toContain("user_id = auth.uid()");
    expect(sql).toContain("for select");
    expect(sql).toContain("for insert");
    expect(sql).toContain("for update");
    expect(sql).toContain("for delete");
  });

  it("배우자 선택과 읽기 anchor 컬럼을 추가한다", () => {
    expect(sql).toContain("spouse_prayer_selection");
    expect(sql).toContain("anchor_key");
    expect(sql).toContain("anchor_offset");
  });
});
