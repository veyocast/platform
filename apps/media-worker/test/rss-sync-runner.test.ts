import { describe, expect, it, vi } from "vitest";

import {
  SupabaseRssSyncBackend,
  runRssSyncOnce
} from "../src/rss-sync-runner";

describe("scheduled RSS backend", () => {
  it("does not upload or invalidate the same content across 100 source checks", async () => {
    let present = false;
    const upload = vi.fn(async () => { present = true; return { error: null }; });
    const exists = vi.fn(async () => ({ data: present, error: null }));
    const backend = new SupabaseRssSyncBackend("https://supabase.test", "service-role", {
      rpc: vi.fn(), storage: { from: () => ({ upload, exists }) }
    });
    const artifact = { assetId: "content-id", bytes: new Uint8Array([1, 2]), checksumSha256: "a".repeat(64),
      externalId: null, fileSizeBytes: 2, height: 10, width: 10, mimeType: "image/webp" as const,
      role: "provider_logo" as const, storagePath: "tenants/tenant/assets/content-id/rss-provider_logo.webp", title: "Logo" };
    for (let i = 0; i < 100; i += 1) await backend.uploadMedia([artifact]);
    expect(upload).toHaveBeenCalledOnce();
    expect(upload.mock.calls[0]).toEqual([artifact.storagePath, artifact.bytes, {
      cacheControl: "31536000", contentType: "image/webp", upsert: false
    }]);
  });
  it("laat een lege queue ongemoeid", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    const backend = new SupabaseRssSyncBackend(
      "https://supabase.test",
      "service-role",
      { rpc }
    );
    await expect(runRssSyncOnce({
      backend,
      lockTimeoutSeconds: 120,
      workerId: "rss-worker"
    })).resolves.toEqual({ status: "idle" });
    expect(rpc).toHaveBeenCalledOnce();
  });
});
