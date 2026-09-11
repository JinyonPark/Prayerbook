import { applyConfirmedCompletionState, displayedLifetimeCount, emptyUserStats, rolloverToday } from "@/lib/local-prayer-db/calc";
import { APPLIED_EVENT_RETENTION_MS, LOCAL_DEDUP_TTL_MS } from "@/lib/local-prayer-db/constants";
import type { LocalPrayerRepository } from "@/lib/local-prayer-db/repository";
import type { CompletionEvent, DailyHistory, UserStats } from "@/lib/local-prayer-db/types";

export async function getLocalPrayerStats(repo: LocalPrayerRepository, userId: string): Promise<UserStats | undefined> {
  return repo.getUserStats(userId);
}

export async function ensureTodayRollover(
  repo: LocalPrayerRepository,
  input: { userId: string; localDate: string; timeZone: string; nowIso: string },
): Promise<UserStats> {
  return repo.transact(async (tx) => {
    const existing = await tx.getUserStats(input.userId);
    const base = existing ?? emptyUserStats({
      userId: input.userId,
      localDate: input.localDate,
      timeZone: input.timeZone,
      nowIso: input.nowIso,
      bootstrapStatus: "pending",
    });
    const next = {
      ...rolloverToday(base, input.localDate, input.nowIso),
      timeZone: input.timeZone || base.timeZone,
    };
    if (JSON.stringify(existing) !== JSON.stringify(next)) {
      await tx.putUserStats(next);
    }
    return next;
  });
}

export async function updateInitialCompletionCount(
  repo: LocalPrayerRepository,
  userId: string,
  value: number,
  nowIso: string,
): Promise<UserStats> {
  return repo.transact(async (tx) => {
    const existing = await tx.getUserStats(userId);
    if (!existing) {
      throw new Error("LOCAL_STATS_MISSING");
    }
    const next: UserStats = {
      ...existing,
      initialCompletionCount: value,
      updatedAt: nowIso,
    };
    await tx.putUserStats(next);
    return next;
  });
}

export async function prepareLocalCompletionEvent(
  repo: LocalPrayerRepository,
  input: {
    userId: string;
    clientEventId: string;
    prayerItemId: string;
    localDate: string;
    nowIso: string;
  },
): Promise<CompletionEvent> {
  return repo.transact(async (tx) => {
    const existing = await tx.getCompletionEvent(input.userId, input.clientEventId);
    if (existing) return existing;
    const event: CompletionEvent = {
      userId: input.userId,
      clientEventId: input.clientEventId,
      prayerItemId: input.prayerItemId,
      localDate: input.localDate,
      status: "pending",
      createdAt: input.nowIso,
      appliedAt: null,
    };
    await tx.putCompletionEvent(event);
    return event;
  });
}

export async function applyConfirmedLocalCompletion(
  repo: LocalPrayerRepository,
  input: {
    userId: string;
    clientEventId: string;
    prayerItemId: string;
    localDate: string;
    timeZone: string;
    nowIso: string;
  },
): Promise<{ applied: boolean; stats: UserStats; history: DailyHistory }> {
  return repo.transact(async (tx) => {
    const [statsRow, history, event] = await Promise.all([
      tx.getUserStats(input.userId),
      tx.getDailyHistory(input.userId, input.localDate),
      tx.getCompletionEvent(input.userId, input.clientEventId),
    ]);
    const stats = statsRow ?? emptyUserStats({
      userId: input.userId,
      localDate: input.localDate,
      timeZone: input.timeZone,
      nowIso: input.nowIso,
      bootstrapStatus: "completed",
    });
    const next = applyConfirmedCompletionState({
      stats,
      history,
      event,
      userId: input.userId,
      clientEventId: input.clientEventId,
      prayerItemId: input.prayerItemId,
      localDate: input.localDate,
      timeZone: input.timeZone,
      nowIso: input.nowIso,
    });
    await tx.putUserStats(next.stats);
    await tx.putDailyHistory(next.history);
    await tx.putCompletionEvent(next.event);
    return { applied: next.applied, stats: next.stats, history: next.history };
  });
}

export async function getTodayLocalCount(repo: LocalPrayerRepository, userId: string): Promise<number> {
  const stats = await repo.getUserStats(userId);
  return stats?.todayCompletionCount ?? 0;
}

export async function getDisplayedLifetimeCount(repo: LocalPrayerRepository, userId: string): Promise<number> {
  const stats = await repo.getUserStats(userId);
  return stats ? displayedLifetimeCount(stats) : 0;
}

export async function getHistoryByMonth(
  repo: LocalPrayerRepository,
  userId: string,
  year: number,
  month: number,
): Promise<DailyHistory[]> {
  return repo.getDailyHistoryByMonth(userId, year, month);
}

export async function deleteHistoryDate(repo: LocalPrayerRepository, userId: string, localDate: string): Promise<void> {
  await repo.deleteDailyHistory(userId, localDate);
}

export async function deleteAllHistory(repo: LocalPrayerRepository, userId: string): Promise<void> {
  await repo.deleteAllDailyHistory(userId);
}

export async function deleteLocalPrayerUserData(repo: LocalPrayerRepository, userId: string): Promise<void> {
  await repo.deleteUserData(userId);
}

export async function cleanupLocalCompletionEvents(
  repo: LocalPrayerRepository,
  userId: string,
  nowMs: number,
): Promise<void> {
  const events = await repo.listCompletionEvents(userId);
  for (const event of events) {
    if (event.status !== "applied" || !event.appliedAt) continue;
    const appliedAt = Date.parse(event.appliedAt);
    if (Number.isFinite(appliedAt) && nowMs - appliedAt > APPLIED_EVENT_RETENTION_MS) {
      await repo.deleteCompletionEvent(userId, event.clientEventId);
    }
  }
}

export function isPendingEventExpired(event: CompletionEvent, nowMs: number): boolean {
  if (event.status !== "pending") return false;
  const created = Date.parse(event.createdAt);
  return Number.isFinite(created) && nowMs - created > LOCAL_DEDUP_TTL_MS;
}

export async function markExpiredPendingEvents(
  repo: LocalPrayerRepository,
  userId: string,
  nowIso: string,
  nowMs: number,
): Promise<CompletionEvent[]> {
  const expired: CompletionEvent[] = [];
  const events = await repo.listCompletionEvents(userId);
  for (const event of events) {
    if (!isPendingEventExpired(event, nowMs)) continue;
    const next: CompletionEvent = {
      ...event,
      status: "failed",
      errorMessage: "PENDING_EXPIRED",
    };
    await repo.putCompletionEvent(next);
    expired.push(next);
  }
  void nowIso;
  return expired;
}

export async function listRetryablePendingEvents(
  repo: LocalPrayerRepository,
  userId: string,
  nowMs: number,
): Promise<CompletionEvent[]> {
  const events = await repo.listCompletionEvents(userId);
  return events.filter((event) => event.status === "pending" && !isPendingEventExpired(event, nowMs));
}
