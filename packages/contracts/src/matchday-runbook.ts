import { z } from "zod";

const id = z.string().trim().min(1).max(200);
const objectKey = z.string().trim().min(1).max(500);
const uuid = z.string().uuid();
const instant = z.string().datetime({ offset: true });
const revision = z.number().int().nonnegative();
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const timezone = z.string().min(3).max(80).refine(value => {
  try { new Intl.DateTimeFormat("nl-NL", { timeZone: value }); return true; } catch { return false; }
}, "Kies een geldige verenigingstijdzone.");

export const matchdayExpiryCapability = "matchday-expiry-v1" as const;
export const matchdayRoleSchema = z.enum(["entrance", "clubwall", "canteen", "led"]);
export const matchdayPhaseSchema = z.enum(["before", "playing", "halftime", "resumed", "finished", "postponed", "cancelled"]);
export const matchdayRunStatusSchema = z.enum(["scheduled", "active", "closed", "cancelled"]);
export const matchdayActionKindSchema = z.enum(["field", "phase", "postponed", "cancelled", "sold_out", "available"]);

/** Provider identities are scoped to the exact tenant and connection. Labels
 * and dates are deliberately absent from the identity. */
export const matchdayContextSchema = z.object({
  sourceId: uuid,
  connectionId: uuid,
  teamId: id,
  competitionId: id,
  poolId: id,
  seasonId: id.nullable(),
  phaseId: id.nullable(),
  selectionMode: z.enum(["auto_current", "pinned"])
}).strict();

export const matchdayMatchSchema = z.object({
  id: uuid,
  matchCode: id,
  context: matchdayContextSchema,
  homeTeamId: id,
  awayTeamId: id,
  homeTeamName: z.string().min(1).max(200),
  awayTeamName: z.string().min(1).max(200),
  kickoffAt: instant,
  field: z.string().max(120).nullable(),
  status: z.enum(["scheduled", "live", "finished", "cancelled", "postponed", "unknown"]),
  observedAt: instant.nullable(),
  lastSuccessfulSyncAt: instant.nullable()
}).strict().refine(value => value.context.teamId === value.homeTeamId || value.context.teamId === value.awayTeamId, {
  message: "De wedstrijd hoort niet bij het geselecteerde team.", path: ["context", "teamId"]
});

const phaseReleases = z.object({
  before: uuid.optional(), playing: uuid.optional(), halftime: uuid.optional(),
  resumed: uuid.optional(), finished: uuid.optional(), postponed: uuid.optional(), cancelled: uuid.optional()
}).strict();

export const matchdayRoleConfigurationSchema = z.object({
  role: matchdayRoleSchema,
  targets: z.array(z.object({ kind: z.enum(["screen", "screen_group"]), id: uuid }).strict()).min(1).max(20),
  defaultReleaseId: uuid,
  phaseReleaseIds: phaseReleases,
  menuFallbacks: z.array(z.object({
    menuSnapshotId: uuid, placementId: id, productId: uuid, productLabel: z.string().min(1).max(200), unavailableReleaseId: uuid
  }).strict()).max(100),
  ledBinding: z.object({
    connectionId: uuid, alertVersionId: uuid, providerMatchId: id,
    maximumSourceAgeSeconds: z.number().int().min(5).max(300)
  }).strict().nullable()
}).strict().superRefine((value, context) => {
  if (new Set(value.targets.map(target => `${target.kind}:${target.id}`)).size !== value.targets.length)
    context.addIssue({ code: "custom", path: ["targets"], message: "Kies ieder scherm of iedere groep één keer." });
  if (value.role !== "canteen" && value.menuFallbacks.length)
    context.addIssue({ code: "custom", path: ["menuFallbacks"], message: "Productplaatsingen horen uitsluitend bij de kantinerol." });
  if (value.role !== "led" && value.ledBinding)
    context.addIssue({ code: "custom", path: ["ledBinding"], message: "Koppel de LED-configuratie aan de LED-rol." });
});

