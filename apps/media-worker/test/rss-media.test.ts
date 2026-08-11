import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { normalizeRssImage } from "../src/rss-media";

const job = {
  dataSourceId: "22222222-2222-4222-8222-222222222222",
  runId: "33333333-3333-4333-8333-333333333333",
  sourceUrl: "https://example.test/rss.xml",
  tenantId: "11111111-1111-4111-8111-111111111111"
};

describe("RSS media normalisatie", () => {
  it("bewaart beeldverhouding en bronresolutie zonder providerbytes uit te voeren", async () => {
    const input = await sharp({
      create: {
        background: { alpha: 1, b: 35, g: 88, r: 180 },
        channels: 4,
        height: 360,
        width: 640
      }
    }).png().toBuffer();

    const first = await normalizeRssImage(
      job,
      {
        externalId: "article-1",
        role: "article_hero",
        title: "Nieuwsbeeld"
      },
      input
    );
    const second = await normalizeRssImage(
      job,
      {
        externalId: "article-1",
        role: "article_hero",
        title: "Nieuwsbeeld"
      },
      input
    );

    expect(first).toMatchObject({
      externalId: "article-1",
      height: 360,
      mimeType: "image/webp",
      role: "article_hero",
      width: 640
    });
    expect(first.assetId).toBe(second.assetId);
    expect(first.storagePath).toBe(
      `tenants/${job.tenantId}/assets/${first.assetId}/rss-article_hero.webp`
    );
    expect(first.checksumSha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("verkleint grote nieuwsbeelden proportioneel binnen een 16:9 maximum", async () => {
    const input = await sharp({
      create: {
        background: { alpha: 1, b: 35, g: 88, r: 180 },
        channels: 4,
        height: 2400,
        width: 1600
      }
    }).png().toBuffer();

    const artifact = await normalizeRssImage(
      job,
      {
        externalId: "portrait-article",
        role: "article_hero",
        title: "Staand nieuwsbeeld"
      },
      input
    );

    expect(artifact).toMatchObject({
      height: 1080,
      width: 720
    });
    expect(artifact.width / artifact.height).toBeCloseTo(2 / 3, 4);
  });

  it("maakt QR-invoer verliesvrij en content-addressed beschikbaar", async () => {
    const input = await sharp({
      create: {
        background: { alpha: 1, b: 255, g: 255, r: 255 },
        channels: 4,
        height: 512,
        width: 512
      }
    }).png().toBuffer();
    const artifact = await normalizeRssImage(
      job,
      {
        externalId: "article-qr",
        role: "article_qr",
        title: "QR-code artikel"
      },
      input
    );

    expect(artifact).toMatchObject({
      externalId: "article-qr",
      height: 512,
      role: "article_qr",
      width: 512
    });
    expect(artifact.storagePath).toContain("/rss-article_qr.webp");
  });
});
