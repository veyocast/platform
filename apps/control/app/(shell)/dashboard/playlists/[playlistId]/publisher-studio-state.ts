import type { PlaylistStudioItem } from "../playlist-studio-contract";

export type StudioOrderSnapshot = string[];

export type StudioOrderHistory = {
  future: StudioOrderSnapshot[];
  past: StudioOrderSnapshot[];
};

export function itemOrder(items: Pick<PlaylistStudioItem, "id">[]): StudioOrderSnapshot {
  return items.map((item) => item.id);
}

export function reorderItems(
  items: PlaylistStudioItem[],
  activeId: string,
  overId: string
): PlaylistStudioItem[] {
  const from = items.findIndex((item) => item.id === activeId);
  const to = items.findIndex((item) => item.id === overId);
  if (from < 0 || to < 0 || from === to) return items;

  const next = [...items];
  const [moved] = next.splice(from, 1);
  if (!moved) return items;
  next.splice(to, 0, moved);
  return next;
}

export function restoreOrder(
  items: PlaylistStudioItem[],
  order: StudioOrderSnapshot
): PlaylistStudioItem[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  const ordered = order.flatMap((id) => {
    const item = byId.get(id);
    return item ? [item] : [];
  });
  const unknown = items.filter((item) => !order.includes(item.id));
  return [...ordered, ...unknown];
}

export function durationStep(
  durationSeconds: number,
  direction: "decrease" | "increase",
  maximumSeconds = 3600
) {
  const next = durationSeconds + (direction === "increase" ? 1 : -1);
  return Math.min(maximumSeconds, Math.max(5, next));
}

export function maximumItemDuration(
  item: Pick<
    PlaylistStudioItem,
    "asset" | "trimEndSeconds" | "trimStartSeconds"
  >
) {
  if (item.asset?.kind !== "video") return 3600;
  const sourceEnd =
    item.trimEndSeconds ?? item.asset.variant?.durationSeconds ?? null;
  if (sourceEnd === null) return 3600;
  return Math.max(
    5,
    Math.min(3600, Math.ceil(sourceEnd - item.trimStartSeconds))
  );
}
