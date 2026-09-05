"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { fetchProgressSummary } from "@/lib/supabase/rpc";
import type { RpcProgressSummary } from "@/lib/progress/types";
import type { ReadingState, UserPreferences } from "@/lib/progress/types";
import type { PersonalizationRow } from "@/lib/prayers/personalize";
import {
  applyPreferences,
  defaultPreferences,
  readCachedPreferences,
  writeCachedPreferences,
  type CachedPreferences,
} from "@/lib/theme/preferences";
import { hasPublicEnv } from "@/lib/validation/env";

type AppState = {
  summary: RpcProgressSummary | null;
  reading: ReadingState | null;
  prefs: CachedPreferences;
  personalizations: PersonalizationRow[];
  online: boolean;
  setSummary: (summary: RpcProgressSummary) => void;
  setReading: (reading: ReadingState) => void;
  setPersonalizations: (rows: PersonalizationRow[]) => void;
  updatePrefs: (prefs: Partial<CachedPreferences>) => Promise<void>;
  refresh: () => Promise<void>;
};

const AppStateContext = createContext<AppState | null>(null);

type Props = {
  children: React.ReactNode;
  initialSummary: RpcProgressSummary | null;
  initialReading: ReadingState | null;
  initialPrefs: UserPreferences | null;
  initialPersonalizations?: PersonalizationRow[];
};

export function AppProviders({
  children,
  initialSummary,
  initialReading,
  initialPrefs,
  initialPersonalizations = [],
}: Props) {
  const [summary, setSummary] = useState(initialSummary);
  const [reading, setReading] = useState(initialReading);
  const [personalizations, setPersonalizations] = useState(initialPersonalizations);
  const [prefs, setPrefs] = useState<CachedPreferences>(
    initialPrefs
      ? {
          theme: initialPrefs.theme,
          fontSize: initialPrefs.font_size,
          lineHeight: initialPrefs.line_height,
        }
      : defaultPreferences,
  );
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const cached = readCachedPreferences();
    if (!initialPrefs) {
      setPrefs(cached);
      applyPreferences(cached);
    } else {
      const next = {
        theme: initialPrefs.theme,
        fontSize: initialPrefs.font_size,
        lineHeight: initialPrefs.line_height,
      };
      writeCachedPreferences(next);
      setPrefs(next);
    }
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, [initialPrefs]);

  const refresh = useCallback(async () => {
    if (!hasPublicEnv() || !navigator.onLine) return;
    const supabase = createBrowserSupabaseClient();
    const next = await fetchProgressSummary(supabase);
    setSummary(next);
  }, []);

  useEffect(() => {
    function onFocus() {
      void refresh();
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

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
      if (event === "PASSWORD_RECOVERY" && window.location.pathname !== "/auth/update-password") {
        window.location.replace("/auth/update-password");
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
    await supabase.from("user_preferences").upsert({
      user_id: user.id,
      theme: next.theme,
      font_size: next.fontSize,
      line_height: next.lineHeight,
    });
  }, [prefs]);

  const value = useMemo(
    () => ({
      summary,
      reading,
      prefs,
      personalizations,
      online,
      setSummary,
      setReading,
      setPersonalizations,
      updatePrefs,
      refresh,
    }),
    [summary, reading, prefs, personalizations, online, updatePrefs, refresh],
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
