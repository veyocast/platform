import { z } from "zod";
import { syncContentFamilies } from "@veyocast/contracts";
import { studioDocumentSchema } from "./schema";

const uuid = z.string().uuid();
const revision = z.number().int().nonnegative();
const title = z.string().trim().min(2).max(120);
const syncDocument = studioDocumentSchema.refine(document => Boolean(document.syncPresentation && document.syncPresentation.name.trim().length >= 2), "Een Sync-document met een naam van minimaal twee tekens is vereist.");
export const mobileSyncStudioSeriesV3Schema = z.object({id: uuid, name: title, revision, members: z.array(z.object({projectId: uuid, name: title, draftRevision: revision}).strict()).min(1).max(20)}).strict();
export const mobileSyncStudioProjectV3Schema = z.object({
  kind: z.literal("sync"), id: uuid, name: title, draftRevision: revision, document: syncDocument,
  renderStatus: z.enum(["unknown", "idle", "queued", "rendering", "completed", "failed", "cancelled"]),
  renderJobId: uuid.nullable(), previewUrl: z.string().url().nullable(), mediaAssetId: uuid.nullable(),
  series: mobileSyncStudioSeriesV3Schema.nullable()
}).strict().superRefine((project, context) => {
  if (project.renderStatus === "completed" && !project.mediaAssetId) context.addIssue({code: "custom", message: "Een gereed afspeelbestand vereist een geverifieerd media-item."});
});
export const mobileSyncStudioWorkspaceV3Schema = z.object({
  schemaVersion: z.literal(3), authoringPaused: z.boolean(), offset: revision.max(10000), total: revision, hasMore: z.boolean(),
  projects: z.array(mobileSyncStudioProjectV3Schema).max(8),
  templates: z.array(z.object({id: z.enum(syncContentFamilies.map(family => family.id)), name: title, label: z.string().max(400)}).strict()).max(36)
}).strict();
export const mobileSyncStudioRequestV3Schema = z.discriminatedUnion("operation", [
  z.object({operation: z.literal("create"), document: syncDocument, idempotencyKey: uuid}).strict(),
  z.object({operation: z.literal("save"), projectId: uuid, expectedDraftRevision: revision, document: syncDocument, idempotencyKey: uuid}).strict(),
  z.object({operation: z.literal("render"), projectId: uuid, expectedDraftRevision: revision, outputKind: z.enum(["png", "mp4"]), idempotencyKey: uuid}).strict(),
  z.object({operation: z.literal("series"), projectId: uuid, draftRevision: revision, seriesId: uuid.nullable(), seriesRevision: revision.min(1).nullable(), action: z.enum(["add", "duplicate", "remove", "reorder", "rename"]), name: title.nullable(), memberIds: z.array(uuid).max(20).nullable(), idempotencyKey: uuid}).strict()
]).superRefine((input, context) => {
  if (input.operation === "series" && ((input.seriesId === null) !== (input.seriesRevision === null) || input.memberIds && new Set(input.memberIds).size !== input.memberIds.length)) context.addIssue({code: "custom", message: "De reeksopdracht is ongeldig."});
  if (input.operation === "series" && input.seriesId === null && input.action !== "add") context.addIssue({code: "custom", message: "Voeg eerst een slide toe om een reeks te beginnen."});
  if (new TextEncoder().encode(JSON.stringify(input)).byteLength > 524288) context.addIssue({code: "custom", message: "De opdracht is groter dan 512 KiB."});
});
export const mobileSyncStudioResultV3Schema = z.object({
  outcome: z.enum(["created", "saved", "conflict", "queued", "applied"]), projectId: uuid, draftRevision: revision, renderJobId: uuid.nullable(),
  series: z.object({id: uuid, revision: revision.min(1), projectIds: z.array(uuid).min(1).max(20), nextProjectId: uuid}).strict().nullable()
}).strict().superRefine((result, context) => {
  if (result.outcome === "queued" ? !result.renderJobId || result.series !== null : result.renderJobId !== null) context.addIssue({code: "custom", message: "Het renderontvangstbewijs is onvolledig."});
  if (result.outcome === "applied" ? !result.series || !result.series.projectIds.includes(result.series.nextProjectId) || new Set(result.series.projectIds).size !== result.series.projectIds.length : result.series !== null) context.addIssue({code: "custom", message: "Het reeksontvangstbewijs is onvolledig."});
});
export type MobileSyncStudioWorkspaceV3 = z.infer<typeof mobileSyncStudioWorkspaceV3Schema>;
export type MobileSyncStudioProjectV3 = z.infer<typeof mobileSyncStudioProjectV3Schema>;
export type MobileSyncStudioRequestV3 = z.infer<typeof mobileSyncStudioRequestV3Schema>;
export type MobileSyncStudioResultV3 = z.infer<typeof mobileSyncStudioResultV3Schema>;
