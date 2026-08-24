import { z } from "zod";

export const youtubeVideoIdSchema = z.string().regex(/^[A-Za-z0-9_-]{11}$/);

export const youtubeSourceSchema = z.object({
  fallbackMediaAssetId: z.string().uuid(),
  id: z.string().uuid(),
  onlineOnly: z.literal(true),
  title: z.string().trim().min(2).max(160),
  videoId: youtubeVideoIdSchema
}).strict();

export const youtubeMetadataSchema = z.object({
  channelTitle: z.string().trim().min(1).max(240),
  embeddable: z.boolean(),
  privacyStatus: z.enum(["private", "public", "unlisted"]),
  title: z.string().trim().min(1).max(500),
  videoId: youtubeVideoIdSchema
}).strict();

export type YouTubeMetadata = z.infer<typeof youtubeMetadataSchema>;
export type YouTubeSource = z.infer<typeof youtubeSourceSchema>;