export const matchdayDraftConfigurationSchema = z.object({
  schemaVersion: z.literal(1),
  name: z.string().trim().min(2).max(120),
  timezone,
  startsAt: instant,
  endsAt: instant,
  context: matchdayContextSchema.nullable(),
  matches: z.array(matchdayMatchSchema).max(100),
  mainMatchId: uuid.nullable(),
  roles: z.array(matchdayRoleConfigurationSchema).max(4),
  overlapDecisions: z.array(z.object({ screenId: uuid, role: matchdayRoleSchema }).strict()).max(200),
  phaseWindows: z.array(z.object({ phase: matchdayPhaseSchema, startsAt: instant, endsAt: instant }).strict()).max(20)
}).strict().superRefine((value, context) => {
  const from = Date.parse(value.startsAt), until = Date.parse(value.endsAt);
  if (!(until > from) || until - from > 48 * 60 * 60_000)
    context.addIssue({ code: "custom", path: ["endsAt"], message: "Gebruik een begrensd tijdvenster van maximaal twee dagen." });
  if (new Set(value.roles.map(role => role.role)).size !== value.roles.length)
    context.addIssue({ code: "custom", path: ["roles"], message: "Iedere schermrol komt maximaal één keer voor." });
  if (new Set(value.matches.map(match => match.id)).size !== value.matches.length || new Set(value.matches.map(match => `${match.context.connectionId}:${match.matchCode}`)).size !== value.matches.length)
    context.addIssue({ code: "custom", path: ["matches"], message: "Een exacte wedstrijd komt maximaal één keer voor." });
  if (value.mainMatchId && !value.matches.some(match => match.id === value.mainMatchId))
    context.addIssue({ code: "custom", path: ["mainMatchId"], message: "Kies de hoofdwedstrijd uit de geselecteerde wedstrijden." });
  if (!value.context && value.matches.length)
    context.addIssue({ code: "custom", path: ["context"], message: "Geselecteerde wedstrijden vereisen een exacte broncontext." });
  for (const [index, match] of value.matches.entries()) {
    const keys = match.id === value.mainMatchId
      ? ["sourceId", "connectionId", "teamId", "competitionId", "poolId", "seasonId", "phaseId"] as const
      : ["sourceId", "connectionId"] as const;
    if (value.context && keys.some(key => match.context[key] !== value.context![key]))
      context.addIssue({ code: "custom", path: ["matches", index], message: "De wedstrijd heeft een andere broncontext of de hoofdwedstrijd wijkt af van de geselecteerde context." });
  }
  const windows = [...value.phaseWindows].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  for (const [index, window] of windows.entries()) {
    if (Date.parse(window.startsAt) < from || Date.parse(window.endsAt) > until || Date.parse(window.endsAt) <= Date.parse(window.startsAt) || index > 0 && Date.parse(windows[index - 1]!.endsAt) > Date.parse(window.startsAt))
      context.addIssue({ code: "custom", path: ["phaseWindows"], message: "Fasevensters blijven binnen de draaiboekperiode en mogen elkaar niet overlappen." });
  }
  if (new Set(value.overlapDecisions.map(item => item.screenId)).size !== value.overlapDecisions.length)
    context.addIssue({ code: "custom", path: ["overlapDecisions"], message: "Bevestig per overlappend scherm één bestemming." });
});

export const matchdaySaveDraftInputSchema = z.object({
  runbookId: uuid, expectedRevision: revision, requestId: uuid,
  configuration: matchdayDraftConfigurationSchema
}).strict();

/** S301 may update drafts only. Clearing selected exact matches is a separate,
 * explicit decision; no match is inferred in another season. */
export const matchdayDraftContextUpdateSchema = z.object({
  runbookId: uuid, expectedRevision: revision, requestId: uuid,
  context: matchdayContextSchema, clearSelectedMatches: z.boolean()
}).strict();

export const matchdayFrozenTargetSchema = z.object({
  screenId: uuid, screenName: z.string().max(200), role: matchdayRoleSchema,
  targetSnapshotId: uuid, defaultReleaseId: uuid, phaseReleaseIds: phaseReleases,
  orientation: z.enum(["landscape", "portrait"]), width: z.number().int().min(1).max(16384), height: z.number().int().min(1).max(16384),
  expiryCapability: z.literal(matchdayExpiryCapability),
  playerId: uuid.nullable()
}).strict();

export const matchdayPublicationSchema = z.object({
  id: uuid, runbookId: uuid, version: z.number().int().positive(), draftRevision: revision,
  configuration: matchdayDraftConfigurationSchema, targets: z.array(matchdayFrozenTargetSchema).min(1).max(200),
  publishedAt: instant, status: matchdayRunStatusSchema, phase: matchdayPhaseSchema,
  phaseActor: z.string().max(200), phaseChangedAt: instant
}).strict();

