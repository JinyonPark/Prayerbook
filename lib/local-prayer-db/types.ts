export const LOCAL_STATS_SCHEMA_VERSION = 1;

export type BootstrapStatus = "pending" | "completed" | "failed";
export type CompletionEventStatus = "pending" | "applied" | "failed";

export type UserStats = {
  userId: string;
  schemaVersion: number;
  initialCompletionCount: number;
  appCompletionCount: number;
  todayDate: string;
  todayCompletionCount: number;
  timeZone: string;
  bootstrapStatus: BootstrapStatus;
  bootstrappedAt: string | null;
  updatedAt: string;
};

export type DailyHistory = {
  userId: string;
  localDate: string;
  totalCompletionCount: number;
  itemCounts: Record<string, number>;
  updatedAt: string;
};

export type CompletionEvent = {
  userId: string;
  clientEventId: string;
  prayerItemId: string;
  localDate: string;
  status: CompletionEventStatus;
  createdAt: string;
  appliedAt: string | null;
  errorMessage?: string | null;
};

export type LegacyBootstrapPayload = {
  completeCount: number;
  todayCount: number;
  days: Array<{
    localDate: string;
    itemCounts: Record<string, number>;
  }>;
};

export type PrayerLabel = {
  id: string;
  title: string;
  itemNumber: number | null;
  category: "main" | "supplementary";
  displayOrder: number;
};
