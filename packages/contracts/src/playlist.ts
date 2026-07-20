import { z } from "zod";

export const playlistFitModeSchema = z.enum(["contain", "cover"]);
export const playlistItemKindSchema = z.enum(["image", "video"]);

export const playerPlaybackItemSchema = z
  .object({
    durationSeconds: z.number().int().min(5).max(3600),
    fitMode: playlistFitModeSchema,
    id: z.string().uuid(),
    kind: playlistItemKindSchema,
    muted: z.boolean(),
    title: z.string().trim().min(1).max(240)
  })
  .strict();

export const playlistDraftOperationSchema = z.enum([
  "update_details",
  "add_item",
  "update_item",
  "move_item",
  "remove_item",
  "archive"
]);

export const playlistConflictSchema = z
  .object({
    actualRevision: z.number().int().nonnegative(),
    code: z.literal("PLAYLIST_REVISION_CONFLICT"),
    expectedRevision: z.number().int().nonnegative(),
    playlistId: z.string().uuid(),
    recovery: z.enum(["reload", "compare", "retry"])
  })
  .strict();

export type PlayerPlaybackItem = z.infer<typeof playerPlaybackItemSchema>;
export type PlaylistDraftOperation = z.infer<typeof playlistDraftOperationSchema>;
export type PlaylistConflict = z.infer<typeof playlistConflictSchema>;