const actionBase = { runbookId: uuid, publicationId: uuid, expectedRevision: revision, requestId: uuid, screenIds: z.array(uuid).min(1).max(200), endsAt: instant, reason: z.string().trim().min(2).max(300) };
export const matchdayActionInputSchema = z.discriminatedUnion("kind", [
  z.object({ ...actionBase, kind: z.literal("field"), matchId: uuid, field: z.string().trim().min(1).max(120) }).strict(),
  z.object({ ...actionBase, kind: z.literal("phase"), matchId: uuid, phase: matchdayPhaseSchema }).strict(),
  z.object({ ...actionBase, kind: z.literal("postponed"), matchId: uuid, newKickoffAt: instant.nullable() }).strict(),
  z.object({ ...actionBase, kind: z.literal("cancelled"), matchId: uuid }).strict(),
  z.object({ ...actionBase, kind: z.literal("sold_out"), productId: uuid, menuSnapshotId: uuid, placementId: id }).strict(),
  z.object({ ...actionBase, kind: z.literal("available"), productId: uuid, menuSnapshotId: uuid, placementId: id }).strict()
]);

export const matchdayCommandReceiptSchema = z.object({
  outcome: z.enum(["applied", "replayed", "conflict", "blocked"]), requestId: uuid,
  runbookId: uuid.nullable(), publicationId: uuid.nullable(), actionId: uuid.nullable(),
  actualRevision: revision, message: z.string().max(500)
}).strict();

export const matchdayDeliveryStatusSchema = z.enum(["scheduled", "queued", "received", "prepared", "rendered", "restoring", "restored", "expired", "overridden", "skipped", "failed", "unknown"]);
export const matchdayDeliverySchema = z.object({
  id: uuid, publicationId: uuid, actionId: uuid.nullable(), actionRevision: revision,
  screenId: uuid, screenName: z.string().max(200), deviceId: uuid.nullable(),
  status: matchdayDeliveryStatusSchema, receivedAt: instant.nullable(), renderedAt: instant.nullable(),
  contentHash: hash.nullable(), confirmedReleaseId: uuid.nullable(), detail: z.string().max(300).nullable()
}).strict();

export type MatchdayContext = z.infer<typeof matchdayContextSchema>;
export type MatchdayMatch = z.infer<typeof matchdayMatchSchema>;
export type MatchdayRole = z.infer<typeof matchdayRoleSchema>;
export type MatchdayPhase = z.infer<typeof matchdayPhaseSchema>;
export type MatchdayDraftConfiguration = z.infer<typeof matchdayDraftConfigurationSchema>;
export type MatchdayPublication = z.infer<typeof matchdayPublicationSchema>;
export type MatchdayFrozenTarget = z.infer<typeof matchdayFrozenTargetSchema>;
export type MatchdayActionInput = z.infer<typeof matchdayActionInputSchema>;
export type MatchdayDelivery = z.infer<typeof matchdayDeliverySchema>;

export const matchdayFeatureInputSchema = z.object({enabled:z.boolean(),expectedRevision:revision,requestId:uuid,reason:z.string().trim().min(2).max(300)}).strict();
export const matchdayPublishInputSchema = z.object({runbookId:uuid,expectedRevision:revision,requestId:uuid,preflightId:uuid}).strict();
export const matchdayLifecycleInputSchema = z.object({runbookId:uuid,publicationId:uuid,expectedRevision:revision,requestId:uuid,operation:z.enum(["close","cancel"]),reason:z.string().trim().min(2).max(300)}).strict();
export const matchdayEndActionInputSchema = z.object({runbookId:uuid,publicationId:uuid,actionId:uuid,expectedRevision:revision,requestId:uuid,reason:z.string().trim().min(2).max(300)}).strict();
export const matchdayDelegationInputSchema = z.object({
  runbookId:uuid,publicationId:uuid,userId:uuid,expectedRevision:revision,requestId:uuid,
  screenIds:z.array(uuid).min(1).max(200),objectIds:z.array(objectKey).min(1).max(100),
  actionKinds:z.array(matchdayActionKindSchema).min(1).max(6),endsAt:instant,revoke:z.boolean()
}).strict();

