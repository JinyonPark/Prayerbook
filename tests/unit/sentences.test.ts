import { describe, expect, it } from "vitest";
import { parsePrayerSections, reconstructFromMarkdown, reconstructPrayerText, splitSentences } from "@/lib/prayers/sentences";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseMarkdownDocument } from "@/lib/prayers/markdown";

describe("문장 분리", () => {
  it("분리 후 합치면 원문과 같다", () => {
    const source = "첫 문장입니다. 둘째 문장입니다.\n\n2) 다음 항목입니다.";
    const sections = parsePrayerSections(source, "sample");
    expect(reconstructPrayerText(sections)).toBe(source.replace(/\r\n/g, "\n"));
  });

  it("실제 기도문도 분리 후 원문과 같다", () => {
    for (const file of ["dawn.md", "spouse.md", "spiritual-power.md", "defeat-devil.md", "homeland.md"]) {
      const raw = readFileSync(path.join(process.cwd(), "content/prayers", file), "utf8");
      const content = parseMarkdownDocument(raw).content;
      expect(reconstructFromMarkdown(content, file)).toBe(content.replace(/\r\n/g, "\n"));
    }
  });

  it("문장 끝에서 다음 문장이 시작된다", () => {
    const parts = splitSentences("하나님은 거룩하신 분이십니다. 이름이 거룩히 여김 받으시기를 원합니다.");
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.join("")).toContain("하나님은 거룩하신 분이십니다.");
  });

  it("16번 본문의 과도한 빈 문단이 없다", () => {
    const raw = readFileSync(path.join(process.cwd(), "content/prayers/spiritual-power.md"), "utf8");
    const content = parseMarkdownDocument(raw).content;
    const section4 = content.split("5)")[0] ?? "";
    expect(section4).not.toMatch(/\n{3,}/);
  });

  it("22번 6)이 5번과 분리되어 있다", () => {
    const raw = readFileSync(path.join(process.cwd(), "content/prayers/spouse.md"), "utf8");
    expect(raw).toMatch(/\n6\) /);
    expect(raw).not.toMatch(/하옵소서\. 6\) /);
  });

  it("26번 본문에 과도한 빈 문단이 없다", () => {
    const raw = readFileSync(path.join(process.cwd(), "content/prayers/defeat-devil.md"), "utf8");
    const content = parseMarkdownDocument(raw).content;
    expect(content).not.toMatch(/\n{4,}/);
  });

  it("26번 명령 안내가 한 문장으로 유지된다", () => {
    const parts = splitSentences("<명령하십시오>");
    expect(parts).toEqual(["<명령하십시오>"]);
  });
});
