import "server-only";

import { createControlSupabaseClient } from "../../../../lib/supabase/server";

export async function loadSponsorHub(tenantId: string) {
  const supabase = await createControlSupabaseClient();
  if (!supabase) return emptySponsorHub;
  const [sponsors, campaigns, positions, creatives, assets, sponsorMedia, plans, screens, events, tasks, opportunities, audit] = await Promise.all([
    supabase.from("sponsors").select("id,name,status,website_url,updated_at").eq("tenant_id", tenantId).order("name"),
    supabase.from("sponsor_campaigns").select("id,sponsor_id,name,status,starts_at,ends_at,weight,submitted_by,approved_by,updated_at").eq("tenant_id", tenantId).order("updated_at", { ascending: false }),
    supabase.from("sponsor_positions").select("id,key,name,mode,enabled").eq("tenant_id", tenantId).order("key"),
    supabase.from("sponsor_creatives").select("id,creative_family_id,position_key,orientation,status,media_asset_id,media_variant_id,storage_bucket,storage_path,mime_type,file_size_bytes,checksum_sha256,created_at").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(500),
    supabase.from("media_assets").select("id,title,kind,width,height").eq("tenant_id", tenantId).eq("status", "ready").is("deleted_at", null).order("created_at", { ascending: false }).limit(100),
    supabase.from("sponsor_media_assets").select("id,sponsor_id,media_asset_id").eq("tenant_id", tenantId).order("created_at", { ascending: false }),
    supabase.from("sponsor_plan_revisions").select("id,version,plan_hash,published_at,expires_at").eq("tenant_id", tenantId).order("version", { ascending: false }).limit(10),
    supabase.from("screens").select("id,name,orientation,status").eq("tenant_id", tenantId).is("deleted_at", null).order("name"),
    supabase.from("sponsor_play_events").select("event_id,campaign_id,played_ms,happened_at").eq("tenant_id", tenantId).gte("happened_at", new Date(Date.now() - 30 * 86400000).toISOString()).order("happened_at", { ascending: false }).limit(5000),
    supabase.from("sponsor_tasks").select("id,title,status,due_at").eq("tenant_id", tenantId).order("due_at"),
    supabase.from("sponsor_opportunities").select("id,name,stage,estimated_value_cents,next_action_at").eq("tenant_id", tenantId).order("updated_at", { ascending: false }),
    supabase.from("sponsor_audit_events").select("id,action,entity_type,created_at").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(50)
  ]);
  const [sets,families] = await Promise.all([
    supabase.from("sponsor_creative_sets").select("id,campaign_id").eq("tenant_id",tenantId).limit(1000),
    supabase.from("sponsor_creative_families").select("id,creative_set_id").eq("tenant_id",tenantId).limit(1000)
  ]);
  const campaignsBySet = new Map((sets.data ?? []).map(set => [set.id,set.campaign_id]));
  const campaignsByFamily = new Map((families.data ?? []).map(family => [family.id,campaignsBySet.get(family.creative_set_id)]));
  const previewUrls = new Map<string,string>();
  const candidates = (creatives.data ?? []).filter(creative => ["draft","approved"].includes(creative.status) && /^(image\/(jpeg|png|webp))$/.test(creative.mime_type) && campaignsByFamily.has(creative.creative_family_id)).slice(0,100);
  if (candidates.length) {
    const assetIds=[...new Set(candidates.map(creative=>creative.media_asset_id))];
    const variantIds=[...new Set(candidates.flatMap(creative=>creative.media_variant_id?[creative.media_variant_id]:[]))];
    const [readyAssets,variants] = await Promise.all([
      supabase.from("media_assets").select("id,storage_bucket,storage_path,mime_type,file_size_bytes,checksum_sha256").eq("tenant_id",tenantId).eq("status","ready").is("deleted_at",null).in("id",assetIds).limit(100),
      variantIds.length?supabase.from("media_variants").select("id,asset_id,storage_bucket,storage_path,mime_type,file_size_bytes,checksum_sha256").eq("tenant_id",tenantId).in("id",variantIds).limit(100):Promise.resolve({data:[],error:null})
    ]);
    const assetsById=new Map((readyAssets.data??[]).map(asset=>[asset.id,asset]));
    const variantsById=new Map((variants.data??[]).map(variant=>[variant.id,variant]));
    if(!readyAssets.error&&!variants.error) for(let offset=0;offset<candidates.length;offset+=10)await Promise.all(candidates.slice(offset,offset+10).map(async creative=>{
      const asset=assetsById.get(creative.media_asset_id);
      const pinned=creative.media_variant_id?variantsById.get(creative.media_variant_id):asset;
      if(!asset||!pinned||("asset_id" in pinned&&pinned.asset_id!==creative.media_asset_id)||creative.storage_bucket!=="tenant-media"||!creative.storage_path.startsWith(`tenants/${tenantId}/assets/${creative.media_asset_id}/`)||creative.storage_path.includes("..")||!Number.isSafeInteger(Number(creative.file_size_bytes))||Number(creative.file_size_bytes)<=0||!/^([a-f0-9]{64})$/.test(creative.checksum_sha256)||pinned.storage_bucket!==creative.storage_bucket||pinned.storage_path!==creative.storage_path||pinned.mime_type!==creative.mime_type||pinned.checksum_sha256!==creative.checksum_sha256||Number(pinned.file_size_bytes)!==Number(creative.file_size_bytes))return;
      try{const signed=await supabase.storage.from("tenant-media").createSignedUrl(creative.storage_path,600);if(!signed.error&&signed.data?.signedUrl)previewUrls.set(creative.id,signed.data.signedUrl);}catch{/* Preview failure never changes a campaign or its publication. */}
    }));
  }
  const linkedCreatives=(creatives.data??[]).map(creative=>({...creative,campaign_id:campaignsByFamily.get(creative.creative_family_id)??null,preview_url:previewUrls.get(creative.id)??null}));
  const results = [sponsors,campaigns,positions,creatives,assets,sponsorMedia,plans,screens,events,tasks,opportunities,audit,sets,families];
  if (results.some((result) => result.error)) console.error("Sponsor Hub laden mislukt", results.map((result) => result.error).filter(Boolean));
  return {
    assets: (assets.data ?? []).filter((asset) => (sponsorMedia.data ?? []).some((item) => item.media_asset_id === asset.id)),
    audit: audit.data ?? [], campaigns: campaigns.data ?? [], creatives: linkedCreatives,
    events: events.data ?? [], opportunities: opportunities.data ?? [], plans: plans.data ?? [], positions: positions.data ?? [],
    screens: screens.data ?? [], sponsorMedia: sponsorMedia.data ?? [], sponsors: sponsors.data ?? [], tasks: tasks.data ?? [],
    tenantAssets: assets.data ?? []
  };
}

const emptySponsorHub = { assets: [], audit: [], campaigns: [], creatives: [], events: [], opportunities: [], plans: [], positions: [], screens: [], sponsorMedia: [], sponsors: [], tasks: [], tenantAssets: [] };
