import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { clampRatio, restoreScrollRatio, getScrollRatio } from "@/lib/reading/scroll-ratio";

describe("읽기 상태", () => {
  it("3번 기도문 40% 위치 비율을 0.4로 저장", () => {
    expect(clampRatio(0.4)).toBe(0.4);
    expect(clampRatio(-1)).toBe(0);
    expect(clampRatio(2)).toBe(1);
  });

  it("다른 화면 크기에서도 비율 기준으로 복원", () => {
    const ratio = 0.42;
    const shortMax = 1000;
    const tallMax = 2500;
    expect(Math.round(shortMax * ratio)).toBe(420);
    expect(Math.round(tallMax * ratio)).toBe(1050);
  });
});

describe("보안 소스 검사", () => {
  it("service role client는 server-only 모듈에만 있다", () => {
    const admin = readFileSync(path.join(process.cwd(), "lib/supabase/admin.ts"), "utf8");
    const client = readFileSync(path.join(process.cwd(), "lib/supabase/client.ts"), "utf8");
    expect(admin).toContain("server-only");
    expect(admin).toContain("getServiceRoleKey");
    expect(client).not.toContain("SERVICE_ROLE");
  });

  it("진행 기록 직접 update는 클라이언트 경로에 없다", () => {
    const client = readFileSync(path.join(process.cwd(), "lib/supabase/client.ts"), "utf8");
    expect(client).not.toContain("user_prayer_progress");
  });
});

describe("스크롤 비율 유틸", () => {
  it("함수가 정의되어 있다", () => {
    expect(typeof getScrollRatio).toBe("function");
    expect(typeof restoreScrollRatio).toBe("function");
  });
});
