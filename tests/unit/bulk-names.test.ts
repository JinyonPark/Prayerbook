import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("이름·중보기도 여러 이름 입력", () => {
  const view = readFileSync(path.join(process.cwd(), "components/settings/PersonalizeView.tsx"), "utf8");
  const settings = readFileSync(path.join(process.cwd(), "components/settings/SettingsView.tsx"), "utf8");
  const reader = readFileSync(path.join(process.cwd(), "components/prayer/PrayerReader.tsx"), "utf8");

  it("태신자와 사람 기도도 한 번에 여러 이름을 받는다", () => {
    expect(view).toContain("prayer.bulkNames");
    expect(view).toContain("conceived-believer");
    expect(view).toContain("처음만 전부 표시");
    expect(view).toContain("매번 전부 표시");
  });

  it("설정에서 태신자 이름 표시를 고른다", () => {
    expect(settings).toContain("conceivedShowAllNames");
    expect(settings).toContain("처음만 전부 표시");
    expect(settings).toContain("매번 전부 표시");
  });

  it("기도문은 여러 이름을 함께 넣고 표시 설정을 따른다", () => {
    expect(reader).toContain("usesBulkNames");
    expect(reader).toContain("nameRepeat");
    expect(reader).toContain("conceivedShowAllNames");
  });
});
