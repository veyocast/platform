import "server-only";
import { hasCapability } from "@veyocast/auth";
import { requireTenantControlSession } from "../../../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../../../lib/supabase/server";
import { emptySitesSourceDestinationOptions, type SitesSourceDestinationOptions } from "./sites-source-destination-model";
export async function loadSitesSourceDestinationOptions(): Promise<SitesSourceDestinationOptions> {
  const session = await requireTenantControlSession("tenant.dynamic_slide.write");
  const canPublish = session.isLive && session.tenantStatus === "active" && hasCapability(session.capabilities, "tenant.playlist.write") && hasCapability(session.capabilities, "tenant.playlist.publish");
  if (!session.tenantId || !hasCapability(session.capabilities, "tenant.playlist.read")) return emptySitesSourceDestinationOptions;
  const client = await createControlSupabaseClient();
  if (!client) return { ...emptySitesSourceDestinationOptions, unavailable: true };
  try {
    const [playlists, screens, groups, memberships] = await Promise.all([
      client.from("playlists").select("id,name,revision").eq("tenant_id", session.tenantId).neq("status", "archived").order("name").limit(200),
      client.from("screens").select("id,name,orientation").eq("tenant_id", session.tenantId).is("deleted_at", null).eq("status", "active").order("name").limit(500),
      client.from("screen_groups").select("id,name").eq("tenant_id", session.tenantId).eq("status", "active").order("name").limit(200),
      client.from("screen_group_memberships").select("screen_group_id,screen_id").eq("tenant_id", session.tenantId).limit(5_000)
    ]);
    if (playlists.error || screens.error || groups.error || memberships.error) return { ...emptySitesSourceDestinationOptions, unavailable: true };
    const actualScreens = new Set((screens.data ?? []).map(screen => screen.id));
    return { canPublish, unavailable: false, playlists: (playlists.data ?? []).map(playlist => ({ ...playlist, revision: Number(playlist.revision) })), screens: screens.data ?? [], groups: (groups.data ?? []).map(group => ({ ...group, screenIds: [...new Set((memberships.data ?? []).filter(member => member.screen_group_id === group.id && actualScreens.has(member.screen_id)).map(member => member.screen_id))] })) };
  } catch { return { ...emptySitesSourceDestinationOptions, unavailable: true }; }
}
