import { LOCAL_PRAYER_DB_NAME, LOCAL_PRAYER_DB_VERSION } from "@/lib/local-prayer-db/constants";
import { monthDateBounds } from "@/lib/local-prayer-db/calc";
import type { LocalPrayerRepository } from "@/lib/local-prayer-db/repository";
import type { CompletionEvent, DailyHistory, UserStats } from "@/lib/local-prayer-db/types";

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("INDEXEDDB_REQUEST_FAILED"));
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("INDEXEDDB_TX_FAILED"));
    tx.onabort = () => reject(tx.error ?? new Error("INDEXEDDB_TX_ABORTED"));
  });
}

let dbPromise: Promise<IDBDatabase> | null = null;

export function openPrayerLocalDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("INDEXEDDB_UNAVAILABLE"));
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(LOCAL_PRAYER_DB_NAME, LOCAL_PRAYER_DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("userStats")) {
          db.createObjectStore("userStats", { keyPath: "userId" });
        }
        if (!db.objectStoreNames.contains("dailyHistory")) {
          db.createObjectStore("dailyHistory", { keyPath: ["userId", "localDate"] });
        }
        if (!db.objectStoreNames.contains("completionEvents")) {
          db.createObjectStore("completionEvents", { keyPath: ["userId", "clientEventId"] });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        dbPromise = null;
        reject(request.error ?? new Error("INDEXEDDB_OPEN_FAILED"));
      };
    });
  }
  return dbPromise;
}

function storeFromTx(tx: IDBTransaction, name: "userStats" | "dailyHistory" | "completionEvents") {
  return tx.objectStore(name);
}

function repositoryForTransaction(tx: IDBTransaction): LocalPrayerRepository {
  const statsStore = () => storeFromTx(tx, "userStats");
  const historyStore = () => storeFromTx(tx, "dailyHistory");
  const eventStore = () => storeFromTx(tx, "completionEvents");

  const repo: LocalPrayerRepository = {
    async getUserStats(userId) {
      return requestToPromise(statsStore().get(userId)) as Promise<UserStats | undefined>;
    },
    async putUserStats(stats) {
      await requestToPromise(statsStore().put(stats));
    },
    async getDailyHistory(userId, localDate) {
      return requestToPromise(historyStore().get([userId, localDate])) as Promise<DailyHistory | undefined>;
    },
    async putDailyHistory(row) {
      await requestToPromise(historyStore().put(row));
    },
    async deleteDailyHistory(userId, localDate) {
      await requestToPromise(historyStore().delete([userId, localDate]));
    },
    async getDailyHistoryByMonth(userId, year, month) {
      const { start, end } = monthDateBounds(year, month);
      const range = IDBKeyRange.bound([userId, start], [userId, end]);
      const rows = (await requestToPromise(historyStore().getAll(range))) as DailyHistory[];
      return rows.sort((left, right) => right.localDate.localeCompare(left.localDate));
    },
    async deleteAllDailyHistory(userId) {
      const range = IDBKeyRange.bound([userId, "0000-01-01"], [userId, "9999-12-31"]);
      const rows = (await requestToPromise(historyStore().getAll(range))) as DailyHistory[];
      for (const row of rows) {
        await requestToPromise(historyStore().delete([row.userId, row.localDate]));
      }
    },
    async getCompletionEvent(userId, clientEventId) {
      return requestToPromise(eventStore().get([userId, clientEventId])) as Promise<CompletionEvent | undefined>;
    },
    async putCompletionEvent(event) {
      await requestToPromise(eventStore().put(event));
    },
    async listCompletionEvents(userId) {
      const range = IDBKeyRange.bound([userId, ""], [userId, "\uffff"]);
      return requestToPromise(eventStore().getAll(range)) as Promise<CompletionEvent[]>;
    },
    async deleteCompletionEvent(userId, clientEventId) {
      await requestToPromise(eventStore().delete([userId, clientEventId]));
    },
    async deleteUserData(userId) {
      await requestToPromise(statsStore().delete(userId));
      await repo.deleteAllDailyHistory(userId);
      const events = await repo.listCompletionEvents(userId);
      for (const event of events) {
        await requestToPromise(eventStore().delete([userId, event.clientEventId]));
      }
    },
    async transact(work) {
      return work(repo);
    },
  };
  return repo;
}

export function createIndexedDbLocalPrayerRepository(): LocalPrayerRepository {
  const withStores = async <T>(mode: IDBTransactionMode, work: (repo: LocalPrayerRepository) => Promise<T>): Promise<T> => {
    const db = await openPrayerLocalDb();
    const tx = db.transaction(["userStats", "dailyHistory", "completionEvents"], mode);
    const repo = repositoryForTransaction(tx);
    const result = await work(repo);
    await transactionDone(tx);
    return result;
  };

  return {
    getUserStats: (userId) => withStores("readonly", (repo) => repo.getUserStats(userId)),
    putUserStats: (stats) => withStores("readwrite", (repo) => repo.putUserStats(stats)),
    getDailyHistory: (userId, localDate) => withStores("readonly", (repo) => repo.getDailyHistory(userId, localDate)),
    putDailyHistory: (row) => withStores("readwrite", (repo) => repo.putDailyHistory(row)),
    deleteDailyHistory: (userId, localDate) => withStores("readwrite", (repo) => repo.deleteDailyHistory(userId, localDate)),
    getDailyHistoryByMonth: (userId, year, month) => withStores("readonly", (repo) => repo.getDailyHistoryByMonth(userId, year, month)),
    deleteAllDailyHistory: (userId) => withStores("readwrite", (repo) => repo.deleteAllDailyHistory(userId)),
    getCompletionEvent: (userId, clientEventId) => withStores("readonly", (repo) => repo.getCompletionEvent(userId, clientEventId)),
    putCompletionEvent: (event) => withStores("readwrite", (repo) => repo.putCompletionEvent(event)),
    listCompletionEvents: (userId) => withStores("readonly", (repo) => repo.listCompletionEvents(userId)),
    deleteCompletionEvent: (userId, clientEventId) => withStores("readwrite", (repo) => repo.deleteCompletionEvent(userId, clientEventId)),
    deleteUserData: (userId) => withStores("readwrite", (repo) => repo.deleteUserData(userId)),
    transact: (work) => withStores("readwrite", work),
  };
}
