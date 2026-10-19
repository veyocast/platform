import "server-only";
import { contentLibraryColumns, mapContentLibraryRows, type ContentDataClient, type ContentLibraryRow } from "../content-data.server";
import { parseMediaFrameSeriesRead } from "./media-frame-series-contract";
import type { ContentFilmstripPage } from "./media-frame-series-types";

export const contentFilmstripPageSize = 48;
export const contentFilmstripMaximumOffset = 2_147_483_600;
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
export const validContentFilmstripOffset = (offset: unknown): offset is number => Number.isSafeInteger(offset) && Number(offset) >= 0 && Number(offset) <= contentFilmstripMaximumOffset;
function validRow(value: unknown): value is ContentLibraryRow {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || !uuid.test(row.id) || typeof row.content_key !== "string" || typeof row.title !== "string" || row.title.length > 400 || typeof row.kind !== "string" || !["media", "dynamic", "studio", "series"].includes(String(row.kind)) || row.archived !== false || typeof row.status !== "string" || typeof row.family !== "string") return false;
  const prefix = row.kind === "media" && row.media_frame_id && row.content_key === `media-frame:${row.id}` ? "media-frame" : row.kind;
  if (row.content_key !== `${prefix}:${row.id}` || row.orientation !== null && !["landscape", "portrait", "square"].includes(String(row.orientation))) return false;
  if (row.media_frame_id !== null && row.media_frame_id !== undefined && (typeof row.media_frame_id !== "string" || !uuid.test(row.media_frame_id))) return false;
  if (row.media_frame_version_id !== null && row.media_frame_version_id !== undefined && (typeof row.media_frame_version_id !== "string" || !uuid.test(row.media_frame_version_id))) return false;
  return true;
}

/** One bounded page of the entire nonarchived library, using the exact existing
 * Content mapper and original resource hrefs. No series-members-only shortcut. */
export async function loadContentFilmstripPage(client: ContentDataClient, tenantId: string, offset = 0): Promise<ContentFilmstripPage | null> {
  if (!uuid.test(tenantId) || !validContentFilmstripOffset(offset)) return null;
  try {
    const result = await client.from("sync_content_library_v1").select(contentLibraryColumns, { count: "exact" })
      .eq("tenant_id", tenantId).eq("archived", false).order("updated_at", { ascending: false }).order("content_key")
      .range(offset, offset + contentFilmstripPageSize - 1);
    if (result.error || !Array.isArray(result.data) || !Number.isSafeInteger(result.count) || result.count === null || result.count < 0 || result.data.length !== Math.min(contentFilmstripPageSize, Math.max(0, result.count - offset)) || !result.data.every(validRow) || new Set(result.data.map(row => row.content_key)).size !== result.data.length) return null;
    const items = await mapContentLibraryRows(client, tenantId, result.data);
    return { offset, total: result.count, hasMore: offset + items.length < result.count, items: items.map(item => ({
      key: item.key, title: item.title, href: item.href, orientation: item.orientation,
      preview: item.mediaFramePreview ? { kind: "media-frame" as const, value: item.mediaFramePreview }
        : item.preview ? { kind: "image" as const, url: item.preview }
          : { kind: "unavailable" as const, message: "Voorbeeld nog niet beschikbaar. Open de inhoud om de status te bekijken." },
    })) };
  } catch { return null; }
}

/** Compare the atomic metadata read to the exact immutable frame snapshot already
 * loaded. A concurrent save must yield a visible reload, never mixed revisions. */
export async function loadMediaFrameSeriesBinding(client: ContentDataClient, tenantId: string, expected: { frameId: string; frameRevision: number; versionId: string; versionNumber: number }) {
  const result = await client.rpc("get_media_frame_series_v1", { p_tenant_id: tenantId, p_frame_id: expected.frameId });
  if (result.error) return null;
  const parsed = parseMediaFrameSeriesRead(result.data, expected.frameId);
  return parsed && parsed.frameRevision === expected.frameRevision && parsed.versionId === expected.versionId && parsed.versionNumber === expected.versionNumber ? { membership: parsed.membership, series: parsed.series } : null;
}
