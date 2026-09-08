import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { hardNavigate } from "@/lib/prayers/navigate";

describe("기도문 네비게이션", () => {
  const reader = readFileSync(path.join(process.cwd(), "components/prayer/PrayerReader.tsx"), "utf8");
  const link = readFileSync(path.join(process.cwd(), "components/prayer/ReaderNavLink.tsx"), "utf8");
  const navigate = readFileSync(path.join(process.cwd(), "lib/prayers/navigate.ts"), "utf8");

  it("뒤로·홈·목차·이전·다음은 전체 페이지 이동을 쓴다", () => {
    expect(reader).toContain('href="/prayers"');
    expect(reader).toContain('href="/"');
    expect(reader).toContain("href={`/prayers/${item.slug}`}");
    expect(reader).toContain("ReaderNavLink");
    expect(link).toContain("hardNavigate(href)");
    expect(navigate).toContain("window.location.assign");
  });

  it("같은 출처 경로로만 이동한다", () => {
    expect(hardNavigate.toString()).toContain("location.assign");
  });
});
