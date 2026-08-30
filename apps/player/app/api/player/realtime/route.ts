import { NextResponse } from "next/server";

import {
  encodeSseEvent,
  hashPlayerCredential,
  ledScoresSseHeaders,
  loadLedScoresPlayerBootstrap,
  normalizeLedScoresDelivery,
  readPlayerBearerToken
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
  try { bootstrap = await loadLedScoresPlayerBootstrap(admin, tokenHash); }
  catch { return failure("PLAYER_REALTIME_UNAVAILABLE", 503); }
  if (!bootstrap.authorized) return failure("INVALID_DEVICE_TOKEN", 401);
  if (!bootstrap.enabled) return new NextResponse(null, { headers: { "Cache-Control": "no-store" }, status: 204 });

  const encoder = new TextEncoder();
  let cleanup: () => void = () => undefined;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let currentBootstrap = bootstrap;
      const sentDeliveryIds = new Set<string>();
      const send = (event: string, value: unknown) => {
        if (closed) return;
        try { controller.enqueue(encoder.encode(encodeSseEvent(event, value))); }
        catch { closed = true; }
      };
      send("bootstrap", {
        configs: currentBootstrap.configs,
        screenId: currentBootstrap.screenId,
        serverTime: new Date().toISOString()
      });
      const sendGoal = (delivery: ReturnType<typeof normalizeLedScoresDelivery>) => {
        if (!delivery || delivery.kind !== "goal" || sentDeliveryIds.has(delivery.id)) return;
        sentDeliveryIds.add(delivery.id);
        const config = currentBootstrap.configs.find(
          (item) => item.alertVersionId === delivery.alertVersionId
        );
        send("goal", {
          ...delivery,
          assets: config?.assets ?? [],
          serverTime: new Date().toISOString()
        });
      };
      for (const delivery of currentBootstrap.pendingDeliveries) sendGoal(delivery);
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
            void (async () => {
              const delivery = normalizeLedScoresDelivery(change.new);
              if (!delivery || delivery.screenId !== bootstrap.screenId) return;
              if (delivery.kind === "configuration") {
                try {
                  const refreshed = await loadLedScoresPlayerBootstrap(admin, tokenHash);
                  if (!refreshed.authorized || !refreshed.enabled) return;
                  currentBootstrap = refreshed;
                  send("configuration", {
                    configs: refreshed.configs,
                    deliveryId: delivery.id,
                    serverTime: new Date().toISOString()
                  });
                } catch {
                  send("diagnostic", { code: "CONFIGURATION_REFRESH_FAILED" });
                }
                return;
              }
              sendGoal(delivery);
            })();
          }
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            void (async () => {
              try {
                const refreshed = await loadLedScoresPlayerBootstrap(admin, tokenHash);
                if (!refreshed.authorized || !refreshed.enabled) return;
                currentBootstrap = refreshed;
                for (const delivery of refreshed.pendingDeliveries) sendGoal(delivery);
              } catch {
                send("diagnostic", { code: "REALTIME_CATCHUP_FAILED" });
              }
            })();
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
