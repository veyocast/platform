import "server-only";

import { createControlSupabaseClient } from "../../../../lib/supabase/server";

export type FleetScreen = {
  activeAssignmentSource: "default" | "override" | "schedule";
  activeScheduleId: string | null;
  activeTargetSnapshotId: string | null;
  assignedPlaylistId: string | null;
  assignedReleaseId: string | null;
  createdAt: string;
  defaultPlaylistId: string | null;
  defaultReleaseId: string | null;
  id: string;
  location: string | null;
  name: string;
  orientation: string;
  resolutionHeight: number | null;
  resolutionWidth: number | null;
  status: string;
};

export type ScreenSchedule = {
  enabled: boolean;
  endsAt: string | null;
  id: string;
  isActive: boolean;
  name: string;
  priority: number;
  releaseId: string;
  releaseLabel: string;
  source: string;
  startsAt: string;
  targetKind: string;
  targetName: string;
  timezoneName: string;
};

export type FleetDevice = {
  activeReleaseId: string | null;
  appVersion: string | null;
  capabilities: Record<string, unknown>;
  desiredReleaseId: string | null;
  deviceName: string | null;
  id: string;
  lastErrorAt: string | null;
  lastErrorCode: string | null;
  lastSeenAt: string | null;
  pairedAt: string;
  platform: string | null;
  revokedAt: string | null;
  screenId: string;
  status: string;
  storageQuotaBytes: number | null;
  storageUsedBytes: number | null;
  syncRetryRequestedAt: string | null;
};

export type FleetRelease = {
  automatic: boolean;
  id: string;
  label: string;
  playlistId: string;
  playlistName: string;
  publishedAt: string;
  version: number;
};

export type ScreenHeartbeat = {
  activeReleaseId: string | null;
  appVersion: string | null;
  createdAt: string;
  id: string;
  runtimeState: string;
  storageQuotaBytes: number | null;
  storageUsedBytes: number | null;
};

export type ScreenSyncEvent = {
  createdAt: string;
  detail: Record<string, unknown>;
  id: string;
  phase: string;
  releaseId: string | null;
};

export type ScreenAuditEvent = {
  action: string;
  createdAt: string;
  id: string;
  metadata: Record<string, unknown>;
  result: string;
  targetId: string | null;
  targetType: string;
};

export type ScreenPlayerCommand = {
  acknowledgedAt: string | null;
  commandType: string;
  completedAt: string | null;
  createdAt: string;
  deliveredAt: string | null;
  expiresAt: string;
  failedAt: string | null;
  failureCode: string | null;
  id: string;
};

export type ScreenFleetData = {
  automation: Record<string, ScreenAutomationSummary>;
  devices: FleetDevice[];
  error: string | null;
  features: { healthView: boolean; venueTwin: boolean };
  floorplans: VenueFloorplan[];
  floorplanAssets: Array<{ height: number | null; id: string; title: string; width: number | null }>;
  groups: Array<{
    id: string;
    memberIds: string[];
    name: string;
    revision: number;
  }>;
  limit: number;
  releases: FleetRelease[];
  screens: FleetScreen[];
  settings: { height: number; orientation: string; width: number };
  venuePlacements: VenueScreenPlacement[];
  venues: Venue[];
  zones: VenueZone[];
};

export type Venue = {
  addressLabel: string | null;
  id: string;
  name: string;
  status: string;
};

export type VenueFloorplan = {
  height: number;
  id: string;
  mediaAssetId: string | null;
  name: string;
  previewUrl: string | null;
  revision: number;
  venueId: string;
  width: number;
};

export type VenueZone = {
  description: string | null;
  floorplanId: string | null;
  id: string;
  name: string;
  venueId: string;
};

export type VenueScreenPlacement = {
  floorplanId: string | null;
  id: string;
  orientation: string;
  revision: number;
  screenId: string;
  venueId: string;
  wallAngleDegrees: number | null;
  xNormalized: number;
  yNormalized: number;
  zoneId: string | null;
};

