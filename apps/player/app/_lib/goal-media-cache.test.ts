import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { GoalMediaCache } from "./goal-media-cache";
import type { PlayerMediaStore } from "./player-media-store";

function setup() {
  const rows = new Map<string, Response>();
  const store: PlayerMediaStore = { delete: async (key) => rows.delete(key), get: async (key) => rows.get(key)?.clone(), keys: async () => [...rows.keys()], put: async (key, response) => { rows.set(key, response); }, resolvePlaybackUrl: async () => { throw new Error("not used"); } };
  const bytes = new TextEncoder().encode("bounded fixture video");
  const asset = { mediaAssetId: "11111111-1111-4111-8111-111111111111", checksum: createHash("sha256").update(bytes).digest("hex"), mimeType: "video/mp4" as const, url: "https://storage.test/intro.mp4" };
  const fetchMedia = vi.fn<typeof fetch>(async () => new Response(bytes));
  return { rows, asset, fetchMedia, cache: new GoalMediaCache(store, fetchMedia) };
}
describe("goal media retention beside playlist assets", () => {
  it("downloads and verifies once; a refreshed signed URL reuses the same hash", async () => {
    const { cache, asset, fetchMedia, rows } = setup();
    await Promise.all([cache.prepare(asset), cache.prepare(asset)]);
    await cache.prepare({ ...asset, url: "https://storage.test/refreshed.mp4" });
    expect(fetchMedia).toHaveBeenCalledTimes(1);
    expect(rows.size).toBe(1);
    const local = await cache.localUrl(asset);
    expect(local).toMatch(/^blob:/);
    URL.revokeObjectURL(local!);
  });
  it("does not activate corrupt bytes and degrades to no intro", async () => {
    const { cache, asset, rows, fetchMedia } = setup();
    fetchMedia.mockImplementation(async () => new Response("corrupt"));
    await expect(cache.prepare(asset)).rejects.toThrow("GOAL_ASSET_INVALID");
    expect(rows.size).toBe(0);
    expect(await cache.localUrl(asset)).toBeNull();
  });
  it("does not wait for a network download at goal time", async () => {
    const { cache, asset, fetchMedia } = setup();
    fetchMedia.mockImplementation(() => new Promise(() => undefined));
    expect(await cache.localUrl(asset)).toBeNull();
  });
});
