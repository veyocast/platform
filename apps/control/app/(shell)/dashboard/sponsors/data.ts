import "server-only";

import { createControlSupabaseClient } from "../../../../lib/supabase/server";

export async function loadSponsorHub(tenantId: string) {
  const supabase = await createControlSupabaseClient();
  if (!supabase) return emptySponsorHub;
  const [sponsors, campaigns, positions, creatives, assets, sponsorMedia, plans, screens, events, tasks, opportunities, audit] = await Promise.all([
    supabase.from("sponsors").select("id,name,status,website_url,updated_at").eq("tenant_id", tenantId).order("name"),
    supabase.from("sponsor_campaigns").select("id,sponsor_id,name,status,starts_at,ends_at,weight,submitted_by,approved_by,updated_at").eq("tenant_id", tenantId).order("updated_at", { ascending: false }),
    supabase.from("sponsor_positions").select("id,key,name,mode,enabled").eq("tenant_id", tenantId).order("key"),
    supabase.from("sponsor_creatives").select("id,position_key,orientation,status,media_asset_id,created_at").eq("tenant_id", tenantId).order("created_at", { ascending: false }),
    supabase.from("media_assets").select("id,title,kind,width,height").eq("tenant_id", tenantId).eq("status", "ready").is("deleted_at", null).order("created_at", { ascending: false }).limit(100),
    supabase.from("sponsor_media_assets").select("id,sponsor_id,media_asset_id").eq("tenant_id", tenantId).order("created_at", { ascending: false }),
    supabase.from("sponsor_plan_revisions").select("id,version,plan_hash,published_at,expires_at").eq("tenant_id", tenantId).order("version", { ascending: false }).limit(10),
    supabase.from("screens").select("id,name,orientation,status").eq("tenant_id", tenantId).is("deleted_at", null).order("name"),
    supabase.from("sponsor_play_events").select("event_id,campaign_id,played_ms,happened_at").eq("tenant_id", tenantId).gte("happened_at", new Date(Date.now() - 30 * 86400000).toISOString()).order("happened_at", { ascending: false }).limit(5000),
    supabase.from("sponsor_tasks").select("id,title,status,due_at").eq("tenant_id", tenantId).order("due_at"),
    supabase.from("sponsor_opportunities").select("id,name,stage,estimated_value_cents,next_action_at").eq("tenant_id", tenantId).order("updated_at", { ascending: false }),
    supabase.from("sponsor_audit_events").select("id,action,entity_type,created_at").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(50)
  ]);
  const results = [sponsors,campaigns,positions,creatives,assets,sponsorMedia,plans,screens,events,tasks,opportunities,audit];
  if (results.some((result) => result.error)) console.error("Sponsor Hub laden mislukt", results.map((result) => result.error).filter(Boolean));
  return {
    assets: (assets.data ?? []).filter((asset) => (sponsorMedia.data ?? []).some((item) => item.media_asset_id === asset.id)),
    audit: audit.data ?? [], campaigns: campaigns.data ?? [], creatives: creatives.data ?? [],
    events: events.data ?? [], opportunities: opportunities.data ?? [], plans: plans.data ?? [], positions: positions.data ?? [],
    screens: screens.data ?? [], sponsorMedia: sponsorMedia.data ?? [], sponsors: sponsors.data ?? [], tasks: tasks.data ?? [],
    tenantAssets: assets.data ?? []
  };
}

const emptySponsorHub = { assets: [], audit: [], campaigns: [], creatives: [], events: [], opportunities: [], plans: [], positions: [], screens: [], sponsorMedia: [], sponsors: [], tasks: [], tenantAssets: [] };
