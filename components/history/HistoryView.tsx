"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useAppState } from "@/components/providers/AppProviders";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { fetchMonthlyPrayerHistory, fetchRecentPrayerHistory } from "@/lib/supabase/rpc";
import { hasPublicEnv } from "@/lib/validation/env";
import {
  applyDailyHistoryBaseline,
  applyMonthlyHistoryBaseline,
  clearAllHistory,
  hideHistoryDate,
  loadHistoryVisibilityState,
  saveHistoryVisibilityState,
  type HistoryDailyRow,
  type HistoryMonthlyRow,
  type HistoryPrayerItem,
  type HistoryVisibilityState,
} from "@/lib/progress/history-visibility";

type Tab = "daily" | "monthly";

function formatKoreanDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${Number(year)}년 ${Number(month)}월 ${Number(day)}일`;
}

function formatKoreanMonth(monthStart: string): string {
  const [year, month] = monthStart.split("-");
  return `${Number(year)}년 ${Number(month)}월`;
}

function itemLabel(item: HistoryPrayerItem): string {
  return item.item_number ? `${item.item_number}. ${item.title}` : item.title;
}

export function HistoryView() {
  const { dailySummary } = useAppState();
  const [tab, setTab] = useState<Tab>("daily");
  const [userId, setUserId] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<HistoryVisibilityState>(() => ({
    version: 1,
    clearAll: null,
    dateBaselines: {},
  }));
  const [dailyRows, setDailyRows] = useState<HistoryDailyRow[]>([]);
  const [monthlyRows, setMonthlyRows] = useState<HistoryMonthlyRow[] | null>(null);
  const [dailyStatus, setDailyStatus] = useState<"loading" | "ready" | "error">("loading");
  const [monthlyStatus, setMonthlyStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [storageError, setStorageError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"all" | HistoryDailyRow | null>(null);
  const [menu, setMenu] = useState<"page" | string | null>(null);
  const [openDates, setOpenDates] = useState<Record<string, boolean>>({});

  const persistVisibility = useCallback((user: string, next: HistoryVisibilityState) => {
    setVisibility(next);
    try {
      saveHistoryVisibilityState(user, next);
      setStorageError(null);
    } catch {
      setStorageError("이 기기에서 이력 숨김 설정을 저장할 수 없습니다.");
    }
  }, []);

  const loadDaily = useCallback(async () => {
    if (!hasPublicEnv()) {
      setDailyStatus("error");
      return;
    }
    setDailyStatus("loading");
    try {
      const supabase = createBrowserSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const id = session?.user?.id ?? null;
      setUserId(id);
      if (id) setVisibility(loadHistoryVisibilityState(id));
      const rows = await fetchRecentPrayerHistory(supabase);
      setDailyRows(rows);
      setOpenDates((current) => {
        if (Object.keys(current).length > 0) return current;
        const first = rows[0]?.local_date;
        return first ? { [first]: true } : {};
      });
      setDailyStatus("ready");
    } catch {
      setDailyStatus("error");
    }
  }, []);

  const loadMonthly = useCallback(async () => {
    if (!hasPublicEnv()) {
      setMonthlyStatus("error");
      return;
    }
    setMonthlyStatus("loading");
    try {
      const supabase = createBrowserSupabaseClient();
      const rows = await fetchMonthlyPrayerHistory(supabase);
      setMonthlyRows(rows);
      setMonthlyStatus("ready");
    } catch {
      setMonthlyStatus("error");
    }
  }, []);

  useEffect(() => {
    void loadDaily();
  }, [loadDaily]);

  useEffect(() => {
    if (tab === "monthly" && monthlyStatus === "idle") void loadMonthly();
  }, [tab, monthlyStatus, loadMonthly]);

  const visibleDaily = useMemo(
    () => dailyRows.map((row) => applyDailyHistoryBaseline(row, visibility)).filter((row): row is HistoryDailyRow => Boolean(row)),
    [dailyRows, visibility],
  );
  const visibleMonthly = useMemo(
    () => (monthlyRows ?? []).map((row) => applyMonthlyHistoryBaseline(row, visibility)).filter((row): row is HistoryMonthlyRow => Boolean(row)),
    [monthlyRows, visibility],
  );

  function hideDate(row: HistoryDailyRow) {
    if (!userId) return;
    const server = dailyRows.find((candidate) => candidate.local_date === row.local_date);
    if (!server) return;
    persistVisibility(userId, hideHistoryDate(visibility, server.local_date, server));
    setConfirm(null);
    setMenu(null);
  }

  function hideAll() {
    void hideAllAsync();
  }

  async function hideAllAsync() {
    if (!userId) return;
    let months = monthlyRows;
    if (months == null) {
      try {
        const supabase = createBrowserSupabaseClient();
        months = await fetchMonthlyPrayerHistory(supabase);
        setMonthlyRows(months);
        setMonthlyStatus("ready");
      } catch {
        months = [];
      }
    }
    const today = dailyRows.find((row) => row.local_date === dailySummary.local_date) ?? dailyRows[0] ?? null;
    const monthKey = `${(today?.local_date ?? "").slice(0, 8)}01`;
    const thisMonth = months.find((row) => row.month_start === monthKey) ?? months[0] ?? null;
    persistVisibility(userId, clearAllHistory(visibility, today, thisMonth));
    setConfirm(null);
    setMenu(null);
  }

  return (
    <div className="mx-auto w-full max-w-[760px] space-y-4 overflow-x-hidden">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">기도 이력</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">이력 삭제는 현재 기기에서만 적용됩니다.</p>
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

      <div className="flex gap-2">
        <Button variant={tab === "daily" ? "primary" : "secondary"} onClick={() => setTab("daily")}>
          최근 30일
        </Button>
        <Button variant={tab === "monthly" ? "primary" : "secondary"} onClick={() => setTab("monthly")}>
          월별 요약
        </Button>
      </div>

      {storageError ? <p role="alert">{storageError}</p> : null}

      {tab === "daily" ? (
        dailyStatus === "loading" ? (
          <p>기도 이력을 불러오는 중입니다.</p>
        ) : dailyStatus === "error" ? (
          <div className="space-y-2">
            <p role="alert">기도 이력을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>
            <Button variant="secondary" onClick={() => void loadDaily()}>
              다시 시도
            </Button>
          </div>
        ) : visibleDaily.length === 0 ? (
          <p className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
            {visibility.clearAll
              ? "표시할 기도 이력이 없습니다. 새로운 기도를 완료하면 다시 기록됩니다."
              : "최근 30일 동안 완료한 기도 기록이 없습니다. 기도를 완료하면 날짜별로 표시됩니다."}
          </p>
        ) : (
          <ul className="space-y-3">
            {visibleDaily.map((row, index) => {
              const open = openDates[row.local_date] ?? index === 0;
              return (
                <li key={row.local_date} className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => setOpenDates((current) => ({ ...current, [row.local_date]: !open }))}
                    >
                      <p className="break-keep font-semibold">{formatKoreanDate(row.local_date)}</p>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        총 {row.total_completion_count}회 · {row.unique_prayer_count}개 기도 항목
                      </p>
                    </button>
                    <Button variant="ghost" className="px-3" aria-label="날짜 메뉴" onClick={() => setMenu(menu === row.local_date ? null : row.local_date)}>
                      ⋮
                    </Button>
                  </div>
                  {menu === row.local_date ? (
                    <div className="mt-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-1">
                      <button type="button" className="touch-target w-full rounded-lg px-3 py-2 text-left" onClick={() => setConfirm(row)}>
                        이 날짜 이력 삭제
                      </button>
                    </div>
                  ) : null}
                  {open ? (
                    <ul className="mt-3 space-y-2">
                      {row.items.map((item) => (
                        <li key={item.history_code} className="flex items-start justify-between gap-3 text-sm">
                          <span className="min-w-0 break-keep">{itemLabel(item)}</span>
                          <span className="shrink-0">{item.completion_count}회</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )
      ) : monthlyStatus === "loading" ? (
        <p>월별 기도 기록을 불러오는 중입니다.</p>
      ) : monthlyStatus === "error" ? (
        <div className="space-y-2">
          <p role="alert">기도 이력을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>
          <Button variant="secondary" onClick={() => void loadMonthly()}>
            다시 시도
          </Button>
        </div>
      ) : visibleMonthly.length === 0 ? (
        <p className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
          {visibility.clearAll ? "표시할 기도 이력이 없습니다. 새로운 기도를 완료하면 다시 기록됩니다." : "표시할 월별 기도 기록이 없습니다."}
        </p>
      ) : (
        <ul className="space-y-3">
          {visibleMonthly.map((row) => (
            <li key={row.month_start} className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
              <p className="font-semibold">{formatKoreanMonth(row.month_start)}</p>
              <p className="mt-1 text-sm text-[var(--muted)]">총 {row.total_completion_count}회</p>
              <ul className="mt-3 space-y-2">
                {row.items.map((item) => (
                  <li key={item.history_code} className="flex items-start justify-between gap-3 text-sm">
                    <span className="min-w-0 break-keep">{itemLabel(item)}</span>
                    <span className="shrink-0">{item.completion_count}회</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={confirm !== null}
        title={confirm === "all" ? "전체 기도 이력을 삭제하시겠습니까?" : "이 날짜의 기도 이력을 삭제하시겠습니까?"}
        onClose={() => setConfirm(null)}
      >
        {confirm === "all" ? (
          <div className="space-y-2 text-sm">
            <p>현재까지 표시된 날짜별 및 월별 기도 이력이 이 기기에서 보이지 않게 됩니다.</p>
            <p>다음 정보는 변경되지 않습니다.</p>
            <ul className="list-disc pl-5">
              <li>기도별 완료 횟수</li>
              <li>오늘 기도 횟수</li>
              <li>지금까지 누적 기도 횟수</li>
              <li>Total 완료 독수</li>
              <li>현재 독수 진행률</li>
              <li>Supabase에 저장된 데이터</li>
            </ul>
            <p>새롭게 완료한 기도는 다시 이력에 표시됩니다.</p>
            <p>이력 삭제는 현재 기기에서만 적용됩니다.</p>
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            <p>이 기기에서 해당 날짜의 이전 기록만 보이지 않게 됩니다.</p>
            <p>기도 완료 횟수, Total, 오늘 기도 횟수, 누적 기도 횟수와 Supabase 데이터에는 영향을 주지 않습니다.</p>
            <p>이력 삭제는 현재 기기에서만 적용됩니다.</p>
          </div>
        )}
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" onClick={() => setConfirm(null)}>
            취소
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              if (confirm === "all") hideAll();
              else if (confirm) hideDate(confirm);
            }}
          >
            {confirm === "all" ? "전체 이력 삭제" : "이력 삭제"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
