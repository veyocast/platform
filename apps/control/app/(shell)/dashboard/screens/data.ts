import "server-only";

import { createControlSupabaseClient } from "../../../../lib/supabase/server";

export type FleetScreen = {
  assignedPlaylistId: string | null;
  assignedReleaseId: string | null;
  createdAt: string;
  id: string;
  location: string | null;
  name: string;
  orientation: string;
  resolutionHeight: number | null;
  resolutionWidth: number | null;
  status: string;
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
  id: string;
  label: string;
  playlistId: string;
  playlistName: string;
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

export type ScreenFleetData = {
  devices: FleetDevice[];
  error: string | null;
  limit: number;
  releases: FleetRelease[];
  screens: FleetScreen[];
  settings: { height: number; orientation: string; width: number };
};

export type ScreenDetailData = {
  auditEvents: ScreenAuditEvent[];
  devices: FleetDevice[];
  error: string | null;
  heartbeats: ScreenHeartbeat[];
  releases: FleetRelease[];
  screen: FleetScreen | null;
  syncEvents: ScreenSyncEvent[];
};

export async function loadScreenFleet(tenantId: string): Promise<ScreenFleetData> {
  const empty: ScreenFleetData = {
    devices: [],
    error: null,
    limit: 0,
    releases: [],
    screens: [],
    settings: { height: 1080, orientation: "landscape", width: 1920 }
  };
  const supabase = await createControlSupabaseClient();
  if (!supabase) return { ...empty, error: "De beveiligde datasessie ontbreekt." };

  const [screens, devices, releases, playlists, tenant, settings] = await Promise.all([
    supabase.from("screens").select("id, name, location, orientation, resolution_width, resolution_height, status, assigned_playlist_id, assigned_release_id, created_at").eq("tenant_id", tenantId).order("created_at"),
    supabase.from("player_devices").select("id, screen_id, device_name, status, app_version, platform, capabilities, storage_quota_bytes, storage_used_bytes, active_release_id, desired_release_id, last_seen_at, paired_at, revoked_at, last_error_code, last_error_at, sync_retry_requested_at").eq("tenant_id", tenantId).order("paired_at", { ascending: false }),
    supabase.from("playlist_releases").select("id, playlist_id, version").eq("tenant_id", tenantId).order("published_at", { ascending: false }),
    supabase.from("playlists").select("id, name").eq("tenant_id", tenantId),
    supabase.from("tenants").select("screen_limit").eq("id", tenantId).maybeSingle(),
    supabase.from("tenant_settings").select("default_screen_orientation, default_resolution_width, default_resolution_height").eq("tenant_id", tenantId).maybeSingle()
  ]);
  const error = [screens.error, devices.error, releases.error, playlists.error, tenant.error, settings.error].find(Boolean);
  if (error) {
    console.error("Schermvloot laden mislukt", error);
    return { ...empty, error: "De schermvloot kon niet volledig worden geladen. Vernieuw de pagina." };
  }

  const playlistNames = new Map((playlists.data ?? []).map((playlist) => [playlist.id, playlist.name]));
  return {
    devices: (devices.data ?? []).map(mapDevice),
    error: null,
    limit: tenant.data?.screen_limit ?? 0,
    releases: (releases.data ?? []).map((release) => ({
      id: release.id,
      label: `${playlistNames.get(release.playlist_id) ?? "Verwijderde playlist"} · versie ${release.version}`,
      playlistId: release.playlist_id,
      playlistName: playlistNames.get(release.playlist_id) ?? "Verwijderde playlist",
      version: release.version
    })),
    screens: (screens.data ?? []).map(mapScreen),
    settings: settings.data
      ? {
          height: settings.data.default_resolution_height,
          orientation: settings.data.default_screen_orientation,
          width: settings.data.default_resolution_width
        }
      : empty.settings
  };
}

export async function loadScreenDetail(
  tenantId: string,
  screenId: string
): Promise<ScreenDetailData> {
  const fleet = await loadScreenFleet(tenantId);
  const screen = fleet.screens.find((candidate) => candidate.id === screenId) ?? null;
  const empty: ScreenDetailData = {
    auditEvents: [],
    devices: [],
    error: fleet.error,
    heartbeats: [],
    releases: fleet.releases,
    screen,
    syncEvents: []
  };
  if (fleet.error || !screen) return empty;
  const supabase = await createControlSupabaseClient();
  if (!supabase) return { ...empty, error: "De beveiligde datasessie ontbreekt." };

  const screenDevices = fleet.devices.filter((device) => device.screenId === screenId);
  const deviceIds = new Set(screenDevices.map((device) => device.id));
  const [heartbeats, syncEvents, auditEvents] = await Promise.all([
    supabase.from("player_heartbeats").select("id, device_id, active_release_id, runtime_state, storage_used_bytes, storage_quota_bytes, app_version, created_at").eq("tenant_id", tenantId).eq("screen_id", screenId).order("created_at", { ascending: false }).limit(100),
    supabase.from("player_sync_events").select("id, device_id, release_id, phase, detail, created_at").eq("tenant_id", tenantId).eq("screen_id", screenId).order("created_at", { ascending: false }).limit(100),
    supabase.from("audit_events").select("id, action, target_type, target_id, result, metadata, created_at").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(250)
  ]);
  const error = [heartbeats.error, syncEvents.error, auditEvents.error].find(Boolean);
  if (error) {
    console.error("Schermdetail laden mislukt", error);
    return { ...empty, devices: screenDevices, error: "Playerstatus en gebeurtenissen konden niet volledig worden geladen." };
  }

  return {
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
    releases: fleet.releases,
    screen,
    syncEvents: (syncEvents.data ?? []).map((event) => ({
      createdAt: event.created_at,
      detail: objectValue(event.detail),
      id: event.id,
      phase: event.phase,
      releaseId: event.release_id
    }))
  };
}

function mapScreen(screen: Record<string, unknown>): FleetScreen {
  return {
    assignedPlaylistId: stringOrNull(screen.assigned_playlist_id),
    assignedReleaseId: stringOrNull(screen.assigned_release_id),
    createdAt: String(screen.created_at),
    id: String(screen.id),
    location: stringOrNull(screen.location),
    name: String(screen.name),
    orientation: String(screen.orientation),
    resolutionHeight: nullableNumber(screen.resolution_height),
    resolutionWidth: nullableNumber(screen.resolution_width),
    status: String(screen.status)
  };
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
