import { NextResponse } from "next/server";

import {
  attachLedScoresCanvasSceneToDelivery,
  createSerializedLedScoresStreamQueue,
  encodeSseEvent,
  hashPlayerCredential,
  hydrateLedScoresDeliveryProviderPhotos,
  ledScoresRealtimeBootstrapPayload,
  ledScoresSseHeaders,
  loadLedScoresMatchPlayerBootstrap,
  loadLedScoresPlayerBootstrap,
  normalizeLedScoresDelivery,
  normalizeLedScoresMatchStateRow,
  orderLedScoresPendingDeliveries,
  readPlayerBearerToken,
  shouldAttachLedScoresConfigAssets,
  shouldRefreshLedScoresConfigAssets
} from "../../../_lib/player-ledscores-server";
import { createPlayerAdminClient } from "../../../_lib/player-supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const token = readPlayerBearerToken(request);
  if (!token) return failure("INVALID_DEVICE_TOKEN", 401);
  let admin: ReturnType<typeof createPlayerAdminClient>;
  try { admin = createPlayerAdminClient(); }
  catch { return failure("PLAYER_REALTIME_UNAVAILABLE", 503); }

  const tokenHash = hashPlayerCredential(token);
  let bootstrap: Awaited<ReturnType<typeof loadLedScoresPlayerBootstrap>>;
  let matchBootstrap: Awaited<ReturnType<typeof loadLedScoresMatchPlayerBootstrap>>;
  try { bootstrap = await loadLedScoresPlayerBootstrap(admin, tokenHash); }
  catch { return failure("PLAYER_REALTIME_UNAVAILABLE", 503); }
  if (!bootstrap.authorized) return failure("INVALID_DEVICE_TOKEN", 401);
  try { matchBootstrap = await loadLedScoresMatchPlayerBootstrap(admin, tokenHash); }
  catch { return failure("PLAYER_REALTIME_UNAVAILABLE", 503); }
  if (!matchBootstrap.authorized ||
    matchBootstrap.screenId !== bootstrap.screenId ||
    matchBootstrap.tenantId !== bootstrap.tenantId) {
    return failure("INVALID_DEVICE_TOKEN", 401);
  }

  const target = await admin.rpc("get_player_effective_target_v1", { p_token_hash: tokenHash });
  if (target.error) return failure("PLAYER_REALTIME_UNAVAILABLE", 503);
  if (!target.data || target.data.screen_id !== bootstrap.screenId || target.data.tenant_id !== bootstrap.tenantId) return failure("INVALID_DEVICE_TOKEN", 401);
  const bindingIds = (dataKey: unknown) => new Set(typeof dataKey === "string" ? dataKey.split(",").map((entry) => entry.split(":")[0]) : []);

  const encoder = new TextEncoder();
  let cleanup: () => void = () => undefined;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let currentBootstrap = bootstrap;
      let authorizedBindings = bindingIds(target.data.data_key);
      let knownTargetRevision = String(target.data.target_revision);
      let currentMatchBootstrap = matchBootstrap;
      let configAssetRefreshAt = Date.now();
      let validationInFlight = false;
      let configAssetRefreshPromise: Promise<void> | null = null;
      const sentDeliveryIds = new Set<string>();
      const allowedConnectionIds = new Set(
        currentMatchBootstrap.enabled
          ? currentMatchBootstrap.bindings.map((binding) => binding.connectionId)
          : []
      );
      let invalidationTimer: ReturnType<typeof setTimeout> | null = null;
      let targetCommitAt: string | null = null;
      let channel: ReturnType<typeof admin.channel> | null = null;
      let keepAlive: ReturnType<typeof setInterval> | null = null;
      const close = () => {
        if (closed) return;
        closed = true;
        if (keepAlive) clearInterval(keepAlive);
        if (invalidationTimer) clearTimeout(invalidationTimer);
        request.signal.removeEventListener("abort", close);
        if (channel) void admin.removeChannel(channel);
        try { controller.close(); } catch { /* already closed */ }
      };
      const send = (event: string, value: unknown) => {
        if (closed) return;
        try { controller.enqueue(encoder.encode(encodeSseEvent(event, value))); }
        catch { close(); }
      };
      const invalidate = () => {
        if (closed || invalidationTimer) return;
        invalidationTimer = setTimeout(() => {
          invalidationTimer = null;
          send("target_invalidated", { screenId: bootstrap.screenId, targetRevision: knownTargetRevision, committedAt: targetCommitAt });
        }, 100);
      };
      const validateTarget = () => {
        if (closed || validationInFlight) return;
        validationInFlight = true;
        void Promise.resolve(admin.rpc("get_player_effective_target_v1", { p_token_hash: tokenHash })).then((result) => {
          if (result.error || !result.data || result.data.screen_id !== bootstrap.screenId || result.data.tenant_id !== bootstrap.tenantId) { close(); return; }
          authorizedBindings = bindingIds(result.data.data_key);
        }).catch(close).finally(() => { validationInFlight = false; });
      };
      const enqueueDeliveryOperation = createSerializedLedScoresStreamQueue(() => {
        send("diagnostic", { code: "DELIVERY_PIPELINE_FAILED" });
      });
      send("bootstrap", ledScoresRealtimeBootstrapPayload({
        configs: currentBootstrap.configs,
        matchBindings: currentMatchBootstrap.enabled
          ? currentMatchBootstrap.bindings
          : [],
        screenId: currentBootstrap.screenId,
        screenOrientation: currentBootstrap.screenOrientation,
        serverTime: new Date().toISOString()
      }));
      const refreshConfigAssetsIfNeeded = async () => {
        if (!shouldRefreshLedScoresConfigAssets(configAssetRefreshAt)) return;
        if (!configAssetRefreshPromise) {
          configAssetRefreshPromise = (async () => {
            const refreshed = await loadLedScoresPlayerBootstrap(admin, tokenHash);
            if (!refreshed.authorized || !refreshed.enabled ||
              refreshed.screenId !== currentBootstrap.screenId ||
              refreshed.tenantId !== currentBootstrap.tenantId) {
              throw new Error("LEDSCORES_CONFIG_ASSET_REFRESH_INVALID");
            }
            currentBootstrap = refreshed;
            configAssetRefreshAt = Date.now();
          })().finally(() => { configAssetRefreshPromise = null; });
        }
        await configAssetRefreshPromise;
      };
      const sendDelivery = async (
        delivery: ReturnType<typeof normalizeLedScoresDelivery>
      ) => {
        if (!delivery || delivery.kind === "configuration" ||
          sentDeliveryIds.has(delivery.id)) return;
        sentDeliveryIds.add(delivery.id);
        const hydrated = await hydrateLedScoresDeliveryProviderPhotos(
          admin,
          delivery,
          currentBootstrap.tenantId
        );
        if (shouldAttachLedScoresConfigAssets(delivery.kind)) {
          try { await refreshConfigAssetsIfNeeded(); }
          catch { send("diagnostic", { code: "CONFIG_ASSET_REFRESH_FAILED" }); }
        }
        const config = currentBootstrap.configs.find(
          (item) => item.alertVersionId === delivery.alertVersionId
        );
        const withCanvasScene = attachLedScoresCanvasSceneToDelivery(
          hydrated,
          currentBootstrap.configs
        );
        send(delivery.kind, {
          ...withCanvasScene,
          ...(shouldAttachLedScoresConfigAssets(delivery.kind)
            ? { assets: [...(config?.assets ?? []), ...(config?.teamAssets ?? []).filter((asset) => asset.mediaAssetId === withCanvasScene.payload.homeLogo || asset.mediaAssetId === withCanvasScene.payload.awayLogo)] }
            : {}),
          serverTime: new Date().toISOString()
        });
      };
      for (const delivery of orderLedScoresPendingDeliveries(
        currentBootstrap.pendingDeliveries,
        currentMatchBootstrap.enabled ? currentMatchBootstrap.pendingDeliveries : []
      )) {
        void enqueueDeliveryOperation(() => sendDelivery(delivery));
      }
      channel = admin.channel(`player-${bootstrap.screenId}-${crypto.randomUUID()}`)
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "screens",
          filter: `id=eq.${bootstrap.screenId}` }, (change) => {
          if (change.new.tenant_id !== bootstrap.tenantId || String(change.new.target_revision) === knownTargetRevision) return;
          knownTargetRevision = String(change.new.target_revision);
          targetCommitAt = typeof change.commit_timestamp === "string" ? change.commit_timestamp : null;
          invalidate();
          validateTarget();
        })
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "published_dynamic_data",
          filter: `tenant_id=eq.${bootstrap.tenantId}` }, (change) => {
          if (change.new.tenant_id !== bootstrap.tenantId || !authorizedBindings.has(change.new.snapshot_id) || change.new.data_revision === change.old.data_revision) return;
          // This carries no data or member identifiers; the authorized manifest
          // read restricts the result to this screen's published bindings.
          invalidate();
        })
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            filter: `screen_id=eq.${bootstrap.screenId}`,
            schema: "public",
            table: "ledscores_player_deliveries"
          },
          (change) => {
            void enqueueDeliveryOperation(async () => {
              const delivery = normalizeLedScoresDelivery(change.new);
              if (!delivery || delivery.screenId !== bootstrap.screenId) return;
              if (delivery.kind === "configuration") {
                try {
                  const refreshed = await loadLedScoresPlayerBootstrap(admin, tokenHash);
                  if (!refreshed.authorized || !refreshed.enabled) return;
                  currentBootstrap = refreshed;
                  configAssetRefreshAt = Date.now();
                  const refreshedMatch = await loadLedScoresMatchPlayerBootstrap(
                    admin,
                    tokenHash
                  );
                  if (refreshedMatch.authorized && refreshedMatch.enabled &&
                    refreshedMatch.screenId === refreshed.screenId &&
                    refreshedMatch.tenantId === refreshed.tenantId) {
                    currentMatchBootstrap = refreshedMatch;
                    allowedConnectionIds.clear();
                    for (const binding of refreshedMatch.bindings) {
                      allowedConnectionIds.add(binding.connectionId);
                    }
                  }
                  send("configuration", {
                    configs: refreshed.configs,
                    matchBindings: currentMatchBootstrap.enabled
                      ? currentMatchBootstrap.bindings
                      : [],
                    deliveryId: delivery.id,
                    serverTime: new Date().toISOString()
                  });
                } catch {
                  send("diagnostic", { code: "CONFIGURATION_REFRESH_FAILED" });
                }
                return;
              }
              await sendDelivery(delivery);
            });
          }
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            filter: `tenant_id=eq.${bootstrap.tenantId}`,
            schema: "public",
            table: "ledscores_live_match_states"
          },
          (change) => {
            const state = normalizeLedScoresMatchStateRow(change.new);
            if (!state || !allowedConnectionIds.has(state.connectionId)) return;
            send("match_state", {
              ...state,
              serverTime: new Date().toISOString()
            });
          }
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            send("target_invalidated", { screenId: bootstrap.screenId });
            void enqueueDeliveryOperation(async () => {
              try {
                const refreshed = await loadLedScoresPlayerBootstrap(admin, tokenHash);
                if (!refreshed.authorized || !refreshed.enabled) return;
                currentBootstrap = refreshed;
                configAssetRefreshAt = Date.now();
                const refreshedMatch = await loadLedScoresMatchPlayerBootstrap(
                  admin,
                  tokenHash
                );
                if (!refreshedMatch.authorized || !refreshedMatch.enabled ||
                  refreshedMatch.screenId !== refreshed.screenId ||
                  refreshedMatch.tenantId !== refreshed.tenantId) return;
                currentMatchBootstrap = refreshedMatch;
                allowedConnectionIds.clear();
                for (const binding of refreshedMatch.bindings) {
                  allowedConnectionIds.add(binding.connectionId);
                }
                send("bootstrap", ledScoresRealtimeBootstrapPayload({
                  configs: refreshed.configs,
                  matchBindings: refreshedMatch.bindings,
                  screenId: refreshed.screenId,
                  screenOrientation: refreshed.screenOrientation,
                  serverTime: new Date().toISOString()
                }));
                for (const delivery of orderLedScoresPendingDeliveries(
                  refreshed.pendingDeliveries,
                  refreshedMatch.pendingDeliveries
                )) {
                  await sendDelivery(delivery);
                }
              } catch {
                send("diagnostic", { code: "REALTIME_CATCHUP_FAILED" });
              }
            });
          }
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            send("diagnostic", { code: "REALTIME_CHANNEL_INTERRUPTED" });
            close();
          }
        });
      keepAlive = setInterval(() => {
        validateTarget();
        if (!closed) {
          try { controller.enqueue(encoder.encode(`: keepalive ${Date.now()}\n\n`)); }
          catch { close(); }
        }
      }, 15_000);
      request.signal.addEventListener("abort", close, { once: true });
      cleanup = close;
      if (request.signal.aborted) close();
    },
    cancel() { cleanup(); }
  });
  return new Response(stream, { headers: ledScoresSseHeaders });
}

function failure(code: string, status: number) {
  return NextResponse.json({ error: { code }, ok: false }, { headers: { "Cache-Control": "no-store" }, status });
}
