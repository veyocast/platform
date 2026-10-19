import "server-only";
import { randomUUID } from "node:crypto";
import { mediaFrameSettingsSchema } from "@veyocast/contracts";
import type { createControlSupabaseClient } from "../../../../lib/supabase/server";
import { readContentPlacement, type ContentItem } from "./model";

export const contentLibraryColumns = "id,content_key,title,kind,family,status,archived,orientation,duration_seconds,updated_at,width,height,preview_asset_id,placement,revision,media_frame_id,media_frame_version_id";
export type ContentDataClient = NonNullable<Awaited<ReturnType<typeof createControlSupabaseClient>>>;
export type ContentLibraryRow = {
  id: string; content_key: string; title: string; kind: string; family: string;
  status: string; archived: boolean; orientation: string | null;
  duration_seconds: number | string | null; updated_at: string;
  width: number | null; height: number | null; preview_asset_id: string | null;
  placement: unknown; revision: number | string | null;
  media_frame_id: string | null; media_frame_version_id: string | null;
};

/** Shared original Content mapping: IDs, hrefs and private signing remain the
 * same for the library and the bounded all-content editor filmstrip. */
export async function mapContentLibraryRows(client: ContentDataClient | null, tenantId: string, rows: ContentLibraryRow[]): Promise<ContentItem[]> {
  const ids = [
    ...new Set(
      rows.flatMap((row) =>
        row.preview_asset_id ? [String(row.preview_asset_id)] : [],
      ),
    ),
  ];
  const variants =
    client && ids.length
      ? await client
          .from("media_variants")
          .select("asset_id,storage_path,variant_type")
          .eq("tenant_id", tenantId)
          .in("asset_id", ids)
          .in("variant_type", ["original", "thumbnail"])
          .like("mime_type", "image/%")
          .order("variant_type")
      : null;
  const previews = new Map<string, string>();
  if (client && variants?.data?.length) {
    const safe = variants.data.filter((v) =>
      v.storage_path.startsWith(
        `tenants/${tenantId}/assets/${v.asset_id}/`,
      ),
    );
    const signed = await client.storage.from("tenant-media").createSignedUrls(
      safe.map((v) => v.storage_path),
      600,
    );
    for (const [index, variant] of safe.entries()) {
      const url = signed.data?.[index]?.signedUrl;
      if (url) previews.set(variant.asset_id, url);
    }
  }
  const items: ContentItem[] = rows.map((item) => ({
    id: item.id,
    key: item.content_key,
    title: item.title,
    kind: item.kind,
    family: item.family,
    status: item.status,
    archived: item.archived,
    orientation: item.orientation,
    duration:
      item.duration_seconds === null ? null : Number(item.duration_seconds),
    width: item.width,
    height: item.height,
    preview: item.preview_asset_id ? previews.get(item.preview_asset_id) ?? null : null,
    href:
      item.kind === "media"
        ? item.media_frame_id ? `/dashboard/content/media/${item.media_frame_id}` : ["ready", "archived"].includes(item.status) ? `/dashboard/content/media/source/${item.id}` : `/dashboard/media?asset=${item.id}`
        : item.kind === "dynamic"
          ? ["menu", "price_list"].includes(item.family)
            ? `/dashboard/slides/menu-studio/${item.id}`
            : `/dashboard/slides/${item.id}`
          : `/dashboard/studio/${item.id}`,
    placement: readContentPlacement(item.placement),
    revision: item.revision === null ? null : Number(item.revision),
    restoreKey: item.archived && item.kind === "media" ? randomUUID() : undefined,
    mediaFrameId: item.media_frame_id ?? undefined,
    mediaFrameVersionId: item.media_frame_version_id ?? undefined,
  }));
  const studioIds = items.filter(item => item.kind === "studio").map(item => item.id);
  const frameIds = items.flatMap(item => item.mediaFrameId ? [item.mediaFrameId] : []);
  if (client && frameIds.length) {
    const versionIds = items.flatMap(item => item.mediaFrameVersionId ? [item.mediaFrameVersionId] : []);
    const [versions, refs] = await Promise.all([
      client.from("media_frame_versions").select("id,frame_id,settings_json").eq("tenant_id", tenantId).in("id", versionIds),
      client.from("media_frame_version_assets").select("version_id,role,media_asset_id,storage_bucket,storage_path,mime_type,checksum_sha256").eq("tenant_id", tenantId).in("version_id", versionIds),
    ]);
    const safeRefs = !refs.error ? (refs.data ?? []).filter(ref => ref.storage_bucket === "tenant-media" && typeof ref.storage_path === "string" && ref.storage_path.startsWith(`tenants/${tenantId}/assets/${ref.media_asset_id}/`) && !ref.storage_path.split("/").some((part: string) => part === "." || part === "..") && !(/[\\?#]/.test(ref.storage_path) || Array.from(ref.storage_path).some(character => character.charCodeAt(0) < 32))) : [];
    const paths = [...new Set(safeRefs.map(ref => String(ref.storage_path)))];
    const urls = paths.length ? await client.storage.from("tenant-media").createSignedUrls(paths, 600) : null;
    const byPath = new Map(paths.map((path, index) => [path, urls?.data?.[index]?.signedUrl]));
    for (const item of items.filter(item => item.mediaFrameId)) {
      item.preview = null;
      const version = !versions.error ? versions.data.find(row => row.id === item.mediaFrameVersionId && row.frame_id === item.mediaFrameId) : undefined;
      const parsed = mediaFrameSettingsSchema.safeParse(version?.settings_json);
      if (!parsed.success) continue;
      const settings = parsed.data, choice = settings.appearance.background;
      item.themeName = settings.appearance.themeId === "fieldflow" ? "FieldFlow" : "OnzeTrots TV";
      const main = safeRefs.find(ref => ref.version_id === item.mediaFrameVersionId && ref.role === "media");
      const background = choice.kind === "image" ? safeRefs.find(ref => ref.version_id === item.mediaFrameVersionId && ref.role === "background" && ref.media_asset_id === choice.mediaAssetId && ref.mime_type.startsWith("image/")) : undefined;
      const sourceUrl = main ? byPath.get(main.storage_path) : undefined, backgroundUrl = background ? byPath.get(background.storage_path) : undefined;
      if (!main || !sourceUrl || choice.kind === "image" && (!backgroundUrl || !/^[a-f0-9]{64}$/.test(String(background?.checksum_sha256)))) continue;
      item.mediaFramePreview = { settings, sourceUrl, kind: main.mime_type === "video/mp4" ? "video" : "image", ...(backgroundUrl ? { backgroundUrl, backgroundChecksumSha256: background!.checksum_sha256 } : {}) };
    }
  }
  if (client && studioIds.length) {
    const themes = await client.from("studio_project_drafts").select("project_id,theme:document_json->syncPresentation->>theme")
      .eq("tenant_id", tenantId).in("project_id", studioIds);
    if (!themes.error) for (const item of items) {
      const theme = themes.data.find(row => row.project_id === item.id)?.theme;
      item.themeName = theme === "fieldflow" ? "FieldFlow" : theme === "onzetrots-tv" ? "OnzeTrots TV" : null;
    }
  }
  return items;
}
