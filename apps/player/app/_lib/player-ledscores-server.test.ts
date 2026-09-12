import { describe, expect, it, vi } from "vitest";

import { createDefaultLedScoresCanvasExperience } from "@veyocast/contracts";

import {
  attachLedScoresCanvasSceneToDelivery,
  createSerializedLedScoresStreamQueue,
  encodeSseEvent,
  hashPlayerCredential,
  hydrateLedScoresDeliveryProviderPhotos,
  ledScoresRealtimeBootstrapPayload,
  ledScoresCanvasMomentForDelivery,
  loadLedScoresMatchPlayerBootstrap,
  loadLedScoresPlayerBootstrap,
  normalizeLedScoresDelivery,
  normalizeLedScoresMatchStateRow,
  orderLedScoresPendingDeliveries,
  readPlayerBearerToken,
  shouldAttachLedScoresConfigAssets,
  shouldRefreshLedScoresConfigAssets
} from "./player-ledscores-server";

describe("LED Scores Player server boundary", () => {
  it("selecteert de canvas-scene uitsluitend uit de bijbehorende immutable alertversie", () => {
    const experience = createDefaultLedScoresCanvasExperience();
    const delivery = normalizeLedScoresDelivery({
      alert_version_id: "11111111-1111-4111-8111-111111111111",
      execute_at: "2026-08-31T18:00:00.000Z",
      expires_at: "2026-08-31T18:00:10.000Z",
      id: "22222222-2222-4222-8222-222222222222",
      message_kind: "goal",
      payload: {
        scene: { injected: true },
        scoringSide: "opponent"
      },
      screen_id: "33333333-3333-4333-8333-333333333333"
    });
    if (!delivery) throw new Error("Expected valid delivery");

    const hydrated = attachLedScoresCanvasSceneToDelivery(delivery, [{
      alertVersionId: "99999999-9999-4999-8999-999999999999",
      config: { canvasExperience: createDefaultLedScoresCanvasExperience() }
    }, {
      alertVersionId: delivery.alertVersionId,
      config: { canvasExperience: experience }
    }]);

    expect(hydrated.payload.scene).toEqual(
      experience.scenes.goalOpponent
    );
    expect(attachLedScoresCanvasSceneToDelivery(delivery, []).payload)
      .not.toHaveProperty("scene");

    const missingAssetExperience = structuredClone(experience);
    missingAssetExperience.scenes.goalOpponent.landscape.background = {
      focusX: 0.5,
      focusY: 0.5,
      kind: "media",
      mediaAssetId: "88888888-8888-4888-8888-888888888888",
      objectFit: "cover",
      overlayColor: "#0a0a0a",
      overlayOpacity: 0.2
    };
    expect(attachLedScoresCanvasSceneToDelivery(delivery, [{
      alertVersionId: delivery.alertVersionId,
      assets: [],
      config: { canvasExperience: missingAssetExperience }
    }]).payload).not.toHaveProperty("scene");
  });

  it.each([
    ["goal", { scoringSide: "own" }, "goalOwn"],
    ["goal", { scoringSide: "unknown" }, "goalUnknown"],
    ["match_overlay", { overlayKind: "lineup", side: "home" }, "lineupHome"],
    ["match_overlay", { overlayKind: "lineup", side: "away" }, "lineupAway"],
    ["match_overlay", { overlayKind: "match_start" }, "matchStart"],
    ["match_overlay", { overlayKind: "half_time" }, "halfTime"],
    ["match_overlay", { overlayKind: "match_end" }, "matchEnd"]
  ] as const)("mapt %s naar canvasmoment %s", (kind, payload, expected) => {
    const delivery = normalizeLedScoresDelivery({
      alert_version_id: "11111111-1111-4111-8111-111111111111",
      execute_at: "2026-08-31T18:00:00.000Z",
      expires_at: "2026-08-31T18:00:10.000Z",
      id: "22222222-2222-4222-8222-222222222222",
      message_kind: kind,
      payload,
      screen_id: "33333333-3333-4333-8333-333333333333"
    });
    if (!delivery) throw new Error("Expected valid delivery");
    expect(ledScoresCanvasMomentForDelivery(delivery)).toBe(expected);
  });

  it("serialiseert trage deliveryhydratie zodat lineup-clear nooit wordt ingehaald", async () => {
    let releaseLineup: (() => void) | undefined;
    const lineupHydrated = new Promise<void>((resolve) => {
      releaseLineup = resolve;
    });
    const rendered: string[] = [];
    const enqueue = createSerializedLedScoresStreamQueue();
    const lineup = enqueue(async () => {
      await lineupHydrated;
      rendered.push("lineup");
    });
    const clear = enqueue(() => {
      rendered.push("lineup_clear");
    });

    await Promise.resolve();
    expect(rendered).toEqual([]);
    releaseLineup?.();
    await Promise.all([lineup, clear]);
    expect(rendered).toEqual(["lineup", "lineup_clear"]);
  });

  it("isoleert een deliveryfout en behoudt databasevolgorde bij gecombineerde catch-up", async () => {
    const failed = vi.fn();
    const rendered: string[] = [];
    const enqueue = createSerializedLedScoresStreamQueue(failed);
    await Promise.all([
      enqueue(() => { throw new Error("photo signing unavailable"); }),
      enqueue(() => { rendered.push("next"); })
    ]);
    expect(failed).toHaveBeenCalledOnce();
    expect(rendered).toEqual(["next"]);

    const delivery = (
      id: string,
      kind: "goal" | "match_overlay",
      executeAt: string
    ) => normalizeLedScoresDelivery({
      alert_version_id: "11111111-1111-4111-8111-111111111111",
      execute_at: executeAt,
      expires_at: "2026-08-31T18:01:00.000Z",
      id,
      message_kind: kind,
      payload: kind === "match_overlay" ? { overlayKind: "lineup" } : {},
      screen_id: "44444444-4444-4444-8444-444444444444"
    });
    const clear = delivery(
      "33333333-3333-4333-8333-333333333333",
      "match_overlay",
      "2026-08-31T18:00:03.000Z"
    );
    const goal = delivery(
      "22222222-2222-4222-8222-222222222222",
      "goal",
      "2026-08-31T18:00:02.000Z"
    );
    if (!clear || !goal) throw new Error("Expected valid deliveries");
    expect(orderLedScoresPendingDeliveries([clear], [goal]).map((item) => item.id))
      .toEqual([goal.id, clear.id]);
  });

  it("accepteert alleen begrensde bearer credentials en hasht ze voor databasegebruik", () => {
    const token = "device_credential_1234567890";
    const request = new Request("https://player.test/api/player/realtime", {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(readPlayerBearerToken(request)).toBe(token);
    expect(hashPlayerCredential(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(readPlayerBearerToken(new Request("https://player.test", {
      headers: { Authorization: "Bearer short" }
    }))).toBeNull();
  });

  it("normaliseert alleen screen-scoped deliveryrecords met geldige tijden", () => {
    expect(normalizeLedScoresDelivery({
      alert_version_id: "11111111-1111-4111-8111-111111111111",
      execute_at: "2026-08-30T12:00:00.750Z",
      expires_at: "2026-08-30T12:00:10.750Z",
      id: "22222222-2222-4222-8222-222222222222",
      message_kind: "goal",
      payload: { eventId: "33333333-3333-4333-8333-333333333333" },
      screen_id: "44444444-4444-4444-8444-444444444444"
    })).toMatchObject({ kind: "goal", screenId: "44444444-4444-4444-8444-444444444444" });
    expect(normalizeLedScoresDelivery({ message_kind: "goal" })).toBeNull();
    expect(normalizeLedScoresDelivery({
      execute_at: "not-a-date",
      expires_at: "2026-08-30T12:00:10.750Z",
      id: "22222222-2222-4222-8222-222222222222",
      message_kind: "goal",
      payload: {},
      screen_id: "44444444-4444-4444-8444-444444444444"
    })).toBeNull();
    expect(normalizeLedScoresDelivery({
      execute_at: "2026-08-30T12:00:00.750Z",
      expires_at: "2026-08-30T12:00:10.750Z",
      id: "22222222-2222-4222-8222-222222222222",
      message_kind: "match_overlay",
      payload: { overlayKind: "match_start" },
      screen_id: "44444444-4444-4444-8444-444444444444"
    }))?.toMatchObject({ kind: "match_overlay" });
    expect(shouldAttachLedScoresConfigAssets("goal")).toBe(true);
    expect(shouldAttachLedScoresConfigAssets("match_overlay")).toBe(true);
    expect(shouldAttachLedScoresConfigAssets("goal_enrichment")).toBe(false);
    expect(shouldRefreshLedScoresConfigAssets(1_000, 45 * 60 * 1_000)).toBe(false);
    expect(shouldRefreshLedScoresConfigAssets(
      1_000,
      45 * 60 * 1_000 + 1_000
    )).toBe(true);
  });

  it("normaliseert live state zonder tenantdetails naar de Player-envelope", () => {
    expect(normalizeLedScoresMatchStateRow({
      connection_id: "11111111-1111-4111-8111-111111111111",
      source_observed_at: "2026-08-31T18:00:00.000Z",
      stale_after_seconds: 10,
      state_json: { schemaVersion: 1, matchKey: "match-1" },
      state_sequence: 4,
      tenant_id: "99999999-9999-4999-8999-999999999999"
    })).toEqual({
      connectionId: "11111111-1111-4111-8111-111111111111",
      sourceObservedAt: "2026-08-31T18:00:00.000Z",
      staleAfterSeconds: 10,
      state: { schemaVersion: 1, matchKey: "match-1" },
      stateSequence: 4
    });
  });

  it("stuurt bij subscribe-catch-up de opnieuw gelezen matchbinding mee", () => {
    const refreshedBinding = {
      connectionId: "11111111-1111-4111-8111-111111111111",
      state: { schemaVersion: 1, stateRevision: 2 }
    };
    expect(ledScoresRealtimeBootstrapPayload({
      configs: [],
      matchBindings: [refreshedBinding],
      screenId: "44444444-4444-4444-8444-444444444444",
      serverTime: "2026-08-31T18:00:02.000Z"
    })).toMatchObject({
      matchBindings: [refreshedBinding],
      screenId: "44444444-4444-4444-8444-444444444444"
    });
  });

  it("laadt alleen release-gebonden live match states en overlaydeliveries", async () => {
    const admin = {
      rpc: vi.fn().mockResolvedValue({
        data: {
          authorized: true,
          bindings: [{
            configuration: { template: "match_center" },
            connectionId: "11111111-1111-4111-8111-111111111111",
            dynamicSnapshotId: "22222222-2222-4222-8222-222222222222",
            sourceObservedAt: "2026-08-31T18:00:00.000Z",
            staleAfterSeconds: 10,
            state: { schemaVersion: 1, matchKey: "match-1" },
            stateSequence: 4
          }],
          enabled: true,
          pendingDeliveries: [{
            alert_version_id: "33333333-3333-4333-8333-333333333333",
            execute_at: "2026-08-31T18:00:00.100Z",
            expires_at: "2026-08-31T18:00:20.000Z",
            id: "44444444-4444-4444-8444-444444444444",
            message_kind: "goal_enrichment",
            payload: { eventId: "55555555-5555-4555-8555-555555555555" },
            screen_id: "66666666-6666-4666-8666-666666666666"
          }],
          screenId: "66666666-6666-4666-8666-666666666666",
          tenantId: "77777777-7777-4777-8777-777777777777"
        },
        error: null
      })
    };
    const bootstrap = await loadLedScoresMatchPlayerBootstrap(
      admin as never,
      "a".repeat(64)
    );
    expect(bootstrap).toMatchObject({
      authorized: true,
      bindings: [expect.objectContaining({ stateSequence: 4 })],
      enabled: true,
      pendingDeliveries: [expect.objectContaining({ kind: "goal_enrichment" })]
    });
  });

  it("tekent providerfoto's service-only en verwijdert interne versie-ID's", async () => {
    const photoId = "88888888-8888-4888-8888-888888888888";
    const createSignedUrl = vi.fn().mockResolvedValue({
      data: { signedUrl: "https://storage.test/signed-player.webp" },
      error: null
    });
    const admin = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          in: vi.fn().mockResolvedValue({
            data: [{
              checksum_sha256: "a".repeat(64),
              file_size_bytes: 12_000,
              id: photoId,
              mime_type: "image/webp",
              provider_asset_cache: {
                asset_role: "player_photo",
                entity_type: "player",
                provider: "ledscores"
              },
              storage_bucket: "provider-assets",
              storage_path: "ledscores/player/88/photo.webp"
            }],
            error: null
          })
        }))
      })),
      storage: { from: vi.fn(() => ({ createSignedUrl })) }
    };
    const delivery = normalizeLedScoresDelivery({
      execute_at: "2026-08-31T18:00:00.100Z",
      expires_at: "2026-08-31T18:00:20.000Z",
      id: "44444444-4444-4444-8444-444444444444",
      message_kind: "goal_enrichment",
      payload: {
        eventId: "55555555-5555-4555-8555-555555555555",
        player: {
          name: "D. Jansen",
          photoProviderAssetVersionId: photoId
        }
      },
      screen_id: "66666666-6666-4666-8666-666666666666"
    });
    if (!delivery) throw new Error("Expected delivery");
    const hydrated = await hydrateLedScoresDeliveryProviderPhotos(
      admin as never,
      delivery
    );
    expect(hydrated.payload.player).toEqual({
      name: "D. Jansen",
      photoUrl: "https://storage.test/signed-player.webp"
    });
    expect(createSignedUrl).toHaveBeenCalledWith(
      "ledscores/player/88/photo.webp",
      3_600
    );

    const fallback = await hydrateLedScoresDeliveryProviderPhotos({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          in: vi.fn().mockRejectedValue(new Error("storage lookup unavailable"))
        }))
      }))
    } as never, delivery);
    expect(fallback.payload.player).toEqual({ name: "D. Jansen" });
  });

  it("tekent uitsluitend tenant assetpaden uit de geautoriseerde bootstrap", async () => {
    const createSignedUrl = vi.fn().mockResolvedValue({
      data: { signedUrl: "https://storage.test/signed" },
      error: null
    });
    const rpc = vi.fn().mockResolvedValue({
      data: {
        authorized: true,
        configs: [{
          alertId: "11111111-1111-4111-8111-111111111111",
          alertVersionId: "22222222-2222-4222-8222-222222222222",
          assets: [{
            bucket: "tenant-media",
            checksum: "a".repeat(64),
            mediaAssetId: "33333333-3333-4333-8333-333333333333",
            mimeType: "image/webp",
            path: "tenants/10000000-0000-4000-8000-000000001321/assets/33333333-3333-4333-8333-333333333333/goal.webp"
          }, {
            bucket: "tenant-media",
            checksum: "b".repeat(64),
            mediaAssetId: "55555555-5555-4555-8555-555555555555",
            mimeType: "image/webp",
            path: "../other-tenant/secret.webp"
          }],
          checksum: "c".repeat(64),
          config: { schemaVersion: "1" },
          durationMs: 8_000,
          priority: 300,
          underlayPolicy: "pause"
        }],
        deviceId: "40000000-0000-4000-8000-000000001321",
        enabled: true,
        pendingDeliveries: [{
          alert_version_id: "22222222-2222-4222-8222-222222222222",
          execute_at: "2026-08-30T12:00:00.750Z",
          expires_at: "2026-08-30T12:00:10.750Z",
          id: "66666666-6666-4666-8666-666666666666",
          message_kind: "goal",
          payload: { eventId: "77777777-7777-4777-8777-777777777777" },
          screen_id: "30000000-0000-4000-8000-000000001321"
        }],
        screenId: "30000000-0000-4000-8000-000000001321",
        tenantId: "10000000-0000-4000-8000-000000001321"
      },
      error: null
    });
    const admin = {
      rpc,
      from: vi.fn(() => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { orientation: "portrait" }, error: null }) }) }) }) })),
      storage: { from: vi.fn(() => ({ createSignedUrl })) }
    };

    const bootstrap = await loadLedScoresPlayerBootstrap(admin as never, "a".repeat(64));
    expect(bootstrap).toMatchObject({ authorized: true, enabled: true, screenOrientation: "portrait" });
    if (!bootstrap.authorized || !bootstrap.enabled) throw new Error("Expected enabled bootstrap");
    expect(bootstrap.configs[0]?.assets).toHaveLength(1);
    expect(bootstrap.pendingDeliveries).toHaveLength(1);
    expect(createSignedUrl).toHaveBeenCalledTimes(1);
  });

  it("tekent maximaal de canvascontractlimiet van 24 immutable assets", async () => {
    const assets = Array.from({ length: 25 }, (_, index) => {
      const mediaAssetId = `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
      return {
        bucket: "tenant-media",
        checksum: "a".repeat(64),
        mediaAssetId,
        mimeType: index === 0 ? "video/mp4" : "image/webp",
        path: `tenants/10000000-0000-4000-8000-000000001321/assets/${mediaAssetId}/scene-${index}.webp`
      };
    });
    const createSignedUrl = vi.fn(async (path: string) => ({
      data: { signedUrl: `https://storage.test/${encodeURIComponent(path)}` },
      error: null
    }));
    const admin = {
      rpc: vi.fn().mockResolvedValue({
        data: {
          authorized: true,
          configs: [{
            alertId: "11111111-1111-4111-8111-111111111111",
            alertVersionId: "22222222-2222-4222-8222-222222222222",
            assets,
            checksum: "c".repeat(64),
            config: { schemaVersion: "1" },
            durationMs: 8_000,
            priority: 300,
            underlayPolicy: "pause"
          }],
          deviceId: "40000000-0000-4000-8000-000000001321",
          enabled: true,
          pendingDeliveries: [],
          screenId: "30000000-0000-4000-8000-000000001321",
          tenantId: "10000000-0000-4000-8000-000000001321"
        },
        error: null
      }),
      from: vi.fn(() => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { orientation: "portrait" }, error: null }) }) }) }) })),
      storage: { from: vi.fn(() => ({ createSignedUrl })) }
    };

    const bootstrap = await loadLedScoresPlayerBootstrap(
      admin as never,
      "a".repeat(64)
    );
    if (!bootstrap.authorized || !bootstrap.enabled) {
      throw new Error("Expected enabled bootstrap");
    }
    expect(bootstrap.configs[0]?.assets).toHaveLength(24);
    expect(createSignedUrl).toHaveBeenCalledTimes(24);
  });

  it("encodeert ieder realtime bericht als één SSE-event", () => {
    expect(encodeSseEvent("goal", { ok: true })).toBe(
      'event: goal\ndata: {"ok":true}\n\n'
    );
  });
});
