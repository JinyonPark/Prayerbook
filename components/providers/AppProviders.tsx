"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { fetchProgressSummary } from "@/lib/supabase/rpc";
import { bootstrapAppState, personalizationsFromBootstrap } from "@/lib/progress/bootstrap";
import type { RpcProgressSummary } from "@/lib/progress/types";
import type { ReadingState, UserPreferences } from "@/lib/progress/types";
import { personalizationRowsFromInputs, type PersonalizationRow } from "@/lib/prayers/personalize";
import type { PrayerInputRow, PrayerInputValues } from "@/lib/prayers/inputs";
import { savePrayerInputsRequest } from "@/lib/prayers/inputs-request";
import { parseAutoScrollSpeed } from "@/lib/prayers/inputs";
import { parseSpousePrayerSelection, readCachedSpouseSelection, writeCachedSpouseSelection, type SpousePrayerSelection } from "@/lib/progress/spouse";
import {
  applyPreferences,
  defaultPreferences,
  parseAutoScrollEnabled,
  parseConceivedShowAllNames,
  readCachedPreferences,
  writeCachedPreferences,
  type CachedPreferences,
} from "@/lib/theme/preferences";
import { hasPublicEnv } from "@/lib/validation/env";
import { isAuthFailure, logDevError } from "@/lib/errors/inspect";
import { emptyDailySummary, type DailyPrayerSummary } from "@/lib/progress/daily";
import { parseShareFormat, type ShareFormatPreference } from "@/lib/progress/share-content";
import { detectBrowserTimeZone, msUntilNextMidnight, normalizeTimeZone } from "@/lib/progress/timezone";
import {
  BOOTSTRAP_FAILED_NOTICE,
  EXPIRED_PENDING_NOTICE,
  type ActivityStats,
  type PrayerLabel,
} from "@/lib/local-prayer-db";
import {
  bootstrapLocalStatsView,
  emptyActivityStats,
  emptyLocalStatsView,
  loadLocalStatsView,
  retryPendingLocalCompletions,
  type LocalStatsView,
} from "@/lib/local-prayer-db/sync";
import { updateInitialCompletionCount, getLocalPrayerStore } from "@/lib/local-prayer-db";
import { perfMark } from "@/lib/perf/marks";

type AppState = {
  summary: RpcProgressSummary | null;
  bootReady: boolean;
  userId: string | null;
  dailySummary: DailyPrayerSummary;
  activityStats: ActivityStats;
  localStatsNotice: string | null;
  setLocalStatsNotice: Dispatch<SetStateAction<string | null>>;
  timeZone: string;
  reading: ReadingState | null;
  prefs: CachedPreferences;
  personalizations: PersonalizationRow[];
  prayerInputs: PrayerInputRow[];
  spouseSelection: SpousePrayerSelection;
  online: boolean;
  setSummary: Dispatch<SetStateAction<RpcProgressSummary | null>>;
  setDailySummary: Dispatch<SetStateAction<DailyPrayerSummary>>;
  applyLocalStatsView: (view: LocalStatsView) => void;
  setReading: (reading: ReadingState) => void;
  setPersonalizations: (rows: PersonalizationRow[]) => void;
  setPrayerInputs: (rows: PrayerInputRow[]) => void;
  updatePrefs: (prefs: Partial<CachedPreferences>) => Promise<void>;
  updateSpouseSelection: (value: SpousePrayerSelection) => Promise<void>;
  savePrayerInputs: (prayerItemId: string, values: PrayerInputValues) => Promise<void>;
  refresh: () => Promise<void>;
  refreshDaily: () => Promise<boolean>;
  updateInitialCount: (value: number) => Promise<void>;
  shareFormat: ShareFormatPreference;
  updateShareFormat: (format: ShareFormatPreference) => Promise<void>;
  prayerLabels: PrayerLabel[];
};

const AppStateContext = createContext<AppState | null>(null);

