export type SpousePrayerSelection = "husband" | "wife" | null;

export const HUSBAND_PRAYER_NUMBER = 9;
export const WIFE_PRAYER_NUMBER = 10;
export const SPOUSE_STORAGE_KEY = "prayerbook-spouse";

export function excludedSpouseItemNumber(selection: SpousePrayerSelection): number | null {
  if (selection === "husband") return WIFE_PRAYER_NUMBER;
  if (selection === "wife") return HUSBAND_PRAYER_NUMBER;
  return null;
}

export function isExcludedSpousePrayer(
  selection: SpousePrayerSelection,
  item: { slug: string; item_number: number | null },
): boolean {
  if (selection === "husband") return item.slug === "wife" || item.item_number === WIFE_PRAYER_NUMBER;
  if (selection === "wife") return item.slug === "husband" || item.item_number === HUSBAND_PRAYER_NUMBER;
  return false;
}

export function parseSpousePrayerSelection(value: unknown): SpousePrayerSelection {
  if (value === "husband" || value === "wife") return value;
  return null;
}

export function resolveSpousePrayerSelection(...candidates: unknown[]): SpousePrayerSelection {
  for (const candidate of candidates) {
    const parsed = parseSpousePrayerSelection(candidate);
    if (parsed) return parsed;
  }
  return null;
}

export function readCachedSpouseSelection(): SpousePrayerSelection {
  if (typeof window === "undefined") return null;
  try {
    return parseSpousePrayerSelection(window.localStorage.getItem(SPOUSE_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function writeCachedSpouseSelection(value: SpousePrayerSelection) {
  if (typeof window === "undefined") return;
  try {
    if (!value) window.localStorage.removeItem(SPOUSE_STORAGE_KEY);
    else window.localStorage.setItem(SPOUSE_STORAGE_KEY, value);
  } catch {
    /* ignore */
  }
}
