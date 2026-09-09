import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("이력 화면", () => {
  const history = readFileSync(path.join(process.cwd(), "components/history/HistoryView.tsx"), "utf8");
  const page = readFileSync(path.join(process.cwd(), "app/(app)/history/page.tsx"), "utf8");
  const providers = readFileSync(path.join(process.cwd(), "components/providers/AppProviders.tsx"), "utf8");

  it("오늘의 기도 카드를 넣지 않는다", () => {
    expect(history).not.toContain("TodayPrayerCard");
    expect(history).not.toContain("오늘의 기도 기록");
  });

  it("최근 30일과 월별 요약을 분리하고 월별은 lazy load한다", () => {
    expect(history).toContain("최근 30일");
    expect(history).toContain("월별 요약");
    expect(history).toContain("fetchRecentPrayerHistory");
    expect(history).toContain("fetchMonthlyPrayerHistory");
    expect(history).toContain('if (tab === "monthly" && monthlyStatus === "idle")');
    expect(page).not.toContain("prayer_progress_operations");
    expect(page).not.toContain("force-dynamic");
  });

  it("로컬 숨김만 하고 서버 삭제는 호출하지 않는다", () => {
    expect(history).toContain("hideHistoryDate");
    expect(history).toContain("clearAllHistory");
    expect(history).toContain("hideAllAsync");
    expect(history).not.toContain("rpcDeleteHistoryOperation");
    expect(history).not.toContain("rpcDeleteAllHistory");
    expect(history).toContain("이력 삭제는 현재 기기에서만 적용됩니다");
    expect(history).toContain("overflow-x-hidden");
    expect(history).not.toContain("자녀 이름");
    expect(history).not.toContain("소원 기도 내용");
    expect(history).not.toContain("client_event_id");
    expect(history).toContain("기도 이력을 불러오는 중입니다.");
    expect(history).toContain("월별 기도 기록을 불러오는 중입니다.");
    expect(history).toContain("다시 시도");
    expect(history).toContain("이 기기에서 이력 숨김 설정을 저장할 수 없습니다.");
    expect(history).toContain("개 기도 항목");
    expect(history).toContain("전체 이력 삭제");
    expect(history).toContain("이 날짜 이력 삭제");
    expect(providers).toContain("clearHistoryVisibilityOnLogoutMemoryOnly");
  });
});
