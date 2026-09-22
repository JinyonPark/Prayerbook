import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

function readSource(relative: string) {
  return readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("기도문 스크롤 충돌 방지", () => {
  const reader = readSource("components/prayer/PrayerReader.tsx");
  const css = readSource("app/globals.css");
  const owner = readSource("lib/reading/scroll-owner.ts");

  it("window.scrollY와 element.scrollTop을 혼용하지 않고 scroll owner만 쓴다", () => {
    expect(reader).not.toContain("window.scrollTo");
    expect(reader).not.toContain("window.scrollY");
    expect(reader).toContain("setReaderScrollY");
    expect(reader).toContain("getReaderScrollY");
    expect(reader).toContain("getReaderScrollMetrics");
    expect(owner).toContain("document.scrollingElement");
  });

  it("자동 스크롤 loop는 ref 하나에만 두고 unmount에서 cancel한다", () => {
    expect(reader).toContain("autoRafRef");
    expect(reader.match(/requestAnimationFrame\(tick\)/g)?.length).toBeGreaterThan(0);
    expect(reader).toContain("window.cancelAnimationFrame(autoRafRef.current)");
    expect(reader).not.toContain("setInterval");
  });

  it("touch 중에는 auto-scroll write를 하지 않고 preventDefault를 쓰지 않는다", () => {
    expect(reader).toContain("beginUserGesture");
    expect(reader).toContain("shouldWriteAutoScrollFrame");
    expect(reader).toContain("isUserScrollGestureLockActive");
    expect(reader).toContain('addEventListener("touchstart"');
    expect(reader).toContain('addEventListener("touchmove"');
    expect(reader).toContain("{ passive: true }");
    expect(reader).not.toContain("preventDefault");
    expect(css).not.toContain("touch-action: none");
  });

  it("Safari 주소창 visualViewport resize로 읽기 위치를 되감기지 않는다", () => {
    expect(reader).not.toContain("visualViewport");
    expect(reader).toContain("didViewportOrientationFlip");
    expect(reader).toContain("orientationchange");
    expect(reader).toContain("if (restored.current) return");
  });

  it("기도문 페이지는 html만 세로 스크롤하고 body는 중첩 overflow를 만들지 않는다", () => {
    expect(css).toContain('html[data-reader="true"]');
    expect(css).toContain("scroll-behavior: auto");
    expect(css).toContain("html[data-reader=\"true\"] body");
    expect(css).toContain("overflow: visible");
  });
});
