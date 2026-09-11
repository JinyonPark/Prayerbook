import type { SupabaseClient } from "@supabase/supabase-js";
import { emptyUserStats } from "@/lib/local-prayer-db/calc";
import { LOCAL_HISTORY_CUTOVER_AT } from "@/lib/local-prayer-db/constants";
import type { LocalPrayerRepository } from "@/lib/local-prayer-db/repository";
import type { DailyHistory, LegacyBootstrapPayload, UserStats } from "@/lib/local-prayer-db/types";

function asCount(value: unknown): number {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : 0;
}

export function parseLegacyBootstrapPayload(value: unknown): LegacyBootstrapPayload {
  const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const daysRaw: unknown[] = Array.isArray(row.days) ? row.days : Array.isArray(row.days_json) ? (row.days_json as unknown[]) : [];
  return {
    completeCount: asCount(row.complete_count ?? row.completeCount),
    todayCount: asCount(row.today_count ?? row.todayCount),
    days: daysRaw
      .map((day: unknown) => {
        const current = day && typeof day === "object" ? (day as Record<string, unknown>) : {};
        const countsRaw = current.item_counts ?? current.itemCounts;
        const itemCounts: Record<string, number> = {};
        if (countsRaw && typeof countsRaw === "object") {
          for (const [key, count] of Object.entries(countsRaw as Record<string, unknown>)) {
            const n = asCount(count);
            if (n > 0) itemCounts[key] = n;
          }
        }
        return {
          localDate: String(current.local_date ?? current.localDate ?? ""),
          itemCounts,
        };
      })
      .filter((day: { localDate: string }) => /^\d{4}-\d{2}-\d{2}$/.test(day.localDate)),
  };
}

export async function fetchLegacyCompleteBootstrap(
  supabase: SupabaseClient,
  cutoverAt = LOCAL_HISTORY_CUTOVER_AT,
): Promise<LegacyBootstrapPayload> {
  const { data, error } = await supabase.rpc("get_legacy_complete_bootstrap", {
    p_cutover: cutoverAt,
  });
  if (error) throw error;
  return parseLegacyBootstrapPayload(data);
}

export async function initializeLocalPrayerStats(
  repo: LocalPrayerRepository,
  input: {
    userId: string;
    localDate: string;
    timeZone: string;
    nowIso: string;
    fetchLegacy: () => Promise<LegacyBootstrapPayload>;
  },
): Promise<{ stats: UserStats; seeded: boolean; bootstrapFailed: boolean }> {
  const existing = await repo.getUserStats(input.userId);
  if (existing) {
    return { stats: existing, seeded: false, bootstrapFailed: existing.bootstrapStatus === "failed" };
  }

  try {
    const legacy = await input.fetchLegacy();
    const stats: UserStats = {
      ...emptyUserStats({
        userId: input.userId,
        localDate: input.localDate,
        timeZone: input.timeZone,
        nowIso: input.nowIso,
        bootstrapStatus: "completed",
      }),
      initialCompletionCount: legacy.completeCount,
      appCompletionCount: 0,
      todayCompletionCount: input.localDate ? legacy.todayCount : 0,
      todayDate: input.localDate,
      bootstrappedAt: input.nowIso,
    };
    await repo.transact(async (tx) => {
      await tx.putUserStats(stats);
      for (const day of legacy.days) {
        const total = Object.values(day.itemCounts).reduce((sum, count) => sum + count, 0);
        const row: DailyHistory = {
          userId: input.userId,
          localDate: day.localDate,
          totalCompletionCount: total,
          itemCounts: day.itemCounts,
          updatedAt: input.nowIso,
        };
        await tx.putDailyHistory(row);
      }
    });
    return { stats, seeded: true, bootstrapFailed: false };
  } catch {
    const stats: UserStats = {
      ...emptyUserStats({
        userId: input.userId,
        localDate: input.localDate,
        timeZone: input.timeZone,
        nowIso: input.nowIso,
        bootstrapStatus: "failed",
      }),
      bootstrappedAt: input.nowIso,
    };
    await repo.putUserStats(stats);
    return { stats, seeded: false, bootstrapFailed: true };
  }
}
