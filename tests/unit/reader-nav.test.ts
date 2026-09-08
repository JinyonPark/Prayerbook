import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("기도문 네비게이션", () => {
  const source = readFileSync(path.join(process.cwd(), "components/prayer/PrayerReader.tsx"), "utf8");

  it("뒤로·홈·목차 항목은 기본 링크 이동을 막지 않는다", () => {
    expect(source).toContain('href="/prayers"');
    expect(source).toContain('href="/"');
    expect(source).toContain("href={`/prayers/${item.slug}`}");
    expect(source).not.toContain("event.preventDefault()");
    expect(source).not.toContain("router.push");
  });
});
