import { isExcludedSpousePrayer, type SpousePrayerSelection } from "@/lib/progress/spouse";

export type SequentialPrayerItem = {
  id: string;
  slug: string;
  title: string;
  item_number: number | null;
  display_order: number;
  is_active?: boolean;
};

export function getSequentialPrayerItems<T extends SequentialPrayerItem>(
  prayerItems: T[],
  spousePrayerSelection: SpousePrayerSelection,
): T[] {
  return prayerItems
    .filter((item) => item.is_active !== false)
    .slice()
    .sort((a, b) => a.display_order - b.display_order)
    .filter((item) => !isExcludedSpousePrayer(spousePrayerSelection, item));
}

export function getPreviousPrayerItem<T extends SequentialPrayerItem>(
  prayerItems: T[],
  currentSlug: string,
  spousePrayerSelection: SpousePrayerSelection,
): T | null {
  return getAdjacentSequentialPrayers(prayerItems, currentSlug, spousePrayerSelection).previous;
}

export function getNextPrayerItem<T extends SequentialPrayerItem>(
  prayerItems: T[],
  currentSlug: string,
  spousePrayerSelection: SpousePrayerSelection,
): T | null {
  return getAdjacentSequentialPrayers(prayerItems, currentSlug, spousePrayerSelection).next;
}

export function getAdjacentSequentialPrayers<T extends SequentialPrayerItem>(
  prayerItems: T[],
  currentSlug: string,
  spousePrayerSelection: SpousePrayerSelection,
): { current: T | null; previous: T | null; next: T | null } {
  const current = prayerItems.find((item) => item.slug === currentSlug) ?? null;
  const sequential = getSequentialPrayerItems(prayerItems, spousePrayerSelection);
  if (!current) return { current: null, previous: null, next: null };

  const index = sequential.findIndex((item) => item.id === current.id || item.slug === current.slug);
  if (index !== -1) {
    return {
      current,
      previous: sequential[index - 1] ?? null,
      next: sequential[index + 1] ?? null,
    };
  }

  const previous =
    [...sequential].reverse().find((item) => item.display_order < current.display_order) ?? null;
  const next = sequential.find((item) => item.display_order > current.display_order) ?? null;
  return { current, previous, next };
}
