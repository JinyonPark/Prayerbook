import { calculateProgressFromItems, type PrayerCountItem, type ProgressSummary } from "@/lib/progress/calculate";
import {
  summarizeDailyCompletions,
  type DailyOperationRecord,
  type DailyPrayerSummary,
} from "@/lib/progress/daily";
import { DEFAULT_TIME_ZONE, localDateString } from "@/lib/progress/timezone";

export type OperationType =
  | "complete"
  | "manual_edit"
  | "item_reset"
  | "current_round_reset"
  | "main_full_reset"
  | "all_full_reset"
  | "bulk_set";

export type AffectedItem = {
  prayerItemId: string;
  beforeCount: number;
  afterCount: number;
};

export type MutationResult = ProgressSummary & {
  operationId: string;
  affectedItems: AffectedItem[];
  totalChanged: boolean;
  previousTotal: number;
  currentTotal: number;
  idempotent: boolean;
};

type UserState = {
  items: PrayerCountItem[];
  operations: Map<string, MutationResult>;
  activity: DailyOperationRecord[];
};

export class InMemoryProgressStore {
  private users = new Map<string, UserState>();

  constructor(private readonly catalog: PrayerCountItem[]) {}

  seedUser(userId: string, counts: Record<string, number> = {}) {
    this.users.set(userId, {
      items: this.catalog.map((item) => ({
        ...item,
        completionCount: counts[item.id] ?? 0,
      })),
      operations: new Map(),
      activity: [],
    });
  }

  private state(userId: string): UserState {
    const current = this.users.get(userId);
    if (!current) {
      throw new Error("NOT_AUTHENTICATED");
    }
    return current;
  }

  summary(userId: string): ProgressSummary {
    return calculateProgressFromItems(this.state(userId).items);
  }

  activity(userId: string): DailyOperationRecord[] {
    return this.state(userId).activity.map((item) => ({ ...item }));
  }

  dailySummary(
    userId: string,
    options: { timeZone?: string; localDate?: string; now?: Date } = {},
  ): DailyPrayerSummary {
    const timeZone = options.timeZone ?? DEFAULT_TIME_ZONE;
    return summarizeDailyCompletions(this.state(userId).activity, {
      timeZone,
      localDate: options.localDate ?? localDateString(options.now ?? new Date(), timeZone),
    });
  }

  complete(userId: string, prayerItemId: string, clientEventId: string, createdAt?: Date): MutationResult {
    return this.mutate(userId, clientEventId, "complete", (items) => {
      const target = items.find((item) => item.id === prayerItemId);
      if (!target) throw new Error("PRAYER_NOT_FOUND");
      const before = target.completionCount;
      target.completionCount += 1;
      return [{ prayerItemId, beforeCount: before, afterCount: target.completionCount }];
    }, createdAt);
  }

  setCount(userId: string, prayerItemId: string, newCount: number, clientEventId: string, createdAt?: Date): MutationResult {
    if (!Number.isInteger(newCount) || newCount < 0 || newCount > 10_000) {
      throw new Error("INVALID_COUNT");
    }
    return this.mutate(userId, clientEventId, "manual_edit", (items) => {
      const target = items.find((item) => item.id === prayerItemId);
      if (!target) throw new Error("PRAYER_NOT_FOUND");
      const before = target.completionCount;
      target.completionCount = newCount;
      return [{ prayerItemId, beforeCount: before, afterCount: newCount }];
    }, createdAt);
  }

  resetItem(userId: string, prayerItemId: string, clientEventId: string, createdAt?: Date): MutationResult {
    return this.mutate(userId, clientEventId, "item_reset", (items) => {
      const target = items.find((item) => item.id === prayerItemId);
      if (!target) throw new Error("PRAYER_NOT_FOUND");
      const before = target.completionCount;
      target.completionCount = 0;
      return [{ prayerItemId, beforeCount: before, afterCount: 0 }];
    }, createdAt);
  }

