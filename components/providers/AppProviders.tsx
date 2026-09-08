"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { fetchDailyPrayerSummary, fetchProgressSummary } from "@/lib/supabase/rpc";
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
import { emptyDailySummary, type DailyPrayerSummary } from "@/lib/progress/daily";
import { parseShareFormat, type ShareFormatPreference } from "@/lib/progress/share-content";
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
  shareFormat: ShareFormatPreference;
  updateShareFormat: (format: ShareFormatPreference) => Promise<void>;
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
  const [shareFormat, setShareFormat] = useState<ShareFormatPreference>(() => parseShareFormat(initialPrefs));
  const timeZoneRef = useRef(timeZone);
  timeZoneRef.current = timeZone;

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

  useEffect(() => {
    if (!hasPublicEnv()) return;
    const supabase = createBrowserSupabaseClient();
    void supabase
      .from("user_prayer_inputs")
      .select("prayer_item_id, values, updated_at")
      .then(({ data }) => {
        if (!data) return;
        setPrayerInputs(data as PrayerInputRow[]);
        setPersonalizations(personalizationRowsFromInputs(data as PrayerInputRow[]));
      });
  }, []);

  const persistTimeZone = useCallback(async (nextZone: string) => {
    if (!hasPublicEnv()) return;
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
    if (!hasPublicEnv()) return false;
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

  const syncDetectedTimeZone = useCallback(() => {
    const detected = detectBrowserTimeZone();
    if (detected !== timeZoneRef.current) {
      setTimeZone(detected);
      void persistTimeZone(detected);
    }
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
    if (!hasPublicEnv()) return;
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

  const updateShareFormat = useCallback(async (next: ShareFormatPreference) => {
    setShareFormat(next);
    if (!hasPublicEnv()) return;
    const supabase = createBrowserSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("user_preferences").upsert({
      user_id: user.id,
      share_selected_fields: next.selected,
      share_custom_template: next.customTemplate,
    });
    if (error) {
      await supabase.from("user_preferences").upsert({
        user_id: user.id,
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
      writeCachedSpouseSelection(previous);
      throw error;
    }
    const next = await fetchProgressSummary(supabase);
    setSummary(next);
  }, [spouseSelection, prefs]);

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
      shareFormat,
      updateShareFormat,
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
