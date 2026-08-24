import { describe, expect, it } from "vitest";

import { deriveEngageVoterHashes } from "./engage-voter-identity";

const secret = "s".repeat(48);
describe("Engage voter pseudonymisation", () => {
  it("is deterministic but separates identity and network controls", () => {
    const result = deriveEngageVoterHashes({ campaignId: "campaign", forwardedFor: "192.0.2.24", secret, userAgent: "browser", visitorId: "visitor" });
    expect(result.identityHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.networkHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.identityHash).not.toBe(result.networkHash);
  });
  it("coarsens IPv4 to avoid retaining address-level identity", () => {
    const left = deriveEngageVoterHashes({ campaignId: "a", forwardedFor: "192.0.2.24", secret, userAgent: "browser", visitorId: "one" });
    const right = deriveEngageVoterHashes({ campaignId: "b", forwardedFor: "192.0.2.99", secret, userAgent: "browser", visitorId: "two" });
    expect(left.networkHash).toBe(right.networkHash);
  });
  it("fails closed without a deployment secret", () => {
    expect(() => deriveEngageVoterHashes({ campaignId: "a", forwardedFor: null, secret: "short", userAgent: null, visitorId: "v" })).toThrow(/ontbreekt/);
  });
});
