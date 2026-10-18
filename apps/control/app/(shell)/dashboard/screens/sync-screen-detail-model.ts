import { syncPlaybackEvidence } from "../../../../lib/sync-playback-evidence";
import type { FleetDevice } from "./data";

export type SyncScreenTab = "overview" | "layout" | "hours" | "health" | "device";

/** Keep old bookmarks and existing action redirects within the right task. */
export function syncScreenTab(value?: string): SyncScreenTab {
  if (value === "layout") return "layout";
  if (value === "automation" || value === "hours") return "hours";
  if (value === "health" || value === "activity" || value === "sync") return "health";
  if (value === "device" || value === "player" || value === "settings") return "device";
  return "overview";
}

export function screenPlaybackEvidence(device: FleetDevice | null, now = Date.now()) {
  return syncPlaybackEvidence(device ? {
    active_release_id: device.activeReleaseId,
    desired_release_id: device.desiredReleaseId,
    current_sync_detail: device.syncDetail,
    last_seen_at: device.lastSeenAt,
    last_error_code: device.lastErrorCode,
    status: device.status,
  } : undefined, now);
}

/** Current telemetry must never borrow contact or runtime from an old device. */
export function currentPlayerHeartbeats<T extends { deviceId: string }>(device: Pick<FleetDevice, "id"> | null, history: readonly T[]): T[] {
  return device ? history.filter(heartbeat => heartbeat.deviceId === device.id) : [];
}

/** Platform choices come only from telemetry, including unknown vendor names. */
export function reportedScreenPlatforms(devices: readonly Pick<FleetDevice, "platform">[]) {
  return [...new Set(devices.flatMap(device => device.platform?.trim() ? [device.platform] : []))]
    .sort((left, right) => left.localeCompare(right, "nl-NL"));
}
