import { describe, expect, it } from "vitest";
import { nextAutoScrollPosition, isManualScrollKey } from "@/lib/prayers/auto-scroll";

describe("자동 스크롤", () => {
  it("경과 시간에 비례해 이동하고 끝에서 종료한다", () => {
    const mid = nextAutoScrollPosition(0, 1000, 50, 1000);
    expect(mid.y).toBe(50);
    expect(mid.finished).toBe(false);
    const end = nextAutoScrollPosition(990, 1000, 50, 1000);
    expect(end.finished).toBe(true);
    expect(end.y).toBe(1000);
  });

  it("주사율이 달라도 같은 경과 시간이면 이동량이 같다", () => {
    const one = nextAutoScrollPosition(0, 5000, 42, 16);
    const two = nextAutoScrollPosition(one.y, 5000, 42, 16);
    const combined = nextAutoScrollPosition(0, 5000, 42, 32);
    expect(two.y).toBeCloseTo(combined.y);
  });

  it("화살표와 스페이스만 수동 스크롤 키로 본다", () => {
    expect(isManualScrollKey("ArrowDown")).toBe(true);
    expect(isManualScrollKey(" ")).toBe(true);
    expect(isManualScrollKey("Tab")).toBe(false);
    expect(isManualScrollKey("Enter")).toBe(false);
  });
});