export type ScreenAutomationSummary = {
  enabled: boolean;
  label: string;
};

export type ScreenDetailData = {
  automation: ScreenAutomationSummary;
  auditEvents: ScreenAuditEvent[];
  devices: FleetDevice[];
  error: string | null;
  heartbeats: ScreenHeartbeat[];
  playerCommands: ScreenPlayerCommand[];
  releases: FleetRelease[];
  schedules: ScreenSchedule[];
  screen: FleetScreen | null;
  syncEvents: ScreenSyncEvent[];
  venueContext: {
    floorplan: VenueFloorplan | null;
    placement: VenueScreenPlacement;
    venue: Venue;
    zone: VenueZone | null;
  } | null;
};

export async function loadScreenFleet(tenantId: string): Promise<ScreenFleetData> {
  const empty: ScreenFleetData = {
    automation: {},
    devices: [],
    error: null,
    features: { healthView: false, venueTwin: false },
    floorplans: [],
    floorplanAssets: [],
    groups: [],
    limit: 0,
    releases: [],
    screens: [],
    settings: { height: 1080, orientation: "landscape", width: 1920 },
    venuePlacements: [],
    venues: [],
    zones: []
  };
  const supabase = await createControlSupabaseClient();
  if (!supabase) return { ...empty, error: "De beveiligde datasessie ontbreekt." };

  const [
    screens,
    devices,
    releases,
    playlists,
    tenant,
    settings,
    groups,
    groupMemberships,
    automationSettings,
    automationPeriods,
    featureFlags,
    venues,
    floorplans,
    zones,
    venuePlacements,
    floorplanAssets
  ] = await Promise.all([
    supabase.from("screens").select("id, name, location, orientation, resolution_width, resolution_height, status, assigned_playlist_id, assigned_release_id, default_playlist_id, default_release_id, active_assignment_source, active_schedule_id, active_target_snapshot_id, created_at").eq("tenant_id", tenantId).is("deleted_at", null).order("created_at"),
    supabase.from("player_devices").select("id, screen_id, device_name, status, app_version, platform, capabilities, storage_quota_bytes, storage_used_bytes, active_release_id, desired_release_id, last_seen_at, paired_at, revoked_at, last_error_code, last_error_at, sync_retry_requested_at").eq("tenant_id", tenantId).order("paired_at", { ascending: false }),
    supabase.from("playlist_releases").select("id, playlist_id, version, published_at, release_notes").eq("tenant_id", tenantId).order("published_at", { ascending: false }),
    supabase.from("playlists").select("id, name").eq("tenant_id", tenantId),
    supabase.from("tenants").select("screen_limit").eq("id", tenantId).maybeSingle(),
    supabase.from("tenant_settings").select("default_screen_orientation, default_resolution_width, default_resolution_height").eq("tenant_id", tenantId).maybeSingle(),
    supabase.from("screen_groups").select("id, name, revision").eq("tenant_id", tenantId).eq("status", "active").order("name"),
    supabase.from("screen_group_memberships").select("screen_group_id, screen_id").eq("tenant_id", tenantId),
    supabase.from("screen_automation_settings").select("screen_id, enabled, schedule_mode, temporary_override, temporary_override_until").eq("tenant_id", tenantId),
    supabase.from("screen_automation_periods").select("screen_id, weekday, start_local_time, enabled").eq("tenant_id", tenantId).order("weekday").order("start_local_time"),
    supabase.from("tenant_feature_flags").select("flag_key, enabled").eq("tenant_id", tenantId).in("flag_key", ["venue_twin", "screen_health_view"]),
    supabase.from("venues").select("id, name, address_label, status").eq("tenant_id", tenantId).eq("status", "active").order("name"),
    supabase.from("venue_floorplans").select("id, venue_id, media_asset_id, name, width, height, revision").eq("tenant_id", tenantId).eq("status", "active").order("name"),
    supabase.from("venue_zones").select("id, venue_id, floorplan_id, name, description").eq("tenant_id", tenantId).eq("status", "active").order("name"),
    supabase.from("venue_screen_placements").select("id, screen_id, venue_id, floorplan_id, zone_id, x_normalized, y_normalized, orientation, wall_angle_degrees, revision").eq("tenant_id", tenantId),
    supabase.from("media_assets").select("id, title, width, height, storage_path").eq("tenant_id", tenantId).eq("source_kind", "user").eq("kind", "image").eq("status", "ready").is("deleted_at", null).order("title").limit(100)
  ]);
  const error = [
    screens.error,
    devices.error,
    releases.error,
    playlists.error,
    tenant.error,
    settings.error,
    groups.error,
    groupMemberships.error,
    automationSettings.error,
    automationPeriods.error,
    featureFlags.error,
    venues.error,
    floorplans.error,
    zones.error,
    venuePlacements.error,
    floorplanAssets.error
  ].find(Boolean);
  if (error) {
    console.error("Schermvloot laden mislukt", error);
    return { ...empty, error: "De schermvloot kon niet volledig worden geladen. Vernieuw de pagina." };
  }

  const playlistNames = new Map((playlists.data ?? []).map((playlist) => [playlist.id, playlist.name]));
  const floorplanPathByAsset = new Map((floorplanAssets.data ?? []).map((asset) => [asset.id, asset.storage_path]));
  const floorplanPreviewByAsset = new Map<string, string>();
  const floorplanPreviewPaths = (floorplans.data ?? []).flatMap((floorplan) => {
    const path = floorplan.media_asset_id ? floorplanPathByAsset.get(floorplan.media_asset_id) : null;
    return floorplan.media_asset_id && path ? [{ assetId: floorplan.media_asset_id, path }] : [];
  });
  if (floorplanPreviewPaths.length) {
    const signed = await supabase.storage.from("tenant-media").createSignedUrls(
      floorplanPreviewPaths.map((entry) => entry.path),
      600
    );
    if (signed.error) {
      console.error("Venueplattegrondvoorbeelden laden mislukt", { code: signed.error.name });
    } else {
      signed.data.forEach((preview, index) => {
        const assetId = floorplanPreviewPaths[index]?.assetId;
        if (assetId && preview.signedUrl) floorplanPreviewByAsset.set(assetId, preview.signedUrl);
      });
    }
  }
  const enabledFlags = new Set((featureFlags.data ?? [])
    .filter((flag) => flag.enabled)
    .map((flag) => flag.flag_key));
  return {
    automation: automationSummaries(
      automationSettings.data ?? [],
      automationPeriods.data ?? []
    ),
    devices: (devices.data ?? []).map(mapDevice),
    error: null,
    features: {
      healthView: enabledFlags.has("screen_health_view"),
      venueTwin: enabledFlags.has("venue_twin")
    },
    floorplans: (floorplans.data ?? []).map((floorplan) => ({
      height: Number(floorplan.height),
      id: floorplan.id,
      mediaAssetId: floorplan.media_asset_id,
      name: floorplan.name,
      previewUrl: floorplan.media_asset_id ? floorplanPreviewByAsset.get(floorplan.media_asset_id) ?? null : null,
      revision: Number(floorplan.revision),
      venueId: floorplan.venue_id,
      width: Number(floorplan.width)
    })),
    floorplanAssets: (floorplanAssets.data ?? []).map((asset) => ({
      height: asset.height,
      id: asset.id,
      title: asset.title,
      width: asset.width
    })),
    groups: (groups.data ?? []).map((group) => ({
      id: group.id,
      memberIds: (groupMemberships.data ?? [])
        .filter((membership) => membership.screen_group_id === group.id)
        .map((membership) => membership.screen_id),
      name: group.name,
      revision: Number(group.revision)
    })),
    limit: tenant.data?.screen_limit ?? 0,
    releases: (releases.data ?? []).map((release) => ({
      automatic: release.release_notes === "Automatische dynamische vernieuwing",
      id: release.id,
      label: `${playlistNames.get(release.playlist_id) ?? "Verwijderde playlist"} · versie ${release.version}`,
      playlistId: release.playlist_id,
      playlistName: playlistNames.get(release.playlist_id) ?? "Verwijderde playlist",
      publishedAt: release.published_at,
      version: release.version
    })),
    screens: (screens.data ?? []).map(mapScreen),
    settings: settings.data
      ? {
          height: settings.data.default_resolution_height,
          orientation: settings.data.default_screen_orientation,
          width: settings.data.default_resolution_width
        }
      : empty.settings,
    venuePlacements: (venuePlacements.data ?? []).map((placement) => ({
      floorplanId: placement.floorplan_id,
      id: placement.id,
      orientation: placement.orientation,
      revision: Number(placement.revision),
      screenId: placement.screen_id,
      venueId: placement.venue_id,
      wallAngleDegrees: nullableNumber(placement.wall_angle_degrees),
      xNormalized: Number(placement.x_normalized),
      yNormalized: Number(placement.y_normalized),
      zoneId: placement.zone_id
    })),
    venues: (venues.data ?? []).map((venue) => ({
      addressLabel: venue.address_label,
      id: venue.id,
      name: venue.name,
      status: venue.status
    })),
    zones: (zones.data ?? []).map((zone) => ({
      description: zone.description,
      floorplanId: zone.floorplan_id,
      id: zone.id,
      name: zone.name,
      venueId: zone.venue_id
    }))
  };
}

