import { z } from "zod";

export const sponsorPositionKeySchema = z.enum([
  "fullscreen",
  "presented_by",
  "footer",
  "corner",
  "match_sponsor",
  "match_ball_sponsor"
]);

export const sponsorContextSchema = z.object({
  competitionId: z.string().uuid().optional(),
  eventId: z.string().uuid().optional(),
  matchId: z.string().uuid().optional(),
  teamId: z.string().uuid().optional()
});

export const playerSponsorCreativeSchema = z.object({
  bytes: z.number().int().positive(),
  campaignId: z.string().uuid(),
  checksumSha256: z.string().regex(/^[a-f0-9]{64}$/),
  creativeFamilyId: z.string().uuid(),
  creativeId: z.string().uuid(),
  durationSeconds: z.number().positive().max(300),
  height: z.number().int().positive().nullable(),
  mimeType: z.string().min(1),
  sponsorId: z.string().uuid(),
  sponsorName: z.string().min(1),
  url: z.string().url(),
  width: z.number().int().positive().nullable()
});

export const playerSponsorPlacementSchema = z.object({
  campaignId: z.string().uuid(),
  context: sponsorContextSchema.default({}),
  cooldownSeconds: z.number().int().nonnegative().default(0),
  creatives: z.array(playerSponsorCreativeSchema).min(1),
  dailyCap: z.number().int().positive().nullable(),
  orientation: z.enum(["landscape", "portrait", "any"]).default("any"),
  positionId: z.string().uuid(),
  positionKey: sponsorPositionKeySchema,
  priority: z.number().int().default(0),
  sponsorId: z.string().uuid(),
  weight: z.number().positive().default(1)
});

export const playerSponsorPlanSchema = z.object({
  expiresAt: z.string().datetime(),
  generatedAt: z.string().datetime(),
  houseFallback: playerSponsorCreativeSchema.nullable(),
  planHash: z.string().regex(/^[a-f0-9]{64}$/),
  placements: z.array(playerSponsorPlacementSchema),
  revisionId: z.string().uuid(),
  schemaVersion: z.literal(1),
  tenantId: z.string().uuid(),
  version: z.number().int().positive()
});

export const sponsorPlayEventSchema = z.object({
  campaignId: z.string().uuid(),
  context: sponsorContextSchema.default({}),
  creativeId: z.string().uuid(),
  eventId: z.string().uuid(),
  happenedAt: z.string().datetime(),
  planRevisionId: z.string().uuid(),
  playedMs: z.number().int().nonnegative(),
  positionId: z.string().uuid(),
  sponsorId: z.string().uuid()
});

export const sponsorPlayEventBatchSchema = z.object({
  events: z.array(sponsorPlayEventSchema).min(1).max(100)
});

export type PlayerSponsorPlan = z.infer<typeof playerSponsorPlanSchema>;
export type PlayerSponsorPlacement = z.infer<typeof playerSponsorPlacementSchema>;
export type PlayerSponsorCreative = z.infer<typeof playerSponsorCreativeSchema>;
export type SponsorContext = z.infer<typeof sponsorContextSchema>;
export type SponsorPlayEvent = z.infer<typeof sponsorPlayEventSchema>;
export type SponsorPositionKey = z.infer<typeof sponsorPositionKeySchema>;

const reportCount = z.string().regex(/^(0|[1-9][0-9]*)$/u);
const reportTimestamp = z.string().datetime({ offset: true });
const reportOption = z.object({ id: z.string().uuid(), name: z.string() });
/** Accepted technical plays; no audience, completion or QR inference. */
export const sponsorReportSchema = z.object({
  schemaVersion: z.literal(1),
  asOf: reportTimestamp,
  timezone: z.string().min(1),
  period: z.object({ fromDate: z.string(), untilDate: z.string(), from: reportTimestamp, until: reportTimestamp }),
  filters: z.object({ campaignId: z.string().uuid().nullable(), screenId: z.string().uuid().nullable() }),
  totals: z.object({ acceptedEvents: reportCount, playedMs: reportCount }),
  coverage: z.object({
    firstEventAt: reportTimestamp.nullable(), lastEventAt: reportTimestamp.nullable(), lastReceivedAt: reportTimestamp.nullable(),
    status: z.enum(["unconfirmed", "partial"]), automaticRetentionDays: z.null(), acceptedLateWindowDays: z.literal(30),
    gaps: z.array(z.object({ from: reportTimestamp, until: reportTimestamp, reason: z.enum(["registration_gap", "retention"]) }))
  }),
  groups: z.array(z.object({
    campaignId: z.string().uuid(), campaignName: z.string(), screenId: z.string().uuid(), screenName: z.string(), screenDeleted: z.boolean(),
    acceptedEvents: reportCount, playedMs: reportCount
  })),
  details: z.array(z.object({
    eventId: z.string().uuid(), campaignId: z.string().uuid(), campaignName: z.string(), screenId: z.string().uuid(), screenName: z.string(), screenDeleted: z.boolean(),
    planVersion: z.number().int().positive(), happenedAt: reportTimestamp, receivedAt: reportTimestamp, playedMs: z.number().int().min(0).max(3_600_000)
  })).max(100),
  hasMore: z.boolean(),
  goals: z.array(z.object({ campaignId: z.string().uuid(), campaignName: z.string(), targetPlays: reportCount })),
  filterOptions: z.object({ campaigns: z.array(reportOption), screens: z.array(reportOption.extend({ deleted: z.boolean() })) }),
  qrScans: z.null(), completedPlays: z.null(), historicalScreenGroupsAvailable: z.literal(false)
});
export type SponsorReport = z.infer<typeof sponsorReportSchema>;
