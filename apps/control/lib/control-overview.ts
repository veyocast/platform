import "server-only";

import { createControlSupabaseClient } from "./supabase/server";

export type TenantOverview = Awaited<ReturnType<typeof loadTenantOverview>>;

export async function loadTenantOverview(tenantId: string) {
  const supabase = await createControlSupabaseClient();
  if (!supabase) return tenantOverviewFailure();

  const [screens, devices, playlists, playlistItems, media, releases, audit, invitations, members, tenant, heartbeats] = await Promise.all([
    supabase
      .from("screens")
      .select("id, name, location, status, assigned_playlist_id, assigned_release_id, created_at")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true }),
    supabase
      .from("player_devices")
      .select("id, screen_id, status, active_release_id, desired_release_id, last_seen_at, storage_used_bytes, storage_quota_bytes, last_error_code, last_error_at")
      .eq("tenant_id", tenantId)
      .neq("status", "revoked"),
    supabase
      .from("playlists")
      .select("id, name, status, updated_at")
      .eq("tenant_id", tenantId)
      .neq("status", "archived"),
    supabase
      .from("playlist_items")
      .select("playlist_id, media_asset_id")
      .eq("tenant_id", tenantId),
    supabase
      .from("media_assets")
      .select("id, title, file_size_bytes, status, validation_error, created_at")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null),
    supabase
      .from("playlist_releases")
      .select("id, playlist_id, version, published_at")
      .eq("tenant_id", tenantId)
      .order("published_at", { ascending: false })
      .limit(20),
    supabase
      .from("audit_events")
      .select("id, action, target_type, result, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("tenant_invitations")
      .select("id, email, status, expires_at")
      .eq("tenant_id", tenantId)
      .eq("status", "pending"),
    supabase
      .from("tenant_memberships")
      .select("user_id", { count: "exact", head: true })
      .eq("tenant_id", tenantId),
    supabase
      .from("tenants")
      .select("screen_limit")
      .eq("id", tenantId)
      .maybeSingle(),
    supabase
      .from("player_heartbeats")
      .select("screen_id, active_release_id, runtime_state, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(250)
  ]);

  if ([screens.error, devices.error, playlists.error, playlistItems.error, media.error, releases.error, audit.error, invitations.error, members.error, tenant.error, heartbeats.error].some(Boolean)) {
    return tenantOverviewFailure();
  }

  return {
    auditEvents: audit.data ?? [],
    heartbeats: heartbeats.data ?? [],
    invitations: invitations.data ?? [],
    memberCount: members.count ?? 0,
    error: false,
    media: media.data ?? [],
    playlistItems: playlistItems.data ?? [],
    playlists: playlists.data ?? [],
    releases: releases.data ?? [],
    screenLimit: tenant.data?.screen_limit ?? 0,
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
    supabase.from("screens").select("tenant_id, status").is("deleted_at", null),
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

export async function loadTenantTeam(tenantId: string) {
  const supabase = await createControlSupabaseClient();
  if (!supabase) return { error: true, invitations: [], members: [] };

  const [memberResult, invitations] = await Promise.all([
    loadTenantMembers(tenantId),
    supabase
      .from("tenant_invitations")
      .select("id, email, role, status, delivery_status, send_attempt_count, expires_at, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
  ]);

  if (memberResult.error || invitations.error) {
    return { error: true, invitations: [], members: [] };
  }

  return {
    error: false,
    invitations: invitations.data ?? [],
    members: memberResult.members
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
    heartbeats: [],
    invitations: [],
    media: [],
    memberCount: 0,
    playlistItems: [],
    playlists: [],
    releases: [],
    screenLimit: 0,
    screens: []
  };
}

function platformOverviewFailure() {
  return { devices: [], error: true, screens: [], tenants: [] };
}
