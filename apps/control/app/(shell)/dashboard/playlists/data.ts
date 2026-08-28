import "server-only";

import {
  evaluatePlaylistReadiness,
  type PlaylistReadinessResult
} from "@veyocast/domain";

import { createControlSupabaseClient } from "../../../../lib/supabase/server";
import type {
  PlaylistStudioAsset,
  PlaylistStudioDynamicSlide,
  PlaylistStudioEngageCampaign,
  PlaylistStudioItem,
  PlaylistStudioSection,
  PlaylistStudioYouTubeSource,
  PlaylistStudioVariant
} from "./playlist-studio-contract";
import {
  chunkPlaylistStudioIds,
  mergePlaylistStudioRows
} from "./playlist-studio-query-scope";

export type PlaylistListFilter = {
  assignment?: "all" | "assigned" | "unassigned";
  page?: number;
  query?: string;
  sort?: "name" | "updated";
  status?: "all" | "archived" | "draft" | "published";
};

export type PlaylistListRow = {
  assignedScreenCount: number;
  coverPreviewUrls: string[];
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
  warningCount: number;
};

export type PlaylistStudioData = {
  assets: PlaylistStudioAsset[];
  dynamicSlides: PlaylistStudioDynamicSlide[];
  engageCampaigns: PlaylistStudioEngageCampaign[];
  error: string | null;
  items: PlaylistStudioItem[];
  playlist: {
    archivedAt: string | null;
    defaultBackgroundColor: string | null;
    defaultFitMode: "contain" | "cover";
    defaultImageDurationSeconds: number;
    defaultTransition: "crossfade" | "cut" | "wipe";
    defaultVideoMuted: boolean;
    description: string | null;
    id: string;
    loopEnabled: boolean;
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
  sections: PlaylistStudioSection[];
  screens: Array<{
    activeReleaseId: string | null;
    assignedPlaylistId: string | null;
    desiredReleaseId: string | null;
    id: string;
    lastSeenAt: string | null;
    name: string;
    orientation: string;
  }>;
  youtubeSources: PlaylistStudioYouTubeSource[];
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
      .is("deleted_at", null)
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
        supabase.from("playlist_items").select("playlist_id, media_asset_id, duration_seconds").eq("tenant_id", tenantId).in("playlist_id", ids).order("sort_order"),
        supabase.from("playlist_releases").select("playlist_id, version").eq("tenant_id", tenantId).in("playlist_id", ids).order("version", { ascending: false }),
        supabase.from("screens").select("assigned_playlist_id").eq("tenant_id", tenantId).is("deleted_at", null).in("assigned_playlist_id", ids).neq("status", "disabled"),
        userIds.length ? supabase.from("profiles").select("id, display_name").in("id", userIds) : Promise.resolve({ data: [], error: null })
      ])
    : [{ data: [], error: null }, { data: [], error: null }, { data: [], error: null }, { data: [], error: null }];

  const aggregateError = [itemsResult.error, releasesResult.error, screensResult.error, profilesResult.error].find(Boolean);
  if (aggregateError) return { ...empty, error: "De playlistdetails konden niet volledig worden geladen." };

  const assetIds = [...new Set((itemsResult.data ?? []).map(({ media_asset_id }) => media_asset_id))];
  const [assetsResult, variantsResult] = assetIds.length
    ? await Promise.all([
        supabase
          .from("media_assets")
          .select("id, status, deleted_at")
          .eq("tenant_id", tenantId)
          .in("id", assetIds),
        supabase
          .from("media_variants")
          .select("asset_id, storage_path, variant_type")
          .eq("tenant_id", tenantId)
          .in("asset_id", assetIds)
          .in("variant_type", ["thumbnail", "original"])
      ])
    : [{ data: [], error: null }, { data: [], error: null }];
  if (assetsResult.error || variantsResult.error) {
    return { ...empty, error: "De visuele playlistdetails konden niet volledig worden geladen." };
  }

  const assets = new Map((assetsResult.data ?? []).map((asset) => [asset.id, asset]));
  const previewPaths = new Map<string, { path: string; priority: number }>();
  const previewPriority: Record<string, number> = {
    original: 1,
    thumbnail: 3
  };
  for (const variant of variantsResult.data ?? []) {
    const current = previewPaths.get(variant.asset_id);
    const priority = previewPriority[variant.variant_type] ?? 0;
    if (!current || priority > current.priority) {
      previewPaths.set(variant.asset_id, {
        path: variant.storage_path,
        priority
      });
    }
  }
  const signedPreviews = new Map<string, string>();
  await Promise.all(
    [...previewPaths.entries()].map(async ([assetId, preview]) => {
      const signed = await supabase.storage
        .from("tenant-media")
        .createSignedUrl(preview.path, 600);
      if (signed.data?.signedUrl) signedPreviews.set(assetId, signed.data.signedUrl);
    })
  );

  const profiles = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile.display_name]));
  const rows = playlists.map((playlist): PlaylistListRow => {
    const items = (itemsResult.data ?? []).filter((item) => item.playlist_id === playlist.id);
    const releases = (releasesResult.data ?? []).filter((release) => release.playlist_id === playlist.id);
    const playlistAssets = items.map((item) => assets.get(item.media_asset_id));
    return {
      assignedScreenCount: (screensResult.data ?? []).filter((screen) => screen.assigned_playlist_id === playlist.id).length,
      coverPreviewUrls: items.flatMap((item) => {
        const previewUrl = signedPreviews.get(item.media_asset_id);
        return previewUrl ? [previewUrl] : [];
      }).slice(0, 4),
      description: playlist.description,
      id: playlist.id,
      itemCount: items.length,
      lastPublishedVersion: releases[0]?.version ?? null,
      name: playlist.name,
      revision: Number(playlist.revision),
      status: playlist.status,
      totalDurationSeconds: items.reduce((total, item) => total + item.duration_seconds, 0),
      updatedAt: playlist.updated_at,
      updatedBy: playlist.updated_by ? profiles.get(playlist.updated_by) ?? "Onbekende gebruiker" : "Systeem",
      warningCount: playlistAssets.filter((asset) => !asset || asset.deleted_at || asset.status !== "ready").length
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
  const empty: PlaylistStudioData = { assets: [], dynamicSlides: [], engageCampaigns: [], error: null, items: [], playlist: null, readiness: null, releases: [], sections: [], screens: [], youtubeSources: [] };
  const supabase = await createControlSupabaseClient();
  if (!supabase) return { ...empty, error: "De beveiligde datasessie ontbreekt." };

  const [playlistResult, itemsResult, sectionsResult, assetsResult, releasesResult, screensResult, devicesResult, dynamicSlidesResult, youtubeSourcesResult, engageCampaignsResult] = await Promise.all([
    supabase.from("playlists").select("id, tenant_id, name, description, status, revision, archived_at, updated_at, updated_by, default_image_duration_seconds, default_transition, default_fit_mode, default_background_color, default_video_muted, loop_enabled").eq("tenant_id", tenantId).eq("id", playlistId).maybeSingle(),
    supabase.from("playlist_items").select("id, media_asset_id, section_id, sort_order, duration_seconds, fit_mode, muted, display_title, transition, crop_focus_x, crop_focus_y, background_color, volume_percent, trim_start_seconds, trim_end_seconds, visible_from, visible_until, enabled, accessibility_name, dynamic_slide_id, dynamic_snapshot_id").eq("tenant_id", tenantId).eq("playlist_id", playlistId).order("position_key"),
    supabase.from("playlist_sections").select("id, name, position_key, enabled, default_duration_seconds, default_transition").eq("tenant_id", tenantId).eq("playlist_id", playlistId).order("position_key"),
    supabase.from("media_assets").select("id, tenant_id, title, kind, mime_type, status, deleted_at").eq("tenant_id", tenantId).eq("source_kind", "user").order("created_at", { ascending: false }),
    supabase.from("playlist_releases").select("id, version, item_count, total_duration_seconds, total_bytes, published_at, published_by").eq("tenant_id", tenantId).eq("playlist_id", playlistId).order("version", { ascending: false }),
    supabase.from("screens").select("id, name, orientation, assigned_playlist_id").eq("tenant_id", tenantId).is("deleted_at", null).eq("status", "active").order("name"),
    supabase.from("player_devices").select("screen_id, active_release_id, desired_release_id, last_seen_at").eq("tenant_id", tenantId).eq("status", "paired").order("paired_at", { ascending: false }),
    supabase.from("dynamic_slides").select("id, name, slide_type, orientation, selection_mode, status, current_snapshot_id").eq("tenant_id", tenantId).eq("status", "ready").order("updated_at", { ascending: false }),
    supabase.from("youtube_sources").select("id, video_id, title, channel_title, fallback_media_asset_id").eq("tenant_id", tenantId).eq("status", "active").eq("validation_status", "verified").eq("embeddable", true).order("updated_at", { ascending: false }),
    supabase.from("engage_campaigns").select("id, public_id, title, question, status").eq("tenant_id", tenantId).in("status", ["scheduled", "live", "closed"]).order("updated_at", { ascending: false })
  ]);
  const error = [playlistResult.error, itemsResult.error, sectionsResult.error, assetsResult.error, releasesResult.error, screensResult.error, devicesResult.error, dynamicSlidesResult.error, youtubeSourcesResult.error, engageCampaignsResult.error].find(Boolean);
  if (error) {
    console.error("Playlist Studio laden mislukt", error);
    return { ...empty, error: "De playlisteditor kon niet volledig worden geladen. Vernieuw de pagina." };
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

  const snapshotIds = [
    ...(itemsResult.data ?? []).map(({ dynamic_snapshot_id }) => dynamic_snapshot_id),
    ...(dynamicSlidesResult.data ?? []).map(({ current_snapshot_id }) => current_snapshot_id)
  ];
  const dynamicSnapshotResults = await Promise.all(
    chunkPlaylistStudioIds(snapshotIds).map((ids) =>
      supabase
        .from("dynamic_slide_snapshots")
        .select("id, dynamic_slide_id, status, output_media_asset_id, snapshot_data_json")
        .eq("tenant_id", tenantId)
        .in("id", ids)
    )
  );
  if (dynamicSnapshotResults.some(({ error: snapshotError }) => snapshotError)) {
    return { ...empty, error: "De dynamische slides konden niet volledig worden geladen. Vernieuw de pagina." };
  }
  const dynamicSnapshots = dynamicSnapshotResults.flatMap(({ data }) => data ?? []);
  const requiredAssetIds = [
    ...(itemsResult.data ?? []).map(({ media_asset_id }) => media_asset_id),
    ...dynamicSnapshots.map(({ output_media_asset_id }) => output_media_asset_id),
    ...(youtubeSourcesResult.data ?? []).map(({ fallback_media_asset_id }) => fallback_media_asset_id)
  ];
  const scopedAssetResults = await Promise.all(
    chunkPlaylistStudioIds(requiredAssetIds).map((ids) =>
      supabase
        .from("media_assets")
        .select("id, tenant_id, title, kind, mime_type, status, deleted_at")
        .eq("tenant_id", tenantId)
        .in("id", ids)
    )
  );
  if (scopedAssetResults.some(({ error: assetError }) => assetError)) {
    return { ...empty, error: "De playlistmedia kon niet volledig worden geladen. Vernieuw de pagina." };
  }
  const assetRows = mergePlaylistStudioRows(
    assetsResult.data ?? [],
    ...scopedAssetResults.map(({ data }) => data ?? [])
  );
  const imageAssetIds = assetRows
    .filter(({ kind }) => kind === "image")
    .map(({ id }) => id);
  const videoAssetIds = assetRows
    .filter(({ kind }) => kind === "video")
    .map(({ id }) => id);
  const variantQueries = [
    ...chunkPlaylistStudioIds(imageAssetIds).map((ids) => ({ ids, variantType: "original" })),
    ...chunkPlaylistStudioIds(videoAssetIds).map((ids) => ({ ids, variantType: "player_1080p" }))
  ];
  const variantResults = await Promise.all(
    variantQueries.map(({ ids, variantType }) =>
      supabase
        .from("media_variants")
        .select("asset_id, tenant_id, variant_type, storage_path, mime_type, file_size_bytes, checksum_sha256, width, height, duration_seconds")
        .eq("tenant_id", tenantId)
        .eq("variant_type", variantType)
        .in("asset_id", ids)
    )
  );
  if (variantResults.some(({ error: variantError }) => variantError)) {
    return { ...empty, error: "De afspeelvarianten konden niet volledig worden geladen. Vernieuw de pagina." };
  }
  const variantRows = variantResults.flatMap(({ data }) => data ?? []);

  const variants = await Promise.all(variantRows.map(async (variant): Promise<PlaylistStudioVariant> => {
    let previewUrl: string | null = null;
    if (signPreviews) {
      const signed = await supabase.storage.from("tenant-media").createSignedUrl(variant.storage_path, 600);
      previewUrl = signed.data?.signedUrl ?? null;
    }
    return {
      assetId: variant.asset_id,
      checksumSha256: variant.checksum_sha256,
      durationSeconds: variant.duration_seconds === null ? null : Number(variant.duration_seconds),
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
  const allAssets = assetRows.map((asset): PlaylistStudioAsset => ({
    deletedAt: asset.deleted_at,
    id: asset.id,
    kind: asset.kind,
    mimeType: asset.mime_type,
    status: asset.status,
    tenantId: asset.tenant_id,
    title: asset.title,
    variant: variants.find((variant) => variant.assetId === asset.id && variant.variantType === (asset.kind === "video" ? "player_1080p" : "original")) ?? null
  }));
  const dynamicOutputAssetIds = new Set(
    dynamicSnapshots.flatMap((snapshot) =>
      snapshot.output_media_asset_id ? [snapshot.output_media_asset_id] : []
    )
  );
  const assets = allAssets.filter((asset) => !dynamicOutputAssetIds.has(asset.id));
  const snapshotsById = new Map(
    dynamicSnapshots.map((snapshot) => [snapshot.id, snapshot])
  );
  const dynamicSlides = (dynamicSlidesResult.data ?? []).flatMap(
    (slide): PlaylistStudioDynamicSlide[] => {
      const snapshot = slide.current_snapshot_id
        ? snapshotsById.get(slide.current_snapshot_id)
        : null;
      const previewAsset = snapshot?.output_media_asset_id
        ? allAssets.find((asset) => asset.id === snapshot.output_media_asset_id)
        : null;
      if (
        !snapshot ||
        snapshot.status !== "ready" ||
        !previewAsset ||
        !previewAsset.variant ||
        previewAsset.status !== "ready" ||
        previewAsset.deletedAt
      ) {
        return [];
      }
      const playback = dynamicSlidePlayback(snapshot.snapshot_data_json);
      return [{
        durationSeconds: playback.durationSeconds,
        id: slide.id,
        name: slide.name,
        orientation: slide.orientation as "landscape" | "portrait",
        previewAsset,
        selectionMode: slide.selection_mode as "latest" | "pinned",
        slideCount: playback.slideCount,
        slideType: slide.slide_type,
        snapshotId: snapshot.id
      }];
    }
  );
  const youtubeSources = (youtubeSourcesResult.data ?? []).flatMap(
    (source): PlaylistStudioYouTubeSource[] => {
      const fallbackAsset = allAssets.find(
        (asset) => asset.id === source.fallback_media_asset_id
      );
      return fallbackAsset?.variant && fallbackAsset.status === "ready" && !fallbackAsset.deletedAt
        ? [{
            channelTitle: source.channel_title,
            fallbackAsset,
            id: source.id,
            title: source.title,
            videoId: source.video_id
          }]
        : [];
    }
  );
  const engageCampaigns = (engageCampaignsResult.data ?? []).map(
    (campaign): PlaylistStudioEngageCampaign => ({
      id: campaign.id,
      publicId: campaign.public_id,
      question: campaign.question,
      status: campaign.status as PlaylistStudioEngageCampaign["status"],
      title: campaign.title
    })
  );
  const items = (itemsResult.data ?? []).map((item): PlaylistStudioItem => ({
    accessibilityName: item.accessibility_name,
    asset: allAssets.find((asset) => asset.id === item.media_asset_id) ?? null,
    backgroundColor: item.background_color,
    cropFocusX: Number(item.crop_focus_x),
    cropFocusY: Number(item.crop_focus_y),
    displayTitle: item.display_title,
    dynamicSlideId: item.dynamic_slide_id,
    dynamicSnapshotId: item.dynamic_snapshot_id,
    durationSeconds: item.duration_seconds,
    enabled: item.enabled,
    fitMode: item.fit_mode,
    id: item.id,
    mediaAssetId: item.media_asset_id,
    muted: item.muted,
    sectionId: item.section_id,
    sortOrder: item.sort_order,
    transition: item.transition,
    trimEndSeconds: item.trim_end_seconds === null ? null : Number(item.trim_end_seconds),
    trimStartSeconds: Number(item.trim_start_seconds),
    visibleFrom: item.visible_from,
    visibleUntil: item.visible_until,
    volumePercent: Number(item.volume_percent)
  }));
  const screens = (screensResult.data ?? []).map((screen) => {
    const device = (devicesResult.data ?? []).find(
      (candidate) => candidate.screen_id === screen.id
    );
    return {
      activeReleaseId: device?.active_release_id ?? null,
      assignedPlaylistId: screen.assigned_playlist_id,
      desiredReleaseId: device?.desired_release_id ?? null,
      id: screen.id,
      lastSeenAt: device?.last_seen_at ?? null,
      name: screen.name,
      orientation: screen.orientation
    };
  });
  const playlist = playlistResult.data;
  const sections = (sectionsResult.data ?? []).map((section): PlaylistStudioSection => ({
    defaultDurationSeconds: section.default_duration_seconds,
    defaultTransition: section.default_transition,
    enabled: section.enabled,
    id: section.id,
    name: section.name,
    positionKey: Number(section.position_key)
  }));
  const enabledSections = new Set(
    sections.filter((section) => section.enabled).map((section) => section.id)
  );
  const publishableItems = items.filter(
    (item) =>
      item.enabled &&
      (item.sectionId === null || enabledSections.has(item.sectionId))
  );
  const readiness = evaluatePlaylistReadiness({
    items: publishableItems.map((item) => ({
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
    dynamicSlides,
    engageCampaigns,
    error: profilesResult.error ? "De namen van bewerkers konden niet volledig worden geladen." : null,
    items,
    playlist: {
      archivedAt: playlist.archived_at,
      defaultBackgroundColor: playlist.default_background_color,
      defaultFitMode: playlist.default_fit_mode,
      defaultImageDurationSeconds: playlist.default_image_duration_seconds,
      defaultTransition: playlist.default_transition,
      defaultVideoMuted: playlist.default_video_muted,
      description: playlist.description,
      id: playlist.id,
      loopEnabled: playlist.loop_enabled,
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
    sections,
    screens,
    youtubeSources
  };
}

function dynamicSlidePlayback(value: unknown) {
  const root = recordValue(value);
  const sport = recordValue(root?.sport);
  if (sport && Array.isArray(sport.birthdays)) {
    const configuration = recordValue(sport.configuration);
    const presentation = recordValue(configuration?.presentation);
    const requestedLandscapeSize = Number(presentation?.maxPerLandscapePage);
    const requestedPortraitSize = Number(presentation?.maxPerPortraitPage);
    const landscapeSize = Number.isInteger(requestedLandscapeSize)
      ? Math.min(8, Math.max(1, requestedLandscapeSize))
      : 4;
    const portraitSize = Number.isInteger(requestedPortraitSize)
      ? Math.min(8, Math.max(1, requestedPortraitSize))
      : 3;
    const pageSize = Math.min(landscapeSize, portraitSize);
    const pageCount = Math.max(1, Math.ceil(sport.birthdays.length / pageSize));
    const requestedSeconds = Number(presentation?.pageDurationSeconds);
    const secondsPerPage = Number.isInteger(requestedSeconds)
      ? Math.min(20, Math.max(6, requestedSeconds))
      : 8;
    return {
      durationSeconds: pageCount * secondsPerPage,
      slideCount: pageCount
    };
  }
  const news = recordValue(root?.news);
  if (!news) return { durationSeconds: 10, slideCount: 1 };
  const articles = Array.isArray(news.articles) ? news.articles : [];
  const slideCount = Math.max(articles.length, 1);
  const requestedSeconds = Number(news.secondsPerSlide);
  const secondsPerSlide = Number.isInteger(requestedSeconds)
    ? Math.min(120, Math.max(5, requestedSeconds))
    : 5;
  return {
    durationSeconds: Math.min(3600, slideCount * secondsPerSlide),
    slideCount
  };
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function escapeLike(value: string) {
  return value.replace(/[%_]/g, "");
}
