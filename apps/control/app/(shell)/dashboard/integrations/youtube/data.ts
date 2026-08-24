import "server-only";

import { createControlSupabaseClient } from "../../../../../lib/supabase/server";

export async function loadYouTubeWorkspace(tenantId: string) {
  const supabase = await createControlSupabaseClient();
  if (!supabase || !tenantId) return { assets: [], enabled: false, sources: [] };
  const [flag, sources, assets] = await Promise.all([
    supabase.from("tenant_feature_flags").select("enabled").eq("tenant_id",tenantId).eq("flag_key","youtube_integration").maybeSingle(),
    supabase.from("youtube_sources").select("id,video_id,title,channel_title,fallback_media_asset_id,validation_status,embeddable,online_only,status,updated_at").eq("tenant_id",tenantId).eq("status","active").order("updated_at",{ ascending:false }),
    supabase.from("media_assets").select("id,title,kind").eq("tenant_id",tenantId).eq("status","ready").is("deleted_at",null).order("title").limit(200)
  ]);
  return { assets: assets.data ?? [], enabled: flag.data?.enabled === true, sources: sources.data ?? [] };
}
