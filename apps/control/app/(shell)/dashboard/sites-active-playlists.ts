import type { TenantOverview } from "../../../lib/control-overview";

/** Counts scoped playlist identities from the latest confirmed screen frames. */
export function countConfirmedActivePlaylists(
  data: Pick<TenantOverview, "heartbeats" | "screens" | "releases" | "playlists">,
  nowMs = Date.now()
): number {
  const screens = new Set(data.screens.filter(screen => screen.status === "active").map(screen => screen.id));
  const playlists = new Set(data.playlists.map(playlist => playlist.id));
  const releases = new Map(data.releases.map(release => [release.id, release.playlist_id]));
  const latest = new Map<string, TenantOverview["heartbeats"][number]>();
  for (const heartbeat of data.heartbeats) {
    const timestamp = Date.parse(heartbeat.created_at);
    if (!screens.has(heartbeat.screen_id) || !Number.isFinite(timestamp)) continue;
    const previous = latest.get(heartbeat.screen_id);
    if (!previous || timestamp > Date.parse(previous.created_at)) latest.set(heartbeat.screen_id, heartbeat);
  }
  const active = new Set<string>();
  for (const heartbeat of latest.values()) {
    const age = nowMs - Date.parse(heartbeat.created_at);
    if (age < 0 || age >= 5 * 60_000 || !heartbeat.active_release_id ||
        !["PLAYING", "OFFLINE_PLAYING", "READY"].includes(heartbeat.runtime_state)) continue;
    const playlistId = releases.get(heartbeat.active_release_id);
    if (playlistId && playlists.has(playlistId)) active.add(playlistId);
  }
  return active.size;
}
