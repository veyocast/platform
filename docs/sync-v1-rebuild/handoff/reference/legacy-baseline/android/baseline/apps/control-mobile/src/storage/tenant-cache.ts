import * as SQLite from "expo-sqlite";
import { z } from "zod";

const cacheRowSchema = z.object({
  payload: z.string(),
  stored_at: z.string()
});

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

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
  try {
    const db = await database();
    await db.runAsync(
      "DELETE FROM tenant_cache WHERE tenant_id = ?",
      tenantId
    );
  } catch {
    // Logout and tenant switching continue even without SQLite.
  }
}

export async function clearAllTenantCaches() {
  try {
    const db = await database();
    await db.runAsync("DELETE FROM tenant_cache");
  } catch {
    // Secure auth state is cleared separately and remains authoritative.
  }
}
