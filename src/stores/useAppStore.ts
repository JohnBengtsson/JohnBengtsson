import { create } from "zustand";
import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "forge-app";
const DB_VERSION = 1;
const STORE_NAME = "offline-queue";

export interface QueuedEveningLog {
  id: string;
  timestamp: number;
  actions: string[];
  measurements?: { leanness?: number; look?: number; strength?: number };
  notes?: string;
}

interface AppStore {
  offlineQueue: QueuedEveningLog[];
  isFlushing: boolean;
  // Persist a log to the queue (called when POST /api/evening-log fails offline)
  enqueueLog: (
    payload: Omit<QueuedEveningLog, "id" | "timestamp">
  ) => Promise<void>;
  // Load queue from IndexedDB on app start
  hydrateQueue: () => Promise<void>;
  // Flush all queued items when back online
  flushQueue: () => Promise<void>;
}

let db: IDBPDatabase | null = null;

async function getDb(): Promise<IDBPDatabase> {
  if (db) return db;
  db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(d) {
      if (!d.objectStoreNames.contains(STORE_NAME)) {
        d.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    },
  });
  return db;
}

export const useAppStore = create<AppStore>((set, get) => ({
  offlineQueue: [],
  isFlushing: false,

  async enqueueLog(payload) {
    const item: QueuedEveningLog = {
      ...payload,
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      timestamp: Date.now(),
    };
    try {
      const d = await getDb();
      await d.add(STORE_NAME, item);
    } catch {
      // IndexedDB unavailable (e.g., private browsing) — store in memory only
    }
    set((s) => ({ offlineQueue: [...s.offlineQueue, item] }));
  },

  async hydrateQueue() {
    try {
      const d = await getDb();
      const items = await d.getAll(STORE_NAME);
      set({ offlineQueue: items as QueuedEveningLog[] });
    } catch {
      // IndexedDB unavailable
    }
  },

  async flushQueue() {
    const { offlineQueue, isFlushing } = get();
    if (isFlushing || offlineQueue.length === 0) return;
    set({ isFlushing: true });

    const d = await getDb().catch(() => null);

    for (const item of offlineQueue) {
      try {
        const res = await fetch("/api/evening-log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            actions: item.actions,
            measurements: item.measurements,
            notes: item.notes,
          }),
        });

        if (res.ok || res.status === 400) {
          // 400 means server rejected (e.g., already logged) — remove from queue anyway
          if (d) await d.delete(STORE_NAME, item.id).catch(() => null);
          set((s) => ({
            offlineQueue: s.offlineQueue.filter((q) => q.id !== item.id),
          }));
        }
      } catch {
        // Still offline — leave in queue, try again later
        break;
      }
    }

    set({ isFlushing: false });
  },
}));
