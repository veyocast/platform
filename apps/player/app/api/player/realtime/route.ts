import { NextResponse } from "next/server";

import {
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
  if (!bootstrap.enabled) return new NextResponse(null, { headers: { "Cache-Control": "no-store" }, status: 204 });
  try { matchBootstrap = await loadLedScoresMatchPlayerBootstrap(admin, tokenHash); }
  catch { return failure("PLAYER_REALTIME_UNAVAILABLE", 503); }
  if (!matchBootstrap.authorized ||
    matchBootstrap.screenId !== bootstrap.screenId ||
    matchBootstrap.tenantId !== bootstrap.tenantId) {
    return failure("INVALID_DEVICE_TOKEN", 401);
  }

  const encoder = new TextEncoder();
  let cleanup: () => void = () => undefined;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let currentBootstrap = bootstrap;
      let currentMatchBootstrap = matchBootstrap;
      let configAssetRefreshAt = Date.now();
      let configAssetRefreshPromise: Promise<void> | null = null;
      const sentDeliveryIds = new Set<string>();
      const allowedConnectionIds = new Set(
        currentMatchBootstrap.enabled
          ? currentMatchBootstrap.bindings.map((binding) => binding.connectionId)
          : []
      );
      const send = (event: string, value: unknown) => {
        if (closed) return;
        try { controller.enqueue(encoder.encode(encodeSseEvent(event, value))); }
        catch { closed = true; }
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
          delivery
        );
        if (shouldAttachLedScoresConfigAssets(delivery.kind)) {
          try { await refreshConfigAssetsIfNeeded(); }
          catch { send("diagnostic", { code: "CONFIG_ASSET_REFRESH_FAILED" }); }
        }
        const config = currentBootstrap.configs.find(
          (item) => item.alertVersionId === delivery.alertVersionId
        );
        send(delivery.kind, {
          ...hydrated,
          ...(shouldAttachLedScoresConfigAssets(delivery.kind)
            ? { assets: config?.assets ?? [] }
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
      let channel: ReturnType<typeof admin.channel> | null = null;
      let keepAlive: ReturnType<typeof setInterval> | null = null;
      const close = () => {
        if (closed) return;
        closed = true;
        if (keepAlive) clearInterval(keepAlive);
        if (channel) void admin.removeChannel(channel);
        try { controller.close(); } catch { /* already closed */ }
      };
      channel = admin.channel(`ledscores-player-${bootstrap.screenId}-${crypto.randomUUID()}`)
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
        if (!closed) {
          try { controller.enqueue(encoder.encode(`: keepalive ${Date.now()}\n\n`)); }
          catch { closed = true; }
        }
      }, 15_000);
      request.signal.addEventListener("abort", close, { once: true });
      cleanup = close;
    },
    cancel() { cleanup(); }
  });
  return new Response(stream, { headers: ledScoresSseHeaders });
}

function failure(code: string, status: number) {
  return NextResponse.json({ error: { code }, ok: false }, { headers: { "Cache-Control": "no-store" }, status });
}
