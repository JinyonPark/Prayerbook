import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("완료 API와 서버 점검", () => {
  it("완료는 서버 세션으로 RPC를 호출한다", () => {
    const source = readFileSync(path.join(process.cwd(), "app/api/prayers/complete/route.ts"), "utf8");
    expect(source).toContain("rpcComplete");
    expect(source).toContain("createServerSupabaseClient");
    expect(source).toContain("AUTH_EXPIRED");
  });

  it("헬스 체크는 익명 키로 prayer_items를 조회한다", () => {
    const source = readFileSync(path.join(process.cwd(), "app/api/health/route.ts"), "utf8");
    expect(source).toContain("/auth/v1/health");
    expect(source).toContain("prayer_items?select=id&limit=1");
    expect(source).toContain("missing-env");
  });
});
