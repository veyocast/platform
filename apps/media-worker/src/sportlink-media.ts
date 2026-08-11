import { createHash } from "node:crypto";

import sharp from "sharp";

import type { ClaimedSportlinkSync } from "./sportlink-sync-runner";

export type SportlinkMediaArtifact = {
  assetId: string;
  bytes: Uint8Array;
  checksumSha256: string;
  fileSizeBytes: number;
  height: number;
  mimeType: "image/webp";
  role: "club_logo";
  storagePath: string;
  title: string;
  width: number;
};

export async function prepareSportlinkClubLogo(
  job: ClaimedSportlinkSync,
  clubName: string,
  input: Uint8Array
): Promise<SportlinkMediaArtifact> {
  const output = await sharp(input, {
    failOn: "warning",
    limitInputPixels: 16_000_000
  })
    .rotate()
    .resize({
      fit: "inside",
      height: 512,
      width: 512,
      withoutEnlargement: true
    })
    .webp({ effort: 4, quality: 90 })
    .toBuffer({ resolveWithObject: true });
  if (
    !output.info.width ||
    !output.info.height ||
    output.data.byteLength <= 0 ||
    output.data.byteLength > 2_000_000
  ) {
    throw new Error("sportlink_club_logo_normalization_invalid");
  }
  const checksumSha256 = createHash("sha256")
    .update(output.data)
    .digest("hex");
  const assetId = contentAddressedUuid(
    `${job.tenantId}\0club_logo\0${checksumSha256}`
  );
  return {
    assetId,
    bytes: output.data,
    checksumSha256,
    fileSizeBytes: output.data.byteLength,
    height: output.info.height,
    mimeType: "image/webp",
    role: "club_logo",
    storagePath:
      `tenants/${job.tenantId}/assets/${assetId}/sportlink-club-logo.webp`,
    title: `${clubName} clublogo`.slice(0, 160),
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
