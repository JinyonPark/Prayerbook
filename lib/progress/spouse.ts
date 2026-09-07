export type SpousePrayerSelection = "husband" | "wife" | null;

export const HUSBAND_PRAYER_NUMBER = 9;
export const WIFE_PRAYER_NUMBER = 10;

export function excludedSpouseItemNumber(selection: SpousePrayerSelection): number | null {
  if (selection === "husband") return WIFE_PRAYER_NUMBER;
  if (selection === "wife") return HUSBAND_PRAYER_NUMBER;
  return null;
}

export function parseSpousePrayerSelection(value: unknown): SpousePrayerSelection {
  if (value === "husband" || value === "wife") return value;
  return null;
}
