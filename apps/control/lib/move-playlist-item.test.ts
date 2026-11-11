import { describe, expect, it } from "vitest";
import { movePlaylistItem } from "./move-playlist-item";

describe("playlist item movement", () => {
  const items = ["A", "B", "C", "D"].map(id => ({ id, mediaId: "same-media", duration: 15, schedule: "unchanged" }));
  it("moves only the selected occurrence one step and preserves settings", () => {
    const up = movePlaylistItem(items, "C", -1);
    expect(up.map(item => item.id)).toEqual(["A", "C", "B", "D"]);
    expect(movePlaylistItem(up, "C", 1)).toEqual(items);
    expect(up[1]).toBe(items[2]);
    expect(items.map(item => item.id)).toEqual(["A", "B", "C", "D"]);
  });
  it("never wraps and handles missing or single items", () => {
    expect(movePlaylistItem(items, "A", -1)).toBe(items);
    expect(movePlaylistItem(items, "D", 1)).toBe(items);
    expect(movePlaylistItem(items, "missing", 1)).toBe(items);
    const single = [items[0]!];
    expect(movePlaylistItem(single, "A", -1)).toBe(single);
    expect(movePlaylistItem(single, "A", 1)).toBe(single);
  });
  it("composes rapid movements without losing intermediate order", () => {
    let current = items;
    for (const offset of [-1, -1, 1, 1] as const) current = movePlaylistItem(current, "C", offset);
    expect(current).toEqual(items);
  });
});
