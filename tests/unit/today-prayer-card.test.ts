import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { emptyDailySummary } from "@/lib/progress/daily";

function readSource(relative: string) {
  return readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("첫 실행 오늘의 기도", () => {
  const layout = readSource("app/(app)/layout.tsx");
  const providers = readSource("components/providers/AppProviders.tsx");
  const bootstrap = readSource("lib/progress/bootstrap.ts");
  const card = readSource("components/dashboard/TodayPrayerCard.tsx");

  it("홈 레이아웃은 사용자 데이터를 기다리지 않고 App Shell을 먼저 연다", () => {
    expect(layout).not.toContain("force-dynamic");
    expect(layout).not.toContain("getUser");
    expect(layout).toContain("AppHomeShell");
    expect(bootstrap).toContain("fetchHomeDashboard");
    expect(bootstrap).toContain("getSession");
    expect(bootstrap).not.toContain("getUser");
    expect(providers).toContain("bootstrapAppState");
  });

  it("서버에서 받은 오늘 기록이 있으면 같은 시간대에서 다시 불러오지 않는다", () => {
    expect(providers).toContain("hydratedDailyRef");
    expect(providers).toContain('if (reason === "mount" && hydratedDailyRef.current) return;');
    expect(providers).toContain("void refreshDaily()");
    expect(providers).toContain("if (!bootReady) return");
    expect(providers).toContain("loadLocalStatsView");
    expect(providers).not.toContain("fetchDailyPrayerSummary");
  });

  it("기록이 오기 전에는 아직 완료한 기도가 없습니다를 보이지 않는다", () => {
    expect(emptyDailySummary().local_date).toBe("");
    expect(card).toContain("Boolean(dailySummary.local_date)");
    expect(card).toContain("loaded && count === 0");
    expect(card).toContain("오늘 기록을 불러오는 중");
  });
});
