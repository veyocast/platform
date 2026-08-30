import { describe, expect, it, vi } from "vitest";

import {
  encodeSseEvent,
  hashPlayerCredential,
  loadLedScoresPlayerBootstrap,
  normalizeLedScoresDelivery,
  readPlayerBearerToken
} from "./player-ledscores-server";

describe("LED Scores Player server boundary", () => {
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
      storage: { from: vi.fn(() => ({ createSignedUrl })) }
    };

    const bootstrap = await loadLedScoresPlayerBootstrap(admin as never, "a".repeat(64));
    expect(bootstrap).toMatchObject({ authorized: true, enabled: true });
    if (!bootstrap.authorized || !bootstrap.enabled) throw new Error("Expected enabled bootstrap");
    expect(bootstrap.configs[0]?.assets).toHaveLength(1);
    expect(bootstrap.pendingDeliveries).toHaveLength(1);
    expect(createSignedUrl).toHaveBeenCalledTimes(1);
  });

  it("encodeert ieder realtime bericht als één SSE-event", () => {
    expect(encodeSseEvent("goal", { ok: true })).toBe(
      'event: goal\ndata: {"ok":true}\n\n'
    );
  });
});
