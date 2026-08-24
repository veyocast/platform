import { z } from "zod";

export const engageCampaignKinds = ["poll", "motm"] as const;
export const engageCampaignStatuses = [
  "draft",
  "scheduled",
  "live",
  "closed",
  "archived"
] as const;
export const engageResultVisibilities = [
  "after_vote",
  "after_close",
  "live"
] as const;

const idSchema = z.string().uuid();
const safeLabelSchema = z.string().trim().min(2).max(160);

export const engageOptionSchema = z.object({
  id: idSchema,
  label: safeLabelSchema,
  sortOrder: z.number().int().min(0).max(100),
  voteCount: z.number().int().nonnegative().optional()
}).strict();

export const engagePublicCampaignSchema = z.object({
  closesAt: z.string().datetime({ offset: true }).nullable(),
  id: idSchema,
  kind: z.enum(engageCampaignKinds),
  options: z.array(engageOptionSchema).min(2).max(24),
  privacyNotice: z.string().trim().min(8).max(500),
  question: safeLabelSchema,
  resultVisibility: z.enum(engageResultVisibilities),
  resultsVisible: z.boolean(),
  status: z.enum(["live", "closed"]),
  tenantName: safeLabelSchema,
  title: safeLabelSchema,
  totalVotes: z.number().int().nonnegative()
}).strict();

export const engageVoteRequestSchema = z.object({ optionId: idSchema }).strict();

export const engageVoteResultSchema = z.object({
  accepted: z.boolean(),
  campaign: engagePublicCampaignSchema,
  reason: z.enum(["accepted", "already_voted", "closed", "invalid"])
}).strict();

export const playerEngagePlaybackSchema = z.object({
  kind: z.literal("engage"),
  publicId: idSchema,
  question: safeLabelSchema,
  title: safeLabelSchema
}).strict();

export type EngageCampaignKind = (typeof engageCampaignKinds)[number];
export type EngageCampaignStatus = (typeof engageCampaignStatuses)[number];
export type EngageResultVisibility = (typeof engageResultVisibilities)[number];
export type EngagePublicCampaign = z.infer<typeof engagePublicCampaignSchema>;
export type EngageVoteResult = z.infer<typeof engageVoteResultSchema>;
export type PlayerEngagePlayback = z.infer<typeof playerEngagePlaybackSchema>;
