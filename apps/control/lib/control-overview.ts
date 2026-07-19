import "server-only";

import { createControlSupabaseClient } from "./supabase/server";

export type TenantOverview = Awaited<ReturnType<typeof loadTenantOverview>>;

export async function loadTenantOverview(tenantId: string) {
  const supabase = await createControlSupabaseClient();
  if (!supabase) return tenantOverviewFailure();

  const [screens, devices, playlists, media, releases, audit] = await Promise.all([
    supabase
      .from("screens")
      .select("id, name, location, status, assigned_playlist_id, assigned_release_id")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: true }),
    supabase
      .from("player_devices")
      .select("screen_id, status, active_release_id, desired_release_id, last_seen_at, storage_used_bytes, storage_quota_bytes")
      .eq("tenant_id", tenantId)
      .neq("status", "revoked"),
    supabase
      .from("playlists")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .neq("status", "archived"),
    supabase
      .from("media_assets")
      .select("file_size_bytes, status")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null),
    supabase
      .from("playlist_releases")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId),
    supabase
      .from("audit_events")
      .select("id, action, target_type, result, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(5)
  ]);

  if ([screens.error, devices.error, playlists.error, media.error, releases.error, audit.error].some(Boolean)) {
    return tenantOverviewFailure();
  }

  return {
    auditEvents: audit.data ?? [],
    error: false,
    media: media.data ?? [],
    playlistCount: playlists.count ?? 0,
    releaseCount: releases.count ?? 0,
    devices: devices.data ?? [],
    screens: screens.data ?? []
  };
}

export async function loadPlatformOverview() {
  const supabase = await createControlSupabaseClient();
  if (!supabase) return platformOverviewFailure();

  const [tenants, screens, devices] = await Promise.all([
    supabase
      .from("tenants")
      .select("id, name, slug, status, screen_limit, created_at")
      .order("created_at", { ascending: true }),
    supabase.from("screens").select("tenant_id, status"),
    supabase
      .from("player_devices")
      .select("tenant_id, status, last_seen_at")
      .neq("status", "revoked")
  ]);

  if (tenants.error || screens.error || devices.error) {
    return platformOverviewFailure();
  }

  return {
    devices: devices.data ?? [],
    error: false,
    screens: screens.data ?? [],
    tenants: tenants.data ?? []
  };
}

export async function loadTenantMembers(tenantId: string) {
  const supabase = await createControlSupabaseClient();
  if (!supabase) return { error: true, members: [] };

  const memberships = await supabase
    .from("tenant_memberships")
    .select("user_id, role, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true });

  if (memberships.error) return { error: true, members: [] };

  const userIds = (memberships.data ?? []).map((membership) => membership.user_id);
  const profiles = userIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", userIds)
    : { data: [], error: null };

  if (profiles.error) return { error: true, members: [] };

  const displayNames = new Map(
    (profiles.data ?? []).map((profile) => [profile.id, profile.display_name])
  );

  return {
    error: false,
    members: (memberships.data ?? []).map((membership) => ({
      ...membership,
      display_name: displayNames.get(membership.user_id) ?? null
    }))
  };
}

export async function loadTenantAuditEvents(tenantId: string) {
  const supabase = await createControlSupabaseClient();
  if (!supabase) return { error: true, events: [] };

  const events = await supabase
    .from("audit_events")
    .select("id, actor_user_id, action, target_type, target_id, result, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(100);

  return events.error
    ? { error: true, events: [] }
    : { error: false, events: events.data ?? [] };
}

function tenantOverviewFailure() {
  return {
    auditEvents: [],
    devices: [],
    error: true,
    media: [],
    playlistCount: 0,
    releaseCount: 0,
    screens: []
  };
}

function platformOverviewFailure() {
  return { devices: [], error: true, screens: [], tenants: [] };
}
