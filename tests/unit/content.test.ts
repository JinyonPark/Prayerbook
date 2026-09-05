import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseMarkdownDocument, toPrayerItem } from "@/lib/prayers/markdown";
import { validatePrayerItems } from "@/lib/prayers/validate";
import { MAIN_PRAYER_COUNT, PRAYER_CATALOG } from "@/lib/prayers/catalog";

describe("기도문 콘텐츠", () => {
  const dir = path.join(process.cwd(), "content", "prayers");
  const files = readdirSync(dir).filter((file) => file.endsWith(".md"));
  const items = files.map((file) => {
    const parsed = parseMarkdownDocument(readFileSync(path.join(dir, file), "utf8"));
    return toPrayerItem(parsed.data, parsed.content);
  });

  it(`기본 기도 정확히 ${MAIN_PRAYER_COUNT}개`, () => {
    expect(items.filter((item) => item.category === "main")).toHaveLength(MAIN_PRAYER_COUNT);
  });

  it(`번호 1~${MAIN_PRAYER_COUNT} 누락 없음`, () => {
    const numbers = items
      .filter((item) => item.category === "main")
      .map((item) => item.item_number)
      .sort((a, b) => (a ?? 0) - (b ?? 0));
    expect(numbers).toEqual(Array.from({ length: MAIN_PRAYER_COUNT }, (_, index) => index + 1));
  });

  it("추가 기도 정확히 3개", () => {
    expect(items.filter((item) => item.category === "supplementary")).toHaveLength(3);
  });

  it("모든 제목과 본문이 비어 있지 않음", () => {
    for (const item of items) {
      expect(item.title.trim().length).toBeGreaterThan(0);
      expect(item.content_md.trim().length).toBeGreaterThan(0);
    }
  });

  it("slug 중복 없음", () => {
    expect(new Set(items.map((item) => item.slug)).size).toBe(items.length);
  });

  it("추가 기도의 counts_toward_total이 false", () => {
    for (const item of items.filter((candidate) => candidate.category === "supplementary")) {
      expect(item.counts_toward_total).toBe(false);
    }
  });

  it("기본 기도의 counts_toward_total이 true", () => {
    for (const item of items.filter((candidate) => candidate.category === "main")) {
      expect(item.counts_toward_total).toBe(true);
    }
  });

  it("검증 함수가 오류를 내지 않는다", () => {
    expect(validatePrayerItems(items).filter((issue) => issue.level === "error")).toHaveLength(0);
  });

  it("카탈로그와 파일 수가 같다", () => {
    expect(items.length).toBe(PRAYER_CATALOG.length);
  });
});
