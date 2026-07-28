import {
  mobilePlaylistDetailSchema,
  mobilePlaylistMutationRequestSchema,
  mobilePlaylistMutationResultSchema
} from "@veyocast/contracts";

import {
  getMobileRequestContext,
  requireMobileTenant
} from "../../../../../../lib/mobile-api/context";
import {
  mobileContextFailure,
  mobileData,
  mobileFailure
} from "../../../../../../lib/mobile-api/response";
import { mobilePlaylistMutationRpc } from "../../../../../../lib/mobile-api/playlist-mutation";

export async function GET(
  request: Request,
  contextInput: { params: Promise<{ playlistId: string }> }
) {
  try {
    const context = await getMobileRequestContext(request);
    const tenant = requireMobileTenant(
      request,
      context,
      "tenant.playlist.read"
    );
    const { playlistId } = await contextInput.params;
    if (!isUuid(playlistId)) {
      return mobileFailure({
        code: "NOT_FOUND",
        message: "De playlist is niet gevonden.",
        recovery: "Open de playlist opnieuw vanuit Content.",
        requestId: context.requestId,
        status: 404
      });
    }
    const [
      playlistResult,
      itemsResult,
      mediaResult,
      screensResult,
      devicesResult
    ] = await Promise.all([
      context.supabase
        .from("playlists")
        .select("id, name, description, status, revision")
        .eq("tenant_id", tenant.id)
        .eq("id", playlistId)
        .maybeSingle(),
      context.supabase
        .from("playlist_items")
        .select("id, media_asset_id, sort_order, duration_seconds, fit_mode, muted")
        .eq("tenant_id", tenant.id)
        .eq("playlist_id", playlistId)
        .order("sort_order"),
      context.supabase
        .from("media_assets")
        .select("id, title, mime_type, status, file_size_bytes, created_at")
        .eq("tenant_id", tenant.id)
        .eq("status", "ready")
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
      context.supabase
        .from("screens")
        .select("id, name, status")
        .eq("tenant_id", tenant.id)
        .is("deleted_at", null)
        .order("name"),
      context.supabase
        .from("player_devices")
        .select("screen_id, last_seen_at, status")
        .eq("tenant_id", tenant.id)
        .eq("status", "paired")
        .order("paired_at", { ascending: false })
    ]);
    const queryError = [
      playlistResult.error,
      itemsResult.error,
      mediaResult.error,
      screensResult.error,
      devicesResult.error
    ].find(Boolean);
    if (queryError) {
      return mobileFailure({
        code: "TEMPORARILY_UNAVAILABLE",
        message: "De playlist kon niet volledig worden geladen.",
        recovery: "Probeer het opnieuw.",
        requestId: context.requestId,
        status: 503
      });
    }
    if (!playlistResult.data) {
      return mobileFailure({
        code: "NOT_FOUND",
        message: "De playlist is niet gevonden.",
        recovery: "Open een bestaande playlist vanuit Content.",
        requestId: context.requestId,
        status: 404
      });
    }
    const media = new Map(
      (mediaResult.data ?? []).map((asset) => [asset.id, asset])
    );
    const devices = new Map(
      (devicesResult.data ?? []).map((device) => [device.screen_id, device])
    );
    const now = Date.now();
    return mobileData(
      mobilePlaylistDetailSchema.parse({
        description: playlistResult.data.description,
        id: playlistResult.data.id,
        items: (itemsResult.data ?? []).flatMap((item) => {
          const asset = media.get(item.media_asset_id);
          return asset
            ? [
                {
                  durationSeconds: item.duration_seconds,
                  fitMode: item.fit_mode,
                  id: item.id,
                  mediaAssetId: item.media_asset_id,
                  mimeType: asset.mime_type,
                  muted: item.muted,
                  sortOrder: item.sort_order,
                  title: asset.title
                }
              ]
            : [];
        }),
        name: playlistResult.data.name,
        publishTargets: (screensResult.data ?? []).map((screen) => {
          const device = devices.get(screen.id);
          const lastSeenAt = device?.last_seen_at ?? null;
          const heartbeatAge = lastSeenAt
            ? now - Date.parse(lastSeenAt)
            : Number.POSITIVE_INFINITY;
          return {
            id: screen.id,
            lastSeenAt,
            name: screen.name,
            status:
              screen.status !== "active"
                ? "blocked"
                : !device || heartbeatAge > 5 * 60_000
                  ? "warning"
                  : "ready"
          };
        }),
        readyMedia: (mediaResult.data ?? []).map((asset) => ({
          createdAt: asset.created_at,
          id: asset.id,
          mimeType: asset.mime_type,
          name: asset.title,
          processingStatus: "ready",
          sizeBytes: Number(asset.file_size_bytes),
          thumbnailUrl: null
        })),
        revision: Number(playlistResult.data.revision),
        status: playlistResult.data.status
      }),
      context.requestId
    );
  } catch (error) {
    return mobileContextFailure(error);
  }
}

export async function POST(
  request: Request,
  contextInput: { params: Promise<{ playlistId: string }> }
) {
  try {
    const context = await getMobileRequestContext(request);
    requireMobileTenant(request, context, "tenant.playlist.write");
    const { playlistId } = await contextInput.params;
    const parsed = mobilePlaylistMutationRequestSchema.safeParse(
      await request.json().catch(() => null)
    );
    if (!isUuid(playlistId) || !parsed.success) {
      return mobileFailure({
        code: "VALIDATION",
        message: "De playlistwijziging is niet geldig.",
        recovery: "Vernieuw de playlist en probeer het opnieuw.",
        requestId: context.requestId,
        status: 422
      });
    }
    const input = parsed.data;
    const payload =
      input.operation === "add_item"
        ? { mediaAssetId: input.mediaAssetId }
        : input.operation === "move_item"
          ? {
              itemId: input.itemId,
              targetPosition: input.targetPosition
            }
          : input.operation === "update_item"
            ? {
                durationSeconds: input.durationSeconds,
                displayName: input.displayName,
                fitMode: input.fitMode,
                itemId: input.itemId,
                muted: input.muted
              }
            : { itemId: input.itemId };
    const { data, error } = await context.supabase.rpc(
      mobilePlaylistMutationRpc(input.operation),
      {
        p_expected_revision: input.expectedRevision,
        p_idempotency_key: input.idempotencyKey,
        p_operation: input.operation,
        p_payload: payload,
        p_playlist_id: playlistId
      }
    );
    if (error || !data || typeof data !== "object" || Array.isArray(data)) {
      console.error("Mobile playlist mutation failed", {
        code: error?.code ?? "INVALID_RESULT",
        operation: input.operation,
        requestId: context.requestId
      });
      return mobileFailure({
        code: error?.code === "42501" ? "FORBIDDEN" : "CONFLICT",
        message: "De playlistwijziging kon niet veilig worden opgeslagen.",
        recovery: "Vernieuw de playlist en probeer het opnieuw.",
        requestId: context.requestId,
        status: error?.code === "42501" ? 403 : 409
      });
    }
    const row = data as Record<string, unknown>;
    return mobileData(
      mobilePlaylistMutationResultSchema.parse({
        actualRevision: Number(row.actualRevision),
        outcome: row.outcome
      }),
      context.requestId
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
