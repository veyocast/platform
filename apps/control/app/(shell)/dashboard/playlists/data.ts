import "server-only";

import {
  evaluatePlaylistReadiness,
  type PlaylistReadinessResult
} from "@veyocast/domain";

import { createControlSupabaseClient } from "../../../../lib/supabase/server";

export type PlaylistListFilter = {
  assignment?: "all" | "assigned" | "unassigned";
  page?: number;
  query?: string;
  sort?: "name" | "updated";
  status?: "all" | "archived" | "draft" | "published";
};

export type PlaylistListRow = {
  assignedScreenCount: number;
  description: string | null;
  id: string;
  itemCount: number;
  lastPublishedVersion: number | null;
  name: string;
  revision: number;
  status: string;
  totalDurationSeconds: number;
  updatedAt: string;
  updatedBy: string;
};

export type PlaylistStudioItem = {
  asset: PlaylistStudioAsset | null;
  durationSeconds: number;
  fitMode: "contain" | "cover";
  id: string;
  mediaAssetId: string;
  muted: boolean;
  sortOrder: number;
};

export type PlaylistStudioAsset = {
  deletedAt: string | null;
  id: string;
  kind: "image" | "video";
  mimeType: string;
  status: string;
  tenantId: string;
  title: string;
  variant: PlaylistStudioVariant | null;
};

export type PlaylistStudioVariant = {
  assetId: string;
  checksumSha256: string;
  fileSizeBytes: number;
  height: number | null;
  mimeType: string;
  previewUrl: string | null;
  storagePath: string;
  tenantId: string;
  variantType: string;
  width: number | null;
};

export type PlaylistStudioData = {
  assets: PlaylistStudioAsset[];
  error: string | null;
  items: PlaylistStudioItem[];
  playlist: {
    archivedAt: string | null;
    description: string | null;
    id: string;
    name: string;
    revision: number;
    status: string;
    tenantId: string;
    updatedAt: string;
    updatedBy: string;
  } | null;
  readiness: PlaylistReadinessResult | null;
  releases: Array<{
    id: string;
    itemCount: number;
    publishedAt: string;
    publishedBy: string;
    totalBytes: number;
    totalDurationSeconds: number;
    version: number;
  }>;
  screens: Array<{
    assignedPlaylistId: string | null;
    id: string;
    name: string;
    orientation: string;
  }>;
};

const pageSize = 20;

