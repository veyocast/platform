import { deriveScreenContactStatus, validScreenTimestamp } from "@veyocast/domain";
import { syncBinaryFrameConfirmationSchema, syncDomFrameConfirmationSchema } from "@veyocast/contracts";

export type DeviceEvidence = {
  active_release_id: string | null;
  current_sync_detail?: unknown;
  desired_release_id: string | null;
  last_error_code: string | null;
  last_seen_at: string | null;
  status: string;
};

export function syncPlaybackEvidence(device: DeviceEvidence | undefined, now = Date.now(), screenStatus = "active", desiredReleaseId = device?.desired_release_id) {
  const health = deriveScreenContactStatus({ screenStatus, deviceStatus: device?.status, lastSeenAt: device?.last_seen_at }, now);
  const seen = validScreenTimestamp(device?.last_seen_at, now);
  const recent = health.reachable;
  const contact = health.contact;
  const detail = record(device?.current_sync_detail);
  const trace = record(detail?.publicationTrace);
  const frameAt = typeof trace?.firstFrameAt === "string" ? validScreenTimestamp(trace.firstFrameAt, now) : null;
  const confirmed = Boolean(device?.status === "paired" && device.active_release_id &&
    trace?.releaseId === device.active_release_id && frameAt !== null && frameAt <= now &&
    seen !== null && frameAt <= seen);
  const desiredConfirmed = confirmed && recent && !device?.last_error_code && desiredReleaseId === device!.active_release_id;
  const publicationKind = device?.last_error_code ? "error" : desiredConfirmed ? "confirmed"
    : recent && desiredReleaseId && desiredReleaseId !== device?.active_release_id ? "syncing" : "unconfirmed";
  const source = syncDomFrameConfirmationSchema.safeParse(detail?.sourceDataConfirmation);
  const binary = syncBinaryFrameConfirmationSchema.safeParse(detail?.sourceDataConfirmation);
  const reportedSource = seen !== null && device?.status === "paired" ? source.data ?? binary.data ?? null : null;
  return { health, contact, publicationKind, desiredReleaseId: desiredReleaseId ?? null, reportedActiveReleaseId: device?.active_release_id ?? null, reportedSource, reportedSourceAt: reportedSource ? device!.last_seen_at : null,
    confirmedReleaseId: confirmed ? device!.active_release_id : null,
    confirmedAt: confirmed ? String(trace!.firstFrameAt) : null,
    desiredConfirmed,
    needsAttention: !recent || Boolean(device?.last_error_code) ||
      Boolean(desiredReleaseId && !desiredConfirmed) };
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
