import "server-only";
import { ledScoresCanvasAssetIds, safeParseLedScoresCanvasExperience } from "@veyocast/contracts";
import { createControlSupabaseClient } from "../../../../../lib/supabase/server";
import { deriveLedScoresFeatureAvailability, parseLedScoresEffectiveState, type LedScoresFeatureAvailability } from "../../../../../lib/ledscores-feature-state";
import { isLedScoresMediaEligible } from "./media-policy";
export async function loadStudioData(tenantId: string) {
  const supabase = await createControlSupabaseClient();
  if (!supabase) return emptyData();
  const featureStateResult = await supabase.rpc(
    "get_ledscores_feature_effective_state_v1",
    { p_tenant_id: tenantId }
  );
  const featureState = parseLedScoresEffectiveState(
    featureStateResult.data,
    tenantId
  );
  const availability = featureStateResult.error
    ? "unavailable" as const
    : deriveLedScoresFeatureAvailability(featureState);
  if (featureStateResult.error || availability === "unavailable") {
    console.error("LED Scores Studio-vrijgavestatus laden mislukt", {
      code: featureStateResult.error?.code ?? "invalid_response"
    });
  }
  if (availability !== "available") return { ...emptyData(), availability };
  const [connections, mappings, groups, memberships, screens, devices, assets, sponsors, alerts, draftGroups, publishedGroups, liveSlides, brandKit, sportsClubs, sportlinkConnections, playerPhotos] = await Promise.all([
    supabase.from("ledscores_connections").select("id,name,provider_club_id,provider_club_name,catalog_synced_at").eq("tenant_id", tenantId).eq("status", "active").order("name"),
    supabase.from("ledscores_team_mappings").select("connection_id,provider_team_key,provider_team_name,scoring_side,active,category,logo_provider_asset_version_id").eq("tenant_id", tenantId).order("created_at"),
    supabase.from("screen_groups").select("id,name,status").eq("tenant_id", tenantId).order("name"),
    supabase.from("screen_group_memberships").select("screen_group_id,screen_id").eq("tenant_id", tenantId),
    supabase.from("screens").select("id,name,status").eq("tenant_id", tenantId).is("deleted_at", null).order("name"),
    supabase.from("player_devices").select("screen_id,status,last_seen_at").eq("tenant_id", tenantId).eq("status", "paired"),
    supabase.from("media_assets").select("id,title,kind,mime_type,width,height,storage_bucket,storage_path,source_kind").eq("tenant_id", tenantId).eq("source_kind", "user").in("kind", ["image", "video"]).eq("status", "ready").is("deleted_at", null).order("created_at", { ascending: false }).limit(100),
    supabase.from("sponsor_creatives").select("id,position_key,orientation").eq("tenant_id", tenantId).eq("status", "approved").order("created_at", { ascending: false }).limit(100),
    supabase.from("ledscores_goal_alerts").select("id,connection_id,name,status,priority,duration_ms,underlay_policy,draft_config,revision,current_published_version_id,updated_at,is_central_goal_overlay").eq("tenant_id", tenantId).neq("status", "archived").order("updated_at", { ascending: false }),
    supabase.from("ledscores_goal_alert_draft_groups").select("alert_id,screen_group_id").eq("tenant_id", tenantId),
    supabase.from("ledscores_goal_alert_version_groups").select("alert_version_id,screen_group_id").eq("tenant_id", tenantId),
    supabase.from("dynamic_slides").select("id,name,orientation,status,updated_at").eq("tenant_id", tenantId).eq("slide_type", "ledscores_live_match").neq("status", "archived").order("updated_at", { ascending: false }),
    supabase.from("studio_tenant_brand_kits").select("logo_media_asset_id").eq("tenant_id", tenantId).maybeSingle(),
    supabase.from("sports_clubs").select("logo_media_asset_id,source_connection_id").eq("tenant_id", tenantId).eq("active", true).not("logo_media_asset_id", "is", null),
    supabase.from("sportlink_connections").select("id").eq("tenant_id", tenantId).eq("status", "active"),
    supabase.from("ledscores_player_identities").select("manual_photo_media_asset_id").eq("tenant_id", tenantId).eq("active", true).not("manual_photo_media_asset_id", "is", null).limit(1000)
  ]);
  const error = [connections.error, mappings.error, groups.error, memberships.error, screens.error, devices.error, assets.error, sponsors.error, alerts.error, draftGroups.error, publishedGroups.error, liveSlides.error, brandKit.error, sportsClubs.error, sportlinkConnections.error, playerPhotos.error].find(Boolean);
  if (error) { console.error("LED Scores Studio laden mislukt", { code: error.code }); return { ...emptyData(), enabled: true }; }
  const activeScreenIds = new Set((screens.data ?? []).filter((screen) => screen.status === "active").map((screen) => screen.id));
  const activeSportlinkConnectionIds = new Set((sportlinkConnections.data ?? []).map((connection) => connection.id));
  const canonicalLogoIds = new Set([
    brandKit.data?.logo_media_asset_id,
    ...(sportsClubs.data ?? [])
      .filter((club) => activeSportlinkConnectionIds.has(club.source_connection_id))
      .map((club) => club.logo_media_asset_id)
  ].filter((assetId): assetId is string => typeof assetId === "string"));
  const assetRows = [...(assets.data ?? [])];
  const referencedIds = [...new Set([
    ...canvasReferencedAssetIds(alerts.data ?? []),
    ...(playerPhotos.data ?? []).flatMap((player) => player.manual_photo_media_asset_id ? [player.manual_photo_media_asset_id] : []),
    ...canonicalLogoIds
  ])];
  const loadedAssetIds = new Set(assetRows.map((asset) => asset.id));
  const missingAssetIds = referencedIds.filter((assetId) => !loadedAssetIds.has(assetId));
  if (missingAssetIds.length) {
    const missingAssets = await supabase.from("media_assets")
      .select("id,title,kind,mime_type,width,height,storage_bucket,storage_path,source_kind")
      .eq("tenant_id", tenantId)
      .in("kind", ["image", "video"])
      .eq("status", "ready")
      .is("deleted_at", null)
      .in("id", missingAssetIds);
    if (missingAssets.error) {
      console.error("Gerefereerde LED Scores-canvasmedia laden mislukt", {
        code: missingAssets.error.code
      });
    } else {
      assetRows.push(...(missingAssets.data ?? []));
    }
  }
  const assetVariants = assetRows.length ? await supabase.from("media_variants")
    .select("asset_id,variant_type,mime_type,width,height,storage_bucket,storage_path")
    .eq("tenant_id", tenantId)
    .in("asset_id", assetRows.map((asset) => asset.id))
    .in("variant_type", ["thumbnail", "original", "player_1080p"])
    .limit(750) : { data: [] as CanvasVariantRow[], error: null };
  if (assetVariants.error) {
    console.error("LED Scores-canvasvarianten laden mislukt", {
      code: assetVariants.error.code
    });
  }
  const signedAssets = await signCanvasAssets(
    supabase,
    assetRows,
    assetVariants.data ?? [],
    canonicalLogoIds
  );
  return {
    alerts: alerts.data ?? [], assets: signedAssets,
    availability: "available" as const,
    connections: connections.data ?? [], draftGroups: draftGroups.data ?? [], enabled: true,
    groups: (groups.data ?? []).filter((group) => group.status === "active").map((group) => ({ id: group.id, name: group.name, screenIds: (memberships.data ?? []).filter((item) => item.screen_group_id === group.id && activeScreenIds.has(item.screen_id)).map((item) => item.screen_id) })),
    liveSlides: liveSlides.data ?? [],
    mappings: mappings.data ?? [],
    publishedGroups: publishedGroups.data ?? [],
    screens: (screens.data ?? []).filter((screen) => screen.status === "active").map((screen) => ({
      id: screen.id,
      name: screen.name,
      status: screenRealtimeStatus((devices.data ?? []).filter((device) => device.screen_id === screen.id).map((device) => device.last_seen_at))
    })),
    sponsors: (sponsors.data ?? []).map((sponsor) => ({ id: sponsor.id, label: `${sponsor.position_key} · ${sponsor.orientation}` })),
    targetGroups: (groups.data ?? []).map((group) => ({ id: group.id, screenIds: (memberships.data ?? []).filter((item) => item.screen_group_id === group.id && activeScreenIds.has(item.screen_id)).map((item) => item.screen_id) }))
  };
}

