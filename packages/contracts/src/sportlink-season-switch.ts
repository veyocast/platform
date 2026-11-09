import { z } from "zod";

import { sportlinkSlideContextSchema } from "./sportlink-slide-blueprints";

const hash = z.string().regex(/^[a-f0-9]{64}$/u);
const label = z.string().max(240);
const identity = z.string().trim().min(1).max(200);
const revision = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const dashboardHref = z.string().max(1000).refine(value =>
  value.startsWith("/dashboard/") && !value.includes("\\") && Array.from(value).every(character => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127)
  && !value.includes("//"), "Gebruik een bestaande interne beheerroute.");

export const sportlinkSeasonResourceKinds = ["dynamic_slide", "matchday_runbook"] as const;
export const sportlinkSeasonRowStates = [
  "current", "available", "choice_required", "source_unavailable", "no_successor",
  "locked", "conflict", "malformed", "broad_unchanged"
] as const;

/** Only exact observed context identities may become a season-switch target. */
export const sportlinkSeasonTargetContextSchema = sportlinkSlideContextSchema.superRefine((context, issue) => {
  if (context.competitionSelectionMode !== "pinned") issue.addIssue({
    code: "custom", path: ["competitionSelectionMode"], message: "Bevestig een concrete broncontext."
  });
  if (context.seasonId === null) issue.addIssue({
    code: "custom", path: ["seasonId"], message: "Kies een door de bron bevestigd seizoen."
  });
});

export const sportlinkSeasonSelectionSchema = z.object({
  mappings: z.array(z.object({
    fromProviderTeamId: identity,
    context: sportlinkSeasonTargetContextSchema
  }).strict()).min(1).max(500)
}).strict().superRefine((selection, issue) => {
  const from = new Set<string>(), to = new Set<string>();
  for (const [index, mapping] of selection.mappings.entries()) {
    if (from.has(mapping.fromProviderTeamId) || to.has(mapping.context.providerTeamId)) issue.addIssue({
      code: "custom", path: ["mappings", index], message: "Koppel ieder oorspronkelijk en nieuw team één keer."
    });
    from.add(mapping.fromProviderTeamId);
    to.add(mapping.context.providerTeamId);
  }
});

export const sportlinkSeasonFiltersSchema = z.object({
  query: z.string().trim().max(120).default(""),
  status: z.enum(["all", "attention", "available", "locked"]).default("all"),
  resourceKind: z.enum(["all", ...sportlinkSeasonResourceKinds]).default("all"),
  resourceId: z.string().uuid().optional()
}).strict();

export const sportlinkSeasonInventoryRequestSchema = z.object({
  connectionId: z.string().uuid(),
  targetSeasonId: z.string().trim().min(1).max(80).nullable(),
  filters: sportlinkSeasonFiltersSchema,
  cursor: z.string().max(2000).nullable(),
  pageSize: z.number().int().min(1).max(50)
}).strict();

const linksSchema = z.object({
  edit: dashboardHref.nullable(), publish: dashboardHref.nullable(), restore: dashboardHref.nullable()
}).strict();

const impactSchema = z.object({
  knownCount: z.number().int().nonnegative().nullable(),
  truncated: z.boolean(), unknown: z.boolean(),
  references: z.array(z.object({
    kind: z.enum(["series", "zone", "publication", "schedule", "screen", "runbook"]),
    id: identity, name: label, href: dashboardHref.nullable(), state: label,
    confirmedVersionId: z.string().uuid().nullable()
  }).strict()).max(100)
}).strict();

export const sportlinkSeasonSourceHealthSchema = z.object({
  state: z.enum(["ready", "stale", "incomplete", "unavailable"]),
  matchesLastSuccessAt: z.string().datetime({ offset: true }).nullable(),
  competitionsLastSuccessAt: z.string().datetime({ offset: true }).nullable(),
  observedThrough: z.string().max(40).nullable(),
  coverageKnown: z.boolean(), reasons: z.array(z.string().max(500)).max(20)
}).strict();

export const sportlinkSeasonCandidateSchema = z.object({
  candidateId: hash, context: sportlinkSeasonTargetContextSchema,
  label, teamName: label, competitionName: label, poolName: label.nullable(), phaseName: label.nullable(),
  reason: z.enum(["same_team_identity", "explicit_choice"]),
  qualifications: z.object({
    competitionType: label.nullable(), discipline: label.nullable(), level: label.nullable()
  }).strict()
}).strict();

