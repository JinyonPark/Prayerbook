import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("이력 화면", () => {
  const history = readFileSync(path.join(process.cwd(), "components/history/HistoryView.tsx"), "utf8");

  it("오늘의 기도 카드를 넣지 않는다", () => {
    expect(history).not.toContain("TodayPrayerCard");
    expect(history).not.toContain("오늘의 기도 기록");
  });
});
