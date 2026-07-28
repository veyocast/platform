import {
  mobilePlaylistPublishRequestSchema,
  mobilePlaylistPublishResultSchema
} from "@veyocast/contracts";
import { evaluatePlaylistReadiness } from "@veyocast/domain";

import {
  getMobileRequestContext,
  requireMobileTenant
} from "../../../../../../../lib/mobile-api/context";
import {
  mobileContextFailure,
  mobileData,
  mobileFailure
} from "../../../../../../../lib/mobile-api/response";

export async function POST(
  request: Request,
  contextInput: { params: Promise<{ playlistId: string }> }
) {
  try {
    const context = await getMobileRequestContext(request);
    const tenant = requireMobileTenant(
      request,
      context,
      "tenant.playlist.publish"
    );
    const { playlistId } = await contextInput.params;
    const parsed = mobilePlaylistPublishRequestSchema.safeParse(
      await request.json().catch(() => null)
    );
    if (!isUuid(playlistId) || !parsed.success) {
      return mobileFailure({
        code: "VALIDATION",
        message: "De publicatieopdracht is niet geldig.",
        recovery: "Controleer de doelschermen en probeer opnieuw.",
        requestId: context.requestId,
        status: 422
      });
    }
    const input = parsed.data;
    const [
      playlistResult,
      itemsResult,
      sectionsResult,
      assetsResult,
      variantsResult,
      screensResult,
      devicesResult
    ] = await Promise.all([
      context.supabase
        .from("playlists")
        .select("id, tenant_id, status, revision")
        .eq("tenant_id", tenant.id)
        .eq("id", playlistId)
        .maybeSingle(),
      context.supabase
        .from("playlist_items")
        .select(
          "id, media_asset_id, section_id, duration_seconds, fit_mode, enabled"
        )
        .eq("tenant_id", tenant.id)
        .eq("playlist_id", playlistId),
      context.supabase
        .from("playlist_sections")
        .select("id, enabled")
        .eq("tenant_id", tenant.id)
        .eq("playlist_id", playlistId),
      context.supabase
        .from("media_assets")
        .select("id, tenant_id, kind, status, deleted_at")
        .eq("tenant_id", tenant.id),
      context.supabase
        .from("media_variants")
        .select(
          "asset_id, tenant_id, variant_type, mime_type, file_size_bytes, width, height"
        )
        .eq("tenant_id", tenant.id),
      context.supabase
        .from("screens")
        .select("id, status, orientation")
        .eq("tenant_id", tenant.id)
        .in("id", input.screenIds)
        .is("deleted_at", null),
      context.supabase
        .from("player_devices")
        .select("screen_id, last_seen_at")
        .eq("tenant_id", tenant.id)
        .in("screen_id", input.screenIds)
        .eq("status", "paired")
        .order("paired_at", { ascending: false })
    ]);
    const queryError = [
      playlistResult.error,
      itemsResult.error,
      sectionsResult.error,
      assetsResult.error,
      variantsResult.error,
      screensResult.error,
      devicesResult.error
    ].find(Boolean);
    if (queryError) {
      return mobileFailure({
        code: "TEMPORARILY_UNAVAILABLE",
        message: "De publicatiecontrole kon niet worden voltooid.",
        recovery: "De huidige release blijft spelen. Probeer het opnieuw.",
        requestId: context.requestId,
        status: 503
      });
    }
    const playlist = playlistResult.data;
    if (!playlist) {
      return mobileFailure({
        code: "NOT_FOUND",
        message: "De playlist is niet gevonden.",
        recovery: "Open een bestaande playlist vanuit Content.",
        requestId: context.requestId,
        status: 404
      });
    }
    if (Number(playlist.revision) !== input.expectedRevision) {
      return mobileData(
        {
          actualRevision: Number(playlist.revision),
          outcome: "conflict" as const,
          releaseId: null
        },
        context.requestId
      );
    }
    const screens = screensResult.data ?? [];
    if (
      screens.length !== new Set(input.screenIds).size ||
      screens.some((screen) => screen.status !== "active")
    ) {
      return mobileFailure({
        code: "CONFLICT",
        message: "Een of meer doelschermen zijn niet beschikbaar.",
        recovery: "Kies alleen actieve schermen binnen deze organisatie.",
        requestId: context.requestId,
        status: 409
      });
    }
    const deviceByScreen = new Map(
      (devicesResult.data ?? []).map((device) => [device.screen_id, device])
    );
    const hasWarning = screens.some((screen) => {
      const lastSeenAt = deviceByScreen.get(screen.id)?.last_seen_at;
      return (
        !lastSeenAt || Date.now() - Date.parse(lastSeenAt) > 5 * 60_000
      );
    });
    if (hasWarning && !input.confirmWarnings) {
      return mobileFailure({
        code: "CONFLICT",
        message: "Minimaal één doelscherm is niet recent online geweest.",
        recovery:
          "Controleer de selectie en bevestig bewust dat de Player later mag synchroniseren.",
        requestId: context.requestId,
        status: 409
      });
    }
    const sections = new Map(
      (sectionsResult.data ?? []).map((section) => [
        section.id,
        section.enabled
      ])
    );
    const assets = new Map(
      (assetsResult.data ?? []).map((asset) => [asset.id, asset])
    );
    const variants = variantsResult.data ?? [];
    const enabledItems = (itemsResult.data ?? []).filter(
      (item) =>
        item.enabled &&
        (item.section_id === null || sections.get(item.section_id) !== false)
    );
    const readiness = evaluatePlaylistReadiness({
      items: enabledItems.map((item) => {
        const asset = assets.get(item.media_asset_id);
        const expectedVariant =
          asset?.kind === "video" ? "player_1080p" : "original";
        const variant = variants.find(
          (candidate) =>
            candidate.asset_id === item.media_asset_id &&
            candidate.variant_type === expectedVariant
        );
        return {
          asset: asset
            ? {
                deleted: Boolean(asset.deleted_at),
                id: asset.id,
                kind: asset.kind,
                status: asset.status,
                tenantId: asset.tenant_id,
                variant: variant
                  ? {
                      fileSizeBytes: Number(variant.file_size_bytes),
                      height: variant.height,
                      mimeType: variant.mime_type,
                      tenantId: variant.tenant_id,
                      variantType: variant.variant_type,
                      width: variant.width
                    }
                  : null
              }
            : null,
          durationSeconds: item.duration_seconds,
          fitMode: item.fit_mode,
          id: item.id,
          mediaAssetId: item.media_asset_id
        };
      }),
      playlistStatus: playlist.status,
      playlistTenantId: tenant.id,
      targetOrientations: screens.map((screen) => screen.orientation)
    });
    if (!readiness.canPublish) {
      return mobileFailure({
        code: "CONFLICT",
        message: "De playlist is nog niet veilig publiceerbaar.",
        recovery:
          "Herstel de gemarkeerde media of instellingen in Control en probeer opnieuw.",
        requestId: context.requestId,
        status: 409
      });
    }
    const { data, error } = await context.supabase.rpc(
      "publish_playlist_to_targets_v3",
      {
        p_expected_revision: input.expectedRevision,
        p_idempotency_key: input.idempotencyKey,
        p_playlist_id: playlistId,
        p_release_notes: input.releaseNotes,
        p_screen_ids: input.screenIds
      }
    );
    if (error || !data || typeof data !== "object" || Array.isArray(data)) {
      return mobileFailure({
        code: error?.code === "42501" ? "FORBIDDEN" : "CONFLICT",
        message: "De immutable release kon niet worden gemaakt.",
        recovery:
          "De huidige release blijft spelen. Controleer je rechten en probeer opnieuw.",
        requestId: context.requestId,
        status: error?.code === "42501" ? 403 : 409
      });
    }
    return mobileData(
      mobilePlaylistPublishResultSchema.parse(data),
      context.requestId,
      201
    );
  } catch (error) {
    return mobileContextFailure(error);
  }
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}
