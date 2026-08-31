import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

import {
  LedScoresPlayerAssetImporter,
  fetchLedScoresPlayerPhoto,
  normalizeLedScoresPlayerPhotoUrl,
  prepareLedScoresPlayerPhoto,
  reusableLedScoresPlayerAssetVersion,
  type LedScoresPlayerAssetRegistry
} from "../src/ledscores-player-assets";

const sourceUrl = "https://api.ledscores.score.tel/players/player-7.png";
const tenantId = "20000000-0000-4000-8000-000000000002";

describe("LED Scores player media", () => {
  it("decodes bounded provider media and creates a deterministic private WebP artifact", async () => {
    const input = await sharp({
      create: {
        background: { alpha: 1, b: 24, g: 96, r: 240 },
        channels: 4,
        height: 80,
        width: 120
      }
    }).png().toBuffer();

    const first = await prepareLedScoresPlayerPhoto(
      tenantId,
      '["connection-1","team-1","player-7"]',
      sourceUrl,
      input
    );
    const second = await prepareLedScoresPlayerPhoto(
      tenantId,
      '["connection-1","team-1","player-7"]',
      sourceUrl,
      input
    );

    expect(first).toMatchObject({
      assetVersionId: second.assetVersionId,
      checksumSha256: second.checksumSha256,
      height: 80,
      mimeType: "image/webp",
      sourceUrl,
      width: 120
    });
    expect(first.storagePath).toBe(
      `tenants/${tenantId}/assets/${first.assetVersionId}/player.webp`
    );
    await expect(sharp(first.bytes).metadata()).resolves.toMatchObject({
      format: "webp",
      height: 80,
      width: 120
    });
  });

  it("uses the current cache entry without fetching the provider again", async () => {
    const versionId = "30000000-0000-4000-8000-000000000003";
    const registry: LedScoresPlayerAssetRegistry = {
      findCurrent: vi.fn(async () => versionId),
      save: vi.fn(async (artifact) => artifact.assetVersionId)
    };
    const fetchImpl = vi.fn();
    const importer = new LedScoresPlayerAssetImporter(
      registry,
      fetchImpl as unknown as typeof fetch
    );

    await expect(importer.importPlayerPhoto({
      connectionId: "connection-1",
      playerKey: "player-7",
      sourceUrl,
      teamKey: "team-1",
      tenantId
    })).resolves.toBe(versionId);
    expect(registry.findCurrent).toHaveBeenCalledWith(
      '["connection-1","team-1","player-7"]',
      sourceUrl
    );
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(registry.save).not.toHaveBeenCalled();
  });

  it("revalidates a stable provider URL after a bounded cache TTL", () => {
    const now = Date.parse("2026-08-31T18:00:00.000Z");
    const versionId = "30000000-0000-4000-8000-000000000003";
    expect(reusableLedScoresPlayerAssetVersion({
      current_version_id: versionId,
      last_checked_at: "2026-08-31T13:00:00.000Z",
      source_url: sourceUrl
    }, sourceUrl, now)).toBe(versionId);
    expect(reusableLedScoresPlayerAssetVersion({
      current_version_id: versionId,
      last_checked_at: "2026-08-31T11:59:59.000Z",
      source_url: sourceUrl
    }, sourceUrl, now)).toBeNull();
    expect(reusableLedScoresPlayerAssetVersion({
      current_version_id: versionId,
      last_checked_at: "2026-08-31T13:00:00.000Z",
      source_url: `${sourceUrl}?revision=2`
    }, sourceUrl, now)).toBeNull();
  });

  it("allows only the exact HTTPS LED Scores media host", () => {
    expect(normalizeLedScoresPlayerPhotoUrl(sourceUrl)).toBe(sourceUrl);
    expect(() => normalizeLedScoresPlayerPhotoUrl(
      "https://api.ledscores.score.tel.example/player.png"
    )).toThrowError(/url_invalid/);
    expect(() => normalizeLedScoresPlayerPhotoUrl(
      "http://api.ledscores.score.tel/player.png"
    )).toThrowError(/url_invalid/);
    expect(() => normalizeLedScoresPlayerPhotoUrl(
      "https://user:secret@api.ledscores.score.tel/player.png"
    )).toThrowError(/url_invalid/);
  });

  it("rejects a non-UUID tenant before cache lookup or download", async () => {
    const registry: LedScoresPlayerAssetRegistry = {
      findCurrent: vi.fn(async () => null),
      save: vi.fn(async (artifact) => artifact.assetVersionId)
    };
    const fetchImpl = vi.fn();
    const importer = new LedScoresPlayerAssetImporter(
      registry,
      fetchImpl as unknown as typeof fetch
    );

    await expect(importer.importPlayerPhoto({
      connectionId: "connection-1",
      playerKey: "player-7",
      sourceUrl,
      teamKey: "team-1",
      tenantId: "../andere-tenant"
    })).rejects.toMatchObject({ code: "ledscores_player_photo_tenant_invalid" });
    expect(registry.findCurrent).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("fails closed on redirects, invalid media types and declared oversized bodies", async () => {
    const redirectFetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.redirect).toBe("error");
      return new Response(null, { status: 302 });
    }) as unknown as typeof fetch;
    await expect(fetchLedScoresPlayerPhoto(sourceUrl, redirectFetch))
      .rejects.toMatchObject({ code: "ledscores_player_photo_fetch_failed" });

    const textFetch = vi.fn(async () => new Response("not an image", {
      headers: { "content-type": "text/plain" },
      status: 200
    })) as unknown as typeof fetch;
    await expect(fetchLedScoresPlayerPhoto(sourceUrl, textFetch))
      .rejects.toMatchObject({ code: "ledscores_player_photo_type_invalid" });

    const oversizedFetch = vi.fn(async () => new Response(new Uint8Array([1]), {
      headers: {
        "content-length": "8000001",
        "content-type": "image/png"
      },
      status: 200
    })) as unknown as typeof fetch;
    await expect(fetchLedScoresPlayerPhoto(sourceUrl, oversizedFetch))
      .rejects.toMatchObject({ code: "ledscores_player_photo_too_large" });
  });

  it("rejects decoded dimensions outside the 4096px safety boundary", async () => {
    const input = await sharp({
      create: {
        background: { b: 0, g: 0, r: 0 },
        channels: 3,
        height: 1,
        width: 4_097
      }
    }).png().toBuffer();

    await expect(prepareLedScoresPlayerPhoto(
      tenantId,
      '["connection-1","team-1","player-wide"]',
      sourceUrl,
      input
    )).rejects.toMatchObject({
      code: "ledscores_player_photo_dimensions_invalid"
    });
  });
});
