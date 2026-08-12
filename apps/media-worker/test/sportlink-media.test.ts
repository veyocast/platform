import { describe, expect, it } from "vitest";
import sharp from "sharp";

import {
  prepareSportlinkClubLogo,
  prepareSportlinkTeamLogo
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
      tenantId: "10000000-0000-4000-8000-000000000001"
    }, "Duindorp sv", input);

    expect(artifact).toMatchObject({
      height: 398,
      mimeType: "image/webp",
      role: "club_logo",
      title: "Duindorp sv clublogo",
      width: 512
    });
    expect(artifact.storagePath).toBe(
      `tenants/10000000-0000-4000-8000-000000000001/assets/${artifact.assetId}/sportlink-club-logo.webp`
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
      tenantId: "10000000-0000-4000-8000-000000000001"
    }, "Bezoekers 1", "https://cdn.sportlink.com/bezoekers.png", input);

    expect(artifact).toMatchObject({
      height: 256,
      role: "team_logo",
      sourceUrl: "https://cdn.sportlink.com/bezoekers.png",
      title: "Bezoekers 1 teamlogo",
      width: 256
    });
    expect(artifact.storagePath).toBe(
      `tenants/10000000-0000-4000-8000-000000000001/assets/${artifact.assetId}/sportlink-team-logo.webp`
    );
  });
});