  resetCurrentRound(userId: string, clientEventId: string, createdAt?: Date): MutationResult {
    return this.mutate(userId, clientEventId, "current_round_reset", (items) => {
      const totalCompleted = calculateProgressFromItems(items).totalCompleted;
      const affected: AffectedItem[] = [];
      for (const item of items) {
        if (item.category === "main" && item.completionCount > totalCompleted) {
          affected.push({
            prayerItemId: item.id,
            beforeCount: item.completionCount,
            afterCount: totalCompleted,
          });
          item.completionCount = totalCompleted;
        }
      }
      return affected;
    }, createdAt);
  }

  resetMain(userId: string, clientEventId: string, createdAt?: Date): MutationResult {
    return this.mutate(userId, clientEventId, "main_full_reset", (items) => {
      const affected: AffectedItem[] = [];
      for (const item of items) {
        if (item.category === "main") {
          affected.push({
            prayerItemId: item.id,
            beforeCount: item.completionCount,
            afterCount: 0,
          });
          item.completionCount = 0;
        }
      }
      return affected;
    }, createdAt);
  }

  resetAll(userId: string, clientEventId: string, createdAt?: Date): MutationResult {
    return this.mutate(userId, clientEventId, "all_full_reset", (items) => {
      const affected: AffectedItem[] = [];
      for (const item of items) {
        affected.push({
          prayerItemId: item.id,
          beforeCount: item.completionCount,
          afterCount: 0,
        });
        item.completionCount = 0;
      }
      return affected;
    }, createdAt);
  }

  bulkSetMain(userId: string, newCount: number, clientEventId: string, createdAt?: Date): MutationResult {
    if (!Number.isInteger(newCount) || newCount < 0 || newCount > 10_000) {
      throw new Error("INVALID_COUNT");
    }
    return this.mutate(userId, clientEventId, "bulk_set", (items) => {
      const affected: AffectedItem[] = [];
      for (const item of items) {
        if (item.category === "main") {
          affected.push({
            prayerItemId: item.id,
            beforeCount: item.completionCount,
            afterCount: newCount,
          });
          item.completionCount = newCount;
        }
      }
      return affected;
    }, createdAt);
  }

  private mutate(
    userId: string,
    clientEventId: string,
    operationType: OperationType,
    apply: (items: PrayerCountItem[]) => AffectedItem[],
    createdAt?: Date,
  ): MutationResult {
    const state = this.state(userId);
    const existing = state.operations.get(clientEventId);
    if (existing) {
      return { ...existing, ...this.summary(userId), idempotent: true, totalChanged: false };
    }

    const previous = this.summary(userId);
    const snapshot = state.items.map((item) => ({ ...item }));
    try {
      const affected = apply(state.items);
      const current = this.summary(userId);
      const result: MutationResult = {
        ...current,
        operationId: crypto.randomUUID(),
        affectedItems: affected,
        totalChanged: current.totalCompleted !== previous.totalCompleted,
        previousTotal: previous.totalCompleted,
        currentTotal: current.totalCompleted,
        idempotent: false,
      };
      state.operations.set(clientEventId, result);
      const at = (createdAt ?? new Date()).toISOString();
      for (const item of affected) {
        const catalogItem = state.items.find((row) => row.id === item.prayerItemId);
        state.activity.push({
          client_event_id: clientEventId,
          operation_type: operationType,
          created_at: at,
          prayer_item_id: item.prayerItemId,
          prayer_title: catalogItem?.itemNumber ? `${catalogItem.itemNumber}번 기도` : item.prayerItemId,
          item_number: catalogItem?.itemNumber ?? null,
          category: catalogItem?.category ?? "main",
          display_order: catalogItem?.displayOrder ?? 0,
        });
      }
      return result;
    } catch (error) {
      state.items = snapshot;
      throw error;
    }
  }
}
