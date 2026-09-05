"use client";

import { PrayerList } from "@/components/prayer/PrayerList";
import { useAppState } from "@/components/providers/AppProviders";
import type { PrayerItemRecord } from "@/lib/prayers/markdown";

export function DashboardProgress({
  main,
  supplementary,
}: {
  main: PrayerItemRecord[];
  supplementary: PrayerItemRecord[];
}) {
  const { summary } = useAppState();
  const round = summary?.current_round ?? 1;
  return (
    <div className="space-y-6">
      <PrayerList title="기본 기도" items={main} summary={summary} round={round} />
      <PrayerList title="추가 기도" items={supplementary} summary={summary} round={round} />
    </div>
  );
}
