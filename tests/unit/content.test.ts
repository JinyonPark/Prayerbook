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

  it("지정된 제목 교정이 반영되고 이전 제목이 없다", () => {
    const titles = items.map((item) => item.title);
    expect(titles).toContain("목장과 목장원을 위한 기도");
    expect(titles).toContain("부모님을 위한 기도");
    expect(titles).not.toContain("목장을 위한 기도");
    expect(titles).not.toContain("부모를 위한 기도");
  });

  it("지정된 본문 교정이 반영된다", () => {
    const bySlug = Object.fromEntries(items.map((item) => [item.slug, item.content_md]));
    expect(bySlug.homeland).toContain("우리 나라 지도자들과 백성들이 하나님의 이름을 거룩히 할 일만");
    expect(bySlug.homeland).toContain("다른 나라의 죄를 용서해 주시기 원합니다");
    expect(bySlug.homeland.match(/다른 나라들의 죄를 용서하여 준 것 같이 우리나라의 죄를 사하여주옵소서/g)?.length).toBe(1);
    expect(bySlug.spiritual).toBeUndefined();
    expect(bySlug["spiritual-power"]).toContain("피난처이십니다");
    expect(bySlug["spiritual-power"]).not.toContain("피난처입니다.");
    expect(bySlug.spouse).toMatch(/\n6\) /);
    expect(bySlug.spouse).toContain("자들로서");
    expect(bySlug.temptations).toContain("거룩하신 분");
    expect(bySlug.thanks).toContain("꾸지 않을");
    expect(bySlug.healing).not.toContain("혹 죄로 인해");
    expect(bySlug["heal-sickness"]).toContain("것 같이");
    expect(bySlug["heal-sickness"]).toContain("쫓아내며…");
    expect(bySlug["personal-2"]).toContain("십자가의 보혈로");
    expect(bySlug["personal-2"]).toContain("불성실");
    expect(bySlug["conceived-believer"]).toContain("하나님의 뜻을 깨닫고");
    expect(bySlug["conceived-believer"]).toContain("하나님께서 ㅇㅇㅇ씨에게");
    expect(bySlug["conceived-believer"]).toContain("또한 ㅇㅇㅇ씨 주변의 사람들이");
    expect(bySlug["conceived-believer"]).not.toContain("하나님께서ㅇㅇㅇ");
    expect(bySlug["conceived-believer"]).not.toContain("또한ㅇㅇㅇ");
    expect(bySlug.faculties).toContain("그리고 ㅇㅇㅇ가");
    expect(bySlug.faculties).toContain("하나님! ㅇㅇㅇ를 악에서");
    expect(bySlug.dawn).toContain("있는 줄");
    expect(bySlug.dawn).toContain("여러 가지");
    expect(bySlug.church).toContain("시험당하지");
    expect(bySlug.pastor).toContain("시험당함을 허락지");
    expect(bySlug.home).toContain("시험당함을 허락지");
    expect(bySlug.husband).toContain("있는 줄");
    expect(bySlug.wife).toContain("있는 줄");
    expect(bySlug.wife).toContain("시험당하지");
    expect(bySlug.healing).toContain("여러 가지");
    expect(bySlug.healing).toContain("지켜 주옵소서");
    expect(bySlug.spouse).toContain("지켜 주옵소서");
    expect(bySlug.money).toContain("여러 가지");
    expect(bySlug.business).toContain("있는 줄");
    expect(bySlug.night).toContain("여러 가지");
    expect(bySlug["heal-sickness"]).not.toContain("쫓아내며,,,");
    expect(bySlug["cell-group"]).toContain("우리 목장과 목장원에게 필요한 것");
    expect(bySlug["cell-group"]).toContain("공급해 주시기를");
    expect(bySlug["cell-group"]).toContain("목장원들이 서로");
    expect(bySlug["cell-group"]).toContain("전 목장원이");
    expect(bySlug["cell-group"]).toContain("우리 목장과 목장원이 시험에");
    expect(bySlug["cell-group"]).toContain("내쫓아 주옵시고");
    expect(bySlug["cell-group"]).toContain("우리 목장과 목장원을 악에서");
    expect(bySlug.temptations).toContain("찾지 못하게");
    expect(bySlug.tired).toContain("내려놓기 원합니다");
    expect(bySlug.thanks).toContain("찾을 수 있는");
    const ids = items.map((item) => item.id).sort();
    expect(new Set(ids).size).toBe(ids.length);
  });
});
