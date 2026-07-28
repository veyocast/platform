import { describe, expect, it, vi } from "vitest";

import {
  SupabaseRssSyncBackend,
  runRssSyncOnce
} from "../src/rss-sync-runner";

describe("scheduled RSS backend", () => {
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
