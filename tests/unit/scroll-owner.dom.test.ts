import { afterEach, describe, expect, it, vi } from "vitest";
import { getReaderScrollElement, getReaderScrollMax, getReaderScrollY, setReaderScrollY } from "@/lib/reading/scroll-owner";
import { getScrollRatio, restoreScrollRatio } from "@/lib/reading/scroll-ratio";

describe("기도문 scroll owner", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    document.querySelectorAll(".reader-article").forEach((node) => node.remove());
  });

  it("문서 스크롤 읽기와 쓰기가 같은 위치를 가리킨다", () => {
    const el = getReaderScrollElement();
    expect(el).toBeTruthy();
    vi.stubGlobal("scrollTo", (x: number | ScrollToOptions, y?: number) => {
      const top = typeof x === "number" ? y ?? 0 : x.top ?? 0;
      document.documentElement.scrollTop = top;
      document.body.scrollTop = top;
    });
    setReaderScrollY(120);
    expect(getReaderScrollY()).toBe(120);
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

  it("본문이 뷰포트보다 길면 document 높이가 같아도 스크롤 여유가 있다", () => {
    vi.stubGlobal("innerHeight", 400);
    const article = document.createElement("article");
    article.className = "reader-article";
    article.getBoundingClientRect = () =>
      ({
        top: 80,
        bottom: 1800,
        left: 0,
        right: 0,
        width: 320,
        height: 1720,
        x: 0,
        y: 80,
        toJSON() {
          return {};
        },
      }) as DOMRect;
    document.body.appendChild(article);
    expect(getReaderScrollMax()).toBeGreaterThan(1);
  });
});
