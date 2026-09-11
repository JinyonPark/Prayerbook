import { monthDateBounds } from "@/lib/local-prayer-db/calc";
import type { LocalPrayerRepository } from "@/lib/local-prayer-db/repository";
import type { CompletionEvent, DailyHistory, UserStats } from "@/lib/local-prayer-db/types";

function historyKey(userId: string, localDate: string) {
  return `${userId}\0${localDate}`;
}

function eventKey(userId: string, clientEventId: string) {
  return `${userId}\0${clientEventId}`;
}

export function createMemoryLocalPrayerRepository(): LocalPrayerRepository {
  const stats = new Map<string, UserStats>();
  const history = new Map<string, DailyHistory>();
  const events = new Map<string, CompletionEvent>();

  const repo: LocalPrayerRepository = {
    async getUserStats(userId) {
      const row = stats.get(userId);
      return row ? { ...row } : undefined;
    },
    async putUserStats(row) {
      stats.set(row.userId, { ...row });
    },
    async getDailyHistory(userId, localDate) {
      const row = history.get(historyKey(userId, localDate));
      return row ? { ...row, itemCounts: { ...row.itemCounts } } : undefined;
    },
    async putDailyHistory(row) {
      history.set(historyKey(row.userId, row.localDate), { ...row, itemCounts: { ...row.itemCounts } });
    },
    async deleteDailyHistory(userId, localDate) {
      history.delete(historyKey(userId, localDate));
    },
    async getDailyHistoryByMonth(userId, year, month) {
      const { start, end } = monthDateBounds(year, month);
      return [...history.values()]
        .filter((row) => row.userId === userId && row.localDate >= start && row.localDate <= end)
        .map((row) => ({ ...row, itemCounts: { ...row.itemCounts } }))
        .sort((left, right) => right.localDate.localeCompare(left.localDate));
    },
    async deleteAllDailyHistory(userId) {
      for (const [key, row] of history) {
        if (row.userId === userId) history.delete(key);
      }
    },
    async getCompletionEvent(userId, clientEventId) {
      const row = events.get(eventKey(userId, clientEventId));
      return row ? { ...row } : undefined;
    },
    async putCompletionEvent(event) {
      events.set(eventKey(event.userId, event.clientEventId), { ...event });
    },
    async listCompletionEvents(userId) {
      return [...events.values()].filter((event) => event.userId === userId).map((event) => ({ ...event }));
    },
    async deleteCompletionEvent(userId, clientEventId) {
      events.delete(eventKey(userId, clientEventId));
    },
    async deleteUserData(userId) {
      stats.delete(userId);
      for (const [key, row] of history) {
        if (row.userId === userId) history.delete(key);
      }
      for (const [key, event] of events) {
        if (event.userId === userId) events.delete(key);
      }
    },
    async transact(work) {
      return work(repo);
    },
  };
  return repo;
}
