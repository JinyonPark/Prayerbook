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
  const card = readSource("components/dashboard/TodayPrayerCard.tsx");

  it("서버에서 오늘 기록을 미리 가져온다", () => {
    expect(layout).toContain("fetchDailyPrayerSummary");
    expect(layout).toContain("initialDailySummary={dailyResult}");
  });

  it("시간대가 같아도 앱을 열면 오늘 기록을 다시 불러온다", () => {
    expect(providers).not.toMatch(/if \(detected === timeZoneRef\.current\) return;/);
    expect(providers).toContain("void refreshDaily()");
  });

  it("기록이 오기 전에는 아직 완료한 기도가 없습니다를 보이지 않는다", () => {
    expect(emptyDailySummary().local_date).toBe("");
    expect(card).toContain("Boolean(dailySummary.local_date)");
    expect(card).toContain("loaded && count === 0");
    expect(card).toContain("오늘 기록을 불러오는 중");
  });
});