export async function loadScreenDetail(
  tenantId: string,
  screenId: string
): Promise<ScreenDetailData> {
  const fleet = await loadScreenFleet(tenantId);
  const screen = fleet.screens.find((candidate) => candidate.id === screenId) ?? null;
  const empty: ScreenDetailData = {
    automation: fleet.automation[screenId] ?? { enabled: false, label: "Handmatig" },
    auditEvents: [],
    devices: [],
    error: fleet.error,
    heartbeats: [],
    playerCommands: [],
    releases: fleet.releases,
    schedules: [],
    screen,
    syncEvents: [],
    venueContext: venueContext(fleet, screenId)
  };
  if (fleet.error || !screen) return empty;
  const supabase = await createControlSupabaseClient();
  if (!supabase) return { ...empty, error: "De beveiligde datasessie ontbreekt." };

  const screenDevices = fleet.devices.filter((device) => device.screenId === screenId);
  const deviceIds = new Set(screenDevices.map((device) => device.id));
  const [
    heartbeats,
    syncEvents,
    auditEvents,
    memberships,
    schedules,
    groups,
    playerCommands
  ] = await Promise.all([
    supabase.from("player_heartbeats").select("id, device_id, active_release_id, runtime_state, storage_used_bytes, storage_quota_bytes, app_version, created_at").eq("tenant_id", tenantId).eq("screen_id", screenId).order("created_at", { ascending: false }).limit(100),
    supabase.from("player_sync_events").select("id, device_id, release_id, phase, detail, created_at").eq("tenant_id", tenantId).eq("screen_id", screenId).order("created_at", { ascending: false }).limit(100),
    supabase.from("audit_events").select("id, action, target_type, target_id, result, metadata, created_at").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(250),
    supabase.from("screen_group_memberships").select("screen_group_id").eq("tenant_id", tenantId).eq("screen_id", screenId),
    supabase.from("content_schedules").select("id, name, target_kind, target_screen_id, target_screen_group_id, release_id, timezone_name, starts_at, ends_at, priority, source, enabled").eq("tenant_id", tenantId).order("starts_at"),
    supabase.from("screen_groups").select("id, name").eq("tenant_id", tenantId),
    supabase.from("player_commands").select("id, command_type, created_at, expires_at, delivered_at, acknowledged_at, completed_at, failed_at, failure_code").eq("tenant_id", tenantId).eq("screen_id", screenId).order("created_at", { ascending: false }).limit(25)
  ]);
  const error = [
    heartbeats.error,
    syncEvents.error,
    auditEvents.error,
    memberships.error,
    schedules.error,
    groups.error,
    playerCommands.error
  ].find(Boolean);
  if (error) {
    console.error("Schermdetail laden mislukt", error);
    return { ...empty, devices: screenDevices, error: "Playerstatus en gebeurtenissen konden niet volledig worden geladen." };
  }
  const groupIds = new Set((memberships.data ?? []).map((membership) => membership.screen_group_id));
  const groupNames = new Map((groups.data ?? []).map((group) => [group.id, group.name]));

  return {
    automation: empty.automation,
    auditEvents: (auditEvents.data ?? [])
      .filter((event) => event.target_id === screenId || (event.target_id && deviceIds.has(event.target_id)))
      .map((event) => ({
        action: event.action,
        createdAt: event.created_at,
        id: event.id,
        metadata: objectValue(event.metadata),
        result: event.result,
        targetId: event.target_id,
        targetType: event.target_type
      })),
    devices: screenDevices,
    error: null,
    heartbeats: (heartbeats.data ?? []).map((heartbeat) => ({
      activeReleaseId: heartbeat.active_release_id,
      appVersion: heartbeat.app_version,
      createdAt: heartbeat.created_at,
      id: heartbeat.id,
      runtimeState: heartbeat.runtime_state,
      storageQuotaBytes: nullableNumber(heartbeat.storage_quota_bytes),
      storageUsedBytes: nullableNumber(heartbeat.storage_used_bytes)
    })),
    playerCommands: (playerCommands.data ?? []).map((command) => ({
      acknowledgedAt: command.acknowledged_at,
      commandType: command.command_type,
      completedAt: command.completed_at,
      createdAt: command.created_at,
      deliveredAt: command.delivered_at,
      expiresAt: command.expires_at,
      failedAt: command.failed_at,
      failureCode: command.failure_code,
      id: command.id
    })),
    releases: fleet.releases,
    schedules: (schedules.data ?? [])
      .filter((schedule) =>
        schedule.target_kind === "screen"
          ? schedule.target_screen_id === screenId
          : groupIds.has(schedule.target_screen_group_id ?? "")
      )
      .map((schedule): ScreenSchedule => ({
        enabled: schedule.enabled,
        endsAt: schedule.ends_at,
        id: schedule.id,
        isActive: schedule.id === screen.activeScheduleId,
        name: schedule.name,
        priority: schedule.priority,
        releaseId: schedule.release_id,
        releaseLabel: fleet.releases.find((release) => release.id === schedule.release_id)?.label ?? "Verwijderde release",
        source: schedule.source,
        startsAt: schedule.starts_at,
        targetKind: schedule.target_kind,
        targetName: schedule.target_kind === "screen"
          ? screen.name
          : groupNames.get(schedule.target_screen_group_id ?? "") ?? "Verwijderde groep",
        timezoneName: schedule.timezone_name
      })),
    screen,
    syncEvents: (syncEvents.data ?? []).map((event) => ({
      createdAt: event.created_at,
      detail: objectValue(event.detail),
      id: event.id,
      phase: event.phase,
      releaseId: event.release_id
    })),
    venueContext: empty.venueContext
  };
}

