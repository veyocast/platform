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
  role: "club_logo" | "person_photo" | "team_logo";
  storagePath: string;
  title: string;
  width: number;
};

export type SportlinkTeamLogoArtifact = SportlinkMediaArtifact & {
  role: "team_logo";
  sourceUrl: string;
};

export type SportlinkPersonPhotoArtifact = SportlinkMediaArtifact & {
  role: "person_photo";
  sourceUrl: string;
};

type LogoStorageError = { message?: string; status?: number; statusCode?: string };
export type SportlinkLogoStorage = {
  download(path: string, options: Record<string, never>, parameters: RequestInit): {
    asStream(): PromiseLike<{ data: ReadableStream<Uint8Array> | null; error: LogoStorageError | null }>;
  };
  upload(path: string, bytes: Uint8Array, options: Record<string, unknown>): PromiseLike<{ error: LogoStorageError | null }>;
};

// Entity IDs belong to the database pointers; immutable object identity is
// shared by teams with the same normalized image. Never use this for photos.
export function sportlinkLogoObjectKey(artifact: SportlinkMediaArtifact) {
  if (!['club_logo', 'team_logo'].includes(artifact.role)
    || !/^[a-f0-9]{64}$/.test(artifact.checksumSha256)
    || artifact.storagePath !== `providers/sportlink/${artifact.role}/${artifact.checksumSha256}.webp`
    || artifact.mimeType !== 'image/webp'
    || !Number.isSafeInteger(artifact.fileSizeBytes) || artifact.fileSizeBytes < 1 || artifact.fileSizeBytes > 2_000_000
    || artifact.bytes.byteLength !== artifact.fileSizeBytes
    || createHash('sha256').update(artifact.bytes).digest('hex') !== artifact.checksumSha256
    || !Number.isInteger(artifact.width) || artifact.width < 1 || artifact.width > 512
    || !Number.isInteger(artifact.height) || artifact.height < 1 || artifact.height > 512) {
    throw new Error('sportlink_logo_object_invalid');
  }
  return JSON.stringify(['provider-assets', artifact.role, artifact.storagePath,
    artifact.checksumSha256, artifact.fileSizeBytes, artifact.width, artifact.height, artifact.mimeType]);
}

export async function persistSportlinkLogoObject(
  bucket: SportlinkLogoStorage,
  artifact: SportlinkMediaArtifact,
  signal: AbortSignal
) {
  sportlinkLogoObjectKey(artifact);
  const metadata = await sharp(artifact.bytes, { failOn: 'warning', limitInputPixels: 16_000_000 }).metadata();
  if (metadata.format !== 'webp' || metadata.width !== artifact.width || metadata.height !== artifact.height) {
    throw new Error('sportlink_logo_object_invalid');
  }
  if (await verifiedStoredLogo(bucket, artifact, signal)) return;
  if (signal.aborted) throw new Error('sportlink_logo_object_cancelled');
  const result = await bucket.upload(artifact.storagePath, artifact.bytes, {
    cacheControl: '31536000', contentType: artifact.mimeType, upsert: false
  });
  if (signal.aborted) throw new Error('sportlink_logo_object_cancelled');
  if (!result.error) return;
  // A competing producer may have won the immutable insert. Its bytes, not
  // the conflict code or a cache pointer, establish successful persistence.
  if (isLogoObjectConflict(result.error)
    && await verifiedStoredLogo(bucket, artifact, signal)) return;
  throw new Error('sportlink_logo_object_upload_failed');
}

async function verifiedStoredLogo(bucket: SportlinkLogoStorage, artifact: SportlinkMediaArtifact, signal: AbortSignal) {
  if (signal.aborted) throw new Error('sportlink_logo_object_cancelled');
  const result = await bucket.download(artifact.storagePath, {}, { cache: 'no-store', signal }).asStream();
  if (signal.aborted) {
    await result.data?.cancel().catch(() => undefined);
    throw new Error('sportlink_logo_object_cancelled');
  }
  if (result.error) {
    if (isMissingLogoObject(result.error)) return false;
    throw new Error('sportlink_logo_object_lookup_failed');
  }
  if (!result.data) throw new Error('sportlink_logo_object_lookup_failed');
  const reader = result.data.getReader();
  const abort = () => { void reader.cancel().catch(() => undefined); };
  signal.addEventListener('abort', abort, { once: true });
  const hash = createHash('sha256');
  let size = 0;
  let complete = false;
  try {
    while (true) {
      if (signal.aborted) throw new Error('sportlink_logo_object_cancelled');
      const chunk = await reader.read();
      if (signal.aborted) throw new Error('sportlink_logo_object_cancelled');
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > artifact.fileSizeBytes || size > 2_000_000) throw new Error('sportlink_logo_object_integrity_failed');
      hash.update(chunk.value);
    }
    if (size !== artifact.fileSizeBytes || hash.digest('hex') !== artifact.checksumSha256) {
      throw new Error('sportlink_logo_object_integrity_failed');
    }
    complete = true;
    return true;
  } finally {
    signal.removeEventListener('abort', abort);
    if (!complete) await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

// Storage's documented legacy contract uses HTTP400 with a specific object
// code. Arbitrary4xx, absent buckets and upstream failures are not misses.
function isMissingLogoObject(error: LogoStorageError) {
  if (error.status === 404) return ['404', 'NoSuchKey', 'not_found'].includes(error.statusCode ?? '404');
  return error.status === 400 && (['NoSuchKey', 'not_found'].includes(error.statusCode ?? '')
    || (error.statusCode === '404' && error.message === 'Object not found'));
}

function isLogoObjectConflict(error: LogoStorageError) {
  if (error.status === 409) return ['409', 'ResourceAlreadyExists', 'KeyAlreadyExists', 'already_exists'].includes(error.statusCode ?? '409');
  return error.status === 400 && (error.statusCode === 'already_exists'
    || (error.statusCode === '409' && error.message === 'The resource already exists'));
}

export async function prepareSportlinkClubLogo(
  job: ClaimedSportlinkSync,
  externalId: string,
  clubName: string,
  input: Uint8Array
): Promise<SportlinkMediaArtifact> {
  return prepareSportlinkImage(job, externalId, clubName, input, "club_logo");
}

export async function prepareSportlinkTeamLogo(
  job: ClaimedSportlinkSync,
  externalId: string,
  teamName: string,
  sourceUrl: string,
  input: Uint8Array
): Promise<SportlinkTeamLogoArtifact> {
  return {
    ...await prepareSportlinkImage(job, externalId, teamName, input, "team_logo"),
    role: "team_logo",
    sourceUrl
  };
}

export async function prepareSportlinkPersonPhoto(
  job: ClaimedSportlinkSync,
  externalId: string,
  sourceUrl: string,
  input: Uint8Array
): Promise<SportlinkPersonPhotoArtifact> {
  return {
    ...await prepareSportlinkImage(
      job,
      externalId,
      "Sportlink profielfoto",
      input,
      "person_photo"
    ),
    role: "person_photo",
    sourceUrl
  };
}

async function prepareSportlinkImage(
  _job: ClaimedSportlinkSync,
  externalId: string,
  name: string,
  input: Uint8Array,
  role: "club_logo" | "person_photo" | "team_logo"
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
    title: role === "person_photo"
      ? "Sportlink profielfoto"
      : `${name} ${role === "club_logo" ? "clublogo" : "teamlogo"}`.slice(0, 160),
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
