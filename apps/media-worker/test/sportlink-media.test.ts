import { describe, expect, it } from "vitest";
import sharp from "sharp";

import { prepareSportlinkClubLogo } from "../src/sportlink-media";

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
});
