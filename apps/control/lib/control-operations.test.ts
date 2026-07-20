import { describe, expect, it } from "vitest";

import {
  deriveOperationalDashboard,
  type OperationalSource
} from "./control-operations";

const now = new Date("2026-07-20T12:00:00.000Z");

function source(overrides: Partial<OperationalSource> = {}): OperationalSource {
  return {
    devices: [],
    heartbeats: [],
    invitations: [],
    media: [],
    memberCount: 1,
    playlistItems: [],
    playlists: [],
    releases: [],
    screenLimit: 10,
    screens: [],
    ...overrides
  };
}

describe("deriveOperationalDashboard", () => {
  it("derives deduplicated recovery signals from tenant resources", () => {
    const result = deriveOperationalDashboard(source({
      devices: [{
        active_release_id: "release-old",
        desired_release_id: "release-new",
        id: "device-1",
        last_error_at: null,
        last_error_code: null,
        last_seen_at: "2026-07-20T11:20:00.000Z",
        screen_id: "screen-1",
        status: "paired",
        storage_quota_bytes: 100,
        storage_used_bytes: 92
      }],
      invitations: [{ email: "team@example.test", expires_at: "2026-07-21T12:00:00.000Z", id: "invite-1", status: "pending" }],
      media: [{ created_at: "2026-07-20T11:30:00.000Z", id: "asset-1", status: "validation_failed", title: "Entreevideo", validation_error: "unsupported_media_type" }],
      playlists: [{ id: "playlist-1", name: "Welkom", status: "draft", updated_at: "2026-07-20T11:40:00.000Z" }],
      screenLimit: 1,
      screens: [{ assigned_release_id: "release-new", created_at: "2026-07-20T10:00:00.000Z", id: "screen-1", name: "Entree", status: "active" }]
    }), now);

    expect(result.signals.map((signal) => signal.id)).toEqual(expect.arrayContaining([
      "screen-offline:screen-1",
      "sync-timeout:screen-1",
      "storage-pressure:screen-1",
      "media-failed:asset-1",
      "playlist-blocked:playlist-1",
      "invitation-expiry:invite-1",
      "tenant-screen-quota"
    ]));
    expect(new Set(result.signals.map((signal) => signal.id)).size).toBe(result.signals.length);
    expect(result.signals[0]?.severity).toBe("critical");
    expect(result.signals.every((signal) => signal.href.startsWith("/dashboard/"))).toBe(true);
  });

  it("derives onboarding and playback only from real resource state", () => {
    const result = deriveOperationalDashboard(source({
      devices: [{
        active_release_id: "release-1", desired_release_id: "release-1", id: "device-1",
        last_error_at: null, last_error_code: null, last_seen_at: "2026-07-20T11:59:00.000Z",
        screen_id: "screen-1", status: "paired", storage_quota_bytes: null, storage_used_bytes: null
      }],
      heartbeats: [{ active_release_id: "release-1", created_at: "2026-07-20T11:59:30.000Z", runtime_state: "PLAYING", screen_id: "screen-1" }],
      media: [{ created_at: "2026-07-20T11:00:00.000Z", id: "asset-1", status: "ready", title: "Poster", validation_error: null }],
      memberCount: 2,
      playlistItems: [{ media_asset_id: "asset-1", playlist_id: "playlist-1" }],
      playlists: [{ id: "playlist-1", name: "Welkom", status: "published", updated_at: "2026-07-20T11:00:00.000Z" }],
      releases: [{ id: "release-1", playlist_id: "playlist-1", published_at: "2026-07-20T11:30:00.000Z", version: 1 }],
      screens: [{ assigned_release_id: "release-1", created_at: "2026-07-20T10:00:00.000Z", id: "screen-1", name: "Entree", status: "active" }]
    }), now);

    expect(result.onboarding.every((step) => step.complete)).toBe(true);
    expect(result.activePlaybackCount).toBe(1);
    expect(result.onlineScreenCount).toBe(1);
    expect(result.signals).toHaveLength(0);
  });
});