type Props = {
  children: ReactNode;
  initialSummary: RpcProgressSummary | null;
  initialDailySummary?: DailyPrayerSummary | null;
  initialReading: ReadingState | null;
  initialPrefs: UserPreferences | null;
  initialPersonalizations?: PersonalizationRow[];
  initialPrayerInputs?: PrayerInputRow[];
  initialSpouseSelection?: SpousePrayerSelection;
  initialTimeZone?: string;
};

function prefsFromServer(initialPrefs: UserPreferences | null, cached: CachedPreferences): CachedPreferences {
  if (!initialPrefs) return cached;
  return {
    theme: initialPrefs.theme,
    fontSize: initialPrefs.font_size,
    lineHeight: initialPrefs.line_height,
    autoScrollSpeed: parseAutoScrollSpeed(initialPrefs.auto_scroll_speed ?? cached.autoScrollSpeed),
    autoScrollEnabled:
      cached.autoScrollEnabled === true
        ? true
        : parseAutoScrollEnabled(initialPrefs.auto_scroll_enabled ?? cached.autoScrollEnabled),
    conceivedShowAllNames: parseConceivedShowAllNames(
      initialPrefs.conceived_show_all_names ?? cached.conceivedShowAllNames,
    ),
  };
}

function preferenceUpsertRow(
  userId: string,
  prefs: CachedPreferences,
  extra: { spouse_prayer_selection: SpousePrayerSelection; time_zone: string },
) {
  return {
    user_id: userId,
    theme: prefs.theme,
    font_size: prefs.fontSize,
    line_height: prefs.lineHeight,
    auto_scroll_speed: prefs.autoScrollSpeed,
    auto_scroll_enabled: prefs.autoScrollEnabled,
    conceived_show_all_names: prefs.conceivedShowAllNames,
    spouse_prayer_selection: extra.spouse_prayer_selection,
    time_zone: extra.time_zone,
  };
}

function sessionUserId(supabase: ReturnType<typeof createBrowserSupabaseClient>) {
  return supabase.auth.getSession().then(({ data }) => data.session?.user?.id ?? null);
}

function prayerLabelsFromSummary(summary: RpcProgressSummary | null): PrayerLabel[] {
  return (summary?.items ?? []).map((item) => ({
    id: item.prayer_item_id,
    title: item.title,
    itemNumber: item.item_number,
    category: item.category,
    displayOrder: item.display_order,
  }));
}

function noticeFromView(view: LocalStatsView): string | null {
  if (view.expiredPending) return EXPIRED_PENDING_NOTICE;
  if (view.bootstrapFailed) return BOOTSTRAP_FAILED_NOTICE;
  return null;
}

