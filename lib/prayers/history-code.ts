export const SUPPLEMENTARY_HISTORY_CODES: Record<string, string> = {
  "hope-prayer": "wish",
  "conceived-prayer": "evangelism",
  "spiritual-prayer": "spiritual",
};

export function historyCodeFor(item: {
  category: "main" | "supplementary";
  item_number: number | null;
  slug: string;
}): string {
  if (item.category === "main" && item.item_number != null) {
    return String(item.item_number);
  }
  return SUPPLEMENTARY_HISTORY_CODES[item.slug] ?? item.slug.replace(/[^a-z0-9]/g, "").slice(0, 20);
}