export const matchdayActionSchema = z.object({
  id:uuid,publicationId:uuid,revision:revision,objectKey,kind:matchdayActionKindSchema,
  matchId:uuid.nullable(),productId:uuid.nullable(),menuSnapshotId:uuid.nullable(),placementId:id.nullable(),
  value:z.string().max(500),actorLabel:z.string().max(200),startsAt:instant,endsAt:instant,
  status:z.enum(["active","ended","superseded","expired","cancelled"]),contentHash:hash,
  screenIds:z.array(uuid).max(200)
}).strict();

export const matchdayPreflightSchema = z.object({
  id:uuid,runbookId:uuid,draftRevision:revision,expiresAt:instant,canPublish:z.boolean(),
  targets:z.array(z.object({screenId:uuid,screenName:z.string().max(200),role:matchdayRoleSchema,
    ready:z.boolean(),reason:z.string().max(500).nullable(),defaultReleaseId:uuid,
    planning:z.array(z.object({at:instant,until:instant.nullable(),winnerName:z.string().max(200),source:z.string().max(40),
      releaseId:uuid.nullable(),scheduleId:uuid.nullable(),restoresAt:instant.nullable()}).strict()).max(40)
  }).strict()).max(200),
  issues:z.array(z.object({screenId:uuid.nullable(),role:matchdayRoleSchema.nullable(),code:id,message:z.string().max(500)}).strict()).max(500)
}).strict();

const workspaceScreen=z.object({id:uuid,name:z.string().max(200),status:z.string().max(40),orientation:z.enum(["landscape","portrait"]),width:z.number().int().positive(),height:z.number().int().positive(),playerId:uuid.nullable(),expiryCapability:z.boolean(),lastSeenAt:instant.nullable(),confirmedReleaseId:uuid.nullable(),confirmedAt:instant.nullable()}).strict();
const releaseOption=z.object({id:uuid,playlistId:uuid,label:z.string().max(300),version:z.number().int().positive(),orientation:z.enum(["landscape","portrait"]),width:z.number().int().positive(),height:z.number().int().positive(),ready:z.boolean()}).strict();
const delegation=z.object({id:uuid,userId:uuid,userLabel:z.string().max(200),screenIds:z.array(uuid).max(200),objectIds:z.array(objectKey).max(100),actionKinds:z.array(matchdayActionKindSchema).max(6),endsAt:instant,revision}).strict();

export const matchdayWorkspaceSchema = z.object({
  schemaVersion:z.literal(1),generatedAt:instant,enabled:z.boolean(),settingsRevision:revision,
  permissions:z.object({canManageFeature:z.boolean(),canEdit:z.boolean(),canPublish:z.boolean(),canDelegate:z.boolean()}).strict(),
  runbooks:z.array(z.object({id:uuid,name:z.string().max(120),draftRevision:revision,startsAt:instant,endsAt:instant,currentPublicationId:uuid.nullable(),status:z.enum(["draft","scheduled","active","closed","cancelled"])}).strict()).max(100),
  selected:z.object({
    readScope:z.enum(["full","delegated"]).default("full"),
    id:uuid,draftRevision:revision,configuration:matchdayDraftConfigurationSchema,
    publication:matchdayPublicationSchema.nullable(),actions:z.array(matchdayActionSchema).max(200),deliveries:z.array(matchdayDeliverySchema).max(500),
    delegations:z.array(delegation).max(100),
    permittedActions:z.array(z.object({kind:matchdayActionKindSchema,objectId:objectKey,screenIds:z.array(uuid).max(200),endsAt:instant}).strict()).max(200),
    objectRevisions:z.array(z.object({key:objectKey,revision}).strict()).max(200),
    audit:z.array(z.object({id:uuid,action:z.string().max(120),actorLabel:z.string().max(200),at:instant,beforeText:z.string().max(500).nullable(),afterText:z.string().max(500).nullable(),requestId:uuid.nullable()}).strict()).max(200)
  }).strict().nullable(),
  options:z.object({contexts:z.array(matchdayContextSchema).max(100),matches:z.array(matchdayMatchSchema).max(200),screens:z.array(workspaceScreen).max(200),
    groups:z.array(z.object({id:uuid,name:z.string().max(200),screenIds:z.array(uuid).max(200)}).strict()).max(100),
    releases:z.array(releaseOption).max(200),members:z.array(z.object({id:uuid,label:z.string().max(200)}).strict()).max(200),
    menuPlacements:z.array(z.object({menuSnapshotId:uuid,placementId:id,productId:uuid,productLabel:z.string().min(1).max(200),menuLabel:z.string().min(1).max(200)}).strict()).max(200),
    ledConfigurations:z.array(z.object({connectionId:uuid,alertVersionId:uuid,providerMatchId:id,matchId:uuid,label:z.string().min(1).max(200),maximumSourceAgeSeconds:z.number().int().min(5).max(300)}).strict()).max(100)
  }).strict()
}).strict();

