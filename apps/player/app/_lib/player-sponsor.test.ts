import { describe, expect, it } from "vitest";

import type { PlayerSponsorPlan } from "@veyocast/contracts";

import { getCacheableAssets } from "./player-cache";
import { appendSponsorProof, selectPlayerSponsor } from "./player-sponsor";

const plan = {
  expiresAt: "2099-01-01T00:00:00.000Z", generatedAt: "2026-08-22T00:00:00.000Z",
  houseFallback: null, planHash: "a".repeat(64), revisionId: "11111111-1111-4111-8111-111111111111",
  schemaVersion: 1, tenantId: "22222222-2222-4222-8222-222222222222", version: 1,
  placements: [{ campaignId: "33333333-3333-4333-8333-333333333333", context: {}, cooldownSeconds: 0, dailyCap: null,
    orientation: "landscape", positionId: "44444444-4444-4444-8444-444444444444", positionKey: "footer", priority: 0,
    sponsorId: "55555555-5555-4555-8555-555555555555", weight: 1, creatives: [{ bytes: 12,
      campaignId: "33333333-3333-4333-8333-333333333333", checksumSha256: "b".repeat(64),
      creativeFamilyId: "66666666-6666-4666-8666-666666666666", creativeId: "77777777-7777-4777-8777-777777777777",
      durationSeconds: 8, height: 200, mimeType: "image/png", sponsorId: "55555555-5555-4555-8555-555555555555",
      sponsorName: "Sponsor", url: "https://assets.example/sponsor.png", width: 400 }]}]
} satisfies PlayerSponsorPlan;

describe("player sponsor runtime", () => {
  it("selecteert deterministisch per positie", () => {
    expect(selectPlayerSponsor({ plan, positionKey: "footer", seed: "screen:1" }))
      .toEqual(selectPlayerSponsor({ plan, positionKey: "footer", seed: "screen:1" }));
  });
  it("dedupliceert een durable proof queue op event UUID", () => {
    const event = { campaignId: plan.placements[0]!.campaignId, context: {}, creativeId: plan.placements[0]!.creatives[0]!.creativeId,
      eventId: "88888888-8888-4888-8888-888888888888", happenedAt: "2026-08-22T00:00:00.000Z", planRevisionId: plan.revisionId,
      playedMs: 8000, positionId: plan.placements[0]!.positionId, sponsorId: plan.placements[0]!.sponsorId };
    expect(appendSponsorProof([event], event)).toHaveLength(1);
  });
  it("neemt sponsorbytes mee in dezelfde geverifieerde releasecache", () => {
    expect(getCacheableAssets({
      items: [], label: "Sponsor delivery", manifestHash: "c".repeat(64),
      playlistId: "99999999-9999-4999-8999-999999999999", publishedAt: "2026-08-22T00:00:00.000Z",
      releaseId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", schemaVersion: 1, sponsorPlan: plan,
      tenantId: plan.tenantId, totalBytes: 12, totalDurationSeconds: 0, version: 1
    })).toMatchObject([{ checksumSha256: "b".repeat(64), kind: "sponsor" }]);
  });
});
