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

export type TenantAuditFilter = {
  action?: string;
  from?: string;
  page?: number;
  result?: "all" | "failure" | "success";
  target?: string;
  to?: string;
};

export async function loadTenantAuditEvents(
  tenantId: string,
  filter: TenantAuditFilter = {}
) {
  const supabase = await createControlSupabaseClient();
  if (!supabase) return { error: true, events: [], page: 1, pageCount: 1, total: 0 };

  const page = Math.max(1, filter.page ?? 1);
  const pageSize = 50;
  let query = supabase
    .from("audit_events")
    .select("id, actor_user_id, action, target_type, target_id, result, created_at", {
      count: "exact"
    })
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (filter.action?.trim()) {
    query = query.ilike("action", `%${escapeAuditLike(filter.action.trim())}%`);
  }
  if (filter.target?.trim()) {
    query = query.ilike("target_type", `%${escapeAuditLike(filter.target.trim())}%`);
  }
  if (filter.result === "success" || filter.result === "failure") {
    query = query.eq("result", filter.result);
  }
  const from = auditDateBoundary(filter.from, false);
  const to = auditDateBoundary(filter.to, true);
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lt("created_at", to);

  const events = await query.range(
    (page - 1) * pageSize,
    page * pageSize - 1
  );
  if (events.error) {
    return { error: true, events: [], page, pageCount: 1, total: 0 };
  }

  const actorIds = [
    ...new Set((events.data ?? []).flatMap((event) =>
      event.actor_user_id ? [event.actor_user_id] : []
    ))
  ];
  const profiles = actorIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", actorIds)
    : { data: [], error: null };
  const names = new Map((profiles.data ?? []).map((profile) => [
    profile.id,
    profile.display_name
  ]));
  const total = events.count ?? 0;

  return {
    error: Boolean(profiles.error),
    events: (events.data ?? []).map((event) => ({
      ...event,
      actor_name: event.actor_user_id
        ? names.get(event.actor_user_id) ?? "Onbekende gebruiker"
        : "Systeem"
    })),
    page,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    total
  };
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

function auditDateBoundary(value: string | undefined, nextDay: boolean) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  if (nextDay) date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString();
}

function escapeAuditLike(value: string) {
  return value.replace(/[%_]/g, "");
}
