import { describe, expect, it } from "vitest";
import { readingPersistEquals, type ReadingAnchor } from "@/lib/reading/anchor";

const base: ReadingAnchor = {
  last_prayer_item_id: "prayer-1",
  scroll_ratio: 0.4,
  anchor_key: "a1",
  anchor_offset: 12,
  last_opened_at: "2026-09-08T00:00:00.000Z",
  updated_at: "2026-09-08T00:00:01.000Z",
};

describe("읽기 위치 저장 비교", () => {
  it("updated_at만 바뀌면 같은 저장으로 본다", () => {
    expect(readingPersistEquals(base, { ...base, updated_at: "2026-09-08T00:00:02.000Z" })).toBe(true);
  });

  it("last_opened_at이 바뀌면 다른 저장으로 본다", () => {
    expect(readingPersistEquals(base, { ...base, last_opened_at: "2026-09-08T00:01:00.000Z" })).toBe(false);
  });

  it("이전 값이 없으면 다른 저장으로 본다", () => {
    expect(readingPersistEquals(null, base)).toBe(false);
  });
});