export type MatchdayWorkspace=z.infer<typeof matchdayWorkspaceSchema>;
export type MatchdayPreflight=z.infer<typeof matchdayPreflightSchema>;
export type MatchdayAction=z.infer<typeof matchdayActionSchema>;

export const matchdayAvailabilitySchema=z.object({schemaVersion:z.literal(1),enabled:z.boolean(),canOpen:z.boolean(),canManageFeature:z.boolean()}).strict();

/** Device-only transport. These are issued facts for one frozen target, never
 * provider credentials, editable catalogue data or a generic publishing grant. */
const playerActionBase={schemaVersion:z.literal(1),deliveryId:uuid,actionId:uuid,runbookId:uuid,publicationId:uuid,targetId:uuid,
  screenId:uuid,deviceId:uuid,actionRevision:z.number().int().positive(),contentHash:hash,startsAt:instant,expiresAt:instant,
  matchId:uuid,matchCode:id,homeTeamName:z.string().min(1).max(200),awayTeamName:z.string().min(1).max(200)};
export const playerMatchdayActionSchema=z.discriminatedUnion("kind",[
  z.object({...playerActionBase,kind:z.literal("field"),field:z.string().min(1).max(120)}).strict(),
  z.object({...playerActionBase,kind:z.literal("postponed"),newKickoffAt:instant.nullable()}).strict(),
  z.object({...playerActionBase,kind:z.literal("cancelled")}).strict()
]);
export const playerMatchdayActionsResponseSchema=z.object({schemaVersion:z.literal(1),requestId:uuid,serverTime:instant,
  deviceId:uuid,screenId:uuid,publicationId:uuid.nullable(),actions:z.array(playerMatchdayActionSchema).max(10)}).strict();
export const playerMatchdayActionsInputSchema=z.object({requestId:uuid,publicationIds:z.array(uuid).max(1)}).strict();
export const playerMatchdayAckInputSchema=z.object({schemaVersion:z.literal(1),requestId:uuid,deliveryId:uuid,actionId:uuid,
  runbookId:uuid,publicationId:uuid,targetId:uuid,actionRevision:z.number().int().positive(),contentHash:hash,
  phase:z.enum(["received","prepared","rendered","restored","skipped","failed"]),reportedAt:instant,
  activeReleaseId:uuid,reasonCode:z.enum(["EXPIRED","ENDED","OVERRIDDEN","FRAME_UNAVAILABLE","PLAYBACK_FAILED"]).nullable()}).strict();
export const playerMatchdayAckReceiptSchema=z.object({accepted:z.boolean(),replayed:z.boolean(),deliveryId:uuid,phase:playerMatchdayAckInputSchema.shape.phase}).strict();
export type PlayerMatchdayAction=z.infer<typeof playerMatchdayActionSchema>;
export type PlayerMatchdayActionsResponse=z.infer<typeof playerMatchdayActionsResponseSchema>;
export type PlayerMatchdayAckInput=z.infer<typeof playerMatchdayAckInputSchema>;
export const playerMatchdayWindowReportSchema=z.object({schemaVersion:z.literal(1),publicationId:uuid,targetId:uuid,windowId:uuid,
  contentHash:hash,releaseId:uuid,phase:z.enum(["received","prepared","rendered","restored"]),reportedAt:instant,
  compositionId:uuid.nullable().default(null),compositionRevision:z.number().int().positive().nullable().default(null),compositionHash:hash.nullable().default(null)
}).strict().refine(value=>value.compositionId===null?value.compositionRevision===null&&value.compositionHash===null:value.compositionRevision!==null,"Een compositiebevestiging vereist haar exacte publicatie-identiteit.");
export type PlayerMatchdayWindowReport=z.infer<typeof playerMatchdayWindowReportSchema>;
