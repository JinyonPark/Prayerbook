import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

function readMigration(name: string) {
  return readFileSync(path.join(process.cwd(), "supabase/migrations", name), "utf8");
}

describe("storage optimization migrations", () => {
  const tables = readMigration("20240909000014_storage_daily_dedup.sql");
  const rpcs = readMigration("20240909000015_storage_rpc_rewrite.sql");
  const inputs = readMigration("20240909000016_inputs_login.sql");

  it("완료 횟수와 auth.users를 삭제하는 데이터 정리 SQL이 아니다", () => {
    expect(tables).not.toMatch(/delete from public\.user_prayer_progress/i);
    expect(tables).not.toMatch(/delete from public\.prayer_progress_operations/i);
    for (const sql of [tables, rpcs, inputs]) {
      expect(sql).not.toMatch(/update auth\.users/i);
      expect(sql).not.toMatch(/delete from auth\.users/i);
    }
  });

  it("일별 집계와 dedup 테이블을 만든다", () => {
    expect(tables).toContain("create table if not exists public.user_daily_prayer_stats");
    expect(tables).toContain("primary key (user_id, local_date)");
    expect(tables).toContain("create table if not exists public.prayer_command_dedup");
    expect(tables).toContain("prayer_storage_backfill_report");
    expect(tables).toContain("Legacy complete rows are kept.");
  });

  it("complete_prayer가 이력 테이블에 complete 행을 넣지 않는다", () => {
    const completeFn = rpcs.slice(rpcs.indexOf("create or replace function public.complete_prayer"));
    const nextFn = completeFn.indexOf("create or replace function public.set_prayer_count");
    const body = completeFn.slice(0, nextFn);
    expect(body).not.toContain("prayer_progress_operations");
    expect(body).not.toContain("prayer_progress_operation_items");
    expect(body).toContain("internal_apply_daily_complete");
    expect(body).toContain("internal_begin_command");
    expect(body).toContain("v_before := v_after - 1");
  });

  it("현재 독수 초기화는 eligible 기도만 변경한다", () => {
    expect(rpcs).toContain("internal_eligible_main_prayers");
    const reset = rpcs.slice(rpcs.indexOf("create or replace function public.reset_current_round"));
    expect(reset).toContain("internal_eligible_main_prayers");
  });

  it("이력 삭제는 complete 행을 남긴다", () => {
    expect(rpcs).toContain("and operation_type <> 'complete'");
    expect(rpcs).toContain("deleted_legacy_complete_operations', 0");
    expect(rpcs).toContain("purge_legacy_complete_operations");
    expect(rpcs).toContain("BACKFILL_NOT_VERIFIED");
  });

  it("입력 RPC와 로그인 정규화를 추가한다", () => {
    expect(inputs).toContain("save_prayer_inputs");
    expect(inputs).toContain("normalized_login_id");
    expect(inputs).toContain("Legacy personalization rows");
    expect(inputs).toContain("revoke insert, update, delete on public.user_prayer_inputs");
  });
});

describe("횟수 수정 RPC 열 이름 충돌", () => {
  it("set_prayer_count는 진행 테이블 열을 별칭으로 구분한다", () => {
    const sql = readMigration("20240909000017_fix_set_count_ambiguous.sql");
    expect(sql).toContain("upp.prayer_item_id = v_prayer_item_id");
    expect(sql).toContain("#variable_conflict use_column");
    expect(sql).not.toMatch(/delete from auth\.users/i);
  });
});
