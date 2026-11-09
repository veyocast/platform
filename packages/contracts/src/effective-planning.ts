import { z } from "zod";

const instant = z.string().datetime({ offset: true });
const identity = z.string().uuid();
const source = z.enum(["override", "publisher", "fallback", "default"]);
const winnerSchema = z.object({
  scheduleId: identity.nullable(), name: z.string(), source,
  targetKind: z.enum(["screen", "screen_group"]).nullable(), priority: z.number().nullable(),
  startsAt: instant.nullable(), endsAt: instant.nullable(), targetSnapshotId: identity.nullable(),
  playlistId: identity.nullable(), playlistName: z.string().nullable(),
  releaseId: identity.nullable(), releaseVersion: z.number().int().nullable(), draft: z.boolean()
});
export const planningAlternativeSchema = z.object({
  scheduleId: identity, name: z.string(), source,
  targetKind: z.enum(["screen", "screen_group"]), priority: z.number(), startsAt: instant
});
export const effectivePlanningSchema = z.object({
  schemaVersion: z.literal(1), evaluatedAt: instant, horizonEnd: instant, timezone: z.string(), proposal: z.boolean(),
  screens: z.array(z.object({
    screenId: identity, name: z.string(), status: z.string(), evaluationApplies: z.boolean(),
    winner: winnerSchema, next: z.object({ at: instant, winner: winnerSchema }).nullable(),
    searchedUntil: instant, searchComplete: z.boolean(), proposalTieUncertain: z.boolean(),
    alternatives: z.array(planningAlternativeSchema).max(5), candidateCount: z.number().int().nonnegative(),
    desired: z.object({ releaseId: identity.nullable(), scheduleId: identity.nullable() }),
    desiredPublication: z.object({ name: z.string(), version: z.number().int() }).nullable(),
    reportedPublication: z.object({ name: z.string(), version: z.number().int() }).nullable(),
    reportedDevice: z.object({
      active_release_id: identity.nullable(), desired_release_id: identity.nullable(),
      last_seen_at: instant.nullable(), last_error_code: z.string().nullable(), status: z.string(),
      current_sync_detail: z.object({ publicationTrace: z.object({
        releaseId: z.string().nullable(), firstFrameAt: z.string().nullable()
      }) })
    }).nullable()
  })).max(50)
});
export type EffectivePlanningReport = z.infer<typeof effectivePlanningSchema>;
export type PlanningAlternative = z.infer<typeof planningAlternativeSchema>;
export type PlanningWinner = z.infer<typeof winnerSchema>;
export type PlanningPreviewResult = { report: EffectivePlanningReport | null; error: string | null };
export type PlanningProposal = {
  scheduleId?: string; expectedRevision?: number; name: string; releaseId: string;
  targetKind: "screen" | "screen_group" | "all"; targetId: string; startsAt: string; endsAt: string | null;
  source: "publisher" | "override"; priority: number; scheduleKind: "once" | "daily" | "weekly" | "custom";
  recurrence: Record<string, unknown>;
};

export const effectivePlanningScreenIdsSchema = z.array(z.string().uuid()).min(1).max(50).refine(ids => new Set(ids).size === ids.length);
