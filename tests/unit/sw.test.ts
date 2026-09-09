import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("service worker", () => {
  const sw = readFileSync(path.join(process.cwd(), "public/sw.js"), "utf8");

  it("Next 라우터 RSC 요청은 가로채지 않는다", () => {
    expect(sw).toContain("prayer-book-v28");
    expect(sw).toContain("isNextRouterRequest");
    expect(sw).toContain('searchParams.has("_rsc")');
    expect(sw).toContain('headers.has("RSC")');
    expect(sw).toContain("if (isNextRouterRequest(request, url)) return;");
    expect(sw).toContain("if (request.method !== \"GET\") return");
    expect(sw).toContain("if (request.mode === \"navigate\") return");
    expect(sw).toContain('url.pathname.startsWith("/prayers")');
    expect(sw).toContain('url.pathname.startsWith("/history")');
    expect(sw).toContain('url.pathname.startsWith("/_next/")');
  });
});

describe("상태 표시줄 여백", () => {
  const css = readFileSync(path.join(process.cwd(), "app/globals.css"), "utf8");

  it("모바일에서 48px 녹색 여백을 강제하지 않는다", () => {
    expect(css).toContain("--safe-top-env");
    expect(css).not.toContain("max(var(--safe-top-env), 48px)");
  });

  it("기도문 상단 메뉴는 상태 표시줄 아래로 내리고 이중 여백을 넣지 않는다", () => {
    expect(css).toContain("position: fixed");
    expect(css).toContain(".reader-chrome-spacer");
    expect(css).toContain("padding-top: var(--safe-top-env)");
    expect(css).toContain("html[data-reader=\"true\"] .app-header");
    expect(css).not.toContain("height: calc(3.25rem + var(--safe-top))");
  });
});
