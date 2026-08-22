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
