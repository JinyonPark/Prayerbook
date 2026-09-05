import { calculateProgressFromItems, type PrayerCountItem, type ProgressSummary } from "@/lib/progress/calculate";

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

  complete(userId: string, prayerItemId: string, clientEventId: string): MutationResult {
    return this.mutate(userId, clientEventId, (items) => {
      const target = items.find((item) => item.id === prayerItemId);
      if (!target) throw new Error("PRAYER_NOT_FOUND");
      const before = target.completionCount;
      target.completionCount += 1;
      return [{ prayerItemId, beforeCount: before, afterCount: target.completionCount }];
    });
  }

  setCount(userId: string, prayerItemId: string, newCount: number, clientEventId: string): MutationResult {
    if (!Number.isInteger(newCount) || newCount < 0 || newCount > 10_000) {
      throw new Error("INVALID_COUNT");
    }
    return this.mutate(userId, clientEventId, (items) => {
      const target = items.find((item) => item.id === prayerItemId);
      if (!target) throw new Error("PRAYER_NOT_FOUND");
      const before = target.completionCount;
      target.completionCount = newCount;
      return [{ prayerItemId, beforeCount: before, afterCount: newCount }];
    });
  }

  resetItem(userId: string, prayerItemId: string, clientEventId: string): MutationResult {
    return this.setCount(userId, prayerItemId, 0, clientEventId);
  }

  resetCurrentRound(userId: string, clientEventId: string): MutationResult {
    return this.mutate(userId, clientEventId, (items) => {
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
    });
  }

  resetMain(userId: string, clientEventId: string): MutationResult {
    return this.mutate(userId, clientEventId, (items) => {
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
    });
  }

  resetAll(userId: string, clientEventId: string): MutationResult {
    return this.mutate(userId, clientEventId, (items) => {
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
    });
  }

  bulkSetMain(userId: string, newCount: number, clientEventId: string): MutationResult {
    if (!Number.isInteger(newCount) || newCount < 0 || newCount > 10_000) {
      throw new Error("INVALID_COUNT");
    }
    return this.mutate(userId, clientEventId, (items) => {
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
    });
  }

  private mutate(
    userId: string,
    clientEventId: string,
    apply: (items: PrayerCountItem[]) => AffectedItem[],
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
      return result;
    } catch (error) {
      state.items = snapshot;
      throw error;
    }
  }
}
