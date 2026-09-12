import { sha256Hex } from "./player-cache";
import { createPlayerMediaStore, type PlayerMediaStore } from "./player-media-store";
import type { LedScoresOverlayAsset } from "./ledscores-match-experience";

export const goalAssetCacheName = "veyocast-player-goal-assets-v2";
const maximumAssetBytes = 128 * 1024 * 1024;
const maximumCacheBytes = 256 * 1024 * 1024;
const keyFor = (asset: LedScoresOverlayAsset) => `/__veyocast-goal-cache/${asset.checksum}`;

/** The existing media adapter, with a separate retention budget from playlist LKG. */
export class GoalMediaCache {
  private readonly pending = new Map<string, Promise<void>>();
  private readonly verified = new Set<string>();
  private generation = 0;
  private serial: Promise<void> = Promise.resolve();
  private requiredVideos = new Set<string>();

  setRequiredAssets(assets: readonly LedScoresOverlayAsset[]) {
    this.requiredVideos = new Set(assets.filter((a) => a.mimeType.startsWith("video/")).map(keyFor));
  }
  constructor(
    private readonly store: PlayerMediaStore = createPlayerMediaStore(goalAssetCacheName),
    private readonly fetchMedia: typeof fetch = fetch
  ) {}

  async preload(assets: readonly LedScoresOverlayAsset[]) {
    const generation = this.generation;
    // Sequential work bounds memory and never participates in release activation.
    for (const asset of assets.slice(0, 1000)) {
      if (generation !== this.generation) return;
      try { await this.prepare(asset); } catch { /* Optional asset; retry on the next configuration. */ }
    }
  }

  async prepare(asset: LedScoresOverlayAsset) {
    const key = keyFor(asset);
    if (this.pending.has(key)) return this.pending.get(key);
    const generation = this.generation;
    const operation = this.serial.then(async () => {
      const cached = await this.store.get(key);
      if (cached) {
        const bytes = await cached.arrayBuffer();
        if (bytes.byteLength <= maximumAssetBytes && await sha256Hex(bytes) === asset.checksum) {
          this.verified.add(key); return;
        }
        await this.store.delete(key);
      }
      const response = await this.fetchMedia(asset.url, { signal: AbortSignal.timeout(60000), cache: "no-store" });
      if (!response.ok || !response.body || Number(response.headers.get("content-length")) > maximumAssetBytes) throw new Error("GOAL_ASSET_UNAVAILABLE");
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let length = 0;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          length += value.byteLength;
          if (length > maximumAssetBytes) throw new Error("GOAL_ASSET_TOO_LARGE");
          chunks.push(value);
        }
      } finally { await reader.cancel().catch(() => undefined); }
      const buffer = new Uint8Array(length);
      let offset = 0;
      for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.byteLength; }
      if (await sha256Hex(buffer.buffer) !== asset.checksum || generation !== this.generation) throw new Error("GOAL_ASSET_INVALID");
      await this.makeRoom(length, key);
      await this.store.put(key, new Response(buffer, { headers: { "Content-Type": asset.mimeType, "Content-Length": String(length) } }));
      this.verified.add(key);
    }).finally(() => this.pending.delete(key));
    this.serial = operation.catch(() => undefined);
    this.pending.set(key, operation);
    return operation;
  }

  async localUrl(asset: LedScoresOverlayAsset): Promise<string | null> {
    const key = keyFor(asset);
    try {
      const response = await this.store.get(key);
      if (!response) { void this.prepare(asset).catch(() => undefined); return null; }
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength > maximumAssetBytes || (!this.verified.has(key) && await sha256Hex(bytes) !== asset.checksum)) {
        await this.store.delete(key); return null;
      }
      this.verified.add(key);
      return URL.createObjectURL(new Blob([bytes], { type: asset.mimeType }));
    } catch { return null; }
  }

  dispose() { this.generation += 1; this.verified.clear(); }

  private async makeRoom(incoming: number, keep: string) {
    const entries = await Promise.all((await this.store.keys()).map(async (key) => ({
      key, bytes: Number((await this.store.get(key))?.headers.get("Content-Length") ?? maximumAssetBytes)
    })));
    let total = entries.reduce((sum, entry) => sum + entry.bytes, incoming);
    for (const entry of entries) {
      if (total <= maximumCacheBytes) break;
      if (entry.key === keep || this.requiredVideos.has(entry.key)) continue;
      await this.store.delete(entry.key); this.verified.delete(entry.key); total -= entry.bytes;
    }
    if (total > maximumCacheBytes) throw new Error("GOAL_ASSET_CACHE_FULL");
  }
}

export const goalMediaCache = new GoalMediaCache();
