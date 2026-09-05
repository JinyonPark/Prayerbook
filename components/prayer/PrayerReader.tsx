"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Modal } from "@/components/ui/Modal";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { useAppState } from "@/components/providers/AppProviders";
import { toUserMessage } from "@/lib/errors/user-message";
import { MAIN_PRAYER_COUNT } from "@/lib/prayers/catalog";
import { preparePrayerMarkdown } from "@/lib/prayers/display";
import {
  applyPersonalization,
  intercessionFor,
  namesFor,
  personalizationConfig,
} from "@/lib/prayers/personalize";
import type { PrayerItemRecord } from "@/lib/prayers/markdown";
import { getScrollRatio, restoreScrollRatio } from "@/lib/reading/scroll-ratio";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { rpcComplete } from "@/lib/supabase/rpc";
import { hasPublicEnv } from "@/lib/validation/env";

type Props = {
  prayer: PrayerItemRecord;
  previous: PrayerItemRecord | null;
  next: PrayerItemRecord | null;
  prayers: PrayerItemRecord[];
};

export function PrayerReader({ prayer, previous, next, prayers }: Props) {
  const { summary, setSummary, reading, setReading, prefs, updatePrefs, online, personalizations } = useAppState();
  const [tocOpen, setTocOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const [error, setError] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<number | null>(null);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [atTop, setAtTop] = useState(true);
  const [chromeHeight, setChromeHeight] = useState(72);
  const restored = useRef(false);
  const lastSaved = useRef(0);
  const lastScrollY = useRef(0);
  const chromeRef = useRef<HTMLDivElement>(null);
  const nameRows = namesFor(personalizations, prayer.slug);
  const intercession = intercessionFor(personalizations, prayer.slug);
  const personalize = personalizationConfig(prayer.slug);
  const [focusName, setFocusName] = useState(nameRows[0]?.value ?? "");

  const progress = summary?.items.find((item) => item.prayer_item_id === prayer.id);
  const count = progress?.completion_count ?? 0;
  const round = summary?.current_round ?? 1;
  const doneThisRound = prayer.category === "main" ? count >= round : false;
  const numberedTitle = `${prayer.item_number ? `${prayer.item_number}. ` : ""}${prayer.title}`;
  const displayMarkdown = applyPersonalization(prayer.content_md, prayer.slug, {
    name: focusName || nameRows[0]?.value || null,
    intercession: intercession?.value ?? null,
  });

  useEffect(() => {
    const names = namesFor(personalizations, prayer.slug).map((row) => row.value);
    if (names.length === 0) {
      setFocusName("");
      return;
    }
    try {
      const stored = window.localStorage.getItem(`prayerbook-focus-name:${prayer.slug}`);
      setFocusName(stored && names.includes(stored) ? stored : names[0]);
    } catch {
      setFocusName(names[0]);
    }
  }, [prayer.slug, personalizations]);

  const persistReading = useCallback(
    async (ratio: number, opened = false) => {
      if (!hasPublicEnv() || !navigator.onLine) {
        setReading({
          last_prayer_item_id: prayer.id,
          scroll_ratio: ratio,
          last_opened_at: opened ? new Date().toISOString() : reading?.last_opened_at ?? null,
          updated_at: new Date().toISOString(),
        });
        return;
      }
      const supabase = createBrowserSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const payload = {
        user_id: user.id,
        last_prayer_item_id: prayer.id,
        scroll_ratio: ratio,
        last_opened_at: opened ? new Date().toISOString() : reading?.last_opened_at ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await supabase.from("user_reading_state").upsert(payload);
      setReading({
        last_prayer_item_id: payload.last_prayer_item_id,
        scroll_ratio: payload.scroll_ratio,
        last_opened_at: payload.last_opened_at,
        updated_at: payload.updated_at,
      });
    },
    [prayer.id, reading?.last_opened_at, setReading],
  );

  useEffect(() => {
    restored.current = false;
    void persistReading(reading?.last_prayer_item_id === prayer.id ? reading.scroll_ratio : 0, true);
  }, [prayer.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (restored.current) return;
    if (reading?.last_prayer_item_id !== prayer.id) {
      restored.current = true;
      return;
    }
    const id = window.requestAnimationFrame(() => {
      restoreScrollRatio(reading.scroll_ratio);
      restored.current = true;
    });
    return () => window.cancelAnimationFrame(id);
  }, [prayer.id, prayer.content_md, reading]);

  useEffect(() => {
    function saveNow() {
      void persistReading(getScrollRatio());
    }
    function onScroll() {
      const now = Date.now();
      if (now - lastSaved.current < 1500) return;
      lastSaved.current = now;
      saveNow();
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", saveNow);
    window.addEventListener("pagehide", saveNow);
    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", saveNow);
      window.removeEventListener("pagehide", saveNow);
      saveNow();
    };
  }, [persistReading]);

  useEffect(() => {
    lastScrollY.current = window.scrollY;
    setAtTop(window.scrollY < 24);
    setChromeVisible(true);

    function onScroll() {
      const y = window.scrollY;
      const delta = y - lastScrollY.current;
      const top = y < 24;
      setAtTop(top);
      if (top) {
        setChromeVisible(true);
      } else if (delta > 6) {
        setChromeVisible(false);
      } else if (delta < -6) {
        setChromeVisible(true);
      }
      lastScrollY.current = y;
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [prayer.id]);

  useEffect(() => {
    const el = chromeRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const update = () => setChromeHeight(el.getBoundingClientRect().height);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [atTop, numberedTitle, chromeVisible]);

  async function onComplete() {
    if (!online) return;
    setStatus("saving");
    setError(null);
    const eventId = crypto.randomUUID();
    try {
      const supabase = createBrowserSupabaseClient();
      const result = await rpcComplete(supabase, prayer.id, eventId);
      setSummary(result);
      setStatus("saved");
      if (result.total_changed) {
        setCelebration(result.current_total);
      }
    } catch (err) {
      setStatus("failed");
      setError(toUserMessage(err));
    }
  }

  const toc = (
    <nav aria-label="기도 목차">
      <ul className="space-y-1">
        {prayers.map((item) => (
          <li key={item.slug}>
            <Link
              href={`/prayers/${item.slug}`}
              className={`block rounded-lg px-2 py-2 ${item.slug === prayer.slug ? "bg-[var(--bg)] font-semibold" : ""}`}
              onClick={() => setTocOpen(false)}
            >
              {item.item_number ? `${item.item_number}. ` : ""}
              {item.title}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );

  return (
    <div className="reader-shell">
      <aside className="reader-side rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">{toc}</aside>
      <div>
        <div
          ref={chromeRef}
          className={`reader-chrome z-20 border-b border-[var(--border)] bg-[var(--bg)]/95 backdrop-blur transition-transform duration-200 max-lg:fixed max-lg:inset-x-0 max-lg:top-0 max-lg:pt-[var(--safe-top)] lg:sticky lg:top-[calc(var(--header-h)+var(--safe-top))] lg:-mx-5 lg:mb-4 lg:px-5 ${
            chromeVisible ? "max-lg:translate-y-0" : "max-lg:-translate-y-full max-lg:pointer-events-none"
          }`}
        >
          <div className="mx-auto flex max-w-[760px] items-center gap-1 px-3 py-1 lg:px-0 lg:py-2">
            <Link href="/prayers" className="touch-target inline-flex shrink-0 items-center rounded-xl px-2">
              뒤로
            </Link>
            <p className="hidden min-w-0 flex-1 truncate font-semibold lg:block">{numberedTitle}</p>
            <div className="min-w-0 flex-1 lg:hidden" aria-hidden="true" />
            <div className="ml-auto flex shrink-0 items-center">
              <Link
                href="/"
                className="touch-target inline-flex items-center justify-center rounded-xl px-2 text-sm font-medium lg:hidden"
              >
                홈
              </Link>
              <Button variant="ghost" className="px-2 text-sm" aria-label="목차" onClick={() => setTocOpen(true)}>
                목차
              </Button>
              <Button
                variant="ghost"
                className="px-2 text-sm"
                aria-label={prefs.theme === "night" ? "주간 모드" : "야간 모드"}
                onClick={() => void updatePrefs({ theme: prefs.theme === "night" ? "day" : "night" })}
              >
                {prefs.theme === "night" ? "주간" : "야간"}
              </Button>
              <Button
                variant="ghost"
                className="px-2 text-sm"
                aria-label="글자 크기"
                onClick={() => {
                  const order = ["small", "default", "large", "xlarge"] as const;
                  const index = order.indexOf(prefs.fontSize);
                  void updatePrefs({ fontSize: order[(index + 1) % order.length] });
                }}
              >
                글자
              </Button>
            </div>
          </div>
          {atTop ? (
            <p className="mx-auto max-w-[760px] px-3 pb-2 font-semibold leading-snug lg:hidden">{numberedTitle}</p>
          ) : null}
        </div>
        <div className="lg:hidden" style={{ height: chromeHeight }} aria-hidden="true" />

        <article className="reader-article rounded-none bg-[var(--card)] px-3.5 py-5 sm:rounded-2xl sm:px-8 sm:py-6">
          {prayer.content_md ? (
            <ReactMarkdown remarkPlugins={[remarkBreaks]}>{preparePrayerMarkdown(displayMarkdown)}</ReactMarkdown>
          ) : (
            <p>기도문 데이터가 없습니다.</p>
          )}
        </article>

        <div className="mx-auto mt-6 max-w-[760px] space-y-3 pb-[calc(7rem+var(--safe-bottom))] lg:pb-8">
          {nameRows.length > 1 ? (
            <label className="flex items-center gap-2 text-sm">
              <span className="shrink-0 text-[var(--muted)]">기도할 이름</span>
              <select
                className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-2"
                value={focusName}
                aria-label="기도할 이름"
                onChange={(event) => {
                  const next = event.target.value;
                  setFocusName(next);
                  try {
                    window.localStorage.setItem(`prayerbook-focus-name:${prayer.slug}`, next);
                  } catch {
                    /* ignore */
                  }
                }}
              >
                {nameRows.map((row) => (
                  <option key={row.id} value={row.value}>
                    {row.value}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {personalize ? (
            <p className="text-sm text-[var(--muted)]">
              이름과 중보기도는 본문을 건드리지 않고 따로 저장합니다.{" "}
              <Link href="/settings/personalize" className="underline">
                이름·중보기도 관리
              </Link>
            </p>
          ) : null}
          {prayer.category === "main" ? (
            <p>
              누적 {count}회 · 현재 {round}독 · {doneThisRound ? `이번 ${round}독 완료됨` : `이번 ${round}독 미완료`}
            </p>
          ) : (
            <p>누적 완료 {count}회</p>
          )}
          {!online ? (
            <p role="status">인터넷 연결이 필요합니다. 연결 후 기도 완료 기록을 저장할 수 있습니다.</p>
          ) : null}
          {status === "saving" ? <p>저장 중</p> : null}
          {status === "saved" ? <p>저장 완료</p> : null}
          {status === "failed" ? <p role="alert">{error}</p> : null}
          <Button className="w-full" onClick={() => void onComplete()} disabled={!online || status === "saving"}>
            {!online
              ? "오프라인에서는 저장할 수 없습니다"
              : prayer.category === "supplementary"
                ? "기도 완료 기록"
                : doneThisRound
                  ? "한 번 더 완료 기록"
                  : `이번 ${round}독 기도 완료`}
          </Button>
          {prayer.category === "main" && doneThisRound ? <p>✓ 이번 {round}독 완료됨</p> : null}
          <div className="flex flex-wrap gap-2">
            {previous ? (
              <Link href={`/prayers/${previous.slug}`} className="touch-target rounded-xl border border-[var(--border)] px-4 py-2.5">
                이전 기도
              </Link>
            ) : null}
            {next ? (
              <Link href={`/prayers/${next.slug}`} className="touch-target rounded-xl border border-[var(--border)] px-4 py-2.5">
                다음 기도
              </Link>
            ) : null}
            <Link href="/prayers" className="touch-target rounded-xl border border-[var(--border)] px-4 py-2.5">
              목차 이동
            </Link>
          </div>
        </div>
      </div>
      <aside className="reader-aside rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
        <p className="font-semibold">Total {summary?.total_completed ?? 0}독</p>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {round}독 진행 중 {summary?.current_completed_count ?? 0} / {MAIN_PRAYER_COUNT}
        </p>
        <div className="mt-3">
          <ProgressBar value={summary?.progress_percent ?? 0} label={`진행률 ${Math.round(summary?.progress_percent ?? 0)}%`} />
        </div>
      </aside>
      <Drawer open={tocOpen} title="목차" onClose={() => setTocOpen(false)}>
        {toc}
      </Drawer>
      <Modal
        open={celebration !== null}
        title={`${celebration}독을 완료했습니다.`}
        onClose={() => setCelebration(null)}
      >
        <p className="mb-4">
          {MAIN_PRAYER_COUNT}개의 기본 기도 항목을 모두 {celebration}회 이상 완료했습니다.
        </p>
        <Button onClick={() => setCelebration(null)}>{(celebration ?? 0) + 1}독 계속하기</Button>
      </Modal>
    </div>
  );
}
