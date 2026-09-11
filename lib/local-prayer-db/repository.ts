import type { CompletionEvent, DailyHistory, UserStats } from "@/lib/local-prayer-db/types";

export type LocalPrayerRepository = {
  getUserStats(userId: string): Promise<UserStats | undefined>;
  putUserStats(stats: UserStats): Promise<void>;
  getDailyHistory(userId: string, localDate: string): Promise<DailyHistory | undefined>;
  putDailyHistory(row: DailyHistory): Promise<void>;
  deleteDailyHistory(userId: string, localDate: string): Promise<void>;
  getDailyHistoryByMonth(userId: string, year: number, month: number): Promise<DailyHistory[]>;
  deleteAllDailyHistory(userId: string): Promise<void>;
  getCompletionEvent(userId: string, clientEventId: string): Promise<CompletionEvent | undefined>;
  putCompletionEvent(event: CompletionEvent): Promise<void>;
  listCompletionEvents(userId: string): Promise<CompletionEvent[]>;
  deleteCompletionEvent(userId: string, clientEventId: string): Promise<void>;
  deleteUserData(userId: string): Promise<void>;
  transact<T>(work: (repo: LocalPrayerRepository) => Promise<T>): Promise<T>;
};
