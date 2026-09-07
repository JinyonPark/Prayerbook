"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { fetchDailyPrayerSummary, fetchProgressSummary } from "@/lib/supabase/rpc";
import type { RpcProgressSummary } from "@/lib/progress/types";
import type { ReadingState, UserPreferences } from "@/lib/progress/types";
import type { PersonalizationRow } from "@/lib/prayers/personalize";
import type { PrayerInputRow, PrayerInputValues } from "@/lib/prayers/inputs";
import { parseAutoScrollSpeed } from "@/lib/prayers/inputs";
import { parseSpousePrayerSelection, type SpousePrayerSelection } from "@/lib/progress/spouse";
import {
  applyPreferences,
  defaultPreferences,
  parseAutoScrollEnabled,
  readCachedPreferences,
  writeCachedPreferences,
  type CachedPreferences,
} from "@/lib/theme/preferences";
import { hasPublicEnv } from "@/lib/validation/env";
import { emptyDailySummary, type DailyPrayerSummary } from "@/lib/progress/daily";
import { detectBrowserTimeZone, msUntilNextMidnight, normalizeTimeZone } from "@/lib/progress/timezone";

type AppState = {
  summary: RpcProgressSummary | null;
  dailySummary: DailyPrayerSummary;
  timeZone: string;
  reading: ReadingState | null;
  prefs: CachedPreferences;
  personalizations: PersonalizationRow[];
  prayerInputs: PrayerInputRow[];
  spouseSelection: SpousePrayerSelection;
  online: boolean;
  setSummary: Dispatch<SetStateAction<RpcProgressSummary | null>>;
  setDailySummary: Dispatch<SetStateAction<DailyPrayerSummary>>;
  setReading: (reading: ReadingState) => void;
  setPersonalizations: (rows: PersonalizationRow[]) => void;
  setPrayerInputs: (rows: PrayerInputRow[]) => void;
  updatePrefs: (prefs: Partial<CachedPreferences>) => Promise<void>;
  updateSpouseSelection: (value: SpousePrayerSelection) => Promise<void>;
  savePrayerInputs: (prayerItemId: string, values: PrayerInputValues) => Promise<void>;
  refresh: () => Promise<void>;
  refreshDaily: () => Promise<boolean>;
};

const AppStateContext = createContext<AppState | null>(null);

