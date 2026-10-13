import { describe, expect, it, vi } from "vitest";
import sharp from "sharp";

import {
  prepareSportlinkClubLogo,
  prepareSportlinkTeamLogo,
  persistSportlinkLogoObject,
  sportlinkLogoObjectKey,
  type SportlinkMediaArtifact
} from "../src/sportlink-media";

describe("Sportlink clublogo", () => {
  it("maakt een begrensd content-addressed lokaal Playerasset", async () => {
    const input = await sharp({
      create: {
        background: "#FF5C20",
        channels: 4,
        height: 700,
        width: 900
      }
    }).png().toBuffer();
    const artifact = await prepareSportlinkClubLogo({
      connectionId: "20000000-0000-4000-8000-000000000001",
      dataSourceId: "30000000-0000-4000-8000-000000000001",
      datasetGroup: "club_profile",
      encryptedClientId: "ciphertext",
      encryptionIv: "initialization",
      encryptionTag: "authentication",
      runId: "40000000-0000-4000-8000-000000000001",
      tenantId: "10000000-0000-4000-8000-000000000001",
      timezone: "Europe/Amsterdam"
    }, "club-1", "Duindorp sv", input);

    expect(artifact).toMatchObject({
      height: 398,
      externalId: "club-1",
      mimeType: "image/webp",
      role: "club_logo",
      title: "Duindorp sv clublogo",
      width: 512
    });
    expect(artifact.storagePath).toBe(
      `providers/sportlink/club_logo/${artifact.checksumSha256}.webp`
    );
    expect(artifact.checksumSha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("maakt teamlogo's provider-neutraal en content-addressed", async () => {
    const input = await sharp({
      create: {
        background: "#315CFF",
        channels: 4,
        height: 256,
        width: 256
      }
    }).png().toBuffer();
    const artifact = await prepareSportlinkTeamLogo({
      connectionId: "20000000-0000-4000-8000-000000000001",
      dataSourceId: "30000000-0000-4000-8000-000000000001",
      datasetGroup: "competitions",
      encryptedClientId: "ciphertext",
      encryptionIv: "initialization",
      encryptionTag: "authentication",
      runId: "40000000-0000-4000-8000-000000000001",
      tenantId: "10000000-0000-4000-8000-000000000001",
      timezone: "Europe/Amsterdam"
    }, "team-1", "Bezoekers 1", "https://cdn.sportlink.com/bezoekers.png", input);

    expect(artifact).toMatchObject({
      height: 256,
      externalId: "team-1",
      role: "team_logo",
      sourceUrl: "https://cdn.sportlink.com/bezoekers.png",
      title: "Bezoekers 1 teamlogo",
      width: 256
    });
    expect(artifact.storagePath).toBe(
      `providers/sportlink/team_logo/${artifact.checksumSha256}.webp`
    );
  });
});

describe("verified Sportlink logo identity and bounded reads", () => {
  const job = {
    connectionId: "20000000-0000-4000-8000-000000000001", dataSourceId: "30000000-0000-4000-8000-000000000001",
    datasetGroup: "club_profile", encryptedClientId: "unused", encryptionIv: "unused", encryptionTag: "unused",
    runId: "40000000-0000-4000-8000-000000000001", tenantId: "10000000-0000-4000-8000-000000000001", timezone: "Europe/Amsterdam"
  };
  const artifact = async () => prepareSportlinkClubLogo(job, "club-1", "Testclub", await sharp({
    create: { background: "#123456", channels: 4, height: 64, width: 64 }
  }).png().toBuffer());

  it.each(["photo", "path", "hash", "bytes", "size", "width", "height", "mime"])("rejects a %s identity mismatch before storage or pointer reuse", async (invalid) => {
    const source = await artifact();
    const mutations: Record<string, Partial<SportlinkMediaArtifact>> = {
      photo: { role: "person_photo" }, path: { storagePath: "tenants/other/assets/private.webp" },
      hash: { checksumSha256: "a".repeat(64) }, bytes: { bytes: new Uint8Array(source.bytes.length) },
      size: { fileSizeBytes: source.fileSizeBytes + 1 }, width: { width: 513 }, height: { height: 0 }, mime: { mimeType: "image/png" as "image/webp" }
    };
    const upload = vi.fn(), download = vi.fn();
    await expect(persistSportlinkLogoObject({ download, upload }, { ...source, ...mutations[invalid] }, new AbortController().signal))
      .rejects.toThrow("sportlink_logo_object_invalid");
    expect(download).not.toHaveBeenCalled(); expect(upload).not.toHaveBeenCalled();
  });

  it("includes every object metadata dimension in the batch identity and checks decoded dimensions", async () => {
    const source = await artifact();
    expect(sportlinkLogoObjectKey(source)).not.toBe(sportlinkLogoObjectKey({ ...source, width: 65 }));
    const upload = vi.fn(), download = vi.fn();
    await expect(persistSportlinkLogoObject({ download, upload }, { ...source, width: 65 }, new AbortController().signal))
      .rejects.toThrow("sportlink_logo_object_invalid");
    expect(download).not.toHaveBeenCalled(); expect(upload).not.toHaveBeenCalled();
  });

  it("rejects a truncated stored object rather than overwriting or activating it", async () => {
    const source = await artifact();
    const download = vi.fn(() => ({ asStream: async () => ({ error: null, data: new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(source.bytes.slice(0, -1)); controller.close(); }
    }) }) }));
    const upload = vi.fn();
    await expect(persistSportlinkLogoObject({ download, upload }, source, new AbortController().signal))
      .rejects.toThrow("sportlink_logo_object_integrity_failed");
    expect(upload).not.toHaveBeenCalled();
  });

  it("cancels a late response body even when a fixture transport ignores the lifecycle signal", async () => {
    const source = await artifact();
    let resolve!: (value: { data: ReadableStream<Uint8Array>; error: null }) => void;
    let cancelled = false;
    const download = vi.fn(() => ({ asStream: () => new Promise<{ data: ReadableStream<Uint8Array>; error: null }>((complete) => { resolve = complete; }) }));
    const upload = vi.fn();
    const controller = new AbortController();
    const pending = persistSportlinkLogoObject({ download, upload }, source, controller.signal);
    await vi.waitFor(() => expect(download).toHaveBeenCalledOnce());
    controller.abort("PRIVATE_REASON");
    resolve({ error: null, data: new ReadableStream<Uint8Array>({ cancel() { cancelled = true; } }) });
    await expect(pending).rejects.toThrow("sportlink_logo_object_cancelled");
    expect(cancelled).toBe(true); expect(upload).not.toHaveBeenCalled();
  });
});
