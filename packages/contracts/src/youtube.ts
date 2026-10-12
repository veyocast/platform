import { z } from "zod";

export const youtubePlaylistIdSchema=z.string().regex(/^[A-Za-z0-9_-]{12,160}$/);
export const youtubePlaylistVideoIdsSchema = z.array(z.string().regex(/^[A-Za-z0-9_-]{11}$/)).min(1).max(200);
export const youtubeVideoIdSchema = z.string().regex(/^[A-Za-z0-9_-]{11}$/);

export const youtubeSourceSchema = z.object({
  fallbackMediaAssetId: z.string().uuid(),
  id: z.string().uuid(),
  onlineOnly: z.literal(true),
  title: z.string().trim().min(2).max(160),
  videoId: youtubeVideoIdSchema,
  playlistId: youtubePlaylistIdSchema.optional(),
  playlistVideoIds: youtubePlaylistVideoIdsSchema.optional(),
  playlistRepeat: z.boolean().optional()
}).strict().superRefine((value,context)=>{
 const hasPlaylist=value.playlistId!==undefined||value.playlistVideoIds!==undefined||value.playlistRepeat!==undefined;
 if(hasPlaylist&&(!value.playlistId||!value.playlistVideoIds||value.playlistRepeat===undefined||value.playlistVideoIds[0]!==value.videoId))context.addIssue({code:"custom",message:"Playlist identity, ordered resolved videos and repeat policy must be complete.",path:["playlistId"]});
});

export const youtubeMetadataSchema = z.object({
  channelTitle: z.string().trim().min(1).max(240),
  embeddable: z.boolean(),
  privacyStatus: z.enum(["private", "public", "unlisted"]),
  title: z.string().trim().min(1).max(500),
  videoId: youtubeVideoIdSchema
}).strict();

/**
 * Immutable release metadata for online-only playback. The Player must always
 * keep a normal, verified local source on the same manifest item as fallback.
 */
export const playerYouTubePlaybackSchema = z.object({
  kind: z.literal("youtube"),
  privacyEnhanced: z.literal(true),
  title: z.string().trim().min(2).max(160),
  videoId: youtubeVideoIdSchema,
  playlistId: youtubePlaylistIdSchema.optional(),
  playlistVideoIds: youtubePlaylistVideoIdsSchema.optional(),
  playlistRepeat: z.boolean().optional()
}).strict().superRefine((value,context)=>{
 if((value.playlistId||value.playlistVideoIds||value.playlistRepeat!==undefined)&&(!value.playlistId||!value.playlistVideoIds||value.playlistRepeat===undefined||value.playlistVideoIds[0]!==value.videoId))context.addIssue({code:"custom",message:"Published playlist metadata must be complete.",path:["playlistId"]});
});

export type YouTubeMetadata = z.infer<typeof youtubeMetadataSchema>;
export type YouTubeSource = z.infer<typeof youtubeSourceSchema>;
export type PlayerYouTubePlayback = z.infer<typeof playerYouTubePlaybackSchema>;
