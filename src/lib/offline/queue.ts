"use client";

import { openDB } from "idb";

export interface CompletionQueueItem {
  id: string;
  missionId: string;
  profileId: string;
  clientRequestId: string;
  clientCompletedAt: string;
}

const DB_NAME = "hero-habits-offline";
const STORE_NAME = "completion-queue";

async function getDb() {
  return openDB(DB_NAME, 1, {
    upgrade(database) {
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    },
  });
}

export async function enqueueCompletion(item: CompletionQueueItem): Promise<void> {
  const db = await getDb();
  await db.put(STORE_NAME, item);
}

export async function getQueuedCompletions(): Promise<CompletionQueueItem[]> {
  const db = await getDb();
  return db.getAll(STORE_NAME);
}

export async function removeQueuedCompletion(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(STORE_NAME, id);
}

export async function removeQueuedCompletionsForMission(
  profileId: string,
  missionId: string,
): Promise<void> {
  const queued = await getQueuedCompletions();
  if (queued.length === 0) {
    return;
  }

  const db = await getDb();
  const tx = db.transaction(STORE_NAME, "readwrite");
  for (const item of queued) {
    if (item.profileId === profileId && item.missionId === missionId) {
      await tx.store.delete(item.id);
    }
  }
  await tx.done;
}

export async function flushCompletionQueue(
  sender: (item: CompletionQueueItem) => Promise<void>,
): Promise<void> {
  const queued = await getQueuedCompletions();

  for (const item of queued) {
    try {
      await sender(item);
      await removeQueuedCompletion(item.id);
    } catch {
      // Keep pending items for retry when network/service recovers.
    }
  }
}
