import Link from "next/link";
import type { PrayerItemRecord } from "@/lib/prayers/markdown";
import type { RpcProgressSummary } from "@/lib/progress/types";

export function PrayerList({
  title,
  items,
  summary,
  round,
}: {
  title: string;
  items: PrayerItemRecord[];
  summary: RpcProgressSummary | null;
  round: number;
}) {
  return (
    <section>
      <h2 className="mb-2 text-lg font-semibold">{title}</h2>
      <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]">
        {items.map((item) => {
          const progress = summary?.items.find((candidate) => candidate.prayer_item_id === item.id);
          const count = progress?.completion_count ?? 0;
          const done = item.category === "main" ? count >= round : null;
          return (
            <li key={item.id}>
              <Link href={`/prayers/${item.slug}`} className="block px-4 py-3">
                <p className="font-medium">
                  {item.item_number ? `${item.item_number}. ` : ""}
                  {item.title}
                </p>
                {item.category === "main" ? (
                  <p className="text-sm text-[var(--muted)]">
                    이번 {round}독 {done ? "완료" : "미완료"} · 누적 {count}회
                  </p>
                ) : (
                  <p className="text-sm text-[var(--muted)]">누적 {count}회</p>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
