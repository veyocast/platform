import "server-only";

import type { TenantOverview } from "../../../lib/control-overview";

export type TodayVisualState =
  | "empty-unconfigured"
  | "partial-error"
  | "full-error"
  | "healthy";

const completeAvailability = {
  audit: true,
  devices: true,
  integrations: true,
  media: true,
  members: true,
  playlists: true,
  screens: true,
  telemetry: true,
  tenant: true
} as const;

export function createTodayVisualFixture(
  state: TodayVisualState
): TenantOverview {
  const now = new Date();
  const recent = new Date(now.getTime() - 60_000).toISOString();
  const earlier = new Date(now.getTime() - 30 * 60_000).toISOString();
  const referencePublishedAt = new Date(now);
  referencePublishedAt.setHours(8, 42, 0, 0);
  const referenceMatchAt = new Date(now);
  referenceMatchAt.setHours(14, 30, 0, 0);
  const base = {
    auditEvents: [],
    availability: completeAvailability,
    devices: [],
    error: false,
    heartbeats: [],
    integrations: {
      dynamicSources: [],
      sportlinkConnections: []
    },
    invitations: [],
    loadState: "complete" as const,
    media: [],
    mediaStorageLimitBytes: 5_000_000_000,
    memberCount: 1,
    playlistItems: [],
    playlists: [],
    releases: [],
    screenLimit: 8,
    screens: [],
    unavailable: []
  } satisfies TenantOverview;

  if (state === "empty-unconfigured") return base;

  if (state === "full-error") {
    const availability = {
      audit: false,
      devices: false,
      integrations: false,
      media: false,
      members: false,
      playlists: false,
      screens: false,
      telemetry: false,
      tenant: false
    } as const;

    return {
      ...base,
      availability,
      error: true,
      loadState: "failed",
      mediaStorageLimitBytes: null,
      screenLimit: 0,
      unavailable: Object.keys(availability)
    };
  }

  const configured = {
    ...base,
    devices: Array.from({ length: 20 }, (_, index) => ({
      active_release_id: index < 7 ? `visual-release-${index + 1}` : null,
      desired_release_id: index < 7 ? `visual-release-${index + 1}` : null,
      id: `visual-device-${index + 1}`,
      last_error_at: null,
      last_error_code: null,
      last_seen_at: recent,
      screen_id: `visual-screen-${index + 1}`,
      status: "paired",
      storage_quota_bytes: 8_000_000_000,
      storage_used_bytes: 1_250_000_000
    })),
    heartbeats: Array.from({ length: 7 }, (_, index) => ({
      active_release_id: `visual-release-${index + 1}`,
      created_at: recent,
      runtime_state: "PLAYING",
      screen_id: `visual-screen-${index + 1}`
    })),
    integrations: {
      dynamicSources: [{
        id: "visual-source-1",
        kind: "rss",
        last_attempt_at: recent,
        last_error_code: null,
        last_successful_sync_at: recent,
        name: "Clubnieuws",
        provider_status: "active",
        status: "active"
      }],
      sportlinkConnections: []
    },
    media: [{
      created_at: earlier,
      file_size_bytes: 18_000_000,
      id: "visual-media-1",
      status: "ready",
      title: "Welkomstscherm",
      validation_error: null
    }],
    memberCount: 3,
    playlistItems: Array.from({ length: 7 }, (_, index) => ({
      media_asset_id: "visual-media-1",
      playlist_id: `visual-playlist-${index + 1}`
    })),
    playlists: [
      ...Array.from({ length: 7 }, (_, index) => ({
        id: `visual-playlist-${index + 1}`,
        name: index === 0 ? "Wedstrijd vandaag" : `Clubprogramma ${index + 1}`,
        status: "published",
        updated_at: earlier
      })),
      {
        id: "visual-playlist-latest",
        name: "Clubnieuws",
        status: "published",
        updated_at: referencePublishedAt.toISOString()
      }
    ],
    releases: [
      {
        id: "visual-release-latest",
        playlist_id: "visual-playlist-latest",
        published_at: referencePublishedAt.toISOString(),
        version: 5
      },
      ...Array.from({ length: 7 }, (_, index) => ({
        id: `visual-release-${index + 1}`,
        playlist_id: `visual-playlist-${index + 1}`,
        published_at: index === 0 ? referenceMatchAt.toISOString() : earlier,
        version: 7 - index
      }))
    ],
    screenLimit: 30,
    screens: Array.from({ length: 20 }, (_, index) => ({
      assigned_playlist_id: index < 7 ? `visual-playlist-${index + 1}` : null,
      assigned_release_id: index < 7 ? `visual-release-${index + 1}` : null,
      created_at: earlier,
      id: `visual-screen-${index + 1}`,
      location: index === 0 ? "Clubhuis" : `Zone ${index + 1}`,
      name: index === 0 ? "Clubhuis" : `Scherm ${index + 1}`,
      status: "active"
    }))
  } satisfies TenantOverview;

  if (state === "partial-error") {
    return {
      ...configured,
      availability: {
        ...completeAvailability,
        integrations: false
      },
      error: true,
      integrations: {
        dynamicSources: [],
        sportlinkConnections: []
      },
      loadState: "partial",
      unavailable: ["integrations"]
    };
  }

  return configured;
}

export function resolveTodayVisualState(
  value: string | undefined
): TodayVisualState | "loading" | null {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.FIELDFLOW_VISUAL_QA !== "1"
  ) {
    return null;
  }

  if (
    value === "loading" ||
    value === "empty-unconfigured" ||
    value === "partial-error" ||
    value === "full-error" ||
    value === "healthy"
  ) {
    return value;
  }

  return null;
}
