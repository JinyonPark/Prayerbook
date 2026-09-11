"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useAppState } from "@/components/providers/AppProviders";
import {
  LOCAL_DEVICE_HISTORY_NOTICE,
  deleteAllHistory,
  deleteHistoryDate,
  getHistoryByMonth,
  getLocalPrayerStore,
  historyRowsFromDaily,
  type PrayerLabel,
} from "@/lib/local-prayer-db";
import { getLocalDateString } from "@/lib/progress/timezone";

type ConfirmState = "all" | { localDate: string } | null;

function formatKoreanDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${Number(year)}년 ${Number(month)}월 ${Number(day)}일`;
}

function formatKoreanMonth(year: number, month: number): string {
  return `${year}년 ${month}월`;
}

function itemLabel(item: { itemNumber: number | null; title: string }): string {
  return item.itemNumber ? `${item.itemNumber}. ${item.title}` : item.title;
}

function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

export function HistoryView({ prayers }: { prayers: PrayerLabel[] }) {
  const { userId, timeZone } = useAppState();
  const labels = useMemo<PrayerLabel[]>(
    () =>
      prayers.length
        ? prayers
        : [],
    [prayers],
  );
  const today = getLocalDateString(timeZone);
  const initial = useMemo(() => {
    const [year, month] = today.split("-").map(Number);
    return { year: year || 2026, month: month || 1 };
  }, [today]);
  const [cursor, setCursor] = useState(initial);
  const [rows, setRows] = useState<ReturnType<typeof historyRowsFromDaily>>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [menu, setMenu] = useState<"page" | string | null>(null);
  const [openDates, setOpenDates] = useState<Record<string, boolean>>({});

  const loadMonth = useCallback(async () => {
    if (!userId) {
      setRows([]);
      setStatus("ready");
      return;
    }
    setStatus("loading");
    try {
      const store = getLocalPrayerStore();
      const history = await getHistoryByMonth(store, userId, cursor.year, cursor.month);
      const next = historyRowsFromDaily(history, labels);
      setRows(next);
      setOpenDates((current) => {
        if (Object.keys(current).length > 0) return current;
        const first = next[0]?.localDate;
        return first ? { [first]: true } : {};
      });
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [userId, cursor.year, cursor.month, labels]);

  useEffect(() => {
    void loadMonth();
  }, [loadMonth]);

  async function removeDate(localDate: string) {
    if (!userId) return;
    await deleteHistoryDate(getLocalPrayerStore(), userId, localDate);
    setConfirm(null);
    setMenu(null);
    await loadMonth();
  }

  async function removeAll() {
    if (!userId) return;
    await deleteAllHistory(getLocalPrayerStore(), userId);
    setConfirm(null);
    setMenu(null);
    await loadMonth();
  }

  const nowMonth = shiftMonth(initial.year, initial.month, 0);
  const nextCursor = shiftMonth(cursor.year, cursor.month, 1);
  const canGoNext =
    nextCursor.year < nowMonth.year || (nextCursor.year === nowMonth.year && nextCursor.month <= nowMonth.month);

  return (
    <div className="mx-auto w-full max-w-[760px] space-y-4 overflow-x-hidden">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">기도 이력</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">{LOCAL_DEVICE_HISTORY_NOTICE}</p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            이력 삭제는 이 기기에 표시된 날짜별 목록만 삭제하며, 기도별 완료 횟수와 Total에는 영향을 주지 않습니다.
          </p>
        </div>
        <div className="relative">
          <Button variant="ghost" className="px-3" aria-expanded={menu === "page"} onClick={() => setMenu(menu === "page" ? null : "page")}>
            더보기
          </Button>
          {menu === "page" ? (
            <div className="absolute right-0 z-20 mt-1 min-w-40 rounded-xl border border-[var(--border)] bg-[var(--card)] p-1">
              <button type="button" className="touch-target w-full rounded-lg px-3 py-2 text-left" onClick={() => setConfirm("all")}>
                전체 이력 삭제
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3">
        <Button variant="secondary" onClick={() => setCursor((current) => shiftMonth(current.year, current.month, -1))}>
          이전 달
        </Button>
        <p className="font-semibold">〈 {formatKoreanMonth(cursor.year, cursor.month)} 〉</p>
        <Button variant="secondary" disabled={!canGoNext} onClick={() => setCursor((current) => shiftMonth(current.year, current.month, 1))}>
          다음 달
        </Button>
      </div>
      <div className="flex justify-center">
        <Button variant="ghost" onClick={() => setCursor(nowMonth)}>
          현재 월
        </Button>
      </div>

      {status === "loading" ? (
        <p>기도 이력을 불러오는 중입니다.</p>
      ) : status === "error" ? (
        <div className="space-y-2">
          <p role="alert">기도 이력을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>
          <Button variant="secondary" onClick={() => void loadMonth()}>
            다시 시도
          </Button>
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
          이 달에 완료한 기도 기록이 없습니다. 기도를 완료하면 날짜별로 표시됩니다.
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row, index) => {
            const open = openDates[row.localDate] ?? index === 0;
            return (
              <li key={row.localDate} className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => setOpenDates((current) => ({ ...current, [row.localDate]: !open }))}
                  >
                    <p className="break-keep font-semibold">{formatKoreanDate(row.localDate)}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      총 {row.totalCompletionCount}회 · {row.uniquePrayerCount}개 기도 항목
                    </p>
                  </button>
                  <Button variant="ghost" className="px-3" aria-label="날짜 메뉴" onClick={() => setMenu(menu === row.localDate ? null : row.localDate)}>
                    ⋮
                  </Button>
                </div>
                {menu === row.localDate ? (
                  <div className="mt-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-1">
                    <button type="button" className="touch-target w-full rounded-lg px-3 py-2 text-left" onClick={() => setConfirm({ localDate: row.localDate })}>
                      이 날짜 이력 삭제
                    </button>
                  </div>
                ) : null}
                {open ? (
                  <ul className="mt-3 space-y-2">
                    {row.items.map((item) => (
                      <li key={item.prayerItemId} className="flex items-start justify-between gap-3 text-sm">
                        <span className="min-w-0 break-keep">{itemLabel(item)}</span>
                        <span className="shrink-0">{item.completionCount}회</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <Modal
        open={confirm !== null}
        title={confirm === "all" ? "전체 기도 이력을 삭제하시겠습니까?" : "이 날짜의 기도 이력을 삭제하시겠습니까?"}
        onClose={() => setConfirm(null)}
      >
        {confirm === "all" ? (
          <div className="space-y-2 text-sm">
            <p>이 기기에 표시된 날짜별 기도 이력이 모두 삭제됩니다.</p>
            <p>다음 정보는 변경되지 않습니다.</p>
            <ul className="list-disc pl-5">
              <li>오늘 기도 횟수</li>
              <li>지금까지 누적 기도 횟수</li>
              <li>기도별 완료 횟수</li>
              <li>Total 완료 독수</li>
              <li>Supabase 데이터</li>
            </ul>
            <p>새롭게 완료한 기도는 이력에 다시 표시됩니다.</p>
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            <p>이 기기의 이력 화면에서만 삭제됩니다.</p>
            <p>기도 완료 횟수, 오늘 기도 횟수, 누적 기도 횟수, Total과 Supabase 데이터에는 영향을 주지 않습니다.</p>
          </div>
        )}
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" onClick={() => setConfirm(null)}>
            취소
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              if (confirm === "all") void removeAll();
              else if (confirm) void removeDate(confirm.localDate);
            }}
          >
            {confirm === "all" ? "전체 이력 삭제" : "이력 삭제"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
