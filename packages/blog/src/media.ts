import "server-only";

import sharp from "sharp";

import { BlogHttpError, blogCommand, blogError, blogMediaLimit, blogRpc, downloadBlogStorage, sha256, uploadBlogStorage, type BlogCommandResult } from "./server";
import { resolveBlogConfig } from "./config";
import { blogAssetPattern } from "./urls";

const maxPixels = 40_000_000;
const maxDimension = 10_000;
const mediaFormats = { "image/jpeg": "jpeg", "image/png": "png", "image/webp": "webp" } as const;
type MediaType = keyof typeof mediaFormats;

export type PreparedBlogMedia = {
  bytes: Uint8Array;
  payload: { sha256: string; outputSha256: string; type: MediaType; width: number; height: number; bytes: number };
};
export type PersistedBlogMedia = { assetId: string; width: number; height: number; type: string; url: string };

function sniffMedia(bytes: Buffer): MediaType | undefined {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP" && bytes.readUInt32LE(4) === bytes.length - 8) return "image/webp";
}

function validDimensions(width: number | undefined, height: number | undefined): boolean {
  return Number.isSafeInteger(width) && Number.isSafeInteger(height) && width! >= 1 && height! >= 1 && width! <= maxDimension && height! <= maxDimension && width! * height! <= maxPixels;
}

// Authorization and the request rate/byte limit run in the route before image decoding.
export async function prepareBlogMedia(file: File): Promise<PreparedBlogMedia> {
  if (file.size > blogMediaLimit) throw blogError("INVALID_MEDIA", 413);
  if (!file.size) throw blogError("INVALID_MEDIA", 422);
  const input = Buffer.from(await file.arrayBuffer());
  if (input.length > blogMediaLimit) throw blogError("INVALID_MEDIA", 413);
  const type = sniffMedia(input);
  if (!type || file.type !== type) throw blogError("INVALID_MEDIA", 415);
  try {
    const pipeline = sharp(input, { animated: true, failOn: "warning", limitInputPixels: maxPixels, sequentialRead: true });
    const metadata = await pipeline.metadata();
    if (metadata.format !== mediaFormats[type] || !validDimensions(metadata.width, metadata.height) || (metadata.pages ?? 1) !== 1) throw blogError("INVALID_MEDIA", 422);
    // No metadata retention: sharp strips EXIF/ICC/XMP and converts to sRGB by default.
    const oriented = pipeline.rotate().timeout({ seconds: 15 });
    const encoder = type === "image/jpeg" ? oriented.jpeg({ quality: 90, chromaSubsampling: "4:4:4", progressive: false, mozjpeg: false, optimiseCoding: true })
      : type === "image/png" ? oriented.png({ compressionLevel: 9, adaptiveFiltering: false, palette: false, progressive: false })
        : oriented.webp({ quality: 90, alphaQuality: 100, effort: 4, lossless: false, nearLossless: false, smartSubsample: false });
    const { data, info } = await encoder.toBuffer({ resolveWithObject: true });
    if (!validDimensions(info.width, info.height) || !data.length) throw blogError("INVALID_MEDIA", 422);
    if (data.length > blogMediaLimit) throw blogError("INVALID_MEDIA", 413);
    return { bytes: data, payload: { sha256: sha256(input), outputSha256: sha256(data), type, width: info.width, height: info.height, bytes: data.length } };
  } catch (error) {
    if (error instanceof BlogHttpError) throw error;
    throw blogError("INVALID_MEDIA", 422);
  }
}

function persistedAsset(body: Record<string, unknown>, prepared: PreparedBlogMedia): PersistedBlogMedia {
  const { assetId, width, height, type } = body;
  if (typeof assetId !== "string" || !blogAssetPattern.test(`/api/blog/media/${assetId}`) || width !== prepared.payload.width || height !== prepared.payload.height || type !== prepared.payload.type) throw blogError("TEMPORARILY_UNAVAILABLE", 503);
  return { assetId, width: prepared.payload.width, height: prepared.payload.height, type: prepared.payload.type, url: `/api/blog/media/${assetId}` };
}

export async function persistBlogMedia(prepared: PreparedBlogMedia, options: { tokenHash?: string; accessToken?: string; actorId?: string; idempotencyKey: string }): Promise<PersistedBlogMedia> {
  if (Boolean(options.tokenHash) === Boolean(options.accessToken)) throw blogError("PERMISSION_DENIED", 403);
  if (options.accessToken && (!options.actorId || !blogAssetPattern.test(`/api/blog/media/${options.actorId}`))) throw blogError("PERMISSION_DENIED", 403);
  if (!/^[A-Za-z0-9_.:/-]{8,200}$/u.test(options.idempotencyKey)) throw blogError("INVALID_REQUEST");
  const { payload, bytes } = prepared;
  if (!validDimensions(payload.width, payload.height) || !Object.hasOwn(mediaFormats, payload.type) || bytes.length !== payload.bytes || bytes.length < 1 || bytes.length > blogMediaLimit || !/^[a-f0-9]{64}$/u.test(payload.sha256) || sha256(bytes) !== payload.outputSha256) throw blogError("INVALID_MEDIA", 422);
  const command = { ...options, payload };
  const intent = await blogCommand("media.intent", command);
  if (intent.httpStatus === 201) return persistedAsset(intent.body, prepared);
  const { assetId, storagePath } = intent.body;
  if (intent.httpStatus !== 202 || typeof assetId !== "string" || !blogAssetPattern.test(`/api/blog/media/${assetId}`) || typeof storagePath !== "string" || !storagePath.startsWith("platform/") || storagePath.split("/").some((part) => !part || part === "." || part === "..") || [...storagePath].some((character) => character.charCodeAt(0) <= 32 || character === "\\")) throw blogError("TEMPORARILY_UNAVAILABLE", 503);
  try {
    await uploadBlogStorage(storagePath, bytes, payload.type, options.accessToken);
  } catch (error) {
    // A timeout or create-only collision can follow a successful write. The same
    // deterministic object must pass readback before the pending intent completes.
    if (!(error instanceof BlogHttpError) || error.status !== 503) throw error;
  }
  const stored = await downloadBlogStorage(storagePath, options.accessToken);
  if (stored.length !== payload.bytes || sha256(stored) !== payload.outputSha256) throw blogError("INVALID_MEDIA", 422);
  const config = resolveBlogConfig();
  const completed = options.accessToken
    ? await blogRpc<BlogCommandResult>("blog_complete_human_media", {
      p_site_id: config.siteId, p_environment: config.environment, p_payload: payload,
      p_idempotency_key: options.idempotencyKey, p_actor_user_id: options.actorId
    }, { admin: true })
    : await blogCommand("media.complete", command);
  const result = persistedAsset(completed.body, prepared);
  if (completed.httpStatus !== 201 || result.assetId !== assetId) throw blogError("TEMPORARILY_UNAVAILABLE", 503);
  return result;
}
