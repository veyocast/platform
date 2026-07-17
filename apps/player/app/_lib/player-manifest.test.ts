import { describe, expect, it } from "vitest";

import {
  demoOnlineDeviceToken,
  getPlaybackDurationMs,
  getPlayerManifestForToken
} from "./player-manifest";

describe("player manifest contract", () => {
  it("requires a device token before fetching a manifest", () => {
    const lookup = getPlayerManifestForToken("");

    expect(lookup.ok).toBe(false);
    expect(lookup.status).toBe(401);
    expect(lookup.body.state).toBe("UNPAIRED");
  });

  it("returns a playable demo manifest for a paired online device", () => {
    const lookup = getPlayerManifestForToken(
      demoOnlineDeviceToken,
      "2026-07-17T10:00:00.000Z"
    );

    expect(lookup.ok).toBe(true);

    if (!lookup.ok) {
      throw new Error("expected demo manifest");
    }

    expect(lookup.body.state).toBe("PLAYING");
    expect(lookup.body.device.screenName).toBe("Entree links");
    expect(lookup.body.manifest.items.map((item) => item.kind)).toEqual([
      "image",
      "video",
      "image"
    ]);
    expect(lookup.body.manifest.manifestHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("bounds test playback duration overrides", () => {
    expect(getPlaybackDurationMs({ durationSeconds: 5 }, 100)).toBe(250);
    expect(getPlaybackDurationMs({ durationSeconds: 5 }, 30_000)).toBe(10_000);
    expect(getPlaybackDurationMs({ durationSeconds: 5 })).toBe(5_000);
  });
});
