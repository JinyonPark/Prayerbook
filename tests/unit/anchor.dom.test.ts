import { describe, expect, it, vi } from "vitest";
import { captureReadingAnchor, restoreReadingAnchor } from "@/lib/reading/anchor";

function node(id: string, top: number): HTMLElement {
  const el = document.createElement("p");
  el.id = id;
  el.dataset.prayerAnchor = id;
  el.getBoundingClientRect = () => ({
    top,
    bottom: top + 20,
    left: 0,
    right: 100,
    width: 100,
    height: 20,
    x: 0,
    y: top,
    toJSON() {
      return {};
    },
  });
  return el;
}

describe("읽기 위치 복원", () => {
  it("화면 상단에 가장 가까운 anchor를 저장한다", () => {
    const article = document.createElement("article");
    article.append(node("a1", 80), node("a2", 12), node("a3", -40));
    const captured = captureReadingAnchor(article);
    expect(captured.anchorKey).toBe("a2");
    expect(captured.anchorOffset).toBe(12);
  });

  it("anchor가 없으면 false를 반환한다", () => {
    const article = document.createElement("article");
    expect(restoreReadingAnchor(article, "missing", 0)).toBe(false);
    expect(restoreReadingAnchor(null, "a1", 0)).toBe(false);
  });

  it("같은 anchor와 offset으로 스크롤을 복원한다", () => {
    const article = document.createElement("article");
    const target = node("a2", 40);
    article.append(target);
    const scrollTo = vi.fn();
    window.scrollTo = scrollTo as typeof window.scrollTo;
    Object.defineProperty(window, "scrollY", { configurable: true, value: 200 });
    expect(restoreReadingAnchor(article, "a2", 10)).toBe(true);
    expect(scrollTo).toHaveBeenCalled();
  });
});
