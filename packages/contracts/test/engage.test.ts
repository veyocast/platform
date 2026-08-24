import { describe, expect, it } from "vitest";

import {
  engagePublicCampaignSchema,
  playerEngagePlaybackSchema
} from "../src/engage";

describe("Engage Player contract", () => {
  it("separates immutable campaign binding from changing public results", () => {
    const binding = playerEngagePlaybackSchema.parse({
      kind: "engage",
      publicId: "11111111-1111-4111-8111-111111111111",
      question: "Wie was vandaag de uitblinker?",
      title: "Man van de wedstrijd"
    });
    const runtime = engagePublicCampaignSchema.parse({
      closesAt: null,
      id: binding.publicId,
      kind: "motm",
      options: [
        { id: "22222222-2222-4222-8222-222222222222", label: "Speler 1", sortOrder: 0, voteCount: 4 },
        { id: "33333333-3333-4333-8333-333333333333", label: "Speler 2", sortOrder: 1, voteCount: 7 }
      ],
      privacyNotice: "Er worden geen namen of ruwe IP-adressen opgeslagen.",
      question: binding.question,
      resultVisibility: "live",
      resultsVisible: true,
      status: "live",
      tenantName: "VeyoCast testvereniging",
      title: binding.title,
      totalVotes: 11
    });

    expect(binding).not.toHaveProperty("options");
    expect(runtime.totalVotes).toBe(11);
  });
});
