import "server-only";

import { createControlSupabaseClient } from "./supabase/server";

export type TenantOverview = Awaited<ReturnType<typeof loadTenantOverview>>;

export type TenantOverviewAvailability = Readonly<{
  audit: boolean;
  devices: boolean;
  integrations: boolean;
  media: boolean;
  members: boolean;
  playlists: boolean;
  screens: boolean;
  telemetry: boolean;
  tenant: boolean;
}>;

export async function loadTenantOverview(tenantId: string) {
  const supabase = await createControlSupabaseClient();
  if (!supabase) return tenantOverviewFailure();

  const [screens, devices, playlists, playlistItems, media, releases, audit, invitations, members, tenant, heartbeats, dynamicSources, sportlinkConnections] = await Promise.all([
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
      .select("id, actor_user_id, action, target_type, target_id, result, created_at")
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
      .select("screen_limit, media_storage_limit_bytes")
      .eq("id", tenantId)
      .maybeSingle(),
    supabase
      .from("player_heartbeats")
      .select("screen_id, active_release_id, runtime_state, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(250),
    supabase
      .from("dynamic_data_sources")
      .select("id, name, kind, status, provider_status, last_successful_sync_at, last_attempt_at, last_error_code")
      .eq("tenant_id", tenantId)
      .neq("status", "archived"),
    supabase
      .from("sportlink_connections")
      .select("id, status, detected_club_name, last_attempt_at, last_success_at, stale_after, last_error_code")
      .eq("tenant_id", tenantId)
      .neq("status", "revoked")
  ]);

  const overviewAudit = audit.data ?? [];
  const actorIds = [...new Set(overviewAudit.flatMap((event) =>
    event.actor_user_id ? [event.actor_user_id] : []
  ))];
  const targetIds = (targetType: string) => [
    ...new Set(overviewAudit.flatMap((event) =>
      event.target_type === targetType && event.target_id ? [event.target_id] : []
    ))
  ];
  const [auditProfiles, auditScreens, auditSchedules, auditGroups] = await Promise.all([
    actorIds.length
      ? supabase.from("profiles").select("id, display_name").in("id", actorIds)
      : Promise.resolve({ data: [], error: null }),
    targetIds("screens").length
      ? supabase.from("screens").select("id, name").in("id", targetIds("screens"))
      : Promise.resolve({ data: [], error: null }),
    targetIds("content_schedules").length
      ? supabase.from("content_schedules").select("id, name").in("id", targetIds("content_schedules"))
      : Promise.resolve({ data: [], error: null }),
    targetIds("screen_groups").length
      ? supabase.from("screen_groups").select("id, name").in("id", targetIds("screen_groups"))
      : Promise.resolve({ data: [], error: null })
  ]);
  const auditActors = new Map((auditProfiles.data ?? []).map((profile) => [
    profile.id,
    profile.display_name
  ]));
  const auditTargets = new Map<string, string>([
    ...(playlists.data ?? []).map((row) => [`playlists:${row.id}`, row.name] as const),
    ...(releases.data ?? []).map((row) => [
      `playlist_releases:${row.id}`,
      `Release versie ${row.version}`
    ] as const),
    ...(media.data ?? []).map((row) => [`media_assets:${row.id}`, row.title] as const),
    ...(auditScreens.data ?? []).map((row) => [`screens:${row.id}`, row.name] as const),
    ...(auditSchedules.data ?? []).map((row) => [`content_schedules:${row.id}`, row.name] as const),
    ...(auditGroups.data ?? []).map((row) => [`screen_groups:${row.id}`, row.name] as const)
  ]);

  const availability = {
    audit: !audit.error && !auditProfiles.error && !auditScreens.error &&
      !auditSchedules.error && !auditGroups.error,
    devices: !devices.error,
    integrations: !dynamicSources.error && !sportlinkConnections.error,
    media: !media.error,
    members: !invitations.error && !members.error,
    playlists: !playlists.error && !playlistItems.error && !releases.error,
    screens: !screens.error,
    telemetry: !heartbeats.error,
    tenant: !tenant.error
  } satisfies TenantOverviewAvailability;
  const unavailable = Object.entries(availability)
    .filter(([, available]) => !available)
    .map(([domain]) => domain);

  return {
    auditEvents: overviewAudit.map((event) => ({
      ...event,
      actor_name: event.actor_user_id
        ? auditActors.get(event.actor_user_id) ?? "Onbekende gebruiker"
        : "Systeem",
      target_name: event.target_id
        ? auditTargets.get(`${event.target_type}:${event.target_id}`) ?? null
        : null
    })),
    availability,
    heartbeats: heartbeats.data ?? [],
    invitations: invitations.data ?? [],
    integrations: {
      dynamicSources: dynamicSources.data ?? [],
      sportlinkConnections: sportlinkConnections.data ?? []
    },
    memberCount: members.count ?? 0,
    mediaStorageLimitBytes: tenant.data?.media_storage_limit_bytes === null
      ? null
      : Number(tenant.data?.media_storage_limit_bytes ?? 0),
    error: unavailable.length > 0,
    loadState: unavailable.length === 0
      ? "complete" as const
      : unavailable.length === Object.keys(availability).length
        ? "failed" as const
        : "partial" as const,
    media: media.data ?? [],
    playlistItems: playlistItems.data ?? [],
    playlists: playlists.data ?? [],
    releases: releases.data ?? [],
    screenLimit: tenant.data?.screen_limit ?? 0,
    devices: devices.data ?? [],
    screens: screens.data ?? [],
    unavailable
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
    .select("user_id, role, custom_role_id, created_at")
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
  if (!supabase) return { customRoles: [], error: true, invitations: [], members: [] };

  const [memberResult, invitations, customRoles] = await Promise.all([
    loadTenantMembers(tenantId),
    supabase
      .from("tenant_invitations")
      .select("id, email, role, custom_role_id, status, delivery_status, send_attempt_count, expires_at, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false }),
    supabase
      .from("tenant_custom_roles")
      .select("id, name, description, capabilities, status, revision, updated_at")
      .eq("tenant_id", tenantId)
      .order("name")
  ]);

  if (memberResult.error || invitations.error || customRoles.error) {
    return { customRoles: [], error: true, invitations: [], members: [] };
  }

  return {
    customRoles: customRoles.data ?? [],
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
    .select("id, actor_user_id, action, target_type, target_id, result, metadata, created_at", {
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
  const targetIds = (targetType: string) => [
    ...new Set((events.data ?? []).flatMap((event) =>
      event.target_type === targetType && event.target_id
        ? [event.target_id]
        : []
    ))
  ];
  const playlistIds = targetIds("playlists");
  const releaseIds = targetIds("playlist_releases");
  const screenIds = targetIds("screens");
  const mediaIds = targetIds("media_assets");
  const scheduleIds = targetIds("content_schedules");
  const groupIds = targetIds("screen_groups");
  const deviceIds = targetIds("player_devices");
  const [
    profiles,
    settings,
    playlists,
    releases,
    screens,
    media,
    schedules,
    groups,
    devices
  ] = await Promise.all([
    actorIds.length
      ? supabase.from("profiles").select("id, display_name").in("id", actorIds)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("tenant_settings")
      .select("timezone_name")
      .eq("tenant_id", tenantId)
      .maybeSingle(),
    playlistIds.length
      ? supabase.from("playlists").select("id, name").in("id", playlistIds)
      : Promise.resolve({ data: [], error: null }),
    releaseIds.length
      ? supabase.from("playlist_releases").select("id, version").in("id", releaseIds)
      : Promise.resolve({ data: [], error: null }),
    screenIds.length
      ? supabase.from("screens").select("id, name").in("id", screenIds)
      : Promise.resolve({ data: [], error: null }),
    mediaIds.length
      ? supabase.from("media_assets").select("id, title").in("id", mediaIds)
      : Promise.resolve({ data: [], error: null }),
    scheduleIds.length
      ? supabase.from("content_schedules").select("id, name").in("id", scheduleIds)
      : Promise.resolve({ data: [], error: null }),
    groupIds.length
      ? supabase.from("screen_groups").select("id, name").in("id", groupIds)
      : Promise.resolve({ data: [], error: null }),
    deviceIds.length
      ? supabase.from("player_devices").select("id, device_name").in("id", deviceIds)
      : Promise.resolve({ data: [], error: null })
  ]);
  const names = new Map((profiles.data ?? []).map((profile) => [
    profile.id,
    profile.display_name
  ]));
  const targetNames = new Map<string, string>([
    ...(playlists.data ?? []).map((row) => [`playlists:${row.id}`, row.name] as const),
    ...(releases.data ?? []).map((row) => [
      `playlist_releases:${row.id}`,
      `Release versie ${row.version}`
    ] as const),
    ...(screens.data ?? []).map((row) => [`screens:${row.id}`, row.name] as const),
    ...(media.data ?? []).map((row) => [`media_assets:${row.id}`, row.title] as const),
    ...(schedules.data ?? []).map((row) => [`content_schedules:${row.id}`, row.name] as const),
    ...(groups.data ?? []).map((row) => [`screen_groups:${row.id}`, row.name] as const),
    ...(devices.data ?? []).map((row) => [`player_devices:${row.id}`, row.device_name] as const)
  ]);
  const total = events.count ?? 0;
  const relatedError = [
    profiles.error,
    settings.error,
    playlists.error,
    releases.error,
    screens.error,
    media.error,
    schedules.error,
    groups.error,
    devices.error
  ].some(Boolean);

  return {
    error: relatedError,
    events: (events.data ?? []).map((event) => ({
      ...event,
      actor_name: event.actor_user_id
        ? names.get(event.actor_user_id) ?? "Onbekende gebruiker"
        : "Systeem",
      target_name: event.target_id
        ? targetNames.get(`${event.target_type}:${event.target_id}`) ?? null
        : null
    })),
    page,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    timezoneName: settings.data?.timezone_name ?? "Europe/Amsterdam",
    total
  };
}

function tenantOverviewFailure() {
  const availability = {
    audit: false,
    devices: false,
    integrations: false,
    media: false,
    members: false,
    playlists: false,
    screens: false,
    telemetry: false,
    tenant: false
  } satisfies TenantOverviewAvailability;

  return {
    auditEvents: [],
    availability,
    devices: [],
    error: true,
    heartbeats: [],
    integrations: { dynamicSources: [], sportlinkConnections: [] },
    invitations: [],
    loadState: "failed" as const,
    media: [],
    memberCount: 0,
    mediaStorageLimitBytes: null,
    playlistItems: [],
    playlists: [],
    releases: [],
    screenLimit: 0,
    screens: [],
    unavailable: Object.keys(availability)
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
