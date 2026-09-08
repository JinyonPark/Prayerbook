import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("기도문 네비게이션", () => {
  const reader = readFileSync(path.join(process.cwd(), "components/prayer/PrayerReader.tsx"), "utf8");
  const link = readFileSync(path.join(process.cwd(), "components/prayer/ReaderNavLink.tsx"), "utf8");

  it("뒤로·홈·목차·이전·다음은 앱 안 이동을 쓴다", () => {
    expect(reader).not.toContain("뒤로");
    expect(reader).not.toContain("truncate font-semibold");
    expect(reader).toContain("reader-chrome-spacer");
    expect(reader).toContain("chromeVisibleFromFingerMove");
    expect(reader).toContain("-translate-y-full");
    expect(reader).toContain('href="/"');
    expect(reader).toContain("href={`/prayers/${item.slug}`}");
    expect(reader).toContain("ReaderNavLink");
    expect(link).toContain("router.push(href)");
  });
});
