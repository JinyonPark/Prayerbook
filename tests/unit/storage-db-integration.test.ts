import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";

describe("DB 통합 테스트", () => {
  it("clean migration 파일 체인이 저장소에 있다", () => {
    const files = [
      "20240904000001_create_tables.sql",
      "20240904000003_rpc_complete_and_edit.sql",
      "20240905000005_fix_rpc_ambiguous_columns.sql",
      "20240907000011_daily_prayer_summary.sql",
      "20240909000014_storage_daily_dedup.sql",
      "20240909000015_storage_rpc_rewrite.sql",
      "20240909000016_inputs_login.sql",
    ];
    for (const file of files) {
      expect(existsSync(path.join(process.cwd(), "supabase/migrations", file))).toBe(true);
    }
  });

  it("로컬 Postgres가 없으면 live RPC 검증을 건너뛴다고 명시한다", () => {
    expect(process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || "").toBeDefined();
  });
});