type Props = {
  children: React.ReactNode;
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
    spouse_prayer_selection: extra.spouse_prayer_selection,
    time_zone: extra.time_zone,
  };
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
  const [dailySummary, setDailySummary] = useState<DailyPrayerSummary>(
    initialDailySummary ?? emptyDailySummary(initialTimeZone),
  );
  const [timeZone, setTimeZone] = useState(normalizeTimeZone(initialTimeZone ?? initialPrefs?.time_zone));
  const [reading, setReading] = useState(initialReading);
  const [personalizations, setPersonalizations] = useState(initialPersonalizations);
  const [prayerInputs, setPrayerInputs] = useState(initialPrayerInputs);
  const [spouseSelection, setSpouseSelection] = useState<SpousePrayerSelection>(initialSpouseSelection);
  const [prefs, setPrefs] = useState<CachedPreferences>(prefsFromServer(initialPrefs, defaultPreferences));
  const [online, setOnline] = useState(true);
  const timeZoneRef = useRef(timeZone);
  timeZoneRef.current = timeZone;

  useEffect(() => {
    const cached = readCachedPreferences();
    const next = prefsFromServer(initialPrefs, cached);
    writeCachedPreferences(next);
    setPrefs(next);
    applyPreferences(next);
    setSpouseSelection(parseSpousePrayerSelection(initialPrefs?.spouse_prayer_selection ?? initialSpouseSelection));
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
    if (!hasPublicEnv() || !navigator.onLine) return;
    const supabase = createBrowserSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("user_preferences").upsert(
      preferenceUpsertRow(user.id, prefs, {
        spouse_prayer_selection: spouseSelection,
        time_zone: nextZone,
      }),
    );
    if (error) {
      await supabase.from("user_preferences").upsert({
        user_id: user.id,
        theme: prefs.theme,
        font_size: prefs.fontSize,
        line_height: prefs.lineHeight,
        time_zone: nextZone,
      });
    }
  }, [prefs, spouseSelection]);

  const refreshDaily = useCallback(async () => {
    if (!hasPublicEnv() || !navigator.onLine) return false;
    const supabase = createBrowserSupabaseClient();
    try {
      const next = await fetchDailyPrayerSummary(supabase);
      setDailySummary(next);
      if (next.time_zone) setTimeZone(normalizeTimeZone(next.time_zone));
      return true;
    } catch {
      return false;
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!hasPublicEnv() || !navigator.onLine) return;
    const supabase = createBrowserSupabaseClient();
    try {
      const next = await fetchProgressSummary(supabase);
      setSummary(next);
    } catch {
      // keep last known summary
    }
    await refreshDaily();
  }, [refreshDaily]);

  const syncDetectedTimeZone = useCallback(() => {
    const detected = detectBrowserTimeZone();
    if (detected === timeZoneRef.current) return;
    setTimeZone(detected);
    void persistTimeZone(detected);
    void refreshDaily();
  }, [persistTimeZone, refreshDaily]);

  useEffect(() => {
    syncDetectedTimeZone();
  }, [syncDetectedTimeZone]);

  useEffect(() => {
    function onFocus() {
      syncDetectedTimeZone();
      void refresh();
    }
    function onVisible() {
      if (document.visibilityState === "visible") {
        syncDetectedTimeZone();
        void refreshDaily();
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
    if (!("serviceWorker" in navigator)) return;
    let refreshing = false;
    function onControllerChange() {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    }
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    void navigator.serviceWorker.register("/sw.js", { scope: "/" });
    return () => navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
  }, []);

  useEffect(() => {
    if (!hasPublicEnv()) return;
    const supabase = createBrowserSupabaseClient();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" && window.location.pathname !== "/reset-password") {
        window.location.replace("/reset-password");
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const updatePrefs = useCallback(async (partial: Partial<CachedPreferences>) => {
    const next = { ...readCachedPreferences(), ...prefs, ...partial };
    setPrefs(next);
    writeCachedPreferences(next);
    if (!hasPublicEnv() || !navigator.onLine) return;
    const supabase = createBrowserSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("user_preferences").upsert(
      preferenceUpsertRow(user.id, next, {
        spouse_prayer_selection: spouseSelection,
        time_zone: timeZoneRef.current,
      }),
    );
    if (error) {
      await supabase.from("user_preferences").upsert({
        user_id: user.id,
        theme: next.theme,
        font_size: next.fontSize,
        line_height: next.lineHeight,
      });
    }
  }, [prefs, spouseSelection]);

  const updateSpouseSelection = useCallback(async (value: SpousePrayerSelection) => {
    const previous = spouseSelection;
    setSpouseSelection(value);
    if (!hasPublicEnv() || !navigator.onLine) return;
    const supabase = createBrowserSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("user_preferences").upsert(
      preferenceUpsertRow(user.id, prefs, {
        spouse_prayer_selection: value,
        time_zone: timeZoneRef.current,
      }),
    );
    if (error) {
      setSpouseSelection(previous);
      throw error;
    }
    const next = await fetchProgressSummary(supabase);
    setSummary(next);
  }, [spouseSelection, prefs]);

  const savePrayerInputs = useCallback(async (prayerItemId: string, values: PrayerInputValues) => {
    const cleaned = Object.fromEntries(
      Object.entries(values).filter(([, item]) => {
        if (Array.isArray(item)) return item.length > 0;
        return Boolean(item);
      }),
    ) as PrayerInputValues;
    const previous = prayerInputs;
    const nextRows = [
      ...prayerInputs.filter((row) => row.prayer_item_id !== prayerItemId),
      { prayer_item_id: prayerItemId, values: cleaned },
    ];
    setPrayerInputs(nextRows);
    if (!hasPublicEnv() || !navigator.onLine) return;
    const supabase = createBrowserSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    if (Object.keys(cleaned).length === 0) {
      const { error } = await supabase.from("user_prayer_inputs").delete().eq("prayer_item_id", prayerItemId);
      if (error) {
        setPrayerInputs(previous);
        throw error;
      }
      return;
    }
    const { error } = await supabase.from("user_prayer_inputs").upsert({
      user_id: user.id,
      prayer_item_id: prayerItemId,
      values: cleaned,
    });
    if (error) {
      setPrayerInputs(previous);
      throw error;
    }
  }, [prayerInputs]);

  const value = useMemo(
    () => ({
      summary,
      dailySummary,
      timeZone,
      reading,
      prefs,
      personalizations,
      prayerInputs,
      spouseSelection,
      online,
      setSummary,
      setDailySummary,
      setReading,
      setPersonalizations,
      setPrayerInputs,
      updatePrefs,
      updateSpouseSelection,
      savePrayerInputs,
      refresh,
      refreshDaily,
    }),
    [
      summary,
      dailySummary,
      timeZone,
      reading,
      prefs,
      personalizations,
      prayerInputs,
      spouseSelection,
      online,
      updatePrefs,
      updateSpouseSelection,
      savePrayerInputs,
      refresh,
      refreshDaily,
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
