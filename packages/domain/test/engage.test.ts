import { describe, expect, it } from "vitest";

import { canTransitionEngageCampaign, engageResultsAreVisible } from "../src/engage";

describe("Engage lifecycle", () => {
  it("staat alleen veilige voorwaartse lifecycle-overgangen toe", () => {
    expect(canTransitionEngageCampaign("draft", "live")).toBe(true);
    expect(canTransitionEngageCampaign("live", "closed")).toBe(true);
    expect(canTransitionEngageCampaign("closed", "live")).toBe(false);
  });

  it("respecteert resultaatprivacy", () => {
    expect(engageResultsAreVisible({ hasVoted: false, status: "live", visibility: "after_vote" })).toBe(false);
    expect(engageResultsAreVisible({ hasVoted: true, status: "live", visibility: "after_vote" })).toBe(true);
    expect(engageResultsAreVisible({ hasVoted: false, status: "closed", visibility: "after_close" })).toBe(true);
  });
});
