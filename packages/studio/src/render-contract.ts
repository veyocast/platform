import { z } from "zod";

import { studioDocumentSchema } from "./schema";

export const studioRenderOutputTypes = ["png", "mp4"] as const;
export type StudioRenderOutputType = (typeof studioRenderOutputTypes)[number];

export const studioRenderStatuses = [
  "queued",
  "preparing",
  "rendering",
  "encoding",
  "uploading",
  "creating_media",
  "completed",
  "failed",
  "cancelled"
] as const;
export type StudioRenderStatus = (typeof studioRenderStatuses)[number];

export const studioRenderRequestSchema = z.object({
  jobId: z.string().uuid(),
  tenantId: z.string().uuid(),
  designId: z.string().uuid(),
  revisionId: z.string().uuid(),
  mediaAssetId: z.string().uuid(),
  outputType: z.enum(studioRenderOutputTypes),
  document: studioDocumentSchema,
  assetManifest: z.array(z.object({
    elementId: z.string(),
    mediaAssetId: z.string().uuid(),
    storagePath: z.string().min(1).max(1_024),
    checksumSha256: z.string().regex(/^[a-f0-9]{64}$/),
    mimeType: z.enum(["image/jpeg", "image/png", "image/webp"])
  })).max(200)
});

export type StudioRenderRequest = z.infer<typeof studioRenderRequestSchema>;

export const studioRenderResultSchema = z.object({
  checksumSha256: z.string().regex(/^[a-f0-9]{64}$/),
  durationMs: z.number().int().min(0).max(30_000),
  fileSizeBytes: z.number().int().positive(),
  height: z.union([z.literal(1080), z.literal(1920)]),
  mimeType: z.enum(["image/png", "video/mp4"]),
  posterChecksumSha256: z.string().regex(/^[a-f0-9]{64}$/),
  posterFileSizeBytes: z.number().int().positive(),
  width: z.union([z.literal(1920), z.literal(1080)])
});

export type StudioRenderResult = z.infer<typeof studioRenderResultSchema>;
