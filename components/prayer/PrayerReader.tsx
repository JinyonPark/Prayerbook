"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Modal } from "@/components/ui/Modal";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { PrayerBody } from "@/components/prayer/PrayerBody";
import { PrayerInputEditor } from "@/components/prayer/PrayerInputEditor";
import { useAppState } from "@/components/providers/AppProviders";
import { isAuthFailure, logDevError } from "@/lib/errors/inspect";
import { toCompleteUserMessage } from "@/lib/errors/user-message";
import { applyPersonalization, applyPrayerInputValues, intercessionFor, namesFor, personalizationConfig } from "@/lib/prayers/personalize";
import type { PrayerItemRecord } from "@/lib/prayers/markdown";
import { AUTO_SCROLL_PX_PER_SECOND, type PrayerInputValues } from "@/lib/prayers/inputs";
import { captureReadingAnchor, readingPersistEquals, restoreReadingAnchor } from "@/lib/reading/anchor";
import { getScrollRatio, restoreScrollRatio } from "@/lib/reading/scroll-ratio";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { completePrayerRequest } from "@/lib/progress/complete-request";
import { hasPublicEnv } from "@/lib/validation/env";
import { eligibleCountFromSummary } from "@/lib/progress/calculate";
import { applySuccessfulCompleteToDaily } from "@/lib/progress/daily";
import { excludedSpouseItemNumber } from "@/lib/progress/spouse";
import { getAdjacentSequentialPrayers } from "@/lib/prayers/sequential";
import {
  AUTO_SCROLL_START_DELAY_MS,
  isManualScrollKey,
  nextAutoScrollPosition,
  shouldStartAutoScroll,
} from "@/lib/prayers/auto-scroll";

type Props = {
  prayer: PrayerItemRecord;
  prayers: PrayerItemRecord[];
};

