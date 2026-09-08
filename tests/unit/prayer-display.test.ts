import { describe, expect, it } from "vitest";
import { preparePrayerMarkdown } from "@/lib/prayers/display";

describe("기도문 번호 표시", () => {
  it("1) 형태가 목록이 아니라 텍스트로 남도록 이스케이프한다", () => {
    const prepared = preparePrayerMarkdown("1) 하나님은 거룩하신 분이십니다.\n둘째 줄");
    expect(prepared.startsWith("1\\) ")).toBe(true);
  });

  it("5-1) 같은 하위 번호도 유지한다", () => {
    const prepared = preparePrayerMarkdown("5-1) 자신의 병을 치료하기 위한 기도");
    expect(prepared.startsWith("5-1\\) ")).toBe(true);
  });

  it("본문의 꺾쇠 안내 문구가 사라지지 않는다", () => {
    const prepared = preparePrayerMarkdown("<명령하십시오>");
    expect(prepared).toBe("&lt;명령하십시오&gt;");
  });
});