function venueContext(fleet: ScreenFleetData, screenId: string) {
  const placement = fleet.venuePlacements.find((item) => item.screenId === screenId);
  if (!placement) return null;
  const venue = fleet.venues.find((item) => item.id === placement.venueId);
  if (!venue) return null;
  return {
    floorplan: fleet.floorplans.find((item) => item.id === placement.floorplanId) ?? null,
    placement,
    venue,
    zone: fleet.zones.find((item) => item.id === placement.zoneId) ?? null
  };
}

function mapScreen(screen: Record<string, unknown>): FleetScreen {
  return {
    activeAssignmentSource: assignmentSource(screen.active_assignment_source),
    activeScheduleId: stringOrNull(screen.active_schedule_id),
    activeTargetSnapshotId: stringOrNull(screen.active_target_snapshot_id),
    assignedPlaylistId: stringOrNull(screen.assigned_playlist_id),
    assignedReleaseId: stringOrNull(screen.assigned_release_id),
    createdAt: String(screen.created_at),
    defaultPlaylistId: stringOrNull(screen.default_playlist_id),
    defaultReleaseId: stringOrNull(screen.default_release_id),
    id: String(screen.id),
    location: stringOrNull(screen.location),
    name: String(screen.name),
    orientation: String(screen.orientation),
    resolutionHeight: nullableNumber(screen.resolution_height),
    resolutionWidth: nullableNumber(screen.resolution_width),
    status: String(screen.status)
  };
}

