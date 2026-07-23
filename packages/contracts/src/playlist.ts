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

export const playerPlaybackItemSchema = z
  .object({
    accessibilityName: z.string().trim().min(1).max(240).optional(),
    backgroundColor: z
      .string()
      .regex(/^#[0-9a-f]{6}$/i)
      .optional(),
    cropFocusX: z.number().min(0).max(1).optional(),
    cropFocusY: z.number().min(0).max(1).optional(),
    displayTitle: z.string().trim().min(1).max(240).optional(),
    durationSeconds: z.number().int().min(5).max(3600),
    enabled: z.boolean().optional(),
    fitMode: playlistFitModeSchema,
    id: z.string().uuid(),
    kind: playlistItemKindSchema,
    muted: z.boolean(),
    title: z.string().trim().min(1).max(240),
    transition: playlistTransitionSchema.optional(),
    trimEndSeconds: z.number().positive().max(86_400).optional(),
    trimStartSeconds: z.number().nonnegative().max(86_400).optional(),
    visibleFrom: playlistPresentationTimestampSchema.optional(),
    visibleUntil: playlistPresentationTimestampSchema.optional(),
    volumePercent: z.number().int().min(0).max(100).optional()
  })
  .superRefine((item, context) => {
    const trimStartSeconds = item.trimStartSeconds ?? 0;
    if (
      item.trimEndSeconds !== undefined &&
      item.trimEndSeconds <= trimStartSeconds
    ) {
      context.addIssue({
        code: "custom",
        message: "trimEndSeconds must be greater than trimStartSeconds",
        path: ["trimEndSeconds"]
      });
    }

    if (
      item.visibleFrom !== undefined &&
      item.visibleUntil !== undefined &&
      Date.parse(item.visibleUntil) <= Date.parse(item.visibleFrom)
    ) {
      context.addIssue({
        code: "custom",
        message: "visibleUntil must be later than visibleFrom",
        path: ["visibleUntil"]
      });
    }
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