export function AppProviders({
  children,
  initialSummary,
  initialDailySummary = null,
  initialReading,
  initialPrefs,
  initialPersonalizations = [],
  initialPrayerInputs = [],
  initialSpouseSelection = null,
  initialTimeZone,
}: Props) {
  const [summary, setSummary] = useState(initialSummary);
  const [userId, setUserId] = useState<string | null>(null);
  const [dailySummary, setDailySummary] = useState<DailyPrayerSummary>(
    initialDailySummary ?? emptyDailySummary(initialTimeZone),
  );
  const [activityStats, setActivityStats] = useState<ActivityStats>(() => emptyActivityStats(initialTimeZone ?? "Asia/Seoul"));
  const [localStatsNotice, setLocalStatsNotice] = useState<string | null>(null);
  const [timeZone, setTimeZone] = useState(normalizeTimeZone(initialTimeZone ?? initialPrefs?.time_zone));
  const [reading, setReading] = useState(initialReading);
  const [personalizations, setPersonalizations] = useState(initialPersonalizations);
  const [prayerInputs, setPrayerInputs] = useState(initialPrayerInputs);
  const [spouseSelection, setSpouseSelection] = useState<SpousePrayerSelection>(initialSpouseSelection);
  const [prefs, setPrefs] = useState<CachedPreferences>(prefsFromServer(initialPrefs, defaultPreferences));
  const [online, setOnline] = useState(true);
  const [shareFormat, setShareFormat] = useState<ShareFormatPreference>(() => parseShareFormat(initialPrefs));
  const [bootReady, setBootReady] = useState(Boolean(initialSummary));
  const timeZoneRef = useRef(timeZone);
  timeZoneRef.current = timeZone;
  const summaryRef = useRef(summary);
  summaryRef.current = summary;
  const userIdRef = useRef(userId);
  userIdRef.current = userId;
  const hydratedDailyRef = useRef(Boolean(initialDailySummary?.local_date));

  const applyLocalStatsView = useCallback((view: LocalStatsView) => {
    setDailySummary(view.daily);
    setActivityStats(view.activity);
    setLocalStatsNotice(noticeFromView(view));
    hydratedDailyRef.current = Boolean(view.daily.local_date);
  }, []);

  useEffect(() => {
    if (bootReady || !hasPublicEnv()) {
      if (!hasPublicEnv()) setBootReady(true);
      return;
    }
    const supabase = createBrowserSupabaseClient();
    void bootstrapAppState(supabase)
      .then(async (state) => {
        setSummary(state.summary);
        setReading(state.reading);
        setPrayerInputs(state.inputs);
        setPersonalizations(personalizationsFromBootstrap(state));
        setSpouseSelection(state.spouseSelection);
        writeCachedSpouseSelection(state.spouseSelection);
        setShareFormat(parseShareFormat(state.prefs));
        setTimeZone(state.timeZone);
        if (state.prefs) {
          const next = prefsFromServer(state.prefs, readCachedPreferences());
          setPrefs(next);
          writeCachedPreferences(next);
        }
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const id = session?.user?.id ?? null;
        setUserId(id);
        if (id) {
          const local = await bootstrapLocalStatsView({
            userId: id,
            timeZone: state.timeZone,
            prayers: prayerLabelsFromSummary(state.summary),
            supabase,
          });
          applyLocalStatsView(local);
          void retryPendingLocalCompletions({
            userId: id,
            timeZone: state.timeZone,
            prayers: prayerLabelsFromSummary(state.summary),
            supabase,
          }).then(applyLocalStatsView).catch(() => undefined);
        }
        perfMark("home_data_ready");
        setBootReady(true);
      })
      .catch((error) => {
        logDevError("bootstrapAppState", error);
        if (isAuthFailure(error) && typeof window !== "undefined") {
          const next = `${window.location.pathname}${window.location.search}`;
          window.location.replace(`/login?next=${encodeURIComponent(next)}`);
          return;
        }
        setBootReady(true);
      });
  }, [bootReady, applyLocalStatsView]);

  useEffect(() => {
    const cached = readCachedPreferences();
    const next = prefsFromServer(initialPrefs, cached);
    writeCachedPreferences(next);
    setPrefs(next);
    applyPreferences(next);
    const nextSpouse =
      parseSpousePrayerSelection(initialPrefs?.spouse_prayer_selection ?? initialSpouseSelection) ??
      readCachedSpouseSelection();
    setSpouseSelection(nextSpouse);
    writeCachedSpouseSelection(nextSpouse);
    setShareFormat(parseShareFormat(initialPrefs));
    if (initialDailySummary) setDailySummary(initialDailySummary);
    setTimeZone(normalizeTimeZone(initialTimeZone ?? initialPrefs?.time_zone));
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
    // Keep the first client snapshot. Later layout refetches must not turn auto-scroll back off.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persistTimeZone = useCallback(async (nextZone: string) => {
    if (!hasPublicEnv()) return;
    const supabase = createBrowserSupabaseClient();
    const userId = await sessionUserId(supabase);
    if (!userId) return;
    const { error } = await supabase.from("user_preferences").upsert(
      preferenceUpsertRow(userId, prefs, {
        spouse_prayer_selection: spouseSelection,
        time_zone: nextZone,
      }),
    );
    if (error) {
      await supabase.from("user_preferences").upsert({
        user_id: userId,
        theme: prefs.theme,
        font_size: prefs.fontSize,
        line_height: prefs.lineHeight,
        time_zone: nextZone,
      });
    }
  }, [prefs, spouseSelection]);

  const refreshDaily = useCallback(async () => {
    const id = userIdRef.current;
    if (!id) return false;
    try {
      const view = await loadLocalStatsView({
        userId: id,
        timeZone: timeZoneRef.current,
        prayers: prayerLabelsFromSummary(summaryRef.current),
      });
      applyLocalStatsView(view);
      return true;
    } catch {
      return false;
    }
  }, [applyLocalStatsView]);

  const refresh = useCallback(async () => {
    if (!hasPublicEnv()) return;
    const supabase = createBrowserSupabaseClient();
    try {
      const next = await fetchProgressSummary(supabase);
      setSummary(next);
    } catch {
      // keep last known summary
    }
    await refreshDaily();
  }, [refreshDaily]);

  const syncDetectedTimeZone = useCallback((reason: "mount" | "resume" = "mount") => {
    const detected = detectBrowserTimeZone();
    if (detected !== timeZoneRef.current) {
      setTimeZone(detected);
      void persistTimeZone(detected);
      void refreshDaily();
      return;
    }
    if (reason === "mount" && hydratedDailyRef.current) return;
    void refreshDaily();
  }, [persistTimeZone, refreshDaily]);

  useEffect(() => {
    if (!bootReady) return;
    syncDetectedTimeZone("mount");
  }, [bootReady, syncDetectedTimeZone]);

  useEffect(() => {
    function onFocus() {
      syncDetectedTimeZone("resume");
      void refresh();
    }
    function onVisible() {
      if (document.visibilityState === "visible") {
        syncDetectedTimeZone("resume");
      }
    }
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh, refreshDaily, syncDetectedTimeZone]);

  useEffect(() => {
    let timer = 0;
    function arm() {
      window.clearTimeout(timer);
      const wait = Math.min(msUntilNextMidnight(new Date(), timeZone), 2_147_000_000);
      timer = window.setTimeout(() => {
        void refreshDaily();
        arm();
      }, wait);
    }
    arm();
    return () => window.clearTimeout(timer);
  }, [timeZone, refreshDaily]);

  useEffect(() => {
    if (!hasPublicEnv()) return;
    const supabase = createBrowserSupabaseClient();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setUserId(null);
        applyLocalStatsView(emptyLocalStatsView(timeZoneRef.current));
      }
      if (event === "PASSWORD_RECOVERY" && window.location.pathname !== "/reset-password") {
        window.location.replace("/reset-password");
      }
    });
    return () => data.subscription.unsubscribe();
  }, [applyLocalStatsView]);

  const updatePrefs = useCallback(async (partial: Partial<CachedPreferences>) => {
    const next = { ...readCachedPreferences(), ...prefs, ...partial };
    setPrefs(next);
    writeCachedPreferences(next);
    if (!hasPublicEnv()) return;
    const supabase = createBrowserSupabaseClient();
    const userId = await sessionUserId(supabase);
    if (!userId) return;
    const { error } = await supabase.from("user_preferences").upsert(
      preferenceUpsertRow(userId, next, {
        spouse_prayer_selection: spouseSelection,
        time_zone: timeZoneRef.current,
      }),
    );
    if (error) {
      await supabase.from("user_preferences").upsert({
        user_id: userId,
        theme: next.theme,
        font_size: next.fontSize,
        line_height: next.lineHeight,
      });
    }
  }, [prefs, spouseSelection]);

  const updateShareFormat = useCallback(async (next: ShareFormatPreference) => {
    setShareFormat(next);
    if (!hasPublicEnv()) return;
    const supabase = createBrowserSupabaseClient();
    const userId = await sessionUserId(supabase);
    if (!userId) return;
    const { error } = await supabase.from("user_preferences").upsert({
      user_id: userId,
      share_selected_fields: next.selected,
      share_custom_template: next.customTemplate,
    });
    if (error) {
      await supabase.from("user_preferences").upsert({
        user_id: userId,
        theme: prefs.theme,
        font_size: prefs.fontSize,
        line_height: prefs.lineHeight,
      });
    }
  }, [prefs.theme, prefs.fontSize, prefs.lineHeight]);

  const updateSpouseSelection = useCallback(async (value: SpousePrayerSelection) => {
    const previous = spouseSelection;
    setSpouseSelection(value);
    writeCachedSpouseSelection(value);
    if (!hasPublicEnv()) return;
    const supabase = createBrowserSupabaseClient();
    const userId = await sessionUserId(supabase);
    if (!userId) return;
    const { error } = await supabase.from("user_preferences").upsert(
      preferenceUpsertRow(userId, prefs, {
        spouse_prayer_selection: value,
        time_zone: timeZoneRef.current,
      }),
    );
    if (error) {
      setSpouseSelection(previous);
      writeCachedSpouseSelection(previous);
      throw error;
    }
    const next = await fetchProgressSummary(supabase);
    setSummary(next);
  }, [spouseSelection, prefs]);

  const updateInitialCount = useCallback(async (value: number) => {
    const id = userIdRef.current;
    if (!id) throw new Error("NOT_AUTHENTICATED");
    const next = await updateInitialCompletionCount(getLocalPrayerStore(), id, value, new Date().toISOString());
    const view = await loadLocalStatsView({
      userId: id,
      timeZone: timeZoneRef.current,
      prayers: prayerLabelsFromSummary(summaryRef.current),
    });
    applyLocalStatsView({
      ...view,
      activity: {
        ...view.activity,
        initialCompletionCount: next.initialCompletionCount,
        displayedLifetimeCount: next.initialCompletionCount + next.appCompletionCount,
      },
    });
  }, [applyLocalStatsView]);

  const savePrayerInputs = useCallback(async (prayerItemId: string, values: PrayerInputValues) => {
    const previous = prayerInputs;
    const previousPersonalizations = personalizations;
    const optimistic = [
      ...prayerInputs.filter((row) => row.prayer_item_id !== prayerItemId),
      { prayer_item_id: prayerItemId, values },
    ];
    setPrayerInputs(optimistic);
    setPersonalizations(personalizationRowsFromInputs(optimistic));
    if (!hasPublicEnv()) return;
    const supabase = createBrowserSupabaseClient();
    try {
      const saved = await savePrayerInputsRequest(supabase, prayerItemId, values);
      const nextRows = [
        ...prayerInputs.filter((row) => row.prayer_item_id !== prayerItemId),
        { prayer_item_id: saved.prayer_item_id, values: saved.values as PrayerInputValues },
      ].filter((row) => Object.keys(row.values ?? {}).length > 0);
      setPrayerInputs(nextRows);
      setPersonalizations(personalizationRowsFromInputs(nextRows));
    } catch (error) {
      setPrayerInputs(previous);
      setPersonalizations(previousPersonalizations);
      throw error;
    }
  }, [prayerInputs, personalizations]);

  const value = useMemo(
    () => ({
      summary,
      bootReady,
      userId,
      dailySummary,
      activityStats,
      localStatsNotice,
      setLocalStatsNotice,
      timeZone,
      reading,
      prefs,
      personalizations,
      prayerInputs,
      spouseSelection,
      online,
      setSummary,
      setDailySummary,
      applyLocalStatsView,
      setReading,
      setPersonalizations,
      setPrayerInputs,
      updatePrefs,
      updateSpouseSelection,
      savePrayerInputs,
      refresh,
      refreshDaily,
      updateInitialCount,
      shareFormat,
      updateShareFormat,
      prayerLabels: prayerLabelsFromSummary(summary),
    }),
    [
      summary,
      bootReady,
      userId,
      dailySummary,
      activityStats,
      localStatsNotice,
      timeZone,
      reading,
      prefs,
      personalizations,
      prayerInputs,
      spouseSelection,
      online,
      applyLocalStatsView,
      updatePrefs,
      updateSpouseSelection,
      savePrayerInputs,
      refresh,
      refreshDaily,
      updateInitialCount,
      shareFormat,
      updateShareFormat,
    ],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const value = useContext(AppStateContext);
  if (!value) {
    throw new Error("useAppState must be used within AppProviders");
  }
  return value;
}
