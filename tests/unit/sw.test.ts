import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("service worker", () => {
  const sw = readFileSync(path.join(process.cwd(), "public/sw.js"), "utf8");

  it("Next 라우터 RSC 요청은 가로채지 않는다", () => {
    expect(sw).toContain("prayer-book-v9");
    expect(sw).toContain("isNextRouterRequest");
    expect(sw).toContain('searchParams.has("_rsc")');
    expect(sw).toContain('headers.has("RSC")');
    expect(sw).toContain("if (isNextRouterRequest(request, url)) return;");
    expect(sw).not.toContain('url.pathname.startsWith("/prayers/")');
  });
});

describe("상태 표시줄 여백", () => {
  const css = readFileSync(path.join(process.cwd(), "app/globals.css"), "utf8");

  it("모바일에서 최소 48px 상단 여백을 둔다", () => {
    expect(css).toContain("--safe-top-env");
    expect(css).toContain("max(var(--safe-top-env), 48px)");
  });
});
