import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppProviders } from "@/components/providers/AppProviders";
import { AppBootSkeleton } from "@/components/layout/AppBootSkeleton";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { fetchDailyPrayerSummary, fetchProgressSummary } from "@/lib/supabase/rpc";
import { hasPublicEnv } from "@/lib/validation/env";
import type { ReadingState, UserPreferences } from "@/lib/progress/types";
import { personalizationRowsFromInputs } from "@/lib/prayers/personalize";
import type { PrayerInputRow } from "@/lib/prayers/inputs";
import { parseSpousePrayerSelection } from "@/lib/progress/spouse";
import { emptyDailySummary } from "@/lib/progress/daily";
import { DEFAULT_TIME_ZONE, normalizeTimeZone } from "@/lib/progress/timezone";

export const dynamic = "force-dynamic";

export default async function AppGroupLayout({ children }: { children: React.ReactNode }) {
  if (!hasPublicEnv()) {
    return (
      <AppProviders initialSummary={null} initialReading={null} initialPrefs={null} initialPersonalizations={[]}>
        <div className="p-6">환경 변수가 없어 서버에 연결할 수 없습니다. README를 확인해 주세요.</div>
        {children}
      </AppProviders>
    );
  }

  return (
    <Suspense fallback={<AppBootSkeleton />}>
      <AppDataProviders>{children}</AppDataProviders>
    </Suspense>
  );
}

async function AppDataProviders({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [summaryResult, prefsResultRaw, readingResultRaw, inputResultRaw, dailyResult] = await Promise.all([
    fetchProgressSummary(supabase).catch(() => ({
      total_completed: 0,
      current_round: 1,
      current_completed_count: 0,
      progress_percent: 0,
      eligible_count: 0,
      items: [],
    })),
    supabase
      .from("user_preferences")
      .select("theme, font_size, line_height, spouse_prayer_selection, auto_scroll_speed, auto_scroll_enabled, time_zone")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("user_reading_state")
      .select("last_prayer_item_id, scroll_ratio, anchor_key, anchor_offset, last_opened_at, updated_at")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase.from("user_prayer_inputs").select("prayer_item_id, values, updated_at"),
    fetchDailyPrayerSummary(supabase).catch(() => emptyDailySummary()),
  ]);

  let prefsResult = prefsResultRaw;
  if (prefsResult.error) {
    prefsResult = await supabase
      .from("user_preferences")
      .select("theme, font_size, line_height, spouse_prayer_selection, auto_scroll_speed, time_zone")
      .eq("user_id", user.id)
      .maybeSingle();
  }
  if (prefsResult.error) {
    prefsResult = await supabase.from("user_preferences").select("theme, font_size, line_height").eq("user_id", user.id).maybeSingle();
  }
  const readingResult = readingResultRaw.error
    ? await supabase
        .from("user_reading_state")
        .select("last_prayer_item_id, scroll_ratio, last_opened_at, updated_at")
        .eq("user_id", user.id)
        .maybeSingle()
    : readingResultRaw;
  const inputResult = inputResultRaw.error ? { data: [] } : inputResultRaw;

  const prefs = prefsResult.data as (UserPreferences & {
    spouse_prayer_selection?: string | null;
    auto_scroll_speed?: string;
    auto_scroll_enabled?: boolean;
    time_zone?: string;
  }) | null;
  const timeZone = normalizeTimeZone(prefs?.time_zone ?? DEFAULT_TIME_ZONE);

  const prayerInputs = (inputResult.data as PrayerInputRow[] | null) ?? [];

  return (
    <AppProviders
      initialSummary={summaryResult}
      initialDailySummary={dailyResult}
      initialReading={(readingResult.data as ReadingState | null) ?? null}
      initialPrefs={prefs}
      initialPersonalizations={personalizationRowsFromInputs(prayerInputs)}
      initialPrayerInputs={prayerInputs}
      initialSpouseSelection={parseSpousePrayerSelection(prefs?.spouse_prayer_selection)}
      initialTimeZone={timeZone}
    >
      {children}
    </AppProviders>
  );
}
