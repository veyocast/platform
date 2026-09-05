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

export type DraftPreflightData = {
  error: string | null;
  screenStates: ReleaseScreenPreflight[];
  warning: string | null;
};

export async function loadReleaseCenter(tenantId: string): Promise<ReleaseCenterData> {
  const supabase = await createControlSupabaseClient();
  if (!supabase) return { error: "De beveiligde datasessie ontbreekt.", releases: [] };

  const [releaseResult, playlistResult, profileResult, assignmentResult, screenResult] = await Promise.all([
    loadAllPages((from, to) => supabase.from("playlist_releases").select("id, playlist_id, version, release_notes, manifest_hash, item_count, total_duration_seconds, total_bytes, published_by, published_at").eq("tenant_id", tenantId).order("published_at", { ascending: false }).order("id").range(from, to)),
    loadAllPages((from, to) => supabase.from("playlists").select("id, name").eq("tenant_id", tenantId).order("id").range(from, to)),
    loadAllPages((from, to) => supabase.from("profiles").select("id, display_name").order("id").range(from, to)),
    loadAllPages((from, to) => supabase.from("release_screen_assignments").select("release_id, screen_id").eq("tenant_id", tenantId).order("release_id").order("screen_id").range(from, to)),
    loadAllPages((from, to) => supabase.from("screens").select("id, assigned_release_id").eq("tenant_id", tenantId).is("deleted_at", null).order("id").range(from, to))
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
  const supabase = await createControlSupabaseClient();
  const empty: ReleaseDetailData = { assignments: [], comparisonReleases: [], error: null, items: [], release: null, screenStates: [] };
  if (!supabase) return { ...empty, error: "De beveiligde datasessie ontbreekt." };

  const releaseResult = await supabase
    .from("playlist_releases")
    .select("id, playlist_id, version, release_notes, manifest_hash, item_count, total_duration_seconds, total_bytes, published_by, published_at")
    .eq("tenant_id", tenantId)
    .eq("id", releaseId)
    .maybeSingle();
  if (releaseResult.error) {
    console.error("Releasedetail: release laden mislukt", releaseResult.error);
    return { ...empty, error: "De release kon niet veilig worden geladen." };
  }
  const releaseRecord = releaseResult.data;
  if (!releaseRecord) return empty;
  const [playlistResult, profileResult] = await Promise.all([
    supabase.from("playlists").select("name").eq("tenant_id", tenantId).eq("id", releaseRecord.playlist_id).maybeSingle(),
    releaseRecord.published_by
      ? supabase.from("profiles").select("display_name").eq("id", releaseRecord.published_by).maybeSingle()
      : Promise.resolve({ data: null, error: null })
  ]);
  if (playlistResult.error || profileResult.error) {
    console.error("Releasedetail: playlist of publiceerder laden mislukt", playlistResult.error ?? profileResult.error);
    return { ...empty, error: "De releasecontext kon niet volledig worden geladen." };
  }
  const baseRelease: ReleaseCenterRow = {
    currentScreenCount: 0,
    deploymentTargetCount: 0,
    id: releaseRecord.id,
    itemCount: releaseRecord.item_count,
    manifestHash: releaseRecord.manifest_hash,
    notes: releaseRecord.release_notes,
    playlistId: releaseRecord.playlist_id,
    playlistName: playlistResult.data?.name ?? "Verwijderde playlist",
    publishedAt: releaseRecord.published_at,
    publishedBy: releaseRecord.published_by
      ? profileResult.data?.display_name ?? "Onbekende gebruiker"
      : "Systeem",
    totalBytes: Number(releaseRecord.total_bytes),
    totalDurationSeconds: releaseRecord.total_duration_seconds,
    version: releaseRecord.version
  };

  const [itemsResult, releasesResult, assignmentsResult, screensResult, devicesResult, syncResult] = await Promise.all([
    loadAllPages((from, to) => releaseItemsQuery(supabase, tenantId).eq("release_id", releaseId).order("sort_order").order("id").range(from, to)),
    loadAllPages((from, to) => supabase.from("playlist_releases").select("id, version").eq("tenant_id", tenantId).eq("playlist_id", baseRelease.playlistId).order("version", { ascending: false }).order("id").range(from, to)),
    loadAllPages((from, to) => supabase.from("release_screen_assignments").select("screen_id, assignment_kind, assigned_at").eq("tenant_id", tenantId).eq("release_id", releaseId).order("assigned_at", { ascending: false }).order("screen_id").range(from, to)),
    loadAllPages((from, to) => supabase.from("screens").select("id, name, location, orientation, status, assigned_release_id").eq("tenant_id", tenantId).is("deleted_at", null).order("name").order("id").range(from, to)),
    loadAllPages((from, to) => supabase.from("player_devices").select("id, screen_id, status, active_release_id, desired_release_id, capabilities, last_seen_at, storage_used_bytes, storage_quota_bytes").eq("tenant_id", tenantId).eq("status", "paired").order("screen_id").order("id").range(from, to)),
    supabase.from("player_sync_events").select("id, screen_id, device_id, release_id, phase, created_at").eq("tenant_id", tenantId).eq("release_id", releaseId).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(1_000)
  ]);
  const error = [itemsResult.error, releasesResult.error, assignmentsResult.error, screensResult.error, devicesResult.error, syncResult.error].find(Boolean);
  if (error) {
    console.error("Releasedetail laden mislukt", error);
    return { ...empty, error: "De releasedetails en schermstatus konden niet volledig worden geladen." };
  }

  const items = (itemsResult.data ?? []).map(mapReleaseItem);
  const devices = devicesResult.data ?? [];
  const activeReleaseIds = [...new Set(devices.flatMap((device) =>
    device.active_release_id ? [device.active_release_id] : []
  ))];
  const activeItemsResult = await loadReleaseChecksums(supabase, tenantId, activeReleaseIds);
  if (activeItemsResult.error) {
    console.error("Releasedetail: actieve releasecache laden mislukt", activeItemsResult.error);
  }
  const activeChecksums = new Map<string, string[]>();
  for (const item of activeItemsResult.data) {
    const checksums = activeChecksums.get(item.release_id) ?? [];
    checksums.push(item.checksum_sha256);
    activeChecksums.set(item.release_id, checksums);
  }
  const screens: ReleaseTargetScreen[] = (screensResult.data ?? []).map((screen) => ({
    assignedReleaseId: screen.assigned_release_id,
    id: screen.id,
    location: screen.location,
    name: screen.name,
    orientation: screen.orientation,
    status: screen.status
  }));
  const screensById = new Map(screens.map((screen) => [screen.id, screen]));
  const devicesByScreen = new Map(devices.map((device) => [device.screen_id, device]));
  const now = new Date().toISOString();
  const screenStates = screens.map((screen): ReleaseScreenPreflight => {
    const device = devicesByScreen.get(screen.id) ?? null;
    const cacheKnown = !activeItemsResult.error;
    const capabilities = parseCapabilities(device?.capabilities);
    return {
      activeReleaseId: device?.active_release_id ?? null,
      desiredReleaseId: device?.desired_release_id ?? null,
      deviceId: device?.id ?? null,
      heartbeatAt: device?.last_seen_at ?? null,
      latestPhase: (syncResult.data ?? []).find((event) => event.screen_id === screen.id)?.phase ?? null,
      preflight: evaluateReleasePreflight({
        activeReleaseChecksums: device?.active_release_id
          ? activeChecksums.get(device.active_release_id) ?? []
          : [],
        capabilities,
        devicePresent: Boolean(device),
        heartbeatAt: device?.last_seen_at ?? null,
        now,
        previousReleaseChecksums: [],
        release: {
          items: items.map((item) => ({ checksumSha256: item.checksumSha256, fileSizeBytes: item.fileSizeBytes })),
          schemaVersion: 1
        },
        screenStatus: screen.status,
        storageQuotaBytes: cacheKnown && device?.storage_quota_bytes !== null && device?.storage_quota_bytes !== undefined
          ? Number(device.storage_quota_bytes)
          : null,
        storageUsedBytes: cacheKnown && device?.storage_used_bytes !== null && device?.storage_used_bytes !== undefined
          ? Number(device.storage_used_bytes)
          : null
      }),
      screen
    };
  });

  const release: ReleaseCenterRow = {
    ...baseRelease,
    currentScreenCount: screens.filter((screen) => screen.assignedReleaseId === releaseId).length,
    deploymentTargetCount: new Set((assignmentsResult.data ?? []).map((assignment) => assignment.screen_id)).size
  };

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
  targetItems: readonly Readonly<{ checksumSha256: string; fileSizeBytes: number }>[],
  targetScreenIds: readonly string[] = []
): Promise<DraftPreflightData> {
  const supabase = await createControlSupabaseClient();
  if (!supabase) {
    return {
      error: "De beveiligde datasessie ontbreekt.",
      screenStates: [],
      warning: null
    };
  }

  // A screen is a publish target even when optional Player telemetry is
  // temporarily unavailable. Loading targets first prevents a secondary
  // preflight failure from being presented as "no screens available".
  const screensResult = await loadAllPages((from, to) => {
    let query = supabase
      .from("screens")
      .select("id, name, location, orientation, status, assigned_release_id")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null);
    if (targetScreenIds.length) query = query.in("id", [...targetScreenIds]);
    return query.order("name").order("id").range(from, to);
  });
  if (screensResult.error) {
    console.error("Conceptpreflight: doelschermen laden mislukt", screensResult.error);
    return {
      error: "De doelschermen konden niet worden geladen. Vernieuw de pagina en probeer opnieuw.",
      screenStates: [],
      warning: null
    };
  }

  const devicesResult = await loadAllPages((from, to) => {
    let query = supabase
      .from("player_devices")
      .select("id, screen_id, active_release_id, desired_release_id, capabilities, last_seen_at, storage_used_bytes, storage_quota_bytes")
      .eq("tenant_id", tenantId)
      .eq("status", "paired");
    if (targetScreenIds.length) query = query.in("screen_id", [...targetScreenIds]);
    return query.order("screen_id").order("id").range(from, to);
  });
  const warnings: string[] = [];
  if (devicesResult.error) {
    console.error("Conceptpreflight: Playerstatus laden mislukt", devicesResult.error);
    warnings.push("De schermen zijn beschikbaar, maar de actuele Playerstatus kon niet worden geladen. Ze blijven selecteerbaar en worden veilig als onbekend beoordeeld.");
  }
  const devices = devicesResult.error ? [] : devicesResult.data ?? [];
  const activeReleaseIds = [...new Set(
    devices
      .map((device) => device.active_release_id)
      .filter((releaseId): releaseId is string => Boolean(releaseId))
  )];
  const activeReleaseItems: Array<{ checksum_sha256: string; release_id: string }> = [];
  const unavailableActiveReleaseIds = new Set<string>();
  for (let offset = 0; offset < activeReleaseIds.length; offset += 100) {
    const releaseIds = activeReleaseIds.slice(offset, offset + 100);
    const batchItems: Array<{ checksum_sha256: string; release_id: string }> = [];
    let batchAvailable = true;
    for (let pageOffset = 0; ; pageOffset += 1_000) {
      const releaseItemsResult = await supabase
        .from("playlist_release_items")
        .select("release_id, checksum_sha256, sort_order")
        .eq("tenant_id", tenantId)
        .in("release_id", releaseIds)
        .order("release_id")
        .order("sort_order")
        .range(pageOffset, pageOffset + 999);
      if (releaseItemsResult.error) {
        releaseIds.forEach((releaseId) => unavailableActiveReleaseIds.add(releaseId));
        console.error("Conceptpreflight: actieve releasecache laden mislukt", releaseItemsResult.error);
        batchAvailable = false;
        break;
      }
      const pageItems = releaseItemsResult.data ?? [];
      batchItems.push(...pageItems);
      if (pageItems.length < 1_000) break;
    }
    if (batchAvailable) activeReleaseItems.push(...batchItems);
  }
  if (unavailableActiveReleaseIds.size) {
    warnings.push("Niet alle actieve cachegegevens konden worden geladen. De opslagcontrole blijft voor de betrokken schermen onbekend en vereist daarom een bewuste bevestiging.");
  }

  const activeChecksums = new Map<string, string[]>();
  for (const item of activeReleaseItems) {
    const checksums = activeChecksums.get(item.release_id) ?? [];
    checksums.push(item.checksum_sha256);
    activeChecksums.set(item.release_id, checksums);
  }
  const now = new Date().toISOString();
  return {
    error: null,
    screenStates: (screensResult.data ?? []).map((screen): ReleaseScreenPreflight => {
      const device = devices.find((candidate) => candidate.screen_id === screen.id) ?? null;
      const cacheKnown = !device?.active_release_id ||
        !unavailableActiveReleaseIds.has(device.active_release_id);
      return {
        activeReleaseId: device?.active_release_id ?? null,
        desiredReleaseId: device?.desired_release_id ?? null,
        deviceId: device?.id ?? null,
        heartbeatAt: device?.last_seen_at ?? null,
        latestPhase: null,
        preflight: evaluateReleasePreflight({
          activeReleaseChecksums: device?.active_release_id
            ? activeChecksums.get(device.active_release_id) ?? []
            : [],
          capabilities: parseCapabilities(device?.capabilities),
          devicePresent: Boolean(device),
          heartbeatAt: device?.last_seen_at ?? null,
          now,
          previousReleaseChecksums: [],
          release: { items: targetItems, schemaVersion: 1 },
          screenStatus: screen.status,
          storageQuotaBytes: cacheKnown && device?.storage_quota_bytes !== null && device?.storage_quota_bytes !== undefined
            ? Number(device.storage_quota_bytes)
            : null,
          storageUsedBytes: cacheKnown && device?.storage_used_bytes !== null && device?.storage_used_bytes !== undefined
            ? Number(device.storage_used_bytes)
            : null
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
    }),
    warning: warnings.length ? warnings.join(" ") : null
  };
}

export async function loadReleasePreflight(
  tenantId: string,
  releaseId: string,
  targetScreenIds: readonly string[]
): Promise<DraftPreflightData> {
  const supabase = await createControlSupabaseClient();
  if (!supabase) {
    return {
      error: "De beveiligde datasessie ontbreekt.",
      screenStates: [],
      warning: null
    };
  }
  const itemsResult = await loadAllPages((from, to) => supabase
    .from("playlist_release_items")
    .select("checksum_sha256, file_size_bytes")
    .eq("tenant_id", tenantId)
    .eq("release_id", releaseId)
    .order("sort_order")
    .order("id")
    .range(from, to));
  if (itemsResult.error) {
    console.error("Releasepreflight: immutable items laden mislukt", itemsResult.error);
    return {
      error: "De immutable release-inhoud kon niet worden geladen. Er is niets toegewezen.",
      screenStates: [],
      warning: null
    };
  }
  return loadDraftPreflight(
    tenantId,
    itemsResult.data.map((item) => ({
      checksumSha256: item.checksum_sha256,
      fileSizeBytes: Number(item.file_size_bytes)
    })),
    targetScreenIds
  );
}

function releaseItemsQuery(supabase: Awaited<ReturnType<typeof createControlSupabaseClient>>, tenantId: string) {
  if (!supabase) throw new Error("Supabase client ontbreekt");
  return supabase.from("playlist_release_items").select("release_id, source_item_id, media_asset_id, sort_order, duration_seconds, fit_mode, muted, asset_title, file_size_bytes, checksum_sha256, display_title, transition, crop_focus_x, crop_focus_y, background_color, volume_percent, trim_start_seconds, trim_end_seconds, visible_from, visible_until, enabled").eq("tenant_id", tenantId);
}

async function loadReleaseChecksums(
  supabase: NonNullable<Awaited<ReturnType<typeof createControlSupabaseClient>>>,
  tenantId: string,
  releaseIds: readonly string[]
): Promise<{
  data: Array<{ checksum_sha256: string; release_id: string }>;
  error: unknown | null;
}> {
  const data: Array<{ checksum_sha256: string; release_id: string }> = [];
  for (let offset = 0; offset < releaseIds.length; offset += 100) {
    const batchIds = releaseIds.slice(offset, offset + 100);
    const batch = await loadAllPages((from, to) => supabase
      .from("playlist_release_items")
      .select("release_id, checksum_sha256")
      .eq("tenant_id", tenantId)
      .in("release_id", batchIds)
      .order("release_id")
      .order("sort_order")
      .order("id")
      .range(from, to));
    if (batch.error) return { data: [], error: batch.error };
    data.push(...batch.data);
  }
  return { data, error: null };
}

async function loadAllPages<Row>(
  loadPage: (
    from: number,
    to: number
  ) => PromiseLike<{ data: Row[] | null; error: unknown }>,
  pageSize = 1_000
): Promise<{ data: Row[]; error: unknown | null }> {
  const data: Row[] = [];
  for (let from = 0; ; from += pageSize) {
    const page = await loadPage(from, from + pageSize - 1);
    if (page.error) return { data: [], error: page.error };
    const rows = page.data ?? [];
    data.push(...rows);
    if (rows.length < pageSize) return { data, error: null };
  }
}

function mapReleaseItem(item: {
  asset_title: string;
  background_color: string | null;
  checksum_sha256: string;
  crop_focus_x: number;
  crop_focus_y: number;
  display_title: string | null;
  duration_seconds: number;
  enabled: boolean;
  file_size_bytes: number;
  fit_mode: string;
  media_asset_id: string;
  muted: boolean;
  sort_order: number;
  source_item_id: string | null;
  transition: string;
  trim_end_seconds: number | null;
  trim_start_seconds: number;
  visible_from: string | null;
  visible_until: string | null;
  volume_percent: number;
}): ReleaseComparisonItem {
  return {
    assetTitle: item.asset_title,
    backgroundColor: item.background_color,
    checksumSha256: item.checksum_sha256,
    cropFocusX: Number(item.crop_focus_x),
    cropFocusY: Number(item.crop_focus_y),
    displayTitle: item.display_title,
    durationSeconds: item.duration_seconds,
    enabled: item.enabled,
    fileSizeBytes: Number(item.file_size_bytes),
    fitMode: item.fit_mode,
    mediaAssetId: item.media_asset_id,
    muted: item.muted,
    sortOrder: item.sort_order,
    sourceItemId: item.source_item_id,
    transition: item.transition,
    trimEndSeconds: item.trim_end_seconds === null ? null : Number(item.trim_end_seconds),
    trimStartSeconds: Number(item.trim_start_seconds),
    visibleFrom: item.visible_from,
    visibleUntil: item.visible_until,
    volumePercent: item.volume_percent
  };
}

function parseCapabilities(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const versions = (value as { manifestSchemaVersions?: unknown }).manifestSchemaVersions;
  if (!Array.isArray(versions)) return null;
  return { manifestSchemaVersions: versions.filter((version): version is number => Number.isInteger(version)) };
}
