import { describe, expect, it } from "vitest";

import {
  minimumPlaylistItemCardContentWidth,
  playlistItemActionLayout,
  playlistItemActionRailWidth
} from "./action-layout";

describe("playlist item action layout", () => {
  it("uses stable semantic columns that fit the smallest supported card", () => {
    expect(playlistItemActionLayout).toEqual({
      deleteWidth: 90,
      fitWidth: 68,
      gap: 6,
      moveWidth: 91
    });
    expect(playlistItemActionRailWidth).toBe(261);
    expect(minimumPlaylistItemCardContentWidth).toBe(262);
    expect(playlistItemActionRailWidth).toBeLessThanOrEqual(
      minimumPlaylistItemCardContentWidth
    );
  });
});
