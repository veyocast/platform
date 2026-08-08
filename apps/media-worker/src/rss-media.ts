import { createHash } from "node:crypto";

import type { ParsedNewsFeed } from "@veyocast/integrations";
import { fetchSafeRssImage } from "@veyocast/integrations/server";
import sharp from "sharp";

import type { ClaimedRssSync } from "./rss-sync-runner";

const maximumArticleImages = 12;
const mediaConcurrency = 3;

export type RssMediaArtifact = {
  assetId: string;
  bytes: Uint8Array;
  checksumSha256: string;
  externalId: string | null;
  fileSizeBytes: number;
  height: number;
  mimeType: "image/webp";
  role: "article_hero" | "provider_logo";
  storagePath: string;
  title: string;
  width: number;
};

export async function prepareRssMediaArtifacts(
  job: ClaimedRssSync,
  feed: ParsedNewsFeed
) {
  const candidates = [
    ...(feed.media.providerLogoUrl
      ? [{
          externalId: null,
          role: "provider_logo" as const,
          title: `${feed.title} logo`,
          url: feed.media.providerLogoUrl
        }]
      : []),
    ...feed.media.articleImages.slice(0, maximumArticleImages).map((image) => ({
      externalId: image.externalId,
      role: "article_hero" as const,
      title:
        feed.articles.find((article) => article.externalId === image.externalId)
          ?.title ?? "RSS-nieuwsafbeelding",
      url: image.url
    }))
  ];
  const artifacts = await mapWithConcurrency(
    candidates,
    mediaConcurrency,
    async (candidate) => {
      try {
        const image = await fetchSafeRssImage(candidate.url);
        return await normalizeRssImage(job, candidate, image.body);
      } catch {
        // Remote media is supplementary. A valid normalized text feed remains
        // publishable when a supplier image is missing or temporarily broken.
        return null;
      }
    }
  );
  return artifacts.filter(
    (artifact): artifact is RssMediaArtifact => artifact !== null
  );
}

export async function normalizeRssImage(
  job: ClaimedRssSync,
  candidate: {
    externalId: string | null;
    role: RssMediaArtifact["role"];
    title: string;
  },
  input: Uint8Array
): Promise<RssMediaArtifact> {
  const pipeline = sharp(input, {
    failOn: "warning",
    limitInputPixels: 40_000_000
  }).rotate();
  const normalized = candidate.role === "provider_logo"
    ? pipeline
        .resize({
          fit: "inside",
          height: 150,
          withoutEnlargement: true,
          width: 260
        })
        .webp({ effort: 4, quality: 88 })
    : pipeline
        .resize({
          fit: "inside",
          height: 1080,
          width: 1920,
          withoutEnlargement: true
        })
        .webp({ effort: 4, quality: 82 });
  const output = await normalized.toBuffer({ resolveWithObject: true });
  if (
    !output.info.width ||
    !output.info.height ||
    output.data.byteLength <= 0 ||
    output.data.byteLength > 8_000_000
  ) {
    throw new Error("rss_media_normalization_invalid");
  }
  const checksumSha256 = createHash("sha256")
    .update(output.data)
    .digest("hex");
  const assetId = contentAddressedUuid(
    `${job.tenantId}\0${candidate.role}\0${checksumSha256}`
  );
  return {
    assetId,
    bytes: output.data,
    checksumSha256,
    externalId: candidate.externalId,
    fileSizeBytes: output.data.byteLength,
    height: output.info.height,
    mimeType: "image/webp",
    role: candidate.role,
    storagePath:
      `tenants/${job.tenantId}/assets/${assetId}/rss-${candidate.role}.webp`,
    title: candidate.title.slice(0, 160),
    width: output.info.width
  };
}

function contentAddressedUuid(value: string) {
  const bytes = createHash("sha256").update(value).digest().subarray(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20)
  ].join("-");
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>
) {
  const results = new Array<R>(values.length);
  let nextIndex = 0;
  await Promise.all(
    Array.from(
      { length: Math.min(concurrency, values.length) },
      async () => {
        for (;;) {
          const index = nextIndex;
          nextIndex += 1;
          if (index >= values.length) return;
          results[index] = await mapper(values[index]!);
        }
      }
    )
  );
  return results;
}
