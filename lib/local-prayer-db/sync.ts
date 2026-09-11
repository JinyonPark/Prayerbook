import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchLegacyCompleteBootstrap, initializeLocalPrayerStats } from "@/lib/local-prayer-db/bootstrap";
import {
  applyConfirmedLocalCompletion,
  cleanupLocalCompletionEvents,
  deleteLocalPrayerUserData,
  ensureTodayRollover,
  listRetryablePendingEvents,
  markExpiredPendingEvents,
} from "@/lib/local-prayer-db/ops";
import { getLocalPrayerStore } from "@/lib/local-prayer-db/index";
import { activityStatsFromUserStats, dailySummaryFromLocal, type ActivityStats } from "@/lib/local-prayer-db/view";
import type { PrayerLabel } from "@/lib/local-prayer-db/types";
import { emptyDailySummary, type DailyPrayerSummary } from "@/lib/progress/daily";
import { getLocalDateString } from "@/lib/progress/timezone";
import { rpcComplete } from "@/lib/supabase/rpc";

export type LocalStatsView = {
  daily: DailyPrayerSummary;
  activity: ActivityStats;
  bootstrapFailed: boolean;
  expiredPending: boolean;
};

export async function loadLocalStatsView(input: {
  userId: string;
  timeZone: string;
  prayers: PrayerLabel[];
  now?: Date;
}): Promise<LocalStatsView> {
  const store = getLocalPrayerStore();
  const now = input.now ?? new Date();
  const nowIso = now.toISOString();
  const localDate = getLocalDateString(input.timeZone, now);
  const stats = await ensureTodayRollover(store, {
    userId: input.userId,
    localDate,
    timeZone: input.timeZone,
    nowIso,
  });
  const todayHistory = await store.getDailyHistory(input.userId, stats.todayDate);
  return {
    daily: dailySummaryFromLocal({ stats, todayHistory, prayers: input.prayers }),
    activity: activityStatsFromUserStats(stats),
    bootstrapFailed: stats.bootstrapStatus === "failed",
    expiredPending: false,
  };
}

export async function bootstrapLocalStatsView(input: {
  userId: string;
  timeZone: string;
  prayers: PrayerLabel[];
  supabase: SupabaseClient;
  now?: Date;
}): Promise<LocalStatsView> {
  const store = getLocalPrayerStore();
  const now = input.now ?? new Date();
  const nowIso = now.toISOString();
  const localDate = getLocalDateString(input.timeZone, now);
  const initialized = await initializeLocalPrayerStats(store, {
    userId: input.userId,
    localDate,
    timeZone: input.timeZone,
    nowIso,
    fetchLegacy: () => fetchLegacyCompleteBootstrap(input.supabase),
  });
  const stats = await ensureTodayRollover(store, {
    userId: input.userId,
    localDate,
    timeZone: input.timeZone,
    nowIso,
  });
  await cleanupLocalCompletionEvents(store, input.userId, now.getTime());
  const expired = await markExpiredPendingEvents(store, input.userId, nowIso, now.getTime());
  const todayHistory = await store.getDailyHistory(input.userId, stats.todayDate);
  void initialized;
  return {
    daily: dailySummaryFromLocal({ stats, todayHistory, prayers: input.prayers }),
    activity: activityStatsFromUserStats(stats),
    bootstrapFailed: stats.bootstrapStatus === "failed",
    expiredPending: expired.length > 0,
  };
}

export async function confirmLocalCompletionView(input: {
  userId: string;
  clientEventId: string;
  prayerItemId: string;
  timeZone: string;
  prayers: PrayerLabel[];
  now?: Date;
}): Promise<LocalStatsView> {
  const store = getLocalPrayerStore();
  const now = input.now ?? new Date();
  const localDate = getLocalDateString(input.timeZone, now);
  const applied = await applyConfirmedLocalCompletion(store, {
    userId: input.userId,
    clientEventId: input.clientEventId,
    prayerItemId: input.prayerItemId,
    localDate,
    timeZone: input.timeZone,
    nowIso: now.toISOString(),
  });
  return {
    daily: dailySummaryFromLocal({
      stats: applied.stats,
      todayHistory: applied.history.localDate === applied.stats.todayDate ? applied.history : await store.getDailyHistory(input.userId, applied.stats.todayDate),
      prayers: input.prayers,
    }),
    activity: activityStatsFromUserStats(applied.stats),
    bootstrapFailed: applied.stats.bootstrapStatus === "failed",
    expiredPending: false,
  };
}

export async function retryPendingLocalCompletions(input: {
  userId: string;
  timeZone: string;
  prayers: PrayerLabel[];
  supabase: SupabaseClient;
  now?: Date;
}): Promise<LocalStatsView> {
  const store = getLocalPrayerStore();
  const now = input.now ?? new Date();
  const pending = await listRetryablePendingEvents(store, input.userId, now.getTime());
  for (const event of pending) {
    try {
      await rpcComplete(input.supabase, event.prayerItemId, event.clientEventId);
      await applyConfirmedLocalCompletion(store, {
        userId: input.userId,
        clientEventId: event.clientEventId,
        prayerItemId: event.prayerItemId,
        localDate: event.localDate || getLocalDateString(input.timeZone, now),
        timeZone: input.timeZone,
        nowIso: now.toISOString(),
      });
    } catch {
      // Keep pending for a later attempt inside the dedup window.
    }
  }
  return loadLocalStatsView(input);
}

export async function clearLocalPrayerDataForUser(userId: string): Promise<void> {
  await deleteLocalPrayerUserData(getLocalPrayerStore(), userId);
}

export function emptyActivityStats(timeZone: string): ActivityStats {
  return {
    todayCompletionCount: 0,
    appCompletionCount: 0,
    initialCompletionCount: 0,
    displayedLifetimeCount: 0,
    todayDate: "",
    timeZone,
    bootstrapStatus: "pending",
  };
}

export function emptyLocalStatsView(timeZone: string): LocalStatsView {
  return {
    daily: emptyDailySummary(timeZone),
    activity: emptyActivityStats(timeZone),
    bootstrapFailed: false,
    expiredPending: false,
  };
}
