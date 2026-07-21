import "server-only";

import {
  evaluateReleasePreflight,
  type ReleaseComparisonItem,
  type ReleasePreflightResult
} from "@veyocast/domain";

import { createControlSupabaseClient } from "../../../../lib/supabase/server";

export type ReleaseCenterRow = {
  currentScreenCount: number;
  deploymentTargetCount: number;
  id: string;
  itemCount: number;
  manifestHash: string;
  notes: string | null;
  playlistId: string;
  playlistName: string;
  publishedAt: string;
  publishedBy: string;
  totalBytes: number;
  totalDurationSeconds: number;
  version: number;
};

export type ReleaseTargetScreen = {
  assignedReleaseId: string | null;
  id: string;
  location: string | null;
  name: string;
  orientation: string;
  status: string;
};

export type ReleaseScreenPreflight = {
  activeReleaseId: string | null;
  desiredReleaseId: string | null;
  deviceId: string | null;
  heartbeatAt: string | null;
  latestPhase: string | null;
  preflight: ReleasePreflightResult;
  screen: ReleaseTargetScreen;
};

export type ReleaseCenterData = {
  error: string | null;
  releases: ReleaseCenterRow[];
};

export type ReleaseDetailData = {
  assignments: Array<{
    assignedAt: string;
    assignmentKind: string;
    screenId: string;
    screenName: string;
  }>;
  comparisonReleases: Array<{ id: string; version: number }>;
  error: string | null;
  items: ReleaseComparisonItem[];
  release: ReleaseCenterRow | null;
  screenStates: ReleaseScreenPreflight[];
};

export async function loadReleaseCenter(tenantId: string): Promise<ReleaseCenterData> {
  const supabase = await createControlSupabaseClient();
  if (!supabase) return { error: "De beveiligde datasessie ontbreekt.", releases: [] };

  const [releaseResult, playlistResult, profileResult, assignmentResult, screenResult] = await Promise.all([
    supabase.from("playlist_releases").select("id, playlist_id, version, release_notes, manifest_hash, item_count, total_duration_seconds, total_bytes, published_by, published_at").eq("tenant_id", tenantId).order("published_at", { ascending: false }),
    supabase.from("playlists").select("id, name").eq("tenant_id", tenantId),
    supabase.from("profiles").select("id, display_name"),
    supabase.from("release_screen_assignments").select("release_id, screen_id").eq("tenant_id", tenantId),
    supabase.from("screens").select("id, assigned_release_id").eq("tenant_id", tenantId).is("deleted_at", null)
  ]);
  const error = [releaseResult.error, playlistResult.error, profileResult.error, assignmentResult.error, screenResult.error].find(Boolean);
  if (error) {
    console.error("Release Center laden mislukt", error);
    return { error: "De releasehistorie kon niet volledig worden geladen. Vernieuw de pagina.", releases: [] };
  }

  const playlists = new Map((playlistResult.data ?? []).map((playlist) => [playlist.id, playlist.name]));
  const profiles = new Map((profileResult.data ?? []).map((profile) => [profile.id, profile.display_name]));
  return {
    error: null,
    releases: (releaseResult.data ?? []).map((release) => ({
      currentScreenCount: (screenResult.data ?? []).filter((screen) => screen.assigned_release_id === release.id).length,
      deploymentTargetCount: new Set((assignmentResult.data ?? []).filter((assignment) => assignment.release_id === release.id).map((assignment) => assignment.screen_id)).size,
      id: release.id,
      itemCount: release.item_count,
      manifestHash: release.manifest_hash,
      notes: release.release_notes,
      playlistId: release.playlist_id,
      playlistName: playlists.get(release.playlist_id) ?? "Verwijderde playlist",
      publishedAt: release.published_at,
      publishedBy: release.published_by ? profiles.get(release.published_by) ?? "Onbekende gebruiker" : "Systeem",
      totalBytes: Number(release.total_bytes),
      totalDurationSeconds: release.total_duration_seconds,
      version: release.version
    }))
  };
}

