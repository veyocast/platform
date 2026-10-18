type ReferenceSource = {
  devices: Array<{ active_release_id: string | null; desired_release_id: string | null }>;
  heartbeats: Array<{ active_release_id: string | null }>;
  screens: Array<{ assigned_release_id: string | null }>;
};

/** A recent-history window must never hide a device's older last-known-good. */
export function missingOverviewReleaseIds(source: ReferenceSource, loaded: Array<{ id: string }>) {
  const known = new Set(loaded.map(release => release.id));
  return [...new Set([
    ...source.devices.flatMap(device => [device.active_release_id, device.desired_release_id]),
    ...source.heartbeats.map(heartbeat => heartbeat.active_release_id),
    ...source.screens.map(screen => screen.assigned_release_id)
  ].filter((id): id is string => Boolean(id)))].filter(id => !known.has(id));
}
