"use client";

import Link from "next/link";
import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useAppState } from "@/components/providers/AppProviders";
import { eligibleCountFromSummary } from "@/lib/progress/calculate";
import {
  dailySharePayload,
  formatDailyCopyText,
  formatDailyPreviewText,
  type DailyPrayerSummary,
} from "@/lib/progress/daily";
import { copyTextToClipboard, shareOrCopyText } from "@/lib/progress/clipboard";

const COPY_SUCCESS = "오늘의 기도 기록을 복사했습니다.";
const COPY_FAILURE = "기록을 복사하지 못했습니다.\n다시 시도해 주세요.";
const SHARE_COPY_FALLBACK = "이 브라우저에서는 공유창을 열 수 없어\n기도 기록을 복사했습니다.";
const SHARE_FAILURE = "기도 기록을 공유하지 못했습니다.\n다시 시도해 주세요.";

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
  const empty = count === 0;

  return (
    <section className="w-full max-w-xl rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 lg:max-w-md">
      <h2 className="text-lg font-semibold">오늘의 기도</h2>
      {empty ? (
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
          <ShareActions summary={dailySummary} progress={progress} onRefresh={refreshDaily} />
        </>
      )}
    </section>
  );
}

function ShareActions({
  summary,
  progress,
  onRefresh,
}: {
  summary: DailyPrayerSummary;
  progress: {
    totalCompleted: number;
    currentRound: number;
    currentCompletedCount: number;
    eligibleCount: number;
  };
  onRefresh: () => Promise<boolean>;
}) {
  const previewId = useId();
  const liveId = useId();
  const busy = useRef(false);
  const copyButtonRef = useRef<HTMLButtonElement>(null);
  const shareButtonRef = useRef<HTMLButtonElement>(null);
  const opener = useRef<"copy" | "share">("copy");
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeTone, setNoticeTone] = useState<"success" | "error">("success");

  const preview = formatDailyPreviewText(summary, progress);
  const copyText = formatDailyCopyText(summary, progress);
  const payload = dailySharePayload(summary, progress);

  function showNotice(message: string, tone: "success" | "error") {
    setNoticeTone(tone);
    setNotice(message);
  }

  function closePreview() {
    setOpen(false);
    queueMicrotask(() => {
      (opener.current === "share" ? shareButtonRef : copyButtonRef).current?.focus();
    });
  }

  async function onCopy() {
    if (busy.current) return;
    busy.current = true;
    try {
      const ok = await copyTextToClipboard(copyText);
      showNotice(ok ? COPY_SUCCESS : COPY_FAILURE, ok ? "success" : "error");
      if (ok) closePreview();
    } finally {
      busy.current = false;
    }
  }

  async function onShare() {
    if (busy.current) return;
    busy.current = true;
    try {
      const result = await shareOrCopyText(payload);
      if (result === "cancelled") return;
      if (result === "shared") {
        closePreview();
        return;
      }
      if (result === "copied") {
        showNotice(SHARE_COPY_FALLBACK, "success");
        closePreview();
        return;
      }
      showNotice(SHARE_FAILURE, "error");
    } catch {
      showNotice(SHARE_FAILURE, "error");
    } finally {
      busy.current = false;
    }
  }

  return (
    <div className="mt-4">
      <div className="flex flex-col gap-2 min-[360px]:flex-row">
        <Button
          ref={copyButtonRef}
          type="button"
          className="w-full min-[360px]:flex-1"
          aria-label="오늘의 기도 결과 복사"
          onClick={() => {
            opener.current = "copy";
            void onRefresh();
            setOpen(true);
          }}
        >
          결과 복사
        </Button>
        <Button
          ref={shareButtonRef}
          type="button"
          variant="secondary"
          className="w-full min-[360px]:flex-1"
          aria-label="오늘의 기도 결과 공유하기"
          onClick={() => {
            opener.current = "share";
            void onRefresh();
            setOpen(true);
          }}
        >
          공유하기
        </Button>
      </div>
      <p
        id={liveId}
        className={`mt-2 min-h-6 whitespace-pre-line text-sm ${noticeTone === "error" ? "text-[var(--danger)]" : "text-[var(--success)]"}`}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {notice}
      </p>
      <Modal
        open={open}
        title="공유할 내용"
        descriptionId={previewId}
        onClose={closePreview}
        footer={
          <div className="flex flex-col gap-2 min-[360px]:flex-row">
            <Button type="button" variant="ghost" className="w-full min-[360px]:flex-1" onClick={closePreview}>
              취소
            </Button>
            <Button type="button" variant="secondary" className="w-full min-[360px]:flex-1" onClick={() => void onCopy()}>
              복사
            </Button>
            <Button type="button" className="w-full min-[360px]:flex-1" onClick={() => void onShare()}>
              공유
            </Button>
          </div>
        }
      >
        <pre id={previewId} className="max-w-md whitespace-pre-wrap break-words font-sans text-sm leading-relaxed">
          {preview}
        </pre>
      </Modal>
    </div>
  );
}
