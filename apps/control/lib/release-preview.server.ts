import "server-only";
import { createControlSupabaseClient } from "./supabase/server";

export type FrozenReleasePreview = { url: string; title: string };

/** A bounded read of the first immutable placement per release; no draft lookup. */
export async function loadFrozenReleasePreviews(tenantId: string, releaseIds: string[]) {
  const previews = new Map<string, FrozenReleasePreview>();
  const ids = [...new Set(releaseIds)].slice(0, 48);
  if (!ids.length) return previews;
  const client = await createControlSupabaseClient();
  if (!client) return previews;
  const result = await client.from("playlist_releases")
    .select("id,items:playlist_release_items(storage_path,storage_bucket,mime_type,asset_title,checksum_sha256,sort_order)")
    .eq("tenant_id", tenantId).in("id", ids).eq("items.enabled", true)
    .order("sort_order", { referencedTable: "items" }).order("id", { referencedTable: "items" })
    .limit(1, { referencedTable: "items" }).limit(48);
  if (result.error) return previews;
  const candidates = (result.data ?? []).flatMap(release => {
    const item = release.items?.[0];
    return item && item.storage_bucket === "tenant-media" && item.mime_type.startsWith("image/") &&
      item.storage_path.startsWith(`tenants/${tenantId}/assets/`) && /^[a-f0-9]{64}$/.test(item.checksum_sha256)
      ? [{ releaseId: release.id, path: item.storage_path, title: item.asset_title }] : [];
  });
  if (!candidates.length) return previews;
  const signed = await client.storage.from("tenant-media").createSignedUrls(candidates.map(item => item.path), 600);
  candidates.forEach((item, index) => {
    const url = signed.data?.[index]?.signedUrl;
    if (url) previews.set(item.releaseId, { url, title: item.title });
  });
  return previews;
}
