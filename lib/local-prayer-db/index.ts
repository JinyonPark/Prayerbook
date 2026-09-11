import { createIndexedDbLocalPrayerRepository } from "@/lib/local-prayer-db/db";
import { createMemoryLocalPrayerRepository } from "@/lib/local-prayer-db/memory";
import type { LocalPrayerRepository } from "@/lib/local-prayer-db/repository";

let override: LocalPrayerRepository | null = null;
let indexed: LocalPrayerRepository | null = null;

export function setLocalPrayerStoreForTests(store: LocalPrayerRepository | null) {
  override = store;
}

export function getLocalPrayerStore(): LocalPrayerRepository {
  if (override) return override;
  if (typeof indexedDB === "undefined") {
    return createMemoryLocalPrayerRepository();
  }
  if (!indexed) indexed = createIndexedDbLocalPrayerRepository();
  return indexed;
}

export { createMemoryLocalPrayerRepository } from "@/lib/local-prayer-db/memory";
export { createIndexedDbLocalPrayerRepository, openPrayerLocalDb } from "@/lib/local-prayer-db/db";
export * from "@/lib/local-prayer-db/types";
export * from "@/lib/local-prayer-db/constants";
export * from "@/lib/local-prayer-db/calc";
export * from "@/lib/local-prayer-db/ops";
export * from "@/lib/local-prayer-db/bootstrap";
export * from "@/lib/local-prayer-db/view";