export async function loadPlaylistList(
  tenantId: string,
  filter: PlaylistListFilter
) {
  const supabase = await createControlSupabaseClient();
  const empty = { error: null as string | null, page: 1, pageCount: 1, rows: [] as PlaylistListRow[], total: 0 };
  if (!supabase) return { ...empty, error: "De beveiligde datasessie ontbreekt." };

  const page = Math.max(1, filter.page ?? 1);
  const assignment = filter.assignment ?? "all";
  let assignedIds: string[] | null = null;

  if (assignment !== "all") {
    const assignedResult = await supabase
      .from("screens")
      .select("assigned_playlist_id")
      .eq("tenant_id", tenantId)
      .neq("status", "disabled")
      .not("assigned_playlist_id", "is", null);
    if (assignedResult.error) return { ...empty, error: "De schermtoewijzingen konden niet worden geladen." };
    assignedIds = [...new Set((assignedResult.data ?? []).flatMap((row) => row.assigned_playlist_id ? [row.assigned_playlist_id] : []))];
    if (assignment === "assigned" && assignedIds.length === 0) return empty;
  }

  let query = supabase
    .from("playlists")
    .select("id, name, description, status, revision, updated_at, updated_by", { count: "exact" })
    .eq("tenant_id", tenantId);

  if (filter.status && filter.status !== "all") query = query.eq("status", filter.status);
  if (filter.query?.trim()) query = query.ilike("name", `%${escapeLike(filter.query.trim())}%`);
  if (assignment === "assigned" && assignedIds) query = query.in("id", assignedIds);
  if (assignment === "unassigned" && assignedIds?.length) query = query.not("id", "in", `(${assignedIds.join(",")})`);
  query = filter.sort === "name"
    ? query.order("name", { ascending: true })
    : query.order("updated_at", { ascending: false });

  const from = (page - 1) * pageSize;
  const playlistResult = await query.range(from, from + pageSize - 1);
  if (playlistResult.error) {
    console.error("Playlistlijst laden mislukt", playlistResult.error);
    return { ...empty, error: "De playlists konden niet veilig worden geladen. Vernieuw de pagina." };
  }

  const playlists = playlistResult.data ?? [];
  const ids = playlists.map(({ id }) => id);
  const userIds = [...new Set(playlists.flatMap(({ updated_by }) => updated_by ? [updated_by] : []))];
  const [itemsResult, releasesResult, screensResult, profilesResult] = ids.length
    ? await Promise.all([
        supabase.from("playlist_items").select("playlist_id, duration_seconds").eq("tenant_id", tenantId).in("playlist_id", ids),
        supabase.from("playlist_releases").select("playlist_id, version").eq("tenant_id", tenantId).in("playlist_id", ids).order("version", { ascending: false }),
        supabase.from("screens").select("assigned_playlist_id").eq("tenant_id", tenantId).in("assigned_playlist_id", ids).neq("status", "disabled"),
        userIds.length ? supabase.from("profiles").select("id, display_name").in("id", userIds) : Promise.resolve({ data: [], error: null })
      ])
    : [{ data: [], error: null }, { data: [], error: null }, { data: [], error: null }, { data: [], error: null }];

  const aggregateError = [itemsResult.error, releasesResult.error, screensResult.error, profilesResult.error].find(Boolean);
  if (aggregateError) return { ...empty, error: "De playlistdetails konden niet volledig worden geladen." };

  const profiles = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile.display_name]));
  const rows = playlists.map((playlist): PlaylistListRow => {
    const items = (itemsResult.data ?? []).filter((item) => item.playlist_id === playlist.id);
    const releases = (releasesResult.data ?? []).filter((release) => release.playlist_id === playlist.id);
    return {
      assignedScreenCount: (screensResult.data ?? []).filter((screen) => screen.assigned_playlist_id === playlist.id).length,
      description: playlist.description,
      id: playlist.id,
      itemCount: items.length,
      lastPublishedVersion: releases[0]?.version ?? null,
      name: playlist.name,
      revision: Number(playlist.revision),
      status: playlist.status,
      totalDurationSeconds: items.reduce((total, item) => total + item.duration_seconds, 0),
      updatedAt: playlist.updated_at,
      updatedBy: playlist.updated_by ? profiles.get(playlist.updated_by) ?? "Onbekende gebruiker" : "Systeem"
    };
  });
  const total = playlistResult.count ?? 0;
  return { error: null, page, pageCount: Math.max(1, Math.ceil(total / pageSize)), rows, total };
}

