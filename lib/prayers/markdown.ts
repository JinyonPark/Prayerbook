export type PrayerItemRecord = {
  id: string;
  item_number: number | null;
  slug: string;
  title: string;
  content_md: string;
  category: "main" | "supplementary";
  counts_toward_total: boolean;
  display_order: number;
  source_url: string;
  content_version: number;
  is_active: boolean;
};

export type PrayerFrontmatter = {
  id: string;
  item_number: string;
  slug: string;
  title: string;
  category: string;
  counts_toward_total: string;
  display_order: string;
  source_url: string;
  content_version: string;
  is_active: string;
};

export function parseMarkdownDocument(raw: string): {
  data: Record<string, string>;
  content: string;
} {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    throw new Error("프론트매터가 없는 기도문 파일입니다.");
  }

  const data: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    data[key] = value.replace(/\\n/g, "\n");
  }

  return { data, content: match[2].replace(/^\r?\n/, "") };
}

export function toPrayerItem(data: Record<string, string>, content: string): PrayerItemRecord {
  const category = data.category;
  if (category !== "main" && category !== "supplementary") {
    throw new Error(`잘못된 category: ${data.slug ?? ""}`);
  }

  return {
    id: required(data, "id"),
    item_number: data.item_number === "" || data.item_number === "null" ? null : Number(data.item_number),
    slug: required(data, "slug"),
    title: required(data, "title"),
    content_md: content.trim(),
    category,
    counts_toward_total: data.counts_toward_total === "true",
    display_order: Number(data.display_order),
    source_url: required(data, "source_url"),
    content_version: Number(data.content_version ?? "1"),
    is_active: (data.is_active ?? "true") !== "false",
  };
}

function required(data: Record<string, string>, key: string): string {
  const value = data[key];
  if (!value) {
    throw new Error(`필수 필드가 없습니다: ${key}`);
  }
  return value;
}

export function yamlQuote(value: string): string {
  return JSON.stringify(value);
}
