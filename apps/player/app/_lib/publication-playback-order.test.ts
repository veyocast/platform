import { describe, expect, it } from "vitest";
import { getPlayerManifestForToken, type PlayerReleaseManifest } from "./player-manifest";
import { publicationPlaybackOrder } from "./publication-playback-order";

function manifest(): PlayerReleaseManifest {
  const lookup = getPlayerManifestForToken("demo-online");
  if (!lookup.ok) throw new Error("fixture missing");
  const base = lookup.body.manifest;
  return { ...base, items: Array.from({ length: 25 }, (_, index) => ({
    ...base.items[0]!, id: `release-item-${index}`, sourceItemId: `stable-${index}`, contentHash: `content-${index}`
  })) };
}
describe("one publication priority pass", () => {
  it("compares with active content and promotes the changed twentieth item only once", () => {
    const active = manifest();
    const next = structuredClone(active);
    next.items[20]!.contentHash = "changed";
    const order = publicationPlaybackOrder(active, next, 0);
    expect(order[0]).toBe(20);
    expect(new Set(order).size).toBe(25);
    expect(order.slice(1)).toEqual([...Array.from({ length: 20 }, (_, i) => i), 21, 22, 23, 24]);
  });
  it("continues after the active item for order-only changes and filters invisible items", () => {
    const active = manifest();
    const next = structuredClone(active);
    next.items[1]!.enabled = false;
    expect(publicationPlaybackOrder(active, next, 0)[0]).toBe(2);
    next.items = next.items.filter((item) => item.sourceItemId !== "stable-0");
    expect(publicationPlaybackOrder(active, next, 0)).not.toContain(0);
  });
  it("starts at the first eligible item for a different playlist or protected order", () => {
    const active = manifest();
    const next = structuredClone(active);
    next.items[20]!.contentHash = "changed";
    expect(publicationPlaybackOrder(active, next, 0, true)[0]).toBe(0);
    next.playlistId = "other";
    expect(publicationPlaybackOrder(active, next, 10)[0]).toBe(0);
  });
});
