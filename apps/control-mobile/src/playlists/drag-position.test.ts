import { describe, expect, it } from "vitest";

import { playlistDropTarget } from "./drag-position";

describe("playlist drag target", () => {
  it("maps vertical movement to a bounded playlist position", () => {
    expect(
      playlistDropTarget({
        currentIndex: 2,
        itemCount: 6,
        itemStride: 100,
        translationY: 210
      })
    ).toBe(4);
    expect(
      playlistDropTarget({
        currentIndex: 2,
        itemCount: 6,
        itemStride: 100,
        translationY: -800
      })
    ).toBe(0);
    expect(
      playlistDropTarget({
        currentIndex: 2,
        itemCount: 6,
        itemStride: 100,
        translationY: 800
      })
    ).toBe(5);
  });

  it("keeps the current position below the drag threshold", () => {
    expect(
      playlistDropTarget({
        currentIndex: 3,
        itemCount: 7,
        itemStride: 100,
        translationY: 38
      })
    ).toBe(3);
  });
});