export const sportlinkSeasonInventoryRowSchema = z.object({
  resourceKind: z.enum(sportlinkSeasonResourceKinds), resourceId: z.string().uuid(), name: label,
  state: z.enum(sportlinkSeasonRowStates), reason: z.string().max(1000), canUpdate: z.boolean(),
  basisVersionId: z.string().uuid().nullable(), draftVersionId: z.string().uuid().nullable(),
  expectedRevision: revision, oldBindingHash: hash, contextHash: hash,
  bindings: z.array(z.object({
    fromProviderTeamId: identity, currentContext: sportlinkSlideContextSchema.nullable(),
    candidates: z.array(sportlinkSeasonCandidateSchema).max(50),
    candidatesTruncated: z.boolean(), candidateCount: z.number().int().nonnegative()
  }).strict()).max(500),
  impact: impactSchema, links: linksSchema
}).strict();

export const sportlinkSeasonInventorySchema = z.object({
  schemaVersion: z.literal(1),
  connection: z.object({ id: z.string().uuid(), sourceId: z.string().uuid(), name: label, timeZone: identity }).strict(),
  seasons: z.array(z.object({ id: z.string().min(1).max(80), label }).strict()).max(100),
  targetSeasonId: z.string().min(1).max(80).nullable(),
  sourceHealth: sportlinkSeasonSourceHealthSchema,
  rows: z.array(sportlinkSeasonInventoryRowSchema).max(50),
  nextCursor: z.string().max(2000).nullable(), totalCount: z.number().int().nonnegative().nullable(),
  integration: z.object({ matchdayRunbooks: z.enum(["available", "unavailable"]) }).strict()
}).strict();

const previewFields = {
  resourceKind: z.enum(sportlinkSeasonResourceKinds), resourceId: z.string().uuid(),
  basisVersionId: z.string().uuid().nullable(), expectedRevision: revision,
  oldBindingHash: hash, contextHash: hash, newSelection: sportlinkSeasonSelectionSchema,
  clearSelectedMatches: z.boolean()
};
export const sportlinkSeasonPreviewRequestSchema = z.object(previewFields).strict();
export const sportlinkSeasonApplyRequestSchema = z.object({
  ...previewFields, requestId: z.string().uuid(), correlationId: z.string().uuid()
}).strict();

export const sportlinkSeasonPreviewSchema = z.object({
  schemaVersion: z.literal(1), resourceKind: z.enum(sportlinkSeasonResourceKinds), resourceId: z.string().uuid(),
  oldSelection: z.object({ mappings: z.array(z.object({
    fromProviderTeamId: identity, context: sportlinkSlideContextSchema
  }).strict()).max(500) }).strict().nullable(),
  newSelection: sportlinkSeasonSelectionSchema,
  basisVersionId: z.string().uuid().nullable(), expectedRevision: revision,
  oldBindingHash: hash, contextHash: hash, canApply: z.boolean(), reasons: z.array(z.string().max(1000)).max(20),
  preview: z.object({
    state: z.enum(["ready", "empty", "unavailable", "blocked"]),
    data: z.unknown().nullable(), message: z.string().max(1000).nullable()
  }).strict(),
  impact: impactSchema, clearsSelectedMatches: z.boolean(), links: linksSchema
}).strict();

export const sportlinkSeasonApplyResultSchema = z.object({
  schemaVersion: z.literal(1), status: z.enum(["applied", "conflict", "blocked"]),
  resourceKind: z.enum(sportlinkSeasonResourceKinds), resourceId: z.string().uuid(),
  requestId: z.string().uuid(), correlationId: z.string().uuid(), receiptId: z.string().uuid().nullable(),
  previousVersionId: z.string().uuid().nullable(), draftVersionId: z.string().uuid().nullable(),
  previousRevision: revision.nullable(), newRevision: revision.nullable(), reason: z.string().max(1000).nullable(),
  links: linksSchema
}).strict().superRefine((result, issue) => {
  if (result.status === "applied" && (result.receiptId === null || result.draftVersionId === null || result.newRevision === null)) {
    issue.addIssue({ code: "custom", message: "Een opgeslagen concept vereist een volledig ontvangstbewijs, concept-ID en revisie." });
  }
});

export type SportlinkSeasonInventoryRequest = z.infer<typeof sportlinkSeasonInventoryRequestSchema>;
export type SportlinkSeasonInventory = z.infer<typeof sportlinkSeasonInventorySchema>;
export type SportlinkSeasonInventoryRow = z.infer<typeof sportlinkSeasonInventoryRowSchema>;
export type SportlinkSeasonCandidate = z.infer<typeof sportlinkSeasonCandidateSchema>;
export type SportlinkSeasonSelection = z.infer<typeof sportlinkSeasonSelectionSchema>;
export type SportlinkSeasonPreviewRequest = z.infer<typeof sportlinkSeasonPreviewRequestSchema>;
export type SportlinkSeasonPreview = z.infer<typeof sportlinkSeasonPreviewSchema>;
export type SportlinkSeasonApplyRequest = z.infer<typeof sportlinkSeasonApplyRequestSchema>;
export type SportlinkSeasonApplyResult = z.infer<typeof sportlinkSeasonApplyResultSchema>;