export async function loadPlaylistStudio(
  tenantId: string,
  playlistId: string,
  signPreviews = true
): Promise<PlaylistStudioData> {
  const empty: PlaylistStudioData = { assets: [], error: null, items: [], playlist: null, readiness: null, releases: [], screens: [] };
  const supabase = await createControlSupabaseClient();
  if (!supabase) return { ...empty, error: "De beveiligde datasessie ontbreekt." };

  const [playlistResult, itemsResult, assetsResult, variantsResult, releasesResult, screensResult] = await Promise.all([
    supabase.from("playlists").select("id, tenant_id, name, description, status, revision, archived_at, updated_at, updated_by").eq("tenant_id", tenantId).eq("id", playlistId).maybeSingle(),
    supabase.from("playlist_items").select("id, media_asset_id, sort_order, duration_seconds, fit_mode, muted").eq("tenant_id", tenantId).eq("playlist_id", playlistId).order("sort_order"),
    supabase.from("media_assets").select("id, tenant_id, title, kind, mime_type, status, deleted_at").eq("tenant_id", tenantId).order("created_at", { ascending: false }),
    supabase.from("media_variants").select("asset_id, tenant_id, variant_type, storage_path, mime_type, file_size_bytes, checksum_sha256, width, height").eq("tenant_id", tenantId),
    supabase.from("playlist_releases").select("id, version, item_count, total_duration_seconds, total_bytes, published_at, published_by").eq("tenant_id", tenantId).eq("playlist_id", playlistId).order("version", { ascending: false }),
    supabase.from("screens").select("id, name, orientation, assigned_playlist_id").eq("tenant_id", tenantId).eq("status", "active").order("name")
  ]);
  const error = [playlistResult.error, itemsResult.error, assetsResult.error, variantsResult.error, releasesResult.error, screensResult.error].find(Boolean);
  if (error) {
    console.error("Playlist Studio laden mislukt", error);
    return { ...empty, error: "Playlist Studio kon niet volledig worden geladen. Vernieuw de pagina." };
  }
  if (!playlistResult.data) return empty;

  const profileIds = [...new Set([
    playlistResult.data.updated_by,
    ...(releasesResult.data ?? []).map(({ published_by }) => published_by)
  ].filter((value): value is string => Boolean(value)))];
  const profilesResult = profileIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", profileIds)
    : { data: [], error: null };
  const profiles = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile.display_name]));

  const variants = await Promise.all((variantsResult.data ?? []).map(async (variant): Promise<PlaylistStudioVariant> => {
    let previewUrl: string | null = null;
    if (signPreviews) {
      const signed = await supabase.storage.from("tenant-media").createSignedUrl(variant.storage_path, 600);
      previewUrl = signed.data?.signedUrl ?? null;
    }
    return {
    assetId: variant.asset_id,
    checksumSha256: variant.checksum_sha256,
      fileSizeBytes: Number(variant.file_size_bytes),
      height: variant.height,
      mimeType: variant.mime_type,
      previewUrl,
      storagePath: variant.storage_path,
      tenantId: variant.tenant_id,
      variantType: variant.variant_type,
      width: variant.width
    };
  }));
  const assets = (assetsResult.data ?? []).map((asset): PlaylistStudioAsset => ({
    deletedAt: asset.deleted_at,
    id: asset.id,
    kind: asset.kind,
    mimeType: asset.mime_type,
    status: asset.status,
    tenantId: asset.tenant_id,
    title: asset.title,
    variant: variants.find((variant) => variant.assetId === asset.id && variant.variantType === (asset.kind === "video" ? "player_1080p" : "original")) ?? null
  }));
  const items = (itemsResult.data ?? []).map((item): PlaylistStudioItem => ({
    asset: assets.find((asset) => asset.id === item.media_asset_id) ?? null,
    durationSeconds: item.duration_seconds,
    fitMode: item.fit_mode,
    id: item.id,
    mediaAssetId: item.media_asset_id,
    muted: item.muted,
    sortOrder: item.sort_order
  }));
  const screens = (screensResult.data ?? []).map((screen) => ({
    assignedPlaylistId: screen.assigned_playlist_id,
    id: screen.id,
    name: screen.name,
    orientation: screen.orientation
  }));
  const playlist = playlistResult.data;
  const readiness = evaluatePlaylistReadiness({
    items: items.map((item) => ({
      asset: item.asset ? {
        deleted: Boolean(item.asset.deletedAt),
        id: item.asset.id,
        kind: item.asset.kind,
        status: item.asset.status,
        tenantId: item.asset.tenantId,
        variant: item.asset.variant ? {
          fileSizeBytes: item.asset.variant.fileSizeBytes,
          height: item.asset.variant.height,
          mimeType: item.asset.variant.mimeType,
          tenantId: item.asset.variant.tenantId,
          variantType: item.asset.variant.variantType,
          width: item.asset.variant.width
        } : null
      } : null,
      durationSeconds: item.durationSeconds,
      fitMode: item.fitMode,
      id: item.id,
      mediaAssetId: item.mediaAssetId
    })),
    playlistStatus: playlist.status,
    playlistTenantId: playlist.tenant_id,
    targetOrientations: screens.map(({ orientation }) => orientation)
  });

  return {
    assets,
    error: profilesResult.error ? "De namen van bewerkers konden niet volledig worden geladen." : null,
    items,
    playlist: {
      archivedAt: playlist.archived_at,
      description: playlist.description,
      id: playlist.id,
      name: playlist.name,
      revision: Number(playlist.revision),
      status: playlist.status,
      tenantId: playlist.tenant_id,
      updatedAt: playlist.updated_at,
      updatedBy: playlist.updated_by ? profiles.get(playlist.updated_by) ?? "Onbekende gebruiker" : "Systeem"
    },
    readiness,
    releases: (releasesResult.data ?? []).map((release) => ({
      id: release.id,
      itemCount: release.item_count,
      publishedAt: release.published_at,
      publishedBy: release.published_by ? profiles.get(release.published_by) ?? "Onbekende gebruiker" : "Systeem",
      totalBytes: Number(release.total_bytes),
      totalDurationSeconds: release.total_duration_seconds,
      version: release.version
    })),
    screens
  };
}

function escapeLike(value: string) {
  return value.replace(/[%_]/g, "");
}
