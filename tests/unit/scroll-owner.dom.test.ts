import { describe, expect, it } from "vitest";
import { getReaderScrollElement, getReaderScrollY, setReaderScrollY } from "@/lib/reading/scroll-owner";
import { getScrollRatio, restoreScrollRatio } from "@/lib/reading/scroll-ratio";

describe("기도문 scroll owner", () => {
  it("읽기와 쓰기가 같은 scrollingElement를 사용한다", () => {
    const el = getReaderScrollElement();
    expect(el).toBeTruthy();
    expect(el).toBe(document.scrollingElement ?? document.documentElement);
    setReaderScrollY(120);
    expect(getReaderScrollY()).toBe(el?.scrollTop);
    setReaderScrollY(0);
    expect(getReaderScrollY()).toBe(0);
  });

  it("지정한 element scroller는 scrollTop만 읽고 쓴다", () => {
    const scroller = document.createElement("div");
    Object.defineProperty(scroller, "scrollHeight", { value: 2000 });
    Object.defineProperty(scroller, "clientHeight", { value: 500 });
    scroller.scrollTop = 300;
    expect(getScrollRatio(scroller)).toBeCloseTo(0.2);
    restoreScrollRatio(0.5, scroller);
    expect(scroller.scrollTop).toBe(750);
  });
});
