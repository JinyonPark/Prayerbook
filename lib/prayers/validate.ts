import { MAIN_PRAYER_COUNT, SUPPLEMENTARY_PRAYER_COUNT } from "@/lib/prayers/catalog";
import type { PrayerItemRecord } from "@/lib/prayers/markdown";

export type PrayerValidationIssue = {
  level: "error" | "warning";
  message: string;
};

export function validatePrayerItems(items: PrayerItemRecord[]): PrayerValidationIssue[] {
  const issues: PrayerValidationIssue[] = [];
  const main = items.filter((item) => item.category === "main");
  const supplementary = items.filter((item) => item.category === "supplementary");

  if (main.length !== MAIN_PRAYER_COUNT) {
    issues.push({
      level: "error",
      message: `기본 기도는 ${MAIN_PRAYER_COUNT}개여야 합니다. 현재 ${main.length}개입니다.`,
    });
  }

  if (supplementary.length !== SUPPLEMENTARY_PRAYER_COUNT) {
    issues.push({
      level: "error",
      message: `추가 기도는 ${SUPPLEMENTARY_PRAYER_COUNT}개여야 합니다. 현재 ${supplementary.length}개입니다.`,
    });
  }

  const numbers = main.map((item) => item.item_number);
  const uniqueNumbers = new Set(numbers);
  if (uniqueNumbers.size !== main.length) {
    issues.push({ level: "error", message: "기본 기도 번호가 중복되었습니다." });
  }

  for (let expected = 1; expected <= MAIN_PRAYER_COUNT; expected += 1) {
    if (!uniqueNumbers.has(expected)) {
      issues.push({ level: "error", message: `기본 기도 ${expected}번이 없습니다.` });
    }
  }

  const slugs = new Set<string>();
  const codes = new Set<string>();
  for (const item of items) {
    if (!item.title.trim()) {
      issues.push({ level: "error", message: `제목이 비어 있습니다: ${item.slug}` });
    }
    if (!item.content_md.trim()) {
      issues.push({ level: "error", message: `본문이 비어 있습니다: ${item.slug}` });
    }
    if (slugs.has(item.slug)) {
      issues.push({ level: "error", message: `slug가 중복되었습니다: ${item.slug}` });
    }
    slugs.add(item.slug);
    if (!item.history_code || item.history_code.length > 20) {
      issues.push({ level: "error", message: `history_code가 올바르지 않습니다: ${item.slug}` });
    }
    if (codes.has(item.history_code)) {
      issues.push({ level: "error", message: `history_code가 중복되었습니다: ${item.history_code}` });
    }
    codes.add(item.history_code);

    if (item.category === "main" && item.counts_toward_total !== true) {
      issues.push({
        level: "error",
        message: `기본 기도 counts_toward_total이 true가 아닙니다: ${item.slug}`,
      });
    }
    if (item.category === "supplementary") {
      if (item.counts_toward_total !== false) {
        issues.push({
          level: "error",
          message: `추가 기도 counts_toward_total이 false가 아닙니다: ${item.slug}`,
        });
      }
      if (item.item_number !== null) {
        issues.push({
          level: "error",
          message: `추가 기도 item_number는 null이어야 합니다: ${item.slug}`,
        });
      }
    }
  }

  return issues;
}

export function assertValidPrayers(items: PrayerItemRecord[]): void {
  const errors = validatePrayerItems(items).filter((issue) => issue.level === "error");
  if (errors.length > 0) {
    throw new Error(errors.map((issue) => issue.message).join("\n"));
  }
}
