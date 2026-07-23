import { describe, expect, it } from "vitest";

import {
  fallbackPlayerDemoManifest,
  isEligiblePlayerDemoConfiguration
} from "./player-demo-manifest";

describe("safe staging review fallback", () => {
  it("contains a deterministic mixed-media loop using the approved attachment", () => {
    const manifest = fallbackPlayerDemoManifest(
      "2026-07-23T12:00:00.000Z"
    );

    expect(manifest.state).toBe("PLAYING");
    expect(manifest.manifest.items.map((item) => item.kind)).toEqual([
      "image",
      "video",
      "image"
    ]);
    expect(manifest.manifest.items[1]).toMatchObject({
      durationSeconds: 10,
      kind: "video",
      muted: true,
      source: {
        bytes: 12_346_112,
        checksumSha256:
          "204a5193f7a94fa84dbea0f45a37e30bc2d7796f0a917083fc676140202c7396",
        mimeType: "video/mp4",
        url: "/api/player/demo/media"
      }
    });
    expect(manifest.manifest.totalDurationSeconds).toBe(20);
  });

  it("accepts only an active tenant and matching non-archived playlist", () => {
    const configuration = {
      playlist_id: "playlist-1",
      tenant_id: "tenant-1"
    };
    const playlist = {
      id: "playlist-1",
      status: "published",
      tenant_id: "tenant-1"
    };
    const tenant = { id: "tenant-1", status: "active" };

    expect(
      isEligiblePlayerDemoConfiguration({ configuration, playlist, tenant })
    ).toBe(true);
    expect(
      isEligiblePlayerDemoConfiguration({
        configuration,
        playlist: { ...playlist, status: "archived" },
        tenant
      })
    ).toBe(false);
    expect(
      isEligiblePlayerDemoConfiguration({
        configuration,
        playlist,
        tenant: { ...tenant, status: "paused" }
      })
    ).toBe(false);
    expect(
      isEligiblePlayerDemoConfiguration({
        configuration,
        playlist: { ...playlist, tenant_id: "tenant-2" },
        tenant
      })
    ).toBe(false);
  });
});
