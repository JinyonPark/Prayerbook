import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseMarkdownDocument, toPrayerItem, type PrayerItemRecord } from "../lib/prayers/markdown";
import { assertValidPrayers } from "../lib/prayers/validate";

const ROOT = process.cwd();
const DIR = path.join(ROOT, "content", "prayers");
const SEED_PATH = path.join(ROOT, "supabase", "seed.sql");

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function toSeedSql(items: PrayerItemRecord[]): string {
  const values = items
    .map((item) => `(
  '${item.id}'::uuid,
  ${item.item_number === null ? "NULL" : String(item.item_number)},
  ${sqlString(item.slug)},
  ${sqlString(item.title)},
  ${sqlString(item.content_md)},
  ${sqlString(item.category)},
  ${item.counts_toward_total},
  ${item.display_order},
  ${sqlString(item.source_url)},
  ${item.content_version},
  ${item.is_active}
)`)
    .join(",\n");

  return `-- Generated from content/prayers markdown.
-- Updates prayer_items only. Does not touch user progress.

insert into public.prayer_items (
  id,
  item_number,
  slug,
  title,
  content_md,
  category,
  counts_toward_total,
  display_order,
  source_url,
  content_version,
  is_active
)
values
${values}
on conflict (id) do update set
  item_number = excluded.item_number,
  slug = excluded.slug,
  title = excluded.title,
  content_md = excluded.content_md,
  category = excluded.category,
  counts_toward_total = excluded.counts_toward_total,
  display_order = excluded.display_order,
  source_url = excluded.source_url,
  content_version = excluded.content_version,
  is_active = excluded.is_active,
  updated_at = now();
`;
}

async function main() {
  const files = (await readdir(DIR)).filter((file) => file.endsWith(".md"));
  const items = [];
  for (const file of files) {
    const raw = await readFile(path.join(DIR, file), "utf8");
    const parsed = parseMarkdownDocument(raw);
    items.push(toPrayerItem(parsed.data, parsed.content));
  }
  items.sort((a, b) => a.display_order - b.display_order);
  assertValidPrayers(items);
  await mkdir(path.dirname(SEED_PATH), { recursive: true });
  await writeFile(SEED_PATH, toSeedSql(items), "utf8");
  console.log(`wrote seed for ${items.length} prayers`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
