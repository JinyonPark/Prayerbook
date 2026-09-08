import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("기도문 네비게이션", () => {
  const reader = readFileSync(path.join(process.cwd(), "components/prayer/PrayerReader.tsx"), "utf8");
  const link = readFileSync(path.join(process.cwd(), "components/prayer/ReaderNavLink.tsx"), "utf8");
  const drawer = readFileSync(path.join(process.cwd(), "components/ui/Drawer.tsx"), "utf8");

  it("뒤로·홈·목차·이전·다음은 앱 안 이동을 쓴다", () => {
    expect(reader).not.toContain("뒤로");
    expect(reader).not.toContain("truncate font-semibold");
    expect(reader).toContain("lg:top-[calc(var(--header-h)+var(--safe-top-env))]");
    expect(reader).toContain("reader-chrome-spacer");
    expect(reader).toContain("chromeVisibleFromFingerMove");
    expect(reader).not.toContain("chromeShown");
    expect(reader).not.toContain("chromeVisible && !autoRunning");
    expect(reader).not.toContain("pauseFromUser");
    expect(reader).toContain("if (autoRunningRef.current) return");
    expect(reader).not.toMatch(/autoRunningRef\.current\) \{\s*applyChrome\(false\)/);
    expect(reader).toContain("-translate-y-full");
    expect(reader).toContain('href="/"');
    expect(reader).toContain("href={`/prayers/${item.slug}`}");
    expect(reader).toContain('href="/prayers"');
    expect(reader).toContain("목차 이동");
    expect(reader).toContain("ReaderNavLink");
    expect(reader).not.toContain("setTocOpen(true)");
    expect(reader).toContain("setTocOpen((open) => !open)");
    expect(reader).toContain("max-lg:pointer-events-none");
    expect(link).toContain("router.push(href)");
  });

  it("목차 시트는 상단 탭으로 닫히고 항목 클릭을 가로채지 않는다", () => {
    expect(drawer).toContain('aria-label="목차 닫기"');
    expect(drawer).toContain("z-[400]");
    expect(drawer).not.toContain("stopPropagation");
    expect(reader).toContain("tocOpen ? \"max-lg:pointer-events-none\"");
  });

  it("목차 드래그 핸들은 44px 닫기 버튼이다", () => {
    const css = readFileSync(path.join(process.cwd(), "app/globals.css"), "utf8");
    expect(drawer).toContain('type="button"');
    expect(drawer).toContain("closeTableOfContents");
    expect(drawer).toContain('className="bottom-sheet-handle-button"');
    expect(drawer).toContain('className="bottom-sheet-handle-bar"');
    expect(drawer).toContain('aria-hidden="true"');
    expect(drawer).toContain("lastFocus.current?.focus()");
    expect(drawer).toContain("lockBodyScroll");
    expect(drawer).not.toMatch(/<div className="mx-auto mb-3 h-1 w-10 rounded-full/);
    expect(css).toContain(".bottom-sheet-handle-button");
    expect(css).toContain("min-width: 44px");
    expect(css).toContain("min-height: 44px");
    expect(css).toContain("pointer-events: auto");
    expect(css).toContain(".bottom-sheet-handle-bar");
    expect(css).toContain("pointer-events: none");
  });
});
