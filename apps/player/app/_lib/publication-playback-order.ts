import { isPlayerManifestItemPlayable, type PlayerReleaseManifest } from "./player-manifest";

/** A single first pass; subsequent loops use the unchanged published order. */
export function publicationPlaybackOrder(
  active: PlayerReleaseManifest,
  candidate: PlayerReleaseManifest,
  activeIndex: number,
  preserveOrder = false,
  now = Date.now()
): number[] {
  const playable = candidate.items.flatMap((item, index) =>
    isPlayerManifestItemPlayable(item, now) ? [index] : []);
  if (preserveOrder || active.playlistId !== candidate.playlistId) return playable;
  const previous = new Map(active.items.map((item) => [item.sourceItemId ?? item.id, item]));
  const changed = playable.filter((index) => {
    const item = candidate.items[index]!;
    const before = previous.get(item.sourceItemId ?? item.id);
    return !before || (item.contentHash !== undefined && before.contentHash !== item.contentHash);
  });
  if (changed.length) {
    const priority = new Set(changed);
    return [...changed, ...playable.filter((index) => !priority.has(index))];
  }
  const current = active.items[activeIndex];
  const position = current ? playable.findIndex((index) =>
    (candidate.items[index]!.sourceItemId ?? candidate.items[index]!.id) ===
      (current.sourceItemId ?? current.id)) : -1;
  return position < 0 ? playable : [...playable.slice(position + 1), ...playable.slice(0, position + 1)];
}
