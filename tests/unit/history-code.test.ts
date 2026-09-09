import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { historyCodeFor } from "@/lib/prayers/history-code";
import { parseMarkdownDocument, toPrayerItem } from "@/lib/prayers/markdown";

describe("history_code", () => {
  it("기본 기도는 번호, 추가 기도는 짧은 코드를 쓴다", () => {
    expect(historyCodeFor({ category: "main", item_number: 1, slug: "dawn" })).toBe("1");
    expect(historyCodeFor({ category: "main", item_number: 27, slug: "closing" })).toBe("27");
    expect(historyCodeFor({ category: "supplementary", item_number: null, slug: "hope-prayer" })).toBe("wish");
    expect(historyCodeFor({ category: "supplementary", item_number: null, slug: "conceived-prayer" })).toBe("evangelism");
    expect(historyCodeFor({ category: "supplementary", item_number: null, slug: "spiritual-prayer" })).toBe("spiritual");
  });

  it("모든 기도 항목의 history_code가 고유하고 20자 이하이다", () => {
    const dir = path.join(process.cwd(), "content", "prayers");
    const items = readdirSync(dir)
      .filter((file) => file.endsWith(".md"))
      .map((file) => {
        const parsed = parseMarkdownDocument(readFileSync(path.join(dir, file), "utf8"));
        return toPrayerItem(parsed.data, parsed.content);
      });
    const codes = items.map((item) => item.history_code);
    expect(new Set(codes).size).toBe(items.length);
    for (const item of items) {
      expect(item.history_code.length).toBeGreaterThan(0);
      expect(item.history_code.length).toBeLessThanOrEqual(20);
      expect(item.history_code).not.toMatch(/-/);
    }
    expect(items.find((item) => item.slug === "hope-prayer")?.history_code).toBe("wish");
    expect(items.find((item) => item.slug === "conceived-prayer")?.history_code).toBe("evangelism");
    expect(items.find((item) => item.slug === "spiritual-prayer")?.history_code).toBe("spiritual");
  });
});
