import * as Crypto from "expo-crypto";
import * as FileSystem from "expo-file-system/legacy";
import * as SQLite from "expo-sqlite";
import { z } from "zod";

const uploadSchema = z.object({
  created_at: z.string(),
  error_code: z.string().nullable(),
  file_name: z.string(),
  id: z.string().uuid(),
  mime_type: z.enum(["image/jpeg", "image/png", "image/webp"]),
  status: z.enum(["failed", "pending", "uploading"]),
  tenant_id: z.string().uuid(),
  title: z.string(),
  uri: z.string()
});

export type QueuedImageUpload = z.infer<typeof uploadSchema>;

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function database() {
  databasePromise ??= SQLite.openDatabaseAsync("veyocast-control.db");
  const db = await databasePromise;
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS image_upload_queue (
      id TEXT PRIMARY KEY NOT NULL,
      tenant_id TEXT NOT NULL,
      uri TEXT NOT NULL,
      file_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      error_code TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS image_upload_queue_tenant_idx
      ON image_upload_queue(tenant_id, created_at);
  `);
  return db;
}

export async function enqueueImageUpload(input: {
  fileName: string;
  mimeType: QueuedImageUpload["mime_type"];
  sourceUri: string;
  tenantId: string;
  title: string;
}) {
  const id = Crypto.randomUUID();
  const root = `${FileSystem.documentDirectory}control-uploads`;
  await FileSystem.makeDirectoryAsync(root, { intermediates: true });
  const extension = input.fileName.split(".").pop()?.toLowerCase() || "img";
  const uri = `${root}/${id}.${extension}`;
  await FileSystem.copyAsync({ from: input.sourceUri, to: uri });
  const queued = uploadSchema.parse({
    created_at: new Date().toISOString(),
    error_code: null,
    file_name: input.fileName,
    id,
    mime_type: input.mimeType,
    status: "pending",
    tenant_id: input.tenantId,
    title: input.title,
    uri
  });
  const db = await database();
  await db.runAsync(
    `INSERT INTO image_upload_queue
      (id, tenant_id, uri, file_name, mime_type, title, status, error_code, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    queued.id,
    queued.tenant_id,
    queued.uri,
    queued.file_name,
    queued.mime_type,
    queued.title,
    queued.status,
    queued.error_code,
    queued.created_at
  );
  return queued;
}

export async function listImageUploads(tenantId: string) {
  const db = await database();
  const rows = await db.getAllAsync(
    "SELECT * FROM image_upload_queue WHERE tenant_id = ? ORDER BY created_at",
    tenantId
  );
  return rows.flatMap((row) => {
    const parsed = uploadSchema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
}

export async function updateImageUpload(
  id: string,
  status: QueuedImageUpload["status"],
  errorCode: string | null = null
) {
  const db = await database();
  await db.runAsync(
    "UPDATE image_upload_queue SET status = ?, error_code = ? WHERE id = ?",
    status,
    errorCode,
    id
  );
}

export async function completeImageUpload(item: QueuedImageUpload) {
  const db = await database();
  await db.runAsync("DELETE FROM image_upload_queue WHERE id = ?", item.id);
  await FileSystem.deleteAsync(item.uri, { idempotent: true });
}

export async function clearTenantUploadQueue(tenantId: string) {
  const items = await listImageUploads(tenantId);
  const db = await database();
  await db.runAsync(
    "DELETE FROM image_upload_queue WHERE tenant_id = ?",
    tenantId
  );
  await Promise.all(
    items.map((item) =>
      FileSystem.deleteAsync(item.uri, { idempotent: true }).catch(() => null)
    )
  );
}
