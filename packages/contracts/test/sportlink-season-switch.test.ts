import { describe, expect, it } from "vitest";

import {
  sportlinkSeasonApplyRequestSchema, sportlinkSeasonInventoryRequestSchema,
  sportlinkSeasonSelectionSchema, sportlinkSeasonTargetContextSchema
} from "../src/sportlink-season-switch";

const id = "10000000-0000-4000-8000-000000000301";
const context = {
  providerTeamId: "218380", competitionSelectionMode: "pinned" as const,
  competitionId: "competition-new", poolId: "pool-new", seasonId: "2026/2027", phaseId: "league"
};
const selection = { mappings: [{ fromProviderTeamId: "old-team", context }] };
const request = {
  resourceKind: "dynamic_slide", resourceId: id, basisVersionId: id, expectedRevision: 0,
  oldBindingHash: "a".repeat(64), contextHash: "b".repeat(64), newSelection: selection,
  clearSelectedMatches: false, requestId: id, correlationId: id
};

describe("exact Sportlink season-switch contract", () => {
  it("accepts revision zero and exact pinned season identity, without a full configuration", () => {
    expect(sportlinkSeasonApplyRequestSchema.parse(request)).toEqual(request);
    expect(sportlinkSeasonApplyRequestSchema.safeParse({ ...request, configuration: {} }).success).toBe(false);
    expect(sportlinkSeasonApplyRequestSchema.safeParse({ ...request, tenantId: id }).success).toBe(false);
  });

  it("cannot replace a target season with an implicit current-season or calendar heuristic", () => {
    expect(sportlinkSeasonTargetContextSchema.safeParse({ ...context, seasonId: null }).success).toBe(false);
    expect(sportlinkSeasonTargetContextSchema.safeParse({ ...context, competitionSelectionMode: "auto_current" }).success).toBe(false);
    expect(sportlinkSeasonTargetContextSchema.safeParse({ ...context, kickoff: "2027-07-01" }).success).toBe(false);
  });

  it("requires explicit source-team mappings, and cannot collapse or duplicate team identities", () => {
    expect(sportlinkSeasonSelectionSchema.safeParse({ mappings: [] }).success).toBe(false);
    expect(sportlinkSeasonSelectionSchema.safeParse({ mappings: [...selection.mappings, ...selection.mappings] }).success).toBe(false);
    expect(sportlinkSeasonSelectionSchema.safeParse({ mappings: [...selection.mappings, { fromProviderTeamId: "other-old-team", context }] }).success).toBe(false);
    expect(sportlinkSeasonSelectionSchema.safeParse({ mappings: [...selection.mappings, { fromProviderTeamId: "other-old-team", context: { ...context, providerTeamId: "new-team" } }] }).success).toBe(true);
  });

  it("bounds filters and pages without accepting a tenant supplied inside the request", () => {
    const input = { connectionId: id, targetSeasonId: null, filters: {}, cursor: null, pageSize: 25 };
    expect(sportlinkSeasonInventoryRequestSchema.parse(input).filters).toEqual({ query: "", status: "all", resourceKind: "all" });
    expect(sportlinkSeasonInventoryRequestSchema.safeParse({ ...input, pageSize: 51 }).success).toBe(false);
    expect(sportlinkSeasonInventoryRequestSchema.safeParse({ ...input, tenantId: id }).success).toBe(false);
    expect(sportlinkSeasonInventoryRequestSchema.safeParse({ ...input, filters: { query: "q".repeat(121) } }).success).toBe(false);
  });
});
