import { describe, expect, it } from "vitest";

import { latestAssignableScreenReleases } from "./screen-release-selection";

type Release = {
  id: string;
  playlistId: string;
  playlistName: string;
  publishedAt: string;
  version: number;
};

const release = (
  id: string,
  playlistId: string,
  version: number,
  publishedAt = `2026-09-${String(Math.min(version, 30)).padStart(2, "0")}T10:00:00.000Z`,
  playlistName = playlistId
): Release => ({ id, playlistId, playlistName, publishedAt, version });

describe("screen release selection", () => {
  it("biedt alleen de nieuwste release per niet-gearchiveerde playlist aan", () => {
    const releases = [
      release("alpha-v1", "alpha", 1),
      release("alpha-v540", "alpha", 540),
      release("beta-v2", "beta", 2, undefined, "Bèta"),
      release("archived-v9", "archived", 9, undefined, "Archief")
    ];

    expect(latestAssignableScreenReleases(releases, [
      { id: "alpha", status: "published" },
      { id: "beta", status: "draft" },
      { id: "archived", status: "archived" }
    ])).toEqual([
      release("alpha-v540", "alpha", 540),
      release("beta-v2", "beta", 2, undefined, "Bèta")
    ]);

    expect(releases).toHaveLength(4);
  });

  it("kiest de hoogste immutable versie ongeacht de aanlevervolgorde", () => {
    expect(latestAssignableScreenReleases([
      release("latest-by-date", "alpha", 6, "2026-09-04T12:00:00.000Z"),
      release("latest-by-version", "alpha", 7, "2026-09-03T12:00:00.000Z")
    ], [{ id: "alpha", status: "published" }])).toEqual([
      release("latest-by-version", "alpha", 7, "2026-09-03T12:00:00.000Z")
    ]);
  });
});
