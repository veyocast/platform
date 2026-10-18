import type { PlaylistBatchOperation } from "@veyocast/contracts";

export type ContentPlacement =
  | { kind: "media"; assetId: string }
  | { kind: "dynamic"; snapshotId: string }
  | { kind: "series"; memberCount: number; revision: number };
export type ContentItem = {
  id: string;
  key: string;
  title: string;
  kind: string;
  family: string;
  status: string;
  archived: boolean;
  orientation: string | null;
  duration: number | null;
  width: number | null;
  height: number | null;
  preview: string | null;
  href: string;
  placement: ContentPlacement | null;
  revision?: number | null;
  themeName?: string | null;
  restoreKey?: string;
};

/** Show actual media proportions; landscape alone does not establish 16:9. */
export function contentFormat(item: Pick<ContentItem, "kind" | "width" | "height" | "orientation">) {
  if (item.kind === "media") {
    const { width, height } = item;
    if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width === null || height === null || width <= 0 || height <= 0) return "Formaat nog onbekend";
    let a = width, b = height;
    while (b) [a, b] = [b, a % b];
    return `${width / a}:${height / a}`;
  }
  return item.orientation === "portrait" ? "9:16" : item.orientation === "landscape" ? "16:9" : item.orientation === "square" ? "1:1" : "Formaat nog onbekend";
}
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
export function readContentPlacement(value: unknown): ContentPlacement | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const p = value as Record<string, unknown>;
  if (
    p.kind === "media" &&
    typeof p.assetId === "string" &&
    uuid.test(p.assetId)
  )
    return { kind: "media", assetId: p.assetId };
  if (
    p.kind === "dynamic" &&
    typeof p.snapshotId === "string" &&
    uuid.test(p.snapshotId)
  )
    return { kind: "dynamic", snapshotId: p.snapshotId };
  if (
    p.kind === "series" &&
    Number.isSafeInteger(p.memberCount) &&
    Number(p.memberCount) > 0 &&
    Number(p.memberCount) <= 20 &&
    Number.isSafeInteger(p.revision) &&
    Number(p.revision) > 0
  )
    return {
      kind: "series",
      memberCount: Number(p.memberCount),
      revision: Number(p.revision),
    };
  return null;
}
/** The server batch validates availability, tenant ownership, revisions and hashes again. */
export function contentPlacementOperations(
  items: readonly ContentItem[],
  newId: () => string,
): PlaylistBatchOperation[] {
  return items.map((item) => {
    if (item.archived || !item.placement)
      throw Error(
        `${item.title} is nog niet gereed. Open het ontwerp om het voor te bereiden; je selectie blijft bewaard.`,
      );
    const p = item.placement;
    if (p.kind === "series") {
      const ids = Array.from({ length: p.memberCount }, newId);
      return {
        operation: "add_studio_series",
        clientId: ids[0]!,
        clientItemIds: ids,
        seriesId: item.id,
        expectedSeriesRevision: p.revision,
      };
    }
    const durationSeconds = Math.min(
      3600,
      Math.max(p.kind === "dynamic" ? 5 : 3, Math.ceil(item.duration ?? 12)),
    );
    return p.kind === "media"
      ? {
          operation: "add_media",
          clientId: newId(),
          mediaAssetId: p.assetId,
          durationSeconds,
        }
      : {
          operation: "add_dynamic",
          clientId: newId(),
          dynamicSlideId: item.id,
          expectedSnapshotId: p.snapshotId,
          durationSeconds,
        };
  });
}
