import "server-only";
import { createControlSupabaseClient } from "../../../../../lib/supabase/server";
import type { YouTubeWorkspaceAsset, YouTubeWorkspaceSource } from "./types";

export async function loadYouTubeWorkspace(tenantId: string): Promise<{ assets: YouTubeWorkspaceAsset[]; enabled: boolean; sources: YouTubeWorkspaceSource[]; failed: boolean }> {
  const supabase = await createControlSupabaseClient();
  if (!supabase || !tenantId) return { assets: [], enabled: false, sources: [], failed: true };
  const [flag, sources, assets] = await Promise.all([
    supabase.from("tenant_feature_flags").select("enabled").eq("tenant_id", tenantId).eq("flag_key", "youtube_integration").maybeSingle(),
    supabase.from("youtube_sources").select("id,video_id,title,channel_title,fallback_media_asset_id,validation_status,embeddable,status,playlist_id,playlist_video_ids,playlist_repeat,playlist_unavailable_count,revision").eq("tenant_id", tenantId).in("status", ["active", "paused"]).order("updated_at", { ascending: false }),
    supabase.from("media_assets").select("id,title,kind").eq("tenant_id", tenantId).eq("status", "ready").is("deleted_at", null).order("title").limit(200)
  ]);
  const items: YouTubeWorkspaceAsset[] = assets.data ?? [];
  const variants = items.length ? await supabase.from("media_variants").select("asset_id,variant_type,storage_bucket,storage_path").eq("tenant_id", tenantId).in("asset_id", items.map(item => item.id)).in("variant_type", ["original", "player_1080p", "thumbnail"]) : { data: [], error: null };
  const resolved = await Promise.all(items.map(async item => {
    const candidates = (variants.data ?? []).filter(variant => variant.asset_id === item.id);
    const playable = candidates.find(variant => variant.variant_type === (item.kind === "video" ? "player_1080p" : "original"));
    const poster = candidates.find(variant => variant.variant_type === "thumbnail");
    if (!playable) return null;
    const [url, thumbnail] = await Promise.all([
      supabase.storage.from(playable.storage_bucket).createSignedUrl(playable.storage_path, 3_600),
      poster ? supabase.storage.from(poster.storage_bucket).createSignedUrl(poster.storage_path, 3_600) : Promise.resolve({ data: null })
    ]);
    return { ...item, ...(url.data?.signedUrl ? { url: url.data.signedUrl } : {}), ...(thumbnail.data?.signedUrl ? { posterUrl: thumbnail.data.signedUrl } : {}) };
  }));
  return { assets: resolved.filter((item): item is YouTubeWorkspaceAsset => item !== null), enabled: flag.data?.enabled === true, sources: (sources.data ?? []) as YouTubeWorkspaceSource[], failed: Boolean(flag.error || sources.error || assets.error || variants.error) };
}