function assignmentSource(value: unknown): FleetScreen["activeAssignmentSource"] {
  return value === "schedule" || value === "override" ? value : "default";
}

function mapDevice(device: Record<string, unknown>): FleetDevice {
  return {
    activeReleaseId: stringOrNull(device.active_release_id),
    appVersion: stringOrNull(device.app_version),
    capabilities: objectValue(device.capabilities),
    desiredReleaseId: stringOrNull(device.desired_release_id),
    deviceName: stringOrNull(device.device_name),
    id: String(device.id),
    lastErrorAt: stringOrNull(device.last_error_at),
    lastErrorCode: stringOrNull(device.last_error_code),
    lastSeenAt: stringOrNull(device.last_seen_at),
    pairedAt: String(device.paired_at),
    platform: stringOrNull(device.platform),
    revokedAt: stringOrNull(device.revoked_at),
    screenId: String(device.screen_id),
    status: String(device.status),
    storageQuotaBytes: nullableNumber(device.storage_quota_bytes),
    storageUsedBytes: nullableNumber(device.storage_used_bytes),
    syncRetryRequestedAt: stringOrNull(device.sync_retry_requested_at)
  };
}

function nullableNumber(value: unknown) {
  return value === null || value === undefined ? null : Number(value);
}

function stringOrNull(value: unknown) {
  return typeof value === "string" ? value : null;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function automationSummaries(
  settings: Array<{
    enabled: boolean;
    schedule_mode: string;
    screen_id: string;
    temporary_override: string;
    temporary_override_until: string | null;
  }>,
  periods: Array<{
    enabled: boolean;
    screen_id: string;
    start_local_time: string;
    weekday: number;
  }>
): Record<string, ScreenAutomationSummary> {
  const now = Date.now();
  return Object.fromEntries(settings.map((setting) => {
    const paused = setting.temporary_override === "paused" &&
      setting.temporary_override_until &&
      Date.parse(setting.temporary_override_until) > now;
    if (!setting.enabled) {
      return [setting.screen_id, { enabled: false, label: "Handmatig" }];
    }
    if (paused) {
      return [
        setting.screen_id,
        { enabled: true, label: "Automatisering gepauzeerd" }
      ];
    }
    if (setting.schedule_mode === "always") {
      return [setting.screen_id, { enabled: true, label: "Altijd actief" }];
    }
    const activePeriods = periods.filter(
      (period) => period.screen_id === setting.screen_id && period.enabled
    );
    if (!activePeriods.length) {
      return [setting.screen_id, { enabled: true, label: "Geen bedrijfstijden" }];
    }
    const weekdays = new Set(activePeriods.map((period) => period.weekday));
    const firstStart = activePeriods[0]!.start_local_time.slice(0, 5);
    const sameStart = activePeriods.every(
      (period) => period.start_local_time.slice(0, 5) === firstStart
    );
    const range = weekdays.size === 7
      ? "Dagelijks"
      : [1, 2, 3, 4, 5].every((weekday) => weekdays.has(weekday)) &&
          !weekdays.has(6) &&
          !weekdays.has(7)
        ? "Ma–vr"
        : `${weekdays.size} dagen`;
    return [
      setting.screen_id,
      {
        enabled: true,
        label: sameStart ? `${range} ${firstStart}` : `${range} · wisselende tijden`
      }
    ];
  }));
}
