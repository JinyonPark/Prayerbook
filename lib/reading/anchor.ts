export type ReadingAnchor = {
  last_prayer_item_id: string | null;
  scroll_ratio: number;
  anchor_key: string | null;
  anchor_offset: number | null;
  last_opened_at: string | null;
  updated_at: string | null;
};

export function readingPersistEquals(
  current: {
    last_prayer_item_id: string | null;
    scroll_ratio: number;
    anchor_key?: string | null;
    anchor_offset?: number | null;
    last_opened_at: string | null;
  } | null | undefined,
  next: ReadingAnchor,
): boolean {
  if (!current) return false;
  return (
    current.last_prayer_item_id === next.last_prayer_item_id &&
    current.scroll_ratio === next.scroll_ratio &&
    (current.anchor_key ?? null) === next.anchor_key &&
    (current.anchor_offset ?? null) === next.anchor_offset &&
    current.last_opened_at === next.last_opened_at
  );
}

export function captureReadingAnchor(article: HTMLElement | null): { anchorKey: string | null; anchorOffset: number | null } {
  if (!article) return { anchorKey: null, anchorOffset: null };
  const nodes = [...article.querySelectorAll<HTMLElement>("[data-prayer-anchor]")];
  if (nodes.length === 0) return { anchorKey: null, anchorOffset: null };
  let closest = nodes[0];
  let closestDelta = Number.POSITIVE_INFINITY;
  for (const node of nodes) {
    const top = node.getBoundingClientRect().top;
    const delta = Math.abs(top);
    if (delta < closestDelta) {
      closest = node;
      closestDelta = delta;
    }
  }
  return {
    anchorKey: closest.dataset.prayerAnchor ?? closest.id ?? null,
    anchorOffset: closest.getBoundingClientRect().top,
  };
}

export function restoreReadingAnchor(
  article: HTMLElement | null,
  anchorKey: string | null,
  anchorOffset: number | null,
): boolean {
  if (!article || !anchorKey) return false;
  const target =
    article.querySelector<HTMLElement>(`[data-prayer-anchor="${cssEscape(anchorKey)}"]`) ??
    document.getElementById(anchorKey);
  if (!target) return false;
  const offset = typeof anchorOffset === "number" && Number.isFinite(anchorOffset) ? anchorOffset : 0;
  const top = window.scrollY + target.getBoundingClientRect().top - offset;
  window.scrollTo({ top: Math.max(0, top), behavior: "instant" });
  return true;
}

function cssEscape(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") return CSS.escape(value);
  return value.replace(/["\\]/g, "\\$&");
}