type CanvasAssetRow = {
  height: number | null;
  id: string;
  kind: string;
  mime_type: string;
  source_kind: string;
  storage_bucket: string;
  storage_path: string;
  title: string;
  width: number | null;
};
type CanvasVariantRow = {
  asset_id: string;
  height: number | null;
  mime_type: string;
  storage_bucket: string;
  storage_path: string;
  variant_type: string;
  width: number | null;
};

function canvasReferencedAssetIds(alerts: Array<{ draft_config: unknown }>) {
  const ids = new Set<string>();
  const legacyKeys = [
    "logoMediaAssetId",
    "ownMediaAssetId",
    "opponentMediaAssetId",
    "unknownMediaAssetId",
    "ownSoundMediaAssetId",
    "opponentSoundMediaAssetId",
    "sponsorMediaAssetId"
  ];
  for (const alert of alerts) {
    if (!isRecord(alert.draft_config)) continue;
    for (const key of legacyKeys) {
      const value = alert.draft_config[key];
      if (typeof value === "string") ids.add(value);
    }
    if (isRecord(alert.draft_config.goalOverlay)) {
      for (const key of ["introLandscapeMediaId", "introPortraitMediaId"]) {
        const value = alert.draft_config.goalOverlay[key];
        if (typeof value === "string") ids.add(value);
      }
    }
    const canvas = safeParseLedScoresCanvasExperience(
      alert.draft_config.canvasExperience
    );
    if (canvas.success) {
      for (const assetId of ledScoresCanvasAssetIds(canvas.data)) ids.add(assetId);
    }
  }
  return [...ids];
}

