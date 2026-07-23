import { z } from "zod";

export const playlistFitModeSchema = z.enum(["contain", "cover"]);
export const playlistItemKindSchema = z.enum(["image", "video"]);
export const playlistTransitionSchema = z.enum(["cut", "crossfade", "wipe"]);

const playlistPresentationTimestampSchema = z
  .string()
  .trim()
  .refine((value) => Number.isFinite(Date.parse(value)), {
    message: "Expected an ISO timestamp"
  });

export const playlistCropFocusSchema = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1)
  })
  .strict();

export const playlistTrimSchema = z
  .object({
    endSeconds: z.number().positive().max(86_400).optional(),
    startSeconds: z.number().nonnegative().max(86_400)
  })
  .strict()
  .superRefine((trim, context) => {
    if (
      trim.endSeconds !== undefined &&
      trim.endSeconds <= trim.startSeconds
    ) {
      context.addIssue({
        code: "custom",
        message: "endSeconds must be greater than startSeconds",
        path: ["endSeconds"]
      });
    }
  });

export const playlistVisibilitySchema = z
  .object({
    from: playlistPresentationTimestampSchema.optional(),
    until: playlistPresentationTimestampSchema.optional()
  })
  .strict()
  .superRefine((visibility, context) => {
    if (
      visibility.from !== undefined &&
      visibility.until !== undefined &&
      Date.parse(visibility.until) <= Date.parse(visibility.from)
    ) {
      context.addIssue({
        code: "custom",
        message: "until must be later than from",
        path: ["until"]
      });
    }
  });

export const playlistItemSectionSnapshotSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    positionKey: z.number(),
    sourceSectionId: z.string().uuid()
  })
  .strict();

export const playerPlaybackItemSchema = z
  .object({
    accessibilityName: z.string().trim().min(1).max(240).optional(),
    backgroundColor: z
      .string()
      .regex(/^#[0-9a-f]{6}$/i)
      .optional(),
    cropFocus: playlistCropFocusSchema.optional(),
    displayTitle: z.string().trim().min(1).max(240).optional(),
    durationSeconds: z.number().int().min(5).max(3600),
    enabled: z.boolean().optional(),
    fitMode: playlistFitModeSchema,
    id: z.string().uuid(),
    kind: playlistItemKindSchema,
    muted: z.boolean(),
    section: playlistItemSectionSnapshotSchema.optional(),
    title: z.string().trim().min(1).max(240),
    transition: playlistTransitionSchema.optional(),
    trim: playlistTrimSchema.optional(),
    visibility: playlistVisibilitySchema.optional(),
    volumePercent: z.number().int().min(0).max(100).optional()
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
