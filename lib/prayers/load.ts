import "server-only";

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseMarkdownDocument, toPrayerItem, type PrayerItemRecord } from "@/lib/prayers/markdown";
import { assertValidPrayers } from "@/lib/prayers/validate";

let cache: PrayerItemRecord[] | null = null;

export function loadPrayerItems(): PrayerItemRecord[] {
  if (cache) return cache;

  const dir = path.join(process.cwd(), "content", "prayers");
  const files = readdirSync(dir).filter((file) => file.endsWith(".md"));
  const items = files.map((file) => {
    const raw = readFileSync(path.join(dir, file), "utf8");
    const parsed = parseMarkdownDocument(raw);
    return toPrayerItem(parsed.data, parsed.content);
  });

  items.sort((a, b) => a.display_order - b.display_order);
  assertValidPrayers(items);
  cache = items;
  return items;
}

export function getPrayerBySlug(slug: string): PrayerItemRecord | undefined {
  return loadPrayerItems().find((item) => item.slug === slug);
}

export function getAdjacentPrayers(slug: string): {
  current: PrayerItemRecord;
  previous: PrayerItemRecord | null;
  next: PrayerItemRecord | null;
} | null {
  const items = loadPrayerItems();
  const index = items.findIndex((item) => item.slug === slug);
  if (index === -1) return null;
  return {
    current: items[index],
    previous: items[index - 1] ?? null,
    next: items[index + 1] ?? null,
  };
}