export async function loadReleaseDetail(
  tenantId: string,
  releaseId: string
): Promise<ReleaseDetailData> {
  const center = await loadReleaseCenter(tenantId);
  const empty: ReleaseDetailData = { assignments: [], comparisonReleases: [], error: center.error, items: [], release: null, screenStates: [] };
  if (center.error) return empty;
  const release = center.releases.find((candidate) => candidate.id === releaseId) ?? null;
  if (!release) return empty;

  const supabase = await createControlSupabaseClient();
  if (!supabase) return { ...empty, error: "De beveiligde datasessie ontbreekt." };

  const [itemsResult, allItemsResult, releasesResult, assignmentsResult, screensResult, devicesResult, heartbeatsResult, syncResult] = await Promise.all([
    releaseItemsQuery(supabase, tenantId).eq("release_id", releaseId).order("sort_order"),
    releaseItemsQuery(supabase, tenantId),
    supabase.from("playlist_releases").select("id, version").eq("tenant_id", tenantId).eq("playlist_id", release.playlistId).order("version", { ascending: false }),
    supabase.from("release_screen_assignments").select("screen_id, assignment_kind, assigned_at").eq("tenant_id", tenantId).eq("release_id", releaseId).order("assigned_at", { ascending: false }),
    supabase.from("screens").select("id, name, location, orientation, status, assigned_release_id").eq("tenant_id", tenantId).is("deleted_at", null).order("name"),
    supabase.from("player_devices").select("id, screen_id, status, active_release_id, desired_release_id, capabilities").eq("tenant_id", tenantId).eq("status", "paired"),
    supabase.from("player_heartbeats").select("device_id, active_release_id, storage_used_bytes, storage_quota_bytes, created_at").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(1000),
    supabase.from("player_sync_events").select("screen_id, device_id, release_id, phase, created_at").eq("tenant_id", tenantId).eq("release_id", releaseId).order("created_at", { ascending: false }).limit(500)
  ]);
  const error = [itemsResult.error, allItemsResult.error, releasesResult.error, assignmentsResult.error, screensResult.error, devicesResult.error, heartbeatsResult.error, syncResult.error].find(Boolean);
  if (error) {
    console.error("Releasedetail laden mislukt", error);
    return { ...empty, error: "De releasedetails en schermstatus konden niet volledig worden geladen." };
  }

  const items = (itemsResult.data ?? []).map(mapReleaseItem);
  const allItems = allItemsResult.data ?? [];
  const screens: ReleaseTargetScreen[] = (screensResult.data ?? []).map((screen) => ({
    assignedReleaseId: screen.assigned_release_id,
    id: screen.id,
    location: screen.location,
    name: screen.name,
    orientation: screen.orientation,
    status: screen.status
  }));
  const screensById = new Map(screens.map((screen) => [screen.id, screen]));
  const now = new Date().toISOString();
  const screenStates = screens.map((screen): ReleaseScreenPreflight => {
    const device = (devicesResult.data ?? []).find((candidate) => candidate.screen_id === screen.id) ?? null;
    const deviceHeartbeats = device ? (heartbeatsResult.data ?? []).filter((heartbeat) => heartbeat.device_id === device.id) : [];
    const latestHeartbeat = deviceHeartbeats[0] ?? null;
    const previousReleaseId = device
      ? deviceHeartbeats.find((heartbeat) => heartbeat.active_release_id && heartbeat.active_release_id !== device.active_release_id)?.active_release_id ?? null
      : null;
    const checksums = (candidateReleaseId: string | null) => candidateReleaseId
      ? allItems.filter((item) => item.release_id === candidateReleaseId).map((item) => item.checksum_sha256)
      : [];
    const capabilities = parseCapabilities(device?.capabilities);
    return {
      activeReleaseId: device?.active_release_id ?? null,
      desiredReleaseId: device?.desired_release_id ?? null,
      deviceId: device?.id ?? null,
      heartbeatAt: latestHeartbeat?.created_at ?? null,
      latestPhase: (syncResult.data ?? []).find((event) => event.screen_id === screen.id)?.phase ?? null,
      preflight: evaluateReleasePreflight({
        activeReleaseChecksums: checksums(device?.active_release_id ?? null),
        capabilities,
        devicePresent: Boolean(device),
        heartbeatAt: latestHeartbeat?.created_at ?? null,
        now,
        previousReleaseChecksums: checksums(previousReleaseId),
        release: {
          items: items.map((item) => ({ checksumSha256: item.checksumSha256, fileSizeBytes: item.fileSizeBytes })),
          schemaVersion: 1
        },
        screenStatus: screen.status,
        storageQuotaBytes: latestHeartbeat?.storage_quota_bytes === null || latestHeartbeat?.storage_quota_bytes === undefined ? null : Number(latestHeartbeat.storage_quota_bytes),
        storageUsedBytes: latestHeartbeat?.storage_used_bytes === null || latestHeartbeat?.storage_used_bytes === undefined ? null : Number(latestHeartbeat.storage_used_bytes)
      }),
      screen
    };
  });

  return {
    assignments: (assignmentsResult.data ?? []).map((assignment) => ({
      assignedAt: assignment.assigned_at,
      assignmentKind: assignment.assignment_kind,
      screenId: assignment.screen_id,
      screenName: screensById.get(assignment.screen_id)?.name ?? "Verwijderd scherm"
    })),
    comparisonReleases: releasesResult.data ?? [],
    error: null,
    items,
    release,
    screenStates
  };
}

