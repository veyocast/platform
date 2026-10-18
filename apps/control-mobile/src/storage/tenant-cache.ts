import * as SQLite from "expo-sqlite";
import { z } from "zod";

const cacheRowSchema = z.object({
  payload: z.string(),
  stored_at: z.string()
});

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;
let allCacheGeneration = 0;
const tenantGenerations = new Map<string, number>();
const requiredOperations = new Map<string, Promise<void>>();
let clearBarrier: Promise<void> = Promise.resolve();
export const tenantCacheGeneration = (tenantId: string, cacheKey = "") => `${allCacheGeneration}:${cacheKey.startsWith("sync-studio-v3:") ? "studio" : tenantGenerations.get(tenantId) ?? 0}`;

function queueRequiredOperation<T>(tenantId: string, cacheKey: string, operation: () => Promise<T>): Promise<T> {
  const identity = JSON.stringify([tenantId, cacheKey]);
  const previous = requiredOperations.get(identity) ?? Promise.resolve();
  const clearing = clearBarrier;
  const result = Promise.all([previous, clearing]).then(operation);
  const settled = result.then(() => undefined, () => undefined);
  requiredOperations.set(identity, settled);
  void settled.then(() => { if (requiredOperations.get(identity) === settled) requiredOperations.delete(identity); });
  return result;
}

async function database() {
  databasePromise ??= SQLite.openDatabaseAsync("veyocast-control.db");
  const db = await databasePromise;
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS tenant_cache (
      tenant_id TEXT NOT NULL,
      cache_key TEXT NOT NULL,
      payload TEXT NOT NULL,
      stored_at TEXT NOT NULL,
      PRIMARY KEY (tenant_id, cache_key)
    );
  `);
  return db;
}

export async function readTenantCache<T>(
  tenantId: string,
  cacheKey: string,
  schema: z.ZodType<T>
): Promise<{ data: T; storedAt: string } | null> {
  try {
    const db = await database();
    const row = await db.getFirstAsync(
      "SELECT payload, stored_at FROM tenant_cache WHERE tenant_id = ? AND cache_key = ?",
      tenantId,
      cacheKey
    );
    const parsedRow = cacheRowSchema.safeParse(row);
    if (!parsedRow.success) return null;
    const parsedData = schema.safeParse(JSON.parse(parsedRow.data.payload));
    return parsedData.success
      ? { data: parsedData.data, storedAt: parsedRow.data.stored_at }
      : null;
  } catch {
    return null;
  }
}

export async function writeTenantCache(
  tenantId: string,
  cacheKey: string,
  value: unknown
) {
  try {
    const db = await database();
    await db.runAsync(
      `INSERT INTO tenant_cache(tenant_id, cache_key, payload, stored_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(tenant_id, cache_key)
       DO UPDATE SET payload = excluded.payload, stored_at = excluded.stored_at`,
      tenantId,
      cacheKey,
      JSON.stringify(value),
      new Date().toISOString()
    );
  } catch {
    // Cache failure may never block live Control operations.
  }
}

export async function clearTenantCache(tenantId: string) {
  tenantGenerations.set(tenantId, (tenantGenerations.get(tenantId) ?? 0) + 1);
  try {
    const db = await database();
    await db.runAsync(
      "DELETE FROM tenant_cache WHERE tenant_id = ? AND cache_key NOT LIKE ?",
      tenantId,
      "sync-studio-v3:%"
    );
  } catch {
    // Logout and tenant switching continue even without SQLite.
  }
}

export function clearAllTenantCaches() {
  allCacheGeneration += 1;
  const earlierClear = clearBarrier;
  const earlierOperations = [...requiredOperations.values()];
  const clearing = earlierClear.then(async () => {
    await Promise.all(earlierOperations);
    const db = await database();
    await db.runAsync("DELETE FROM tenant_cache");
  });
  clearBarrier = clearing.catch(() => {
    // Secure auth state is cleared separately and remains authoritative.
  });
  return clearBarrier;
}

/** Studio command recovery must be durable before a request can leave the device. */
export function writeRequiredTenantCache(tenantId: string, cacheKey: string, value: unknown, generation = tenantCacheGeneration(tenantId, cacheKey)) {
  const payload = JSON.stringify(value);
  return queueRequiredOperation(tenantId, cacheKey, async () => {
  const db = await database();
  if (generation !== tenantCacheGeneration(tenantId, cacheKey)) throw new Error("De lokale sessiecontext is gewijzigd.");
  await db.runAsync(
    `INSERT INTO tenant_cache(tenant_id, cache_key, payload, stored_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(tenant_id, cache_key) DO UPDATE SET payload = excluded.payload, stored_at = excluded.stored_at`,
    tenantId, cacheKey, payload, new Date().toISOString(),
  );
  });
}

export function readRequiredTenantCache<T>(tenantId: string, cacheKey: string, schema: z.ZodType<T>): Promise<T | null> {
  return queueRequiredOperation(tenantId, cacheKey, async () => {
  const db = await database();
  const row = await db.getFirstAsync("SELECT payload, stored_at FROM tenant_cache WHERE tenant_id = ? AND cache_key = ?", tenantId, cacheKey);
  if (!row) return null;
  return schema.parse(JSON.parse(cacheRowSchema.parse(row).payload));
  });
}

export function removeRequiredTenantCache(tenantId: string, cacheKey: string) {
  return queueRequiredOperation(tenantId, cacheKey, async () => {
  const db = await database();
  await db.runAsync("DELETE FROM tenant_cache WHERE tenant_id = ? AND cache_key = ?", tenantId, cacheKey);
  });
}
