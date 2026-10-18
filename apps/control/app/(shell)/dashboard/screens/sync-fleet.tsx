import "server-only";
import { loadFrozenReleasePreviews } from "../../../../lib/release-preview.server";
import { syncPlaybackEvidence } from "../../../../lib/sync-playback-evidence";
import { SyncFleetView } from "./sync-fleet-view";

type Props = Omit<Parameters<typeof SyncFleetView>[0], "previews"> & { tenantId?: string | null };

/** The tenant-bound signed-media read stays in the server component. */
export async function SyncFleet({ tenantId, ...props }: Props) {
  const releaseIds = props.screens.flatMap(screen => {
    const device = props.devices.get(screen.id);
    const id = syncPlaybackEvidence(device ? {
      active_release_id: device.activeReleaseId, desired_release_id: device.desiredReleaseId,
      current_sync_detail: device.syncDetail, last_seen_at: device.lastSeenAt,
      last_error_code: device.lastErrorCode, status: device.status
    } : undefined).confirmedReleaseId;
    return id ? [id] : [];
  });
  const previews = tenantId ? await loadFrozenReleasePreviews(tenantId, releaseIds) : new Map();
  return <SyncFleetView {...props} previews={previews} />;
}