async function signCanvasAssets(
  supabase: NonNullable<Awaited<ReturnType<typeof createControlSupabaseClient>>>,
  assetRows: CanvasAssetRow[],
  variantRows: CanvasVariantRow[],
  canonicalLogoIds: Set<string>
) {
  const selections = assetRows.flatMap((asset) => {
    if (asset.kind !== "image" && asset.kind !== "video") return [];
    const variants = variantRows.filter((variant) => variant.asset_id === asset.id);
    const selected = asset.kind === "video"
      ? variants.find((variant) => variant.variant_type === "player_1080p")
      : variants.find((variant) => variant.variant_type === "thumbnail")
        ?? variants.find((variant) => variant.variant_type === "original");
    return [{
      asset,
      height: selected?.height ?? asset.height,
      mimeType: selected?.mime_type ?? asset.mime_type,
      path: selected?.storage_path ?? asset.storage_path,
      width: selected?.width ?? asset.width
    }];
  });
  const paths = [...new Set(selections.map((selection) => selection.path))];
  const signedByPath = new Map<string, string>();
  if (paths.length) {
    const signed = await supabase.storage.from("tenant-media").createSignedUrls(paths, 600);
    if (signed.error) {
      console.error("LED Scores-canvasvoorbeelden ondertekenen mislukt", {
        code: signed.error.name
      });
    } else {
      for (const preview of signed.data ?? []) {
        if (preview.path && preview.signedUrl) {
          signedByPath.set(preview.path, preview.signedUrl);
        }
      }
    }
  }
  return selections
    .map(({ asset, height, mimeType, path, width }) => ({
      canvasCompatible: asset.kind === "image"
        ? ["image/jpeg", "image/png", "image/webp"].includes(asset.mime_type)
        : variantRows.some((variant) =>
            variant.asset_id === asset.id
            && variant.variant_type === "player_1080p"
            && variant.mime_type === "video/mp4"
          ),
      height,
      id: asset.id,
      kind: asset.kind as "image" | "video",
      librarySelectable: isLedScoresMediaEligible({
        canvasCompatible: asset.kind === "image"
          ? ["image/jpeg", "image/png", "image/webp"].includes(asset.mime_type)
          : variantRows.some((variant) =>
              variant.asset_id === asset.id
              && variant.variant_type === "player_1080p"
              && variant.mime_type === "video/mp4"
            ),
        kind: asset.kind,
        mimeType,
        sourceKind: asset.source_kind
      }, "fallback"),
      logoSelectable: isLedScoresMediaEligible({
        canvasCompatible: asset.kind === "image"
          && ["image/jpeg", "image/png", "image/webp"].includes(asset.mime_type),
        kind: asset.kind,
        mimeType: asset.mime_type,
        purposeApproved: canonicalLogoIds.has(asset.id),
        sourceKind: asset.source_kind
      }, "logo"),
      mimeType,
      previewUrl: signedByPath.get(path) ?? null,
      title: asset.title,
      width
    }))
    .sort((left, right) => left.title.localeCompare(right.title, "nl-NL"));
}

export function emptyData() { return { alerts: [] as Array<{ id: string; connection_id: string; name: string; status: string; priority: number; duration_ms: number; underlay_policy: string; draft_config: unknown; revision: number; current_published_version_id: string | null; updated_at: string; is_central_goal_overlay: boolean }>, assets: [] as Array<{ canvasCompatible: boolean; height: number | null; id: string; kind: "image" | "video"; librarySelectable: boolean; logoSelectable: boolean; mimeType: string; previewUrl: string | null; title: string; width: number | null }>, availability: "not_released" as LedScoresFeatureAvailability, connections: [] as Array<{ id: string; name: string; provider_club_id: string | null; provider_club_name: string | null; catalog_synced_at: string | null }>, draftGroups: [] as Array<{ alert_id: string; screen_group_id: string }>, enabled: false, groups: [] as Array<{ id: string; name: string; screenIds: string[] }>, liveSlides: [] as Array<{ id: string; name: string; orientation: string; status: string; updated_at: string }>, mappings: [] as Array<{ connection_id: string; provider_team_key: string; provider_team_name: string; scoring_side: string; active: boolean; category: string | null; logo_provider_asset_version_id: string | null }>, publishedGroups: [] as Array<{ alert_version_id: string; screen_group_id: string }>, screens: [] as Array<{ id: string; name: string; status: "offline" | "online" | "stale" }>, sponsors: [] as Array<{ id: string; label: string }>, targetGroups: [] as Array<{ id: string; screenIds: string[] }> }; }
function screenRealtimeStatus(values: Array<string | null>): "offline" | "online" | "stale" {
  const latest = Math.max(...values.map((value) => value ? Date.parse(value) : 0), 0);
  if (latest >= Date.now() - 2 * 60_000) return "online";
  if (latest >= Date.now() - 15 * 60_000) return "stale";
  return "offline";
}

function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
