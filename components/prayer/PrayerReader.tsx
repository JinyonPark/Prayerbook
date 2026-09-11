"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Modal } from "@/components/ui/Modal";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { PrayerBody } from "@/components/prayer/PrayerBody";
import { PrayerInputEditor } from "@/components/prayer/PrayerInputEditor";
import { ReaderNavLink } from "@/components/prayer/ReaderNavLink";
import { useAppState } from "@/components/providers/AppProviders";
import { isAuthFailure, logDevError } from "@/lib/errors/inspect";
import { toCompleteUserMessage } from "@/lib/errors/user-message";
import { applyPersonalization, applyPrayerInputValues, intercessionFor, namesFor, personalizationConfig, usesBulkNames } from "@/lib/prayers/personalize";
import type { PrayerItemRecord } from "@/lib/prayers/markdown";
import { AUTO_SCROLL_PX_PER_SECOND, type PrayerInputValues } from "@/lib/prayers/inputs";
import { captureReadingAnchor, readingPersistEquals, restoreReadingAnchor } from "@/lib/reading/anchor";
import { getScrollRatio, restoreScrollRatio } from "@/lib/reading/scroll-ratio";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { completePrayerRequest } from "@/lib/progress/complete-request";
import { applyCompleteResultToSummary } from "@/lib/progress/complete-state";
import { hasPublicEnv } from "@/lib/validation/env";
import { eligibleCountFromSummary } from "@/lib/progress/calculate";
import { excludedSpouseItemNumber, resolveSpousePrayerSelection } from "@/lib/progress/spouse";
import { getAdjacentSequentialPrayers } from "@/lib/prayers/sequential";
import { getLocalDateString } from "@/lib/progress/timezone";
import { getLocalPrayerStore, prepareLocalCompletionEvent } from "@/lib/local-prayer-db";
import { confirmLocalCompletionView } from "@/lib/local-prayer-db/sync";
import { LOCAL_APPLY_RETRY_NOTICE } from "@/lib/local-prayer-db/constants";
import { perfLog, perfMark, perfMeasure } from "@/lib/perf/marks";
import {
  remainingAutoScrollDelay,
  shouldIgnoreAutoScrollCancel,
  isManualScrollKey,
  nextAutoScrollPosition,
  nextReaderChromeVisible,
  chromeVisibleFromFingerMove,
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
    userId,
    timeZone,
    prayerLabels,
    applyLocalStatsView,
    setLocalStatsNotice,
  } = useAppState();
  const [tocOpen, setTocOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const [inputStatus, setInputStatus] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const [error, setError] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<number | null>(null);
  const [reachedEnd, setReachedEnd] = useState(false);
  const [inputEditorOpen, setInputEditorOpen] = useState(false);
  const [autoRunning, setAutoRunning] = useState(false);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [openingHref, setOpeningHref] = useState<string | null>(null);
  const [chromeHeight, setChromeHeight] = useState(44);
  const restored = useRef(false);
  const lastChromeYRef = useRef(0);
  const chromeRef = useRef<HTMLDivElement>(null);
  const touchingChromeRef = useRef(false);
  const lastTouchYRef = useRef(0);
  const chromeVisibleRef = useRef(true);
  const autoEnteredAtRef = useRef(0);
  const lastOpenedAtRef = useRef(reading?.last_opened_at ?? null);
  const lastReadingRef = useRef(reading);
  const persistReadingRef = useRef<(opened?: boolean) => Promise<void>>(async () => {});
  const lastSaved = useRef(0);
  const restoring = useRef(false);
  const completeEventId = useRef<string | null>(null);
  const autoCancelRef = useRef(false);
  const autoTimerRef = useRef(0);
  const autoRunningRef = useRef(false);
  const articleWrapRef = useRef<HTMLDivElement>(null);
  const nameRows = namesFor(personalizations, prayer.slug);
  const intercession = intercessionFor(personalizations, prayer.slug);
  const personalize = personalizationConfig(prayer.slug);
  const inputValues = prayerInputs.find((row) => row.prayer_item_id === prayer.id)?.values ?? {};
  const bulkNameList = usesBulkNames(prayer.slug)
    ? prayer.slug === "children"
      ? inputValues.child_names?.length
        ? inputValues.child_names
        : nameRows.map((row) => row.value)
      : nameRows.map((row) => row.value)
    : null;
  const [focusName, setFocusName] = useState(nameRows[0]?.value ?? "");
  const overlayOpen = tocOpen || celebration !== null || inputEditorOpen;
  const overlayOpenRef = useRef(overlayOpen);
  overlayOpenRef.current = overlayOpen;
  autoRunningRef.current = autoRunning;
  const eligibleCount = eligibleCountFromSummary(summary);
  const resolvedSpouse = resolveSpousePrayerSelection(spouseSelection, summary?.spouse_prayer_selection);
  const excludedNumber = excludedSpouseItemNumber(resolvedSpouse);
  const adjacent = useMemo(
    () => getAdjacentSequentialPrayers(prayers, prayer.slug, resolvedSpouse),
    [prayers, prayer.slug, resolvedSpouse],
  );
  const previousPrayer = adjacent.previous;
  const nextPrayer = adjacent.next;

  const progress = summary?.items.find((item) => item.prayer_item_id === prayer.id);
  const count = progress?.completion_count ?? 0;
  const round = summary?.current_round ?? 1;
  const excluded = Boolean(progress?.excluded_from_progress);
  const doneThisRound = prayer.category === "main" && !excluded ? count >= round : false;
  const numberedTitle = `${prayer.item_number ? `${prayer.item_number}. ` : ""}${prayer.title}`;
  const appliedNames = bulkNameList?.length
    ? bulkNameList
    : focusName || nameRows[0]?.value
      ? [focusName || nameRows[0]?.value]
      : [];
  const displayMarkdown = applyPrayerInputValues(
    applyPersonalization(prayer.content_md, prayer.slug, {
      names: appliedNames.filter(Boolean) as string[],
      intercession: intercession?.value ?? null,
      nameRepeat: prefs.conceivedShowAllNames ? "all" : "first",
    }),
    prayer.slug,
    inputValues,
  );

  useEffect(() => {
    if (usesBulkNames(prayer.slug)) return;
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
        if (!autoRunningRef.current) setReading(payload);
      }
      if (!hasPublicEnv() || autoRunningRef.current) return;
      const supabase = createBrowserSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) return;
      const { error } = await supabase.from("user_reading_state").upsert({
        user_id: userId,
        ...payload,
      });
      if (error) {
        await supabase.from("user_reading_state").upsert({
          user_id: userId,
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

  useEffect(() => {
    function onHide() {
      if (document.visibilityState === "hidden") void persistReadingRef.current();
    }
    function onPageHide() {
      void persistReadingRef.current();
    }
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, []);

  useEffect(() => {
    perfMark("target_route_loaded");
    perfMark("target_prayer_title_visible");
    perfMark("target_prayer_interactive");
    perfMeasure("prayer_nav_title", "prayer_navigation_click", "target_prayer_title_visible");
    perfMeasure("prayer_nav_body", "prayer_navigation_click", "target_prayer_interactive");
    perfLog("prayer_nav");
  }, [prayer.slug]);

  useEffect(() => {
    const saveData =
      typeof navigator !== "undefined" &&
      "connection" in navigator &&
      Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData);
    if (saveData) return;
    const prefetch = () => {
      if (nextPrayer) router.prefetch(`/prayers/${nextPrayer.slug}`);
      if (previousPrayer) router.prefetch(`/prayers/${previousPrayer.slug}`);
    };
    const id = window.setTimeout(prefetch, 250);
    return () => window.clearTimeout(id);
  }, [nextPrayer, previousPrayer, router]);

  const cancelAutoStart = useCallback(() => {
    autoCancelRef.current = true;
    window.clearTimeout(autoTimerRef.current);
    autoTimerRef.current = 0;
    setAutoRunning(false);
    void persistReadingRef.current();
  }, []);

  useEffect(() => {
    restored.current = false;
    autoCancelRef.current = false;
    autoEnteredAtRef.current = Date.now();
    completeEventId.current = null;
    setReachedEnd(false);
    setAutoRunning(false);
    setChromeVisible(true);
    setOpeningHref(null);
    lastChromeYRef.current = 0;
    setTocOpen(false);
    setStatus("idle");
    setError(null);
    window.clearTimeout(autoTimerRef.current);
  }, [prayer.id]);

  useEffect(() => {
    document.documentElement.dataset.reader = "true";
    return () => {
      delete document.documentElement.dataset.reader;
    };
  }, []);

  const restorePosition = useCallback(() => {
    if (prefs.autoScrollEnabled) {
      window.scrollTo(0, 0);
      restored.current = true;
      return;
    }
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
  }, [prayer.id, prefs.autoScrollEnabled, reading?.last_prayer_item_id, reading?.scroll_ratio, reading?.anchor_key, reading?.anchor_offset]);

  useEffect(() => {
    if (restored.current) return;
    const id = window.requestAnimationFrame(() => {
      if (prefs.autoScrollEnabled) {
        window.scrollTo(0, 0);
        restored.current = true;
        void persistReadingRef.current(true);
        return;
      }
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
  }, [prayer.id, prayer.content_md, displayMarkdown, prefs.fontSize, prefs.lineHeight, prefs.theme, prefs.autoScrollEnabled, restorePosition, reading?.last_prayer_item_id]);

  useEffect(() => {
    let frame = 0;
    function onViewportChange() {
      if (restoring.current || autoRunningRef.current) return;
      window.cancelAnimationFrame(frame);
      const article = articleWrapRef.current?.querySelector(".reader-article") as HTMLElement | null;
      const snapshot = captureReadingAnchor(article);
      frame = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
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
    lastChromeYRef.current = window.scrollY;
    chromeVisibleRef.current = window.scrollY <= 12;
    setChromeVisible(chromeVisibleRef.current);

    function applyChrome(next: boolean) {
      if (chromeVisibleRef.current === next) return;
      chromeVisibleRef.current = next;
      setChromeVisible(next);
    }

    function onTouchStart(event: TouchEvent) {
      touchingChromeRef.current = true;
      lastTouchYRef.current = event.touches[0]?.clientY ?? 0;
    }
    function onTouchMove(event: TouchEvent) {
      const y = event.touches[0]?.clientY ?? lastTouchYRef.current;
      const fingerDelta = y - lastTouchYRef.current;
      lastTouchYRef.current = y;
      applyChrome(chromeVisibleFromFingerMove(fingerDelta, chromeVisibleRef.current));
    }
    function onTouchEnd() {
      touchingChromeRef.current = false;
    }
    function onWheel(event: WheelEvent) {
      if (event.deltaY < -4) applyChrome(true);
      else if (event.deltaY > 4) applyChrome(false);
    }
    function onChromeScroll() {
      const y = window.scrollY || document.documentElement.scrollTop || 0;
      const deltaY = y - lastChromeYRef.current;
      lastChromeYRef.current = y;
      if (autoRunningRef.current) return;
      if (touchingChromeRef.current) return;
      applyChrome(
        nextReaderChromeVisible({
          current: chromeVisibleRef.current,
          scrollY: y,
          deltaY,
        }),
      );
    }

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("scroll", onChromeScroll, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("scroll", onChromeScroll);
    };
  }, [prayer.id]);

  useLayoutEffect(() => {
    function measure() {
      const node = chromeRef.current;
      if (!node) return;
      const next = Math.ceil(node.getBoundingClientRect().height);
      if (next > 0) setChromeHeight(next);
    }
    measure();
    const node = chromeRef.current;
    if (!node) return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [numberedTitle]);

  useEffect(() => {
    if (prefs.autoScrollEnabled) setReachedEnd(false);
  }, [prefs.autoScrollEnabled]);

  useEffect(() => {
    if (!autoRunning) return;
    chromeVisibleRef.current = false;
    setChromeVisible(false);
  }, [autoRunning]);

  useEffect(() => {
    window.clearTimeout(autoTimerRef.current);
    if (!prefs.autoScrollEnabled || reachedEnd) {
      setAutoRunning(false);
      return;
    }

    function arm() {
      if (autoCancelRef.current || !prefs.autoScrollEnabled) return;
      if (!restored.current || restoring.current || overlayOpenRef.current) {
        autoTimerRef.current = window.setTimeout(arm, 50);
        return;
      }
      autoTimerRef.current = window.setTimeout(() => {
        if (overlayOpenRef.current || !restored.current || restoring.current) {
          arm();
          return;
        }
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
      }, remainingAutoScrollDelay(autoEnteredAtRef.current, Date.now()));
    }
    arm();
    return () => window.clearTimeout(autoTimerRef.current);
  }, [prayer.id, prefs.autoScrollEnabled, reachedEnd]);

  useEffect(() => {
    if (autoRunning) return;
    const startY = window.scrollY;
    function cancelFromUserScroll() {
      if (restoring.current) return;
      if (shouldIgnoreAutoScrollCancel(autoEnteredAtRef.current, Date.now())) return;
      if (Math.abs(window.scrollY - startY) < 40) return;
      autoCancelRef.current = true;
      window.clearTimeout(autoTimerRef.current);
    }
    function cancelFromKey(event: KeyboardEvent) {
      if (!isManualScrollKey(event.key)) return;
      if (shouldIgnoreAutoScrollCancel(autoEnteredAtRef.current, Date.now())) return;
      autoCancelRef.current = true;
      window.clearTimeout(autoTimerRef.current);
    }
    function cancelIfHidden() {
      if (document.visibilityState !== "visible") {
        autoCancelRef.current = true;
        window.clearTimeout(autoTimerRef.current);
      }
    }
    window.addEventListener("scroll", cancelFromUserScroll, { passive: true });
    window.addEventListener("keydown", cancelFromKey);
    document.addEventListener("visibilitychange", cancelIfHidden);
    return () => {
      window.removeEventListener("scroll", cancelFromUserScroll);
      window.removeEventListener("keydown", cancelFromKey);
      document.removeEventListener("visibilitychange", cancelIfHidden);
    };
  }, [autoRunning, prayer.id]);

  useEffect(() => {
    if (!autoRunning || reachedEnd || overlayOpen) return;
    let frame = 0;
    let last = 0;
    const speed = AUTO_SCROLL_PX_PER_SECOND[prefs.autoScrollSpeed];

    function tick(now: number) {
      if (!last) {
        last = now;
        frame = window.requestAnimationFrame(tick);
        return;
      }
      const elapsed = Math.min(24, now - last);
      last = now;
      if (
        restored.current &&
        !restoring.current &&
        document.visibilityState === "visible"
      ) {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const next = nextAutoScrollPosition(window.scrollY, max, speed, elapsed);
        window.scrollTo({ top: next.y });
        if (next.finished && max > 1) {
          setReachedEnd(true);
          setAutoRunning(false);
          void persistReadingRef.current();
          return;
        }
      }
      frame = window.requestAnimationFrame(tick);
    }
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [autoRunning, reachedEnd, overlayOpen, prefs.autoScrollSpeed]);

  useEffect(() => {
    if (prefs.autoScrollEnabled) return;
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
  }, [prefs.fontSize, prefs.lineHeight, prefs.theme, prefs.autoScrollEnabled]);

  async function onComplete() {
    if (status === "saving") return;
    perfMark("complete_click");
    setStatus("saving");
    perfMark("complete_ui_pending_visible");
    setError(null);
    if (!completeEventId.current) completeEventId.current = crypto.randomUUID();
    const eventId = completeEventId.current;
    try {
      const supabase = createBrowserSupabaseClient();
      if (userId) {
        await prepareLocalCompletionEvent(getLocalPrayerStore(), {
          userId,
          clientEventId: eventId,
          prayerItemId: prayer.id,
          localDate: getLocalDateString(timeZone),
          nowIso: new Date().toISOString(),
        });
      }
      const result = await completePrayerRequest(supabase, prayer.id, eventId);
      completeEventId.current = null;
      setSummary((current) => applyCompleteResultToSummary(current, result, prayer.id));
      perfMark("complete_state_updated");
      setStatus("saved");
      perfMark("complete_success_visible");
      perfMeasure("complete_click_to_success", "complete_click", "complete_success_visible");
      perfLog("complete");
      if (result.total_changed) setCelebration(result.current_total);
      if (userId) {
        void confirmLocalCompletionView({
          userId,
          clientEventId: eventId,
          prayerItemId: prayer.id,
          timeZone,
          prayers: prayerLabels,
        })
          .then((view) => {
            applyLocalStatsView(view);
            setLocalStatsNotice(null);
          })
          .catch(() => {
            setLocalStatsNotice(LOCAL_APPLY_RETRY_NOTICE);
            void confirmLocalCompletionView({
              userId,
              clientEventId: eventId,
              prayerItemId: prayer.id,
              timeZone,
              prayers: prayerLabels,
            })
              .then((view) => {
                applyLocalStatsView(view);
                setLocalStatsNotice(null);
              })
              .catch(() => {
                setLocalStatsNotice(LOCAL_APPLY_RETRY_NOTICE);
              });
          });
      }
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

  function rememberReading() {
    cancelAutoStart();
    void persistReading();
  }

  function startNavigation(href: string) {
    perfMark("prayer_navigation_started");
    rememberReading();
    setTocOpen(false);
    setOpeningHref(href);
  }

  const toc = (
    <nav aria-label="기도 목차">
      <ul className="space-y-1">
        {prayers.map((item) => (
          <li key={item.id}>
            <ReaderNavLink
              href={`/prayers/${item.slug}`}
              prefetch={false}
              className={`block rounded-lg px-2 py-2 ${item.slug === prayer.slug ? "bg-[var(--bg)] font-semibold" : ""}`}
              onNavigate={() => {
                if (item.slug === prayer.slug) {
                  setTocOpen(false);
                  return false;
                }
                startNavigation(`/prayers/${item.slug}`);
              }}
            >
              {item.item_number ? `${item.item_number}. ` : ""}
              {item.title}
              {excludedNumber !== null && item.item_number === excludedNumber ? (
                <span className="ml-2 text-sm font-normal text-[var(--muted)]">진행률 제외</span>
              ) : null}
            </ReaderNavLink>
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
          className={`reader-chrome z-[200] border-b border-[var(--border)] bg-[var(--bg)] transition-transform duration-200 ease-out lg:sticky lg:top-[calc(var(--header-h)+var(--safe-top-env))] lg:-mx-5 lg:mb-4 lg:px-5 ${
            chromeVisible ? "translate-y-0" : "max-lg:pointer-events-none max-lg:-translate-y-full"
          } ${tocOpen ? "max-lg:pointer-events-none" : ""}`}
        >
          <div className="mx-auto flex max-w-[760px] items-start gap-1 px-3 py-1 lg:px-0 lg:py-2">
            <p className="min-w-0 flex-1 break-keep font-semibold leading-snug">{numberedTitle}</p>
            <div className="ml-auto flex shrink-0 items-center">
              <ReaderNavLink
                href="/"
                className="touch-target inline-flex items-center justify-center rounded-xl px-2 text-sm font-medium active:opacity-70 lg:hidden"
                onNavigate={rememberReading}
              >
                홈
              </ReaderNavLink>
              <Button
                variant="ghost"
                className="px-2 text-sm"
                aria-label="목차"
                aria-expanded={tocOpen}
                onClick={() => setTocOpen((open) => !open)}
              >
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
        </div>
        <div className="reader-chrome-spacer lg:hidden" style={{ height: chromeHeight }} aria-hidden />

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
          {usesBulkNames(prayer.slug) ? (
            <div className="space-y-1 text-sm text-[var(--muted)]">
              {bulkNameList && bulkNameList.length > 0 ? (
                <p>
                  {prayer.slug === "children" ? "자녀 이름" : prayer.slug === "conceived-believer" ? "태신자 이름" : "이름"}:{" "}
                  {bulkNameList.join(", ")}
                </p>
              ) : (
                <p>저장된 이름이 없습니다.</p>
              )}
              <p>
                이름은 설정에서만 수정할 수 있습니다.{" "}
                <Link href="/settings/personalize" className="underline">
                  이름·중보기도 관리
                </Link>
              </p>
            </div>
          ) : null}
          {!usesBulkNames(prayer.slug) && nameRows.length > 1 ? (
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
              {summary
                ? `누적 ${count}회 · 현재 ${round}독 · ${excluded ? "진행률 제외" : doneThisRound ? `이번 ${round}독 완료됨` : `이번 ${round}독 미완료`}`
                : "진행 정보를 불러오는 중"}
            </p>
          ) : (
            <p>{summary ? `누적 완료 ${count}회` : "진행 정보를 불러오는 중"}</p>
          )}
          {status === "saving" ? <p>저장 중</p> : null}
          {status === "saved" ? <p>저장 완료</p> : null}
          {status === "failed" ? <p role="alert">{error}</p> : null}
          <Button
            className="w-full active:opacity-70"
            onClick={() => void onComplete()}
            aria-busy={status === "saving"}
            aria-disabled={status === "saving"}
          >
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
              <ReaderNavLink
                href={`/prayers/${previousPrayer.slug}`}
                className="touch-target rounded-xl border border-[var(--border)] px-4 py-2.5 active:opacity-70"
                onNavigate={() => startNavigation(`/prayers/${previousPrayer.slug}`)}
              >
                {openingHref === `/prayers/${previousPrayer.slug}` ? "이전 기도 여는 중…" : "이전 기도"}
              </ReaderNavLink>
            ) : (
              <span className="touch-target inline-flex items-center rounded-xl border border-[var(--border)] px-4 py-2.5 text-[var(--muted)]">이전 기도</span>
            )}
            {nextPrayer ? (
              <ReaderNavLink
                href={`/prayers/${nextPrayer.slug}`}
                className="touch-target rounded-xl border border-[var(--border)] px-4 py-2.5 active:opacity-70"
                onNavigate={() => startNavigation(`/prayers/${nextPrayer.slug}`)}
              >
                {openingHref === `/prayers/${nextPrayer.slug}` ? "다음 기도 여는 중…" : "다음 기도"}
              </ReaderNavLink>
            ) : (
              <span className="touch-target inline-flex items-center rounded-xl border border-[var(--border)] px-4 py-2.5 text-[var(--muted)]">다음 기도</span>
            )}
            <ReaderNavLink
              href="/prayers"
              className="touch-target rounded-xl border border-[var(--border)] px-4 py-2.5 active:opacity-70"
              onNavigate={rememberReading}
            >
              목차 이동
            </ReaderNavLink>
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
