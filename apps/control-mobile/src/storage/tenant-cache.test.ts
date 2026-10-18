import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
const db = vi.hoisted(() => ({ execAsync: vi.fn(), runAsync: vi.fn(), getFirstAsync: vi.fn() }));
vi.mock("expo-sqlite", () => ({ openDatabaseAsync: async () => db }));
import { clearAllTenantCaches, clearTenantCache, readRequiredTenantCache, tenantCacheGeneration, writeRequiredTenantCache } from "./tenant-cache";
beforeEach(() => { db.execAsync.mockResolvedValue(undefined); db.runAsync.mockReset().mockResolvedValue(undefined); db.getFirstAsync.mockReset(); });
describe("native durable command recovery boundary", () => {
  it("reports failed persistence instead of allowing an unjournaled command", async () => {
    db.runAsync.mockRejectedValueOnce(Error("disk unavailable"));
    await expect(writeRequiredTenantCache("tenant-a", "studio-command", { idempotencyKey: "same-command" })).rejects.toThrow("disk unavailable");
  });
  it("fences an ordinary cache write after a tenant switch cleared its cache", async () => {
    const generation = tenantCacheGeneration("tenant-b");
    await clearTenantCache("tenant-b");
    await expect(writeRequiredTenantCache("tenant-b", "draft", {}, generation)).rejects.toThrow("sessiecontext");
    expect(db.runAsync.mock.calls.filter(([sql]) => String(sql).startsWith("INSERT"))).toHaveLength(0);
  });
  it("preserves the user-scoped exact Studio journal and a closing editor write across tenant switches", async () => {
    const key = "sync-studio-v3:user-a:project-a";
    const generation = tenantCacheGeneration("tenant-e", key);
    await clearTenantCache("tenant-e");
    expect(db.runAsync.mock.calls[0]).toEqual(["DELETE FROM tenant_cache WHERE tenant_id = ? AND cache_key NOT LIKE ?", "tenant-e", "sync-studio-v3:%"]);
    await expect(writeRequiredTenantCache("tenant-e", key, { idempotencyKey: "original-command" }, generation)).resolves.toBeUndefined();
    await clearAllTenantCaches();
    await expect(writeRequiredTenantCache("tenant-e", key, {}, generation)).rejects.toThrow("sessiecontext");
  });
  it("fences a queued editor write after logout", async () => {
    const generation = tenantCacheGeneration("tenant-c");
    await clearAllTenantCaches();
    await expect(writeRequiredTenantCache("tenant-c", "draft", {}, generation)).rejects.toThrow("sessiecontext");
  });

  it("orders closing-editor writes before a remount read and the next uncertain command", async () => {
    const key = "sync-studio-v3:actor:shared-project";
    let release!: () => void;
    let began!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const started = new Promise<void>(resolve => { began = resolve; });
    let stored = "";
    db.runAsync.mockImplementation(async (sql, _tenant, _key, payload) => {
      if (String(sql).startsWith("INSERT")) {
        if (String(payload).includes("old-edit")) { began(); await gate; }
        stored = String(payload);
      }
    });
    db.getFirstAsync.mockImplementation(async () => ({ payload: stored, stored_at: "2026-10-18T00:00:00Z" }));
    const first = writeRequiredTenantCache("tenant-queue", key, { nonce: "old-edit" });
    await started;
    const oldPending = writeRequiredTenantCache("tenant-queue", key, { nonce: "old-pending" });
    const remountRead = readRequiredTenantCache("tenant-queue", key, z.object({ nonce: z.string() }));
    const newPending = writeRequiredTenantCache("tenant-queue", key, { nonce: "new-pending" });
    release();
    await Promise.all([first, oldPending, newPending]);
    expect(await remountRead).toEqual({ nonce: "old-pending" });
    expect(JSON.parse(stored)).toEqual({ nonce: "new-pending" });
  });
  it("finishes a global clear before accepting the next account's journal", async () => {
    let release!: () => void;
    let began!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const started = new Promise<void>(resolve => { began = resolve; });
    const order: string[] = [];
    let stored = "";
    db.runAsync.mockImplementation(async (sql, tenant, _key, payload) => {
      if (String(sql).startsWith("INSERT") && tenant === "old-account") { order.push("old-insert"); began(); await gate; stored = String(payload); }
      else if (String(sql) === "DELETE FROM tenant_cache") { order.push("delete-all"); stored = ""; }
      else if (String(sql).startsWith("INSERT")) { order.push("new-insert"); stored = String(payload); }
    });
    const old = writeRequiredTenantCache("old-account", "sync-studio-v3:old:project", { nonce: "old" });
    await started;
    const cleared = clearAllTenantCaches();
    const next = writeRequiredTenantCache("new-account", "sync-studio-v3:new:project", { nonce: "new" });
    release();
    await Promise.all([old, cleared, next]);
    expect(order).toEqual(["old-insert", "delete-all", "new-insert"]);
    expect(JSON.parse(stored)).toEqual({ nonce: "new" });
  });
  it("does not silently discard malformed command recovery data", async () => {
    db.getFirstAsync.mockResolvedValue({ payload: "{broken", stored_at: "2026-10-18T00:00:00Z" });
    await expect(readRequiredTenantCache("tenant-d", "command", z.object({ idempotencyKey: z.string() }))).rejects.toThrow();
  });
});
