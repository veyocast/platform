"use client";

import {
  safeParseStudioDocument,
  type StudioDocument
} from "@veyocast/studio";

type StudioRecoveryRecord = {
  document: StudioDocument;
  draftRevision: number;
  projectId: string;
  savedAt: string;
  tenantId: string;
};

const databaseName = "veyocast-studio-recovery";
const databaseVersion = 1;
const storeName = "drafts";

export async function readStudioRecovery(
  tenantId: string,
  projectId: string
): Promise<StudioRecoveryRecord | null> {
  const database = await openDatabase();
  const value = await requestValue<unknown>(
    database
      .transaction(storeName, "readonly")
      .objectStore(storeName)
      .get(recoveryKey(tenantId, projectId))
  );
  database.close();
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<StudioRecoveryRecord>;
  const parsed = safeParseStudioDocument(record.document);
  if (
    !parsed.success ||
    record.projectId !== projectId ||
    record.tenantId !== tenantId ||
    typeof record.savedAt !== "string" ||
    !Number.isSafeInteger(record.draftRevision)
  ) {
    return null;
  }
  return {
    document: parsed.data,
    draftRevision: Number(record.draftRevision),
    projectId,
    savedAt: record.savedAt,
    tenantId
  };
}

export async function writeStudioRecovery(
  record: StudioRecoveryRecord
): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(storeName, "readwrite");
  transaction
    .objectStore(storeName)
    .put(record, recoveryKey(record.tenantId, record.projectId));
  await transactionDone(transaction);
  database.close();
}

export async function clearStudioRecovery(
  tenantId: string,
  projectId: string
): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(storeName, "readwrite");
  transaction
    .objectStore(storeName)
    .delete(recoveryKey(tenantId, projectId));
  await transactionDone(transaction);
  database.close();
}

function recoveryKey(tenantId: string, projectId: string) {
  return `${tenantId}:${projectId}`;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, databaseVersion);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(storeName)) {
        request.result.createObjectStore(storeName);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Lokale Studio-opslag openen mislukt."));
  });
}

function requestValue<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Lokale Studio-opslag lezen mislukt."));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(
        transaction.error ?? new Error("Lokale Studio-opslag schrijven mislukt.")
      );
    transaction.onabort = transaction.onerror;
  });
}
