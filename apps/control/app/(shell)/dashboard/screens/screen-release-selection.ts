type PlaylistAvailability = {
  id: string;
  status: string;
};

type PlaylistRelease = {
  playlistId: string;
  playlistName: string;
  publishedAt: string;
  version: number;
};

export function latestAssignableScreenReleases<T extends PlaylistRelease>(
  releases: readonly T[],
  playlists: readonly PlaylistAvailability[]
) {
  const assignablePlaylistIds = new Set(
    playlists
      .filter((playlist) => playlist.status !== "archived")
      .map((playlist) => playlist.id)
  );
  const latestByPlaylist = new Map<string, T>();

  for (const release of releases) {
    if (!assignablePlaylistIds.has(release.playlistId)) continue;
    const current = latestByPlaylist.get(release.playlistId);
    if (!current || isNewerRelease(release, current)) {
      latestByPlaylist.set(release.playlistId, release);
    }
  }

  return [...latestByPlaylist.values()].sort((left, right) =>
    left.playlistName.localeCompare(right.playlistName, "nl") ||
    left.playlistId.localeCompare(right.playlistId)
  );
}

function isNewerRelease(left: PlaylistRelease, right: PlaylistRelease) {
  if (left.version !== right.version) return left.version > right.version;
  return left.publishedAt > right.publishedAt;
}
