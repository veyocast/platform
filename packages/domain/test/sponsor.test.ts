import { describe, expect, it } from "vitest";

import type { PlayerSponsorPlacement } from "@veyocast/contracts";

import {
  isSponsorPlanUsable,
  selectSponsorCreative,
  selectSponsorPlacement
} from "../src/sponsor";

const creative = {
  bytes: 1200,
  campaignId: "22222222-2222-4222-8222-222222222222",
  checksumSha256: "a".repeat(64),
  creativeFamilyId: "33333333-3333-4333-8333-333333333333",
  creativeId: "44444444-4444-4444-8444-444444444444",
  durationSeconds: 8,
  height: 1080,
  mimeType: "image/png",
  sponsorId: "11111111-1111-4111-8111-111111111111",
  sponsorName: "Lokale sponsor",
  url: "https://assets.example/sponsor.png",
  width: 1920
} as const;

function placement(overrides: Partial<PlayerSponsorPlacement> = {}): PlayerSponsorPlacement {
  return {
    campaignId: creative.campaignId,
    context: {},
    cooldownSeconds: 0,
    creatives: [creative],
    dailyCap: null,
    orientation: "any",
    positionId: "55555555-5555-4555-8555-555555555555",
    positionKey: "footer",
    priority: 0,
    sponsorId: creative.sponsorId,
    weight: 1,
    ...overrides
  };
}

describe("sponsorselectie", () => {
  it("kiest de meest specifieke context vóór de algemene pool", () => {
    const match = placement({
      campaignId: "66666666-6666-4666-8666-666666666666",
      context: { matchId: "77777777-7777-4777-8777-777777777777" }
    });
    expect(selectSponsorPlacement({
      context: { matchId: "77777777-7777-4777-8777-777777777777" },
      history: { campaignCounts: {}, lastPlayedAtByCampaign: {} },
      now: new Date("2026-08-22T12:00:00.000Z"),
      placements: [placement(), match],
      positionKey: "footer",
      seed: "screen:loop"
    })?.campaignId).toBe(match.campaignId);
  });

  it("houdt meervoudige creatives binnen hetzelfde sponsoraandeel", () => {
    const second = { ...creative, creativeId: "88888888-8888-4888-8888-888888888888" };
    const campaign = placement({ creatives: [creative, second] });
    expect(selectSponsorCreative(campaign, "vaste-seed")).toEqual(
      selectSponsorCreative(campaign, "vaste-seed")
    );
  });

  it("weigert een verlopen offline sponsorplan", () => {
    expect(isSponsorPlanUsable("2026-08-21T00:00:00.000Z", new Date("2026-08-22T00:00:00.000Z"))).toBe(false);
  });
});
