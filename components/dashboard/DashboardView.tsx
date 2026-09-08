"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { eligibleCountFromSummary, findNextIncomplete } from "@/lib/progress/calculate";
import { formatScrollPercent } from "@/lib/reading/scroll-ratio";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { OfflineBanner } from "@/components/pwa/ServiceWorkerRegistrar";
import { ServiceWorkerRegistrar } from "@/components/pwa/ServiceWorkerRegistrar";
import { useAppState } from "@/components/providers/AppProviders";
import { parseSpousePrayerSelection } from "@/lib/progress/spouse";
import type { PrayerItemRecord } from "@/lib/prayers/markdown";
import { TodayPrayerCard } from "@/components/dashboard/TodayPrayerCard";

const InstallCard = dynamic(() => import("@/components/pwa/InstallCard").then((mod) => ({ default: mod.InstallCard })), {
  ssr: false,
  loading: () => null,
});

export function DashboardView({ prayers }: { prayers: PrayerItemRecord[] }) {
  const { summary, reading, online, spouseSelection } = useAppState();
  const selection = parseSpousePrayerSelection(summary?.spouse_prayer_selection) ?? spouseSelection;
  const total = summary?.total_completed ?? 0;
  const round = summary?.current_round ?? 1;
  const completed = summary?.current_completed_count ?? 0;
  const percent = summary?.progress_percent ?? 0;
  const eligibleCount = eligibleCountFromSummary(summary);
  const lastPrayer = prayers.find((item) => item.id === reading?.last_prayer_item_id);
  const countItems = (summary?.items ?? []).map((item) => ({
    id: item.prayer_item_id,
    category: item.category,
    countsTowardTotal: item.counts_toward_total,
    itemNumber: item.item_number,
    displayOrder: item.display_order,
    completionCount: item.completion_count,
  }));
  const next = findNextIncomplete(countItems, round, selection);
  const nextPrayer = prayers.find((item) => item.id === next?.id) ?? prayers[0];
  const main = prayers.filter((item) => item.category === "main");
  const supplementary = prayers.filter((item) => item.category === "supplementary");

  return (
    <div className="space-y-4">
      <ServiceWorkerRegistrar />
      <OfflineBanner online={online} />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,24rem)]">
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
        <p className="text-sm text-[var(--muted)]">기도훈련집</p>
        <h2 className="mt-1 text-2xl font-semibold">Total {total}독 완료</h2>
        <p className="mt-1">
          {round}독 진행 중 {completed} / {eligibleCount}
        </p>
        {selection ? null : (
          <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3">
            <p>배우자 기도를 선택해 주세요.</p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              선택하기 전까지는 기존처럼 모든 기본 기도로 진행률을 계산합니다. 선택하지 않은 기도의 완료 횟수는 삭제되지 않습니다.
            </p>
            <Link href="/settings" className="touch-target mt-3 inline-flex rounded-xl bg-[var(--accent)] px-4 py-2.5 text-[var(--accent-text)]">
              설정에서 선택
            </Link>
          </div>
        )}
        <div className="mt-3">
          <ProgressBar value={percent} label={`진행률 ${Math.round(percent)}%`} />
        </div>
      </section>
      <TodayPrayerCard variant="dashboard" startHref={nextPrayer ? `/prayers/${nextPrayer.slug}` : `/prayers/${prayers[0]?.slug ?? "dawn"}`} />
      </div>

      {lastPrayer && reading ? (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
          <h2 className="text-lg font-semibold">이어 기도하기</h2>
          <p className="mt-2">
            {lastPrayer.item_number ? `${lastPrayer.item_number}. ` : ""}
            {lastPrayer.title}
          </p>
          <p className="text-[var(--muted)]">본문 {formatScrollPercent(reading.scroll_ratio)} 지점</p>
          <Link href={`/prayers/${lastPrayer.slug}`} prefetch className="touch-target mt-3 inline-flex rounded-xl bg-[var(--accent)] px-4 py-2.5 text-[var(--accent-text)] active:opacity-70">
            계속 기도하기
          </Link>
        </section>
      ) : (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
          <h2 className="text-lg font-semibold">시작하기</h2>
          <p className="mt-2 text-[var(--muted)]">마지막 읽은 항목이 없습니다.</p>
          <Link href={`/prayers/${prayers[0]?.slug ?? "dawn"}`} className="touch-target mt-3 inline-flex rounded-xl bg-[var(--accent)] px-4 py-2.5 text-[var(--accent-text)]">
            1번 기도부터 시작하기
          </Link>
        </section>
      )}

      {nextPrayer ? (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
          <h2 className="text-lg font-semibold">다음 미완료 기도</h2>
          <p className="mt-2">
            {nextPrayer.item_number ? `${nextPrayer.item_number}. ` : ""}
            {nextPrayer.title}
          </p>
          <Link href={`/prayers/${nextPrayer.slug}`} prefetch className="touch-target mt-3 inline-flex rounded-xl border border-[var(--border)] px-4 py-2.5 active:opacity-70">
            기도문 열기
          </Link>
        </section>
      ) : null}

      <PrayerCollection title="기도 목록" items={main} summary={summary} round={round} />
      <PrayerCollection title="추가 기도" items={supplementary} summary={summary} round={round} />
      <InstallCard compact />
    </div>
  );
}

function PrayerCollection({
  title,
  items,
  summary,
  round,
}: {
  title: string;
  items: PrayerItemRecord[];
  summary: ReturnType<typeof useAppState>["summary"];
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
                    {progress?.excluded_from_progress
                      ? `진행률 제외 · 누적 ${count}회`
                      : `이번 ${round}독 ${done ? "완료" : "미완료"} · 누적 ${count}회`}
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
