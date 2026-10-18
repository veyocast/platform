import { z } from "zod";
import { sitesDynamicConfigurationSchema } from "./sites-presentation";

const id = z.string().uuid();
const duration = z.number().int().min(3).max(3600);
export const playlistItemPatchSchema = z.object({
  durationSeconds: duration.optional(),
  displayTitle: z.string().trim().min(2).max(120).nullable().optional(),
  accessibilityName: z.string().trim().min(2).max(160).nullable().optional(),
  enabled: z.boolean().optional(), muted: z.boolean().optional(),
  fitMode: z.enum(["contain", "cover"]).optional(),
  transition: z.enum(["cut", "crossfade", "wipe"]).optional(),
  cropFocusX: z.number().min(0).max(1).optional(), cropFocusY: z.number().min(0).max(1).optional(),
  backgroundColor: z.string().regex(/^#[0-9a-f]{6}$/i).nullable().optional(),
  volumePercent: z.number().int().min(0).max(100).optional(),
  trimStartSeconds: z.number().min(0).max(3600).optional(),
  trimEndSeconds: z.number().positive().max(3600).nullable().optional(),
  visibleFrom: z.string().datetime({ offset: true }).nullable().optional(),
  visibleUntil: z.string().datetime({ offset: true }).nullable().optional(),
  sitesConfiguration: sitesDynamicConfigurationSchema.nullable().optional()
}).strict().refine((patch) => Object.keys(patch).length > 0, "An item patch must change a field.");

export const playlistBatchOperationSchema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("add_media"), clientId: id, mediaAssetId: id, durationSeconds: duration }).strict(),
  z.object({ operation: z.literal("add_dynamic"), clientId: id, dynamicSlideId: id, expectedSnapshotId: id, durationSeconds: duration.min(5) }).strict(),
  z.object({ operation: z.literal("add_sync_dynamic"), clientId: id, dynamicSlideId: id, expectedSnapshotId: id, snapshotId: id, durationSeconds: duration.max(120) }).strict(),
  z.object({ operation: z.literal("add_youtube"), clientId: id, sourceId: id, durationSeconds: duration.min(5) }).strict(),
  z.object({ operation: z.literal("add_engage"), clientId: id, campaignId: id, fallbackAssetId: id, durationSeconds: duration.min(5) }).strict(),
  z.object({ operation: z.literal("add_studio_series"), clientId: id, clientItemIds: z.array(id).min(1).max(20), seriesId: id, expectedSeriesRevision: z.number().int().positive() }).strict(),
  z.object({ operation: z.literal("duplicate"), clientId: id, itemId: id }).strict(),
  z.object({ operation: z.literal("replace_media"), itemId: id, mediaAssetId: id }).strict(),
  z.object({ operation: z.literal("replace_fallback"), itemId: id, mediaAssetId: id, sourceKind: z.enum(["youtube", "engage"]), sourceId: id }).strict(),
  z.object({ operation: z.literal("refresh_dynamic"), itemId: id, expectedSnapshotId: id }).strict(),
  z.object({ operation: z.literal("use_sync_dynamic_variant"), itemId: id, expectedSnapshotId: id, snapshotId: id, durationSeconds: duration.max(120) }).strict(),
  z.object({ operation: z.literal("remove"), itemId: id }).strict(),
  z.object({ operation: z.literal("patch"), itemId: id, patch: playlistItemPatchSchema }).strict(),
  z.object({ operation: z.literal("reorder"), itemIds: z.array(id).max(1000).refine((ids) => new Set(ids).size === ids.length, "An item occurs more than once.") }).strict(),
  z.object({ operation: z.literal("details"), name: z.string().trim().min(2).max(120), description: z.string().trim().max(500) }).strict()
]);
export const playlistBatchCommandSchema = z.object({
  playlistId: id, expectedRevision: z.number().int().nonnegative(), idempotencyKey: id,
  operations: z.array(playlistBatchOperationSchema).min(1).max(200)
}).strict().superRefine((command, context) => {
  if (new TextEncoder().encode(JSON.stringify(command)).byteLength > 262144) {
    context.addIssue({ code: "custom", path: ["operations"], message: "The command exceeds 256 KiB." });
  }
  const generated = command.operations.flatMap((operation) => operation.operation === "add_studio_series" ? operation.clientItemIds : "clientId" in operation ? [operation.clientId] : []);
  if (new Set(generated).size !== generated.length) {
    context.addIssue({ code: "custom", path: ["operations"], message: "Each added item needs its own command-local identity." });
  }
  command.operations.forEach((operation, index) => {
    if (operation.operation === "add_studio_series" && operation.clientId !== operation.clientItemIds[0]) context.addIssue({ code: "custom", path: ["operations", index, "clientId"], message: "The series identity must match its first item." });
  });
});
export type PlaylistBatchCommand = z.infer<typeof playlistBatchCommandSchema>;
export type PlaylistBatchOperation = z.infer<typeof playlistBatchOperationSchema>;
