import type { SupabaseClient } from "@supabase/supabase-js";
import { personalizationRowsFromInputs } from "@/lib/prayers/personalize";
import type { PrayerInputRow } from "@/lib/prayers/inputs";
import { emptyDailySummary, type DailyPrayerSummary } from "@/lib/progress/daily";
import { parseSpousePrayerSelection, type SpousePrayerSelection } from "@/lib/progress/spouse";
import { DEFAULT_TIME_ZONE, normalizeTimeZone } from "@/lib/progress/timezone";
import type { ReadingState, RpcProgressSummary, UserPreferences } from "@/lib/progress/types";
import { fetchDailyPrayerSummary, fetchHomeDashboard, fetchProgressSummary } from "@/lib/supabase/rpc";
import { perfMark } from "@/lib/perf/marks";

const PREFS_SELECT =
  "theme, font_size, line_height, spouse_prayer_selection, auto_scroll_speed, auto_scroll_enabled, conceived_show_all_names, time_zone, share_selected_fields, share_custom_template";
const PREFS_FALLBACK =
  "theme, font_size, line_height, spouse_prayer_selection, auto_scroll_speed, auto_scroll_enabled, time_zone";
const READING_SELECT = "last_prayer_item_id, scroll_ratio, anchor_key, anchor_offset, last_opened_at, updated_at";

export type AppBootstrapState = {
  summary: RpcProgressSummary;
  daily: DailyPrayerSummary;
  prefs: UserPreferences | null;
  spouseSelection: SpousePrayerSelection;
  timeZone: string;
  reading: ReadingState | null;
  inputs: PrayerInputRow[];
};

let inflight: Promise<AppBootstrapState> | null = null;

async function loadHomeDashboard(supabase: SupabaseClient) {
  try {
    return await fetchHomeDashboard(supabase);
  } catch {
    const [progress, daily] = await Promise.all([
      fetchProgressSummary(supabase).catch(
        (): RpcProgressSummary => ({
          total_completed: 0,
          current_round: 1,
          current_completed_count: 0,
          progress_percent: 0,
          eligible_count: 0,
          items: [],
        }),
      ),
      fetchDailyPrayerSummary(supabase).catch(() => emptyDailySummary()),
    ]);
    return { progress, daily };
  }
}

async function loadPreferences(supabase: SupabaseClient) {
  const full = await supabase.from("user_preferences").select(PREFS_SELECT).maybeSingle();
  if (!full.error) return full.data;
  const fallback = await supabase.from("user_preferences").select(PREFS_FALLBACK).maybeSingle();
  return fallback.error ? null : fallback.data;
}

async function doBootstrap(supabase: SupabaseClient): Promise<AppBootstrapState> {
  perfMark("auth_start");
  const {
    data: { session },
  } = await supabase.auth.getSession();
  perfMark("auth_ready");
  if (!session) {
    const error = Object.assign(new Error("NOT_AUTHENTICATED"), { status: 401, code: "AUTH_EXPIRED" });
    throw error;
  }

  perfMark("home_data_request_start");
  const [home, prefsRow, readingResult, inputsResult] = await Promise.all([
    loadHomeDashboard(supabase),
    loadPreferences(supabase),
    supabase.from("user_reading_state").select(READING_SELECT).maybeSingle(),
    supabase.from("user_prayer_inputs").select("prayer_item_id, values, updated_at"),
  ]);

  const prefs = (prefsRow ?? null) as UserPreferences | null;
  const timeZone = normalizeTimeZone(prefs?.time_zone ?? DEFAULT_TIME_ZONE);
  const inputs = (inputsResult.error ? [] : (inputsResult.data ?? [])) as PrayerInputRow[];
  const reading = (readingResult.error ? null : (readingResult.data as ReadingState | null)) ?? null;

  return {
    summary: home.progress,
    daily: home.daily,
    prefs,
    spouseSelection: parseSpousePrayerSelection(prefs?.spouse_prayer_selection),
    timeZone,
    reading,
    inputs,
  };
}

export async function bootstrapAppState(supabase: SupabaseClient): Promise<AppBootstrapState> {
  if (!inflight) {
    inflight = doBootstrap(supabase).catch((error) => {
      inflight = null;
      throw error;
    });
  }
  return inflight;
}

export function personalizationsFromBootstrap(state: AppBootstrapState) {
  return personalizationRowsFromInputs(state.inputs);
}
