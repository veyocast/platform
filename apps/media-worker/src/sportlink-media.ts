import { createHash } from "node:crypto";

import sharp from "sharp";

import type { ClaimedSportlinkSync } from "./sportlink-sync-runner";

export type SportlinkMediaArtifact = {
  assetId: string;
  bytes: Uint8Array;
  checksumSha256: string;
  externalId: string;
  fileSizeBytes: number;
  height: number;
  mimeType: "image/webp";
  role: "club_logo" | "team_logo";
  storagePath: string;
  title: string;
  width: number;
};

export type SportlinkTeamLogoArtifact = SportlinkMediaArtifact & {
  role: "team_logo";
  sourceUrl: string;
};

export async function prepareSportlinkClubLogo(
  job: ClaimedSportlinkSync,
  externalId: string,
  clubName: string,
  input: Uint8Array
): Promise<SportlinkMediaArtifact> {
  return prepareSportlinkLogo(job, externalId, clubName, input, "club_logo");
}

export async function prepareSportlinkTeamLogo(
  job: ClaimedSportlinkSync,
  externalId: string,
  teamName: string,
  sourceUrl: string,
  input: Uint8Array
): Promise<SportlinkTeamLogoArtifact> {
  return {
    ...await prepareSportlinkLogo(job, externalId, teamName, input, "team_logo"),
    role: "team_logo",
    sourceUrl
  };
}

async function prepareSportlinkLogo(
  _job: ClaimedSportlinkSync,
  externalId: string,
  name: string,
  input: Uint8Array,
  role: "club_logo" | "team_logo"
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
    `sportlink\0${role}\0${externalId}\0${checksumSha256}`
  );
  return {
    assetId,
    bytes: output.data,
    checksumSha256,
    externalId,
    fileSizeBytes: output.data.byteLength,
    height: output.info.height,
    mimeType: "image/webp",
    role,
    storagePath: `providers/sportlink/${role}/${checksumSha256}.webp`,
    title: `${name} ${role === "club_logo" ? "clublogo" : "teamlogo"}`
      .slice(0, 160),
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
