import type { PrayerInputValues } from "@/lib/prayers/inputs";

const ALLOWED_KEYS = new Set([
  "child_names",
  "names",
  "intercession",
  "disease_target_name",
  "disease_name",
  "wish_text",
  "forgiveness_person_name",
  "evangelism_target_name",
]);

const STRING_LIMITS: Record<string, number> = {
  disease_target_name: 100,
  disease_name: 200,
  wish_text: 1000,
  forgiveness_person_name: 100,
  evangelism_target_name: 100,
  intercession: 4000,
};

function cleanText(value: string, maxLength: number): string {
  return value.replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function uniqueNames(values: unknown, maxItems = 20, maxLength = 50): string[] {
  if (!Array.isArray(values)) {
    throw new Error("INVALID_INPUT_VALUES");
  }
  if (values.length > maxItems) {
    throw new Error("TOO_MANY_NAMES");
  }
  const seen = new Set<string>();
  const names: string[] = [];
  for (const item of values) {
    const name = cleanText(String(item ?? ""), maxLength);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    names.push(name);
  }
  return names;
}

export function normalizePrayerInputValues(values: PrayerInputValues | Record<string, unknown>): PrayerInputValues {
  const encoded = JSON.stringify(values ?? {});
  if (encoded.length > 16384) {
    throw new Error("INPUT_TOO_LARGE");
  }
  const input = (values ?? {}) as Record<string, unknown>;
  for (const key of Object.keys(input)) {
    if (!ALLOWED_KEYS.has(key)) {
      throw new Error("INVALID_INPUT_KEY");
    }
  }
  const next: PrayerInputValues = {};
  if ("child_names" in input) next.child_names = uniqueNames(input.child_names);
  if ("names" in input) next.names = uniqueNames(input.names);
  for (const [key, limit] of Object.entries(STRING_LIMITS)) {
    if (!(key in input)) continue;
    const value = input[key];
    if (typeof value !== "string") throw new Error("INVALID_INPUT_VALUES");
    const cleaned = cleanText(value, limit);
    if (cleaned) (next as Record<string, string>)[key] = cleaned;
  }
  return next;
}
