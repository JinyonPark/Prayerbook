"use client";

import Link from "next/link";
import { useAppState } from "@/components/providers/AppProviders";
import { ShareContentDialog } from "@/components/dashboard/ShareContentDialog";
import { eligibleCountFromSummary } from "@/lib/progress/calculate";

type Props = {
  startHref?: string;
};

export function TodayPrayerCard({ startHref = "/prayers" }: Props) {
  const { dailySummary, summary, refreshDaily } = useAppState();
  const progress = {
    totalCompleted: summary?.total_completed ?? 0,
    currentRound: summary?.current_round ?? 1,
    currentCompletedCount: summary?.current_completed_count ?? 0,
    eligibleCount: eligibleCountFromSummary(summary),
  };
  const count = dailySummary.total_completion_count;
  const unique = dailySummary.unique_prayer_count;
  const loaded = Boolean(dailySummary.local_date);
  const empty = loaded && count === 0;

  return (
    <section className="w-full max-w-xl rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 lg:max-w-md">
      <h2 className="text-lg font-semibold">오늘의 기도</h2>
      {!loaded ? (
        <p className="mt-2 text-sm text-[var(--muted)]">오늘 기록을 불러오는 중</p>
      ) : empty ? (
        <>
          <p className="mt-2 break-words">아직 완료한 기도가 없습니다.</p>
          <p className="mt-1 text-sm text-[var(--muted)]">기도를 완료하면 이곳에 기록됩니다.</p>
          <Link
            href={startHref}
            className="touch-target mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--accent)] px-4 py-2.5 text-[var(--accent-text)]"
          >
            기도 시작하기
          </Link>
        </>
      ) : (
        <>
          <p className="mt-2 break-words">오늘 총 {count}회 기도했습니다.</p>
          <p className="mt-1 break-words text-[var(--muted)]">완료한 기도 항목 {unique}개</p>
        </>
      )}
      <ShareContentDialog dailySummary={dailySummary} progress={progress} onRefresh={refreshDaily} />
    </section>
  );
}
