type DeviceEvidence = {
  active_release_id: string | null;
  current_sync_detail?: unknown;
  desired_release_id: string | null;
  last_error_code: string | null;
  last_seen_at: string | null;
  status: string;
};

export function syncPlaybackEvidence(device: DeviceEvidence | undefined, now = Date.now()) {
  const seen = device?.last_seen_at ? Date.parse(device.last_seen_at) : NaN;
  const recent = Number.isFinite(seen) && now - seen >= 0 && now - seen < 5 * 60_000;
  const contact = !device || !Number.isFinite(seen) ? "unknown" : recent ? "online" : "offline";
  const detail = record(device?.current_sync_detail);
  const trace = record(detail?.publicationTrace);
  const frameAt = typeof trace?.firstFrameAt === "string" ? Date.parse(trace.firstFrameAt) : NaN;
  const confirmed = Boolean(device?.status === "paired" && device.active_release_id &&
    trace?.releaseId === device.active_release_id && Number.isFinite(frameAt) && frameAt <= seen && frameAt <= now &&
    !device.last_error_code);
  const desiredConfirmed = confirmed && recent && device!.desired_release_id === device!.active_release_id;
  return { contact, confirmedReleaseId: confirmed ? device!.active_release_id : null,
    confirmedAt: confirmed ? String(trace!.firstFrameAt) : null,
    desiredConfirmed,
    needsAttention: !device || device.status !== "paired" || contact !== "online" || Boolean(device.last_error_code) ||
      Boolean(device.desired_release_id && !desiredConfirmed) };
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
