import { describe, expect, it } from "vitest";

import {
  chunkPlaylistStudioIds,
  mergePlaylistStudioRows
} from "./playlist-studio-query-scope";

describe("playlist Studio query scope", () => {
  it("retains recent playlist ids beyond the PostgREST row limit", () => {
    const ids = Array.from({ length: 1_005 }, (_, index) => `asset-${index}`);

    const chunks = chunkPlaylistStudioIds(ids);

    expect(chunks.every((chunk) => chunk.length <= 100)).toBe(true);
    expect(chunks.flat()).toEqual(ids);
    expect(chunks.at(-1)).toContain("asset-1004");
  });

  it("deduplicates scoped ids and ignores absent provenance", () => {
    expect(
      chunkPlaylistStudioIds(["snapshot-1", null, "snapshot-1", undefined])
    ).toEqual([["snapshot-1"]]);
  });

  it("lets explicitly scoped rows replace an older library row", () => {
    expect(
      mergePlaylistStudioRows(
        [{ id: "asset-1", status: "processing" }],
        [{ id: "asset-1", status: "ready" }, { id: "asset-2", status: "ready" }]
      )
    ).toEqual([
      { id: "asset-1", status: "ready" },
      { id: "asset-2", status: "ready" }
    ]);
  });
});
