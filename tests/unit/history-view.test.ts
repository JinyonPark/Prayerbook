import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("이력 화면", () => {
  const history = readFileSync(path.join(process.cwd(), "components/history/HistoryView.tsx"), "utf8");
  const page = readFileSync(path.join(process.cwd(), "app/(app)/history/page.tsx"), "utf8");

  it("오늘의 기도 카드를 넣지 않는다", () => {
    expect(history).not.toContain("TodayPrayerCard");
    expect(history).not.toContain("오늘의 기도 기록");
  });

  it("선택한 월의 IndexedDB 이력만 조회한다", () => {
    expect(history).toContain("getHistoryByMonth");
    expect(history).toContain("이전 달");
    expect(history).toContain("다음 달");
    expect(history).toContain("현재 월");
    expect(history).not.toContain("fetchRecentPrayerHistory");
    expect(history).not.toContain("fetchMonthlyPrayerHistory");
    expect(history).not.toContain("get_daily_prayer_summary");
    expect(page).not.toContain("prayer_progress_operations");
    expect(page).not.toContain("force-dynamic");
  });

  it("날짜·전체 삭제는 로컬 dailyHistory만 지운다", () => {
    expect(history).toContain("deleteHistoryDate");
    expect(history).toContain("deleteAllHistory");
    expect(history).not.toContain("rpcDeleteHistoryOperation");
    expect(history).not.toContain("rpcDeleteAllHistory");
    expect(history).toContain("이 기기의 이력 화면에서만 삭제됩니다");
    expect(history).toContain("overflow-x-hidden");
    expect(history).not.toContain("자녀 이름");
    expect(history).not.toContain("소원 기도 내용");
    expect(history).not.toContain("client_event_id");
    expect(history).toContain("기도 이력을 불러오는 중입니다.");
    expect(history).toContain("다시 시도");
    expect(history).toContain("개 기도 항목");
    expect(history).toContain("전체 이력 삭제");
    expect(history).toContain("이 날짜 이력 삭제");
  });
});
