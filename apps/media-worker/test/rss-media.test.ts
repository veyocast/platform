import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";

import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { prepareZXingModule, readBarcodes } from "zxing-wasm/reader";

import {
  normalizeRssImage,
  prepareRssMediaArtifacts
} from "../src/rss-media";

const job = {
  dataSourceId: "22222222-2222-4222-8222-222222222222",
  runId: "33333333-3333-4333-8333-333333333333",
  sourceUrl: "https://example.test/rss.xml",
  tenantId: "11111111-1111-4111-8111-111111111111"
};

const requireFromTest = createRequire(import.meta.url);
const readerWasm = Uint8Array.from(readFileSync(resolve(
  dirname(requireFromTest.resolve("zxing-wasm/reader")),
  "../../reader/zxing_reader.wasm"
))).buffer;
prepareZXingModule({ overrides: { wasmBinary: readerWasm } });

describe("RSS media normalisatie", () => {
  it("bewaart beeldverhouding en vergroot een kleine bron niet kunstmatig", async () => {
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

  it("verkleint brede nieuwsbeelden zonder anisotrope uitrekking", async () => {
    const input = await sharp({
      create: {
        background: { alpha: 1, b: 35, g: 88, r: 180 },
        channels: 4,
        height: 1200,
        width: 3600
      }
    }).png().toBuffer();

    const artifact = await normalizeRssImage(
      job,
      {
        externalId: "wide-article",
        role: "article_hero",
        title: "Breed nieuwsbeeld"
      },
      input
    );

    expect(artifact).toMatchObject({
      height: 640,
      width: 1920
    });
    expect(artifact.width / artifact.height).toBeCloseTo(3, 4);
  });

  it("houdt de echte artikelbestemming na QR-normalisatie decodeerbaar", async () => {
    const destination = "https://www.veyocast.nl/clubnieuws/royal-current";
    const artifacts = await prepareRssMediaArtifacts(job, {
      articles: [{
        author: null,
        canonicalLink: destination,
        externalId: "article-qr",
        heroMediaAssetId: null,
        intro: "Nieuws uit de club",
        link: destination,
        publishedAt: null,
        qrMediaAssetId: null,
        sourceName: "VeyoCast",
        title: "Royal Current"
      }],
      media: { articleImages: [], providerLogoUrl: null },
      title: "VeyoCast clubnieuws"
    });
    expect(artifacts).toHaveLength(1);
    const artifact = artifacts[0]!;

    expect(artifact).toMatchObject({
      externalId: "article-qr",
      height: 512,
      role: "article_qr",
      width: 512
    });
    expect(artifact.storagePath).toContain("/rss-article_qr.webp");

    const decodedImage = await sharp(artifact.bytes)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const results = await readBarcodes({
      colorSpace: "srgb",
      data: Uint8ClampedArray.from(decodedImage.data),
      height: decodedImage.info.height,
      width: decodedImage.info.width
    }, {
      formats: ["QRCode"],
      maxNumberOfSymbols: 1,
      tryHarder: true
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      format: "QRCode",
      text: destination
    });
  });
});