export async function loadDraftPreflight(
  tenantId: string,
  targetItems: readonly Readonly<{ checksumSha256: string; fileSizeBytes: number }>[]
): Promise<{ error: string | null; screenStates: ReleaseScreenPreflight[] }> {
  const supabase = await createControlSupabaseClient();
  if (!supabase) return { error: "De beveiligde datasessie ontbreekt.", screenStates: [] };
  const [screensResult, devicesResult, heartbeatsResult, allItemsResult] = await Promise.all([
    supabase.from("screens").select("id, name, location, orientation, status, assigned_release_id").eq("tenant_id", tenantId).is("deleted_at", null).order("name"),
    supabase.from("player_devices").select("id, screen_id, active_release_id, desired_release_id, capabilities").eq("tenant_id", tenantId).eq("status", "paired"),
    supabase.from("player_heartbeats").select("device_id, active_release_id, storage_used_bytes, storage_quota_bytes, created_at").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(1000),
    releaseItemsQuery(supabase, tenantId)
  ]);
  const error = [screensResult.error, devicesResult.error, heartbeatsResult.error, allItemsResult.error].find(Boolean);
  if (error) {
    console.error("Conceptpreflight laden mislukt", error);
    return { error: "De schermpreflight kon niet volledig worden berekend.", screenStates: [] };
  }
  const allItems = allItemsResult.data ?? [];
  const now = new Date().toISOString();
  return {
    error: null,
    screenStates: (screensResult.data ?? []).map((screen): ReleaseScreenPreflight => {
      const device = (devicesResult.data ?? []).find((candidate) => candidate.screen_id === screen.id) ?? null;
      const deviceHeartbeats = device ? (heartbeatsResult.data ?? []).filter((heartbeat) => heartbeat.device_id === device.id) : [];
      const latestHeartbeat = deviceHeartbeats[0] ?? null;
      const previousReleaseId = device
        ? deviceHeartbeats.find((heartbeat) => heartbeat.active_release_id && heartbeat.active_release_id !== device.active_release_id)?.active_release_id ?? null
        : null;
      const checksums = (candidateReleaseId: string | null) => candidateReleaseId
        ? allItems.filter((item) => item.release_id === candidateReleaseId).map((item) => item.checksum_sha256)
        : [];
      return {
        activeReleaseId: device?.active_release_id ?? null,
        desiredReleaseId: device?.desired_release_id ?? null,
        deviceId: device?.id ?? null,
        heartbeatAt: latestHeartbeat?.created_at ?? null,
        latestPhase: null,
        preflight: evaluateReleasePreflight({
          activeReleaseChecksums: checksums(device?.active_release_id ?? null),
          capabilities: parseCapabilities(device?.capabilities),
          devicePresent: Boolean(device),
          heartbeatAt: latestHeartbeat?.created_at ?? null,
          now,
          previousReleaseChecksums: checksums(previousReleaseId),
          release: { items: targetItems, schemaVersion: 1 },
          screenStatus: screen.status,
          storageQuotaBytes: latestHeartbeat?.storage_quota_bytes === null || latestHeartbeat?.storage_quota_bytes === undefined ? null : Number(latestHeartbeat.storage_quota_bytes),
          storageUsedBytes: latestHeartbeat?.storage_used_bytes === null || latestHeartbeat?.storage_used_bytes === undefined ? null : Number(latestHeartbeat.storage_used_bytes)
        }),
        screen: {
          assignedReleaseId: screen.assigned_release_id,
          id: screen.id,
          location: screen.location,
          name: screen.name,
          orientation: screen.orientation,
          status: screen.status
        }
      };
    })
  };
}

function releaseItemsQuery(supabase: Awaited<ReturnType<typeof createControlSupabaseClient>>, tenantId: string) {
  if (!supabase) throw new Error("Supabase client ontbreekt");
  return supabase.from("playlist_release_items").select("release_id, source_item_id, media_asset_id, sort_order, duration_seconds, fit_mode, muted, asset_title, file_size_bytes, checksum_sha256").eq("tenant_id", tenantId);
}

function mapReleaseItem(item: {
  asset_title: string;
  checksum_sha256: string;
  duration_seconds: number;
  file_size_bytes: number;
  fit_mode: string;
  media_asset_id: string;
  muted: boolean;
  sort_order: number;
  source_item_id: string | null;
}): ReleaseComparisonItem {
  return {
    assetTitle: item.asset_title,
    checksumSha256: item.checksum_sha256,
    durationSeconds: item.duration_seconds,
    fileSizeBytes: Number(item.file_size_bytes),
    fitMode: item.fit_mode,
    mediaAssetId: item.media_asset_id,
    muted: item.muted,
    sortOrder: item.sort_order,
    sourceItemId: item.source_item_id
  };
}

function parseCapabilities(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const versions = (value as { manifestSchemaVersions?: unknown }).manifestSchemaVersions;
  if (!Array.isArray(versions)) return null;
  return { manifestSchemaVersions: versions.filter((version): version is number => Number.isInteger(version)) };
}