export function PrayerReader({ prayer, prayers }: Props) {
  const router = useRouter();
  const {
    summary,
    setSummary,
    reading,
    setReading,
    prefs,
    updatePrefs,
    spouseSelection,
    personalizations,
    prayerInputs,
    savePrayerInputs,
    refreshDaily,
    setDailySummary,
  } = useAppState();
  const [tocOpen, setTocOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const [inputStatus, setInputStatus] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const [error, setError] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<number | null>(null);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [atTop, setAtTop] = useState(true);
  const [chromeHeight, setChromeHeight] = useState(72);
  const [reachedEnd, setReachedEnd] = useState(false);
  const [inputEditorOpen, setInputEditorOpen] = useState(false);
  const [autoRunning, setAutoRunning] = useState(false);
  const [navPending, setNavPending] = useState(false);
  const restored = useRef(false);
  const lastOpenedAtRef = useRef(reading?.last_opened_at ?? null);
  const lastReadingRef = useRef(reading);
  const persistReadingRef = useRef<(opened?: boolean) => Promise<void>>(async () => {});
  const lastSaved = useRef(0);
  const lastScrollY = useRef(0);
  const userScrolling = useRef(false);
  const restoring = useRef(false);
  const completeEventId = useRef<string | null>(null);
  const autoCancelRef = useRef(false);
  const autoTimerRef = useRef(0);
  const chromeRef = useRef<HTMLDivElement>(null);
  const articleWrapRef = useRef<HTMLDivElement>(null);
  const nameRows = namesFor(personalizations, prayer.slug);
  const intercession = intercessionFor(personalizations, prayer.slug);
  const personalize = personalizationConfig(prayer.slug);
  const inputValues = prayerInputs.find((row) => row.prayer_item_id === prayer.id)?.values ?? {};
  const childNames = prayer.slug === "children" ? (inputValues.child_names?.length ? inputValues.child_names : nameRows.map((row) => row.value)) : null;
  const [focusName, setFocusName] = useState(nameRows[0]?.value ?? "");
  const overlayOpen = tocOpen || celebration !== null || inputEditorOpen;
  const overlayOpenRef = useRef(overlayOpen);
  overlayOpenRef.current = overlayOpen;
  const eligibleCount = eligibleCountFromSummary(summary);
  const excludedNumber = excludedSpouseItemNumber(spouseSelection);
  const adjacent = useMemo(
    () => getAdjacentSequentialPrayers(prayers, prayer.slug, spouseSelection),
    [prayers, prayer.slug, spouseSelection],
  );
  const previousPrayer = adjacent.previous;
  const nextPrayer = adjacent.next;

  const progress = summary?.items.find((item) => item.prayer_item_id === prayer.id);
  const count = progress?.completion_count ?? 0;
  const round = summary?.current_round ?? 1;
  const excluded = Boolean(progress?.excluded_from_progress);
  const doneThisRound = prayer.category === "main" && !excluded ? count >= round : false;
  const numberedTitle = `${prayer.item_number ? `${prayer.item_number}. ` : ""}${prayer.title}`;
  const appliedNames = childNames ?? (focusName || nameRows[0]?.value ? [focusName || nameRows[0]?.value] : []);
  const displayMarkdown = applyPrayerInputValues(
    applyPersonalization(prayer.content_md, prayer.slug, {
      names: appliedNames.filter(Boolean) as string[],
      intercession: intercession?.value ?? null,
    }),
    prayer.slug,
    inputValues,
  );

  useEffect(() => {
    if (prayer.slug === "children") return;
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
    async (opened = false) => {
      const ratio = getScrollRatio();
      const article = articleWrapRef.current?.querySelector(".reader-article") as HTMLElement | null;
      const anchor = captureReadingAnchor(article);
      const lastOpenedAt = opened ? new Date().toISOString() : lastOpenedAtRef.current;
      if (opened) lastOpenedAtRef.current = lastOpenedAt;
      const payload = {
        last_prayer_item_id: prayer.id,
        scroll_ratio: ratio,
        anchor_key: anchor.anchorKey,
        anchor_offset: anchor.anchorOffset,
        last_opened_at: lastOpenedAt,
        updated_at: new Date().toISOString(),
      };
      if (!readingPersistEquals(lastReadingRef.current, payload)) {
        lastReadingRef.current = payload;
        setReading(payload);
      }
      if (!hasPublicEnv()) return;
      const supabase = createBrowserSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase.from("user_reading_state").upsert({
        user_id: user.id,
        ...payload,
      });
      if (error) {
        await supabase.from("user_reading_state").upsert({
          user_id: user.id,
          last_prayer_item_id: payload.last_prayer_item_id,
          scroll_ratio: payload.scroll_ratio,
          last_opened_at: payload.last_opened_at,
          updated_at: payload.updated_at,
        });
      }
    },
    [prayer.id, setReading],
  );
  persistReadingRef.current = persistReading;

  const cancelAutoStart = useCallback(() => {
    autoCancelRef.current = true;
    window.clearTimeout(autoTimerRef.current);
    autoTimerRef.current = 0;
    setAutoRunning(false);
  }, []);

  useEffect(() => {
    restored.current = false;
    autoCancelRef.current = false;
    completeEventId.current = null;
    setReachedEnd(false);
    setAutoRunning(false);
    setNavPending(false);
    setChromeVisible(true);
    setAtTop(true);
    setTocOpen(false);
    setStatus("idle");
    setError(null);
    window.clearTimeout(autoTimerRef.current);
  }, [prayer.id]);

  const restorePosition = useCallback(() => {
    if (reading?.last_prayer_item_id !== prayer.id) {
      restored.current = true;
      return;
    }
    restoring.current = true;
    const article = articleWrapRef.current?.querySelector(".reader-article") as HTMLElement | null;
    const restoredByAnchor = restoreReadingAnchor(article, reading.anchor_key ?? null, reading.anchor_offset ?? null);
    if (!restoredByAnchor) restoreScrollRatio(reading.scroll_ratio);
    restored.current = true;
    window.setTimeout(() => {
      restoring.current = false;
    }, 250);
  }, [prayer.id, reading?.last_prayer_item_id, reading?.scroll_ratio, reading?.anchor_key, reading?.anchor_offset]);

  useEffect(() => {
    if (restored.current) return;
    const id = window.requestAnimationFrame(() => {
      if (reading?.last_prayer_item_id === prayer.id) {
        restorePosition();
        void persistReadingRef.current(true);
        return;
      }
      window.scrollTo(0, 0);
      restored.current = true;
      void persistReadingRef.current(true);
    });
    return () => window.cancelAnimationFrame(id);
  }, [prayer.id, prayer.content_md, displayMarkdown, prefs.fontSize, prefs.lineHeight, prefs.theme, restorePosition, reading?.last_prayer_item_id]);

  useEffect(() => {
    let frame = 0;
    function onViewportChange() {
      if (userScrolling.current || restoring.current) return;
      window.cancelAnimationFrame(frame);
      const article = articleWrapRef.current?.querySelector(".reader-article") as HTMLElement | null;
      const snapshot = captureReadingAnchor(article);
      frame = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          if (userScrolling.current) return;
          restoreReadingAnchor(article, snapshot.anchorKey, snapshot.anchorOffset);
        });
      });
    }
    window.visualViewport?.addEventListener("resize", onViewportChange);
    window.addEventListener("orientationchange", onViewportChange);
    return () => {
      window.visualViewport?.removeEventListener("resize", onViewportChange);
      window.removeEventListener("orientationchange", onViewportChange);
      window.cancelAnimationFrame(frame);
    };
  }, [prayer.id]);

  useEffect(() => {
    function saveNow() {
      void persistReadingRef.current();
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
  }, [prayer.id]);

  useEffect(() => {
    lastScrollY.current = window.scrollY;
    setAtTop(window.scrollY < 24);
    setChromeVisible(true);

    function onScroll() {
      const y = window.scrollY;
      const delta = y - lastScrollY.current;
      const top = y < 24;
      setAtTop(top);
      if (top) setChromeVisible(true);
      else if (delta > 6) setChromeVisible(false);
      else if (delta < -6) setChromeVisible(true);
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

  useEffect(() => {
    if (previousPrayer) router.prefetch(`/prayers/${previousPrayer.slug}`);
    if (nextPrayer) router.prefetch(`/prayers/${nextPrayer.slug}`);
  }, [previousPrayer, nextPrayer, router]);

  useEffect(() => {
    if (prefs.autoScrollEnabled) setReachedEnd(false);
  }, [prefs.autoScrollEnabled]);

  useEffect(() => {
    if (overlayOpen && !autoRunning) {
      autoCancelRef.current = true;
      window.clearTimeout(autoTimerRef.current);
    }
  }, [overlayOpen, autoRunning]);

  useEffect(() => {
    window.clearTimeout(autoTimerRef.current);
    if (!prefs.autoScrollEnabled || reachedEnd) {
      setAutoRunning(false);
      return;
    }

    function arm() {
      if (autoCancelRef.current || !prefs.autoScrollEnabled) return;
      if (!restored.current || restoring.current) {
        autoTimerRef.current = window.setTimeout(arm, 50);
        return;
      }
      autoTimerRef.current = window.setTimeout(() => {
        if (
          !shouldStartAutoScroll({
            enabled: prefs.autoScrollEnabled,
            restored: restored.current,
            visible: document.visibilityState === "visible",
            overlayOpen: overlayOpenRef.current,
            cancelled: autoCancelRef.current,
          })
        ) {
          return;
        }
        setAutoRunning(true);
      }, AUTO_SCROLL_START_DELAY_MS);
    }
    arm();
    return () => window.clearTimeout(autoTimerRef.current);
  }, [prayer.id, prefs.autoScrollEnabled, reachedEnd]);

  useEffect(() => {
    if (autoRunning) return;
    function cancelFromUser() {
      if (restoring.current) return;
      autoCancelRef.current = true;
      window.clearTimeout(autoTimerRef.current);
    }
    function cancelFromKey(event: KeyboardEvent) {
      if (!isManualScrollKey(event.key)) return;
      cancelFromUser();
    }
    function cancelIfHidden() {
      if (document.visibilityState !== "visible") cancelFromUser();
    }
    window.addEventListener("wheel", cancelFromUser, { passive: true });
    window.addEventListener("touchmove", cancelFromUser, { passive: true });
    window.addEventListener("keydown", cancelFromKey);
    document.addEventListener("visibilitychange", cancelIfHidden);
    return () => {
      window.removeEventListener("wheel", cancelFromUser);
      window.removeEventListener("touchmove", cancelFromUser);
      window.removeEventListener("keydown", cancelFromKey);
      document.removeEventListener("visibilitychange", cancelIfHidden);
    };
  }, [autoRunning, prayer.id]);

  useEffect(() => {
    if (!autoRunning || reachedEnd || overlayOpen) return;
    let frame = 0;
    let last = performance.now();
    const speed = AUTO_SCROLL_PX_PER_SECOND[prefs.autoScrollSpeed];

    function tick(now: number) {
      const elapsed = Math.min(48, now - last);
      last = now;
      if (
        restored.current &&
        !restoring.current &&
        !userScrolling.current &&
        document.visibilityState === "visible"
      ) {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const next = nextAutoScrollPosition(window.scrollY, max, speed, elapsed);
        window.scrollTo({ top: next.y });
        if (next.finished && max > 1) {
          setReachedEnd(true);
          setAutoRunning(false);
          return;
        }
      }
      frame = window.requestAnimationFrame(tick);
    }
    frame = window.requestAnimationFrame(tick);

    function pauseFromUser() {
      if (restoring.current) return;
      userScrolling.current = true;
      window.setTimeout(() => {
        userScrolling.current = false;
      }, 600);
    }
    function pauseFromKey(event: KeyboardEvent) {
      if (!isManualScrollKey(event.key)) return;
      pauseFromUser();
    }

    window.addEventListener("wheel", pauseFromUser, { passive: true });
    window.addEventListener("touchmove", pauseFromUser, { passive: true });
    window.addEventListener("keydown", pauseFromKey);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("wheel", pauseFromUser);
      window.removeEventListener("touchmove", pauseFromUser);
      window.removeEventListener("keydown", pauseFromKey);
    };
  }, [autoRunning, reachedEnd, overlayOpen, prefs.autoScrollSpeed]);

  useEffect(() => {
    if (!restored.current) return;
    const article = articleWrapRef.current?.querySelector(".reader-article") as HTMLElement | null;
    const snapshot = captureReadingAnchor(article);
    restoring.current = true;
    const id = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        restoreReadingAnchor(article, snapshot.anchorKey, snapshot.anchorOffset);
        window.setTimeout(() => {
          restoring.current = false;
        }, 250);
      });
    });
    return () => window.cancelAnimationFrame(id);
  }, [prefs.fontSize, prefs.lineHeight, prefs.theme]);

  async function onComplete() {
    if (status === "saving") return;
    setStatus("saving");
    setError(null);
    if (!completeEventId.current) completeEventId.current = crypto.randomUUID();
    const eventId = completeEventId.current;
    try {
      const supabase = createBrowserSupabaseClient();
      const result = await completePrayerRequest(supabase, prayer.id, eventId);
      completeEventId.current = null;
      setSummary(result);
      setStatus("saved");
      if (result.total_changed) setCelebration(result.current_total);
      void refreshDaily().then((refreshed) => {
        if (refreshed) return;
        setDailySummary((current) =>
          applySuccessfulCompleteToDaily(current, {
            prayerItemId: prayer.id,
            prayerTitle: prayer.title,
            itemNumber: prayer.item_number,
            category: prayer.category,
            idempotent: result.idempotent,
          }),
        );
      });
    } catch (err) {
      logDevError("onComplete", err);
      setStatus("failed");
      setError(toCompleteUserMessage(err));
      if (isAuthFailure(err)) {
        router.replace(`/login?next=${encodeURIComponent(`/prayers/${prayer.slug}`)}`);
      }
    }
  }

  async function onSaveInputs(values: PrayerInputValues) {
    setInputStatus("saving");
    try {
      await savePrayerInputs(prayer.id, values);
      setInputStatus("saved");
    } catch (err) {
      setInputStatus("failed");
      throw err;
    }
  }

  function goToPrayer(slug: string) {
    if (navPending) return;
    cancelAutoStart();
    setTocOpen(false);
    if (slug === prayer.slug) return;
    setNavPending(true);
    void persistReading();
    router.push(`/prayers/${slug}`);
  }

  const toc = (
    <nav aria-label="기도 목차">
      <ul className="space-y-1">
        {prayers.map((item) => (
          <li key={item.id}>
            <Link
              href={`/prayers/${item.slug}`}
              prefetch={item.slug === previousPrayer?.slug || item.slug === nextPrayer?.slug}
              className={`block rounded-lg px-2 py-2 ${item.slug === prayer.slug ? "bg-[var(--bg)] font-semibold" : ""}`}
              onClick={(event) => {
                event.preventDefault();
                goToPrayer(item.slug);
              }}
            >
              {item.item_number ? `${item.item_number}. ` : ""}
              {item.title}
              {excludedNumber !== null && item.item_number === excludedNumber ? (
                <span className="ml-2 text-sm font-normal text-[var(--muted)]">진행률 제외</span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );

  return (
    <div className="reader-shell">
      {navPending ? <div className="pointer-events-none fixed inset-x-0 top-0 z-[95] h-1 bg-[var(--accent)]" aria-hidden="true" /> : null}
      <aside className="reader-side rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">{toc}</aside>
      <div>
        <div
          ref={chromeRef}
          className={`reader-chrome pointer-events-none z-40 border-b border-[var(--border)] bg-[var(--bg)]/95 backdrop-blur transition-transform duration-200 max-lg:fixed max-lg:inset-x-0 max-lg:top-0 max-lg:pt-[var(--safe-top)] max-lg:shadow-[0_calc(-1*var(--safe-top))_0_var(--status-bar)] lg:sticky lg:top-[calc(var(--header-h)+var(--safe-top))] lg:-mx-5 lg:mb-4 lg:px-5 ${
            chromeVisible ? "max-lg:translate-y-0" : "max-lg:-translate-y-full"
          }`}
        >
          <div className="pointer-events-auto relative z-[1] mx-auto flex max-w-[760px] items-center gap-1 px-3 py-1 lg:px-0 lg:py-2">
            <button
              type="button"
              className="touch-target inline-flex shrink-0 items-center rounded-xl px-2 active:opacity-70"
              onClick={() => {
                cancelAutoStart();
                void persistReading();
                router.push("/prayers");
              }}
            >
              뒤로
            </button>
            <p className="hidden min-w-0 flex-1 truncate font-semibold lg:block">{numberedTitle}</p>
            <div className="min-w-0 flex-1 lg:hidden" aria-hidden="true" />
            <div className="ml-auto flex shrink-0 items-center">
              <button
                type="button"
                className="touch-target inline-flex items-center justify-center rounded-xl px-2 text-sm font-medium active:opacity-70 lg:hidden"
                onClick={() => {
                  cancelAutoStart();
                  void persistReading();
                  router.push("/");
                }}
              >
                홈
              </button>
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
            <p className="pointer-events-none mx-auto max-w-[760px] px-3 pb-2 font-semibold leading-snug lg:hidden">{numberedTitle}</p>
          ) : null}
        </div>
        <div className="pointer-events-none lg:hidden" style={{ height: chromeHeight }} aria-hidden="true" />

        {["heal-sickness", "hope-prayer", "conceived-prayer"].includes(prayer.slug) ? (
        <div className="mx-auto max-w-[760px] space-y-3 px-3 pt-3 lg:px-0">
          <PrayerInputEditor
            slug={prayer.slug}
            values={inputValues}
            onSave={onSaveInputs}
            pending={inputStatus === "saving"}
            status={inputStatus}
            onOpenChange={setInputEditorOpen}
          />
          {inputStatus === "saved" ? <p>저장 완료</p> : null}
          {inputStatus === "failed" ? <p role="alert">저장에 실패했습니다. 입력한 내용은 화면에 남아 있습니다.</p> : null}
        </div>
        ) : null}

        <div ref={articleWrapRef}>
          {prayer.content_md ? <PrayerBody prayerId={prayer.id} markdown={displayMarkdown} /> : <p>기도문 데이터가 없습니다.</p>}
        </div>

        <div className="relative z-10 mx-auto mt-6 max-w-[760px] space-y-3 pb-[calc(7rem+var(--safe-bottom))] lg:pb-8">
          {prayer.slug === "children" ? (
            <div className="space-y-1 text-sm text-[var(--muted)]">
              {childNames && childNames.length > 0 ? <p>자녀 이름: {childNames.join(", ")}</p> : <p>저장된 자녀 이름이 없습니다.</p>}
              <p>
                자녀 이름은 설정에서만 수정할 수 있습니다.{" "}
                <Link href="/settings/personalize" className="underline">
                  이름·중보기도 관리
                </Link>
              </p>
            </div>
          ) : childNames && childNames.length > 0 ? (
            <p className="text-sm text-[var(--muted)]">기도 이름: {childNames.join(", ")}</p>
          ) : null}
          {prayer.slug !== "children" && nameRows.length > 1 ? (
            <label className="flex items-center gap-2 text-sm">
              <span className="shrink-0 text-[var(--muted)]">기도할 이름</span>
              <select
                className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-2"
                value={focusName}
                aria-label="기도할 이름"
                onChange={(event) => {
                  const nextName = event.target.value;
                  setFocusName(nextName);
                  try {
                    window.localStorage.setItem(`prayerbook-focus-name:${prayer.slug}`, nextName);
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
              누적 {count}회 · 현재 {round}독 · {excluded ? "진행률 제외" : doneThisRound ? `이번 ${round}독 완료됨` : `이번 ${round}독 미완료`}
            </p>
          ) : (
            <p>누적 완료 {count}회</p>
          )}
          {status === "saving" ? <p>저장 중</p> : null}
          {status === "saved" ? <p>저장 완료</p> : null}
          {status === "failed" ? <p role="alert">{error}</p> : null}
          <Button className="w-full active:opacity-70" onClick={() => void onComplete()} disabled={status === "saving"}>
            {status === "saving"
              ? "저장 중"
              : prayer.category === "supplementary"
                ? "기도 완료 기록"
                : doneThisRound
                  ? "한 번 더 완료 기록"
                  : `이번 ${round}독 기도 완료`}
          </Button>
          {prayer.category === "main" && doneThisRound ? <p>✓ 이번 {round}독 완료됨</p> : null}
          <div className="flex flex-wrap gap-2">
            {previousPrayer ? (
              <Link
                href={`/prayers/${previousPrayer.slug}`}
                prefetch
                className="touch-target rounded-xl border border-[var(--border)] px-4 py-2.5 active:opacity-70"
                aria-disabled={navPending}
                onClick={(event) => {
                  event.preventDefault();
                  goToPrayer(previousPrayer.slug);
                }}
              >
                이전 기도
              </Link>
            ) : (
              <span className="touch-target inline-flex items-center rounded-xl border border-[var(--border)] px-4 py-2.5 text-[var(--muted)]">이전 기도</span>
            )}
            {nextPrayer ? (
              <Link
                href={`/prayers/${nextPrayer.slug}`}
                prefetch
                className="touch-target rounded-xl border border-[var(--border)] px-4 py-2.5 active:opacity-70"
                aria-disabled={navPending}
                onClick={(event) => {
                  event.preventDefault();
                  goToPrayer(nextPrayer.slug);
                }}
              >
                다음 기도
              </Link>
            ) : (
              <span className="touch-target inline-flex items-center rounded-xl border border-[var(--border)] px-4 py-2.5 text-[var(--muted)]">다음 기도</span>
            )}
            <button
              type="button"
              className="touch-target rounded-xl border border-[var(--border)] px-4 py-2.5 active:opacity-70"
              onClick={() => {
                cancelAutoStart();
                setTocOpen(true);
              }}
            >
              목차 이동
            </button>
          </div>
        </div>
      </div>
      <aside className="reader-aside rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
        <p className="font-semibold">Total {summary?.total_completed ?? 0}독</p>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {round}독 진행 중 {summary?.current_completed_count ?? 0} / {eligibleCount}
        </p>
        <div className="mt-3">
          <ProgressBar value={summary?.progress_percent ?? 0} label={`진행률 ${Math.round(summary?.progress_percent ?? 0)}%`} />
        </div>
      </aside>
      <Drawer open={tocOpen} title="목차" onClose={() => setTocOpen(false)}>
        {toc}
      </Drawer>
      <Modal open={celebration !== null} title={`${celebration}독을 완료했습니다.`} onClose={() => setCelebration(null)}>
        <p className="mb-4">
          {eligibleCount}개의 기본 기도 항목을 모두 {celebration}회 이상 완료했습니다.
        </p>
        <Button onClick={() => setCelebration(null)}>{(celebration ?? 0) + 1}독 계속하기</Button>
      </Modal>
    </div>
  );
}
