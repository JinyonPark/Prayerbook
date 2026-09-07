export type PrayerInputValues = {
  child_names?: string[];
  disease_target_name?: string;
  disease_name?: string;
  wish_text?: string;
  forgiveness_person_name?: string;
  evangelism_target_name?: string;
  auto_scroll_speed?: "slow" | "normal" | "fast";
};

export type PrayerInputRow = {
  user_id?: string;
  prayer_item_id: string;
  values: PrayerInputValues;
  updated_at?: string;
};

export function sanitizePlainText(value: string, maxLength = 200): string {
  return value.replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

export function parseNameList(raw: string): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const part of raw.split(/[\n,]+/)) {
    const name = sanitizePlainText(part, 40);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    names.push(name);
  }
  return names;
}

export function formatNameList(names: string[]): string {
  return names.join(", ");
}

export function lastNameForParticle(names: string[]): string {
  return names.at(-1) ?? "";
}

export type AutoScrollSpeed = "slow" | "normal" | "fast";

export function parseAutoScrollSpeed(value: unknown): AutoScrollSpeed {
  if (value === "slow" || value === "fast") return value;
  return "normal";
}

export const AUTO_SCROLL_PX_PER_SECOND: Record<AutoScrollSpeed, number> = {
  slow: 22,
  normal: 42,
  fast: 72,
};
