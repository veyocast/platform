import { describe, expect, it } from "vitest";

import {
  createPlayerDemoSession,
  isStagingPlayerDemoEnabled,
  isValidPlayerDemoSession,
  matchesPlayerDemoCode,
  playerDemoSessionLifetimeSeconds
} from "./player-demo-session";

const secret = "review-demo-session-secret-with-at-least-32-bytes";
const now = Date.parse("2026-07-23T12:00:00.000Z");

describe("staging player demo session", () => {
  it("fails closed outside the explicit staging runtime", () => {
    expect(isStagingPlayerDemoEnabled({ VEYOCAST_ENVIRONMENT: "staging" })).toBe(true);
    expect(isStagingPlayerDemoEnabled({ VEYOCAST_ENVIRONMENT: "production" })).toBe(false);
    expect(isStagingPlayerDemoEnabled({ NODE_ENV: "development" })).toBe(false);
  });

  it("accepts the reusable review code with harmless spacing differences", () => {
    expect(matchesPlayerDemoCode("VYO 2VY")).toBe(true);
    expect(matchesPlayerDemoCode("vyo2vy")).toBe(true);
    expect(matchesPlayerDemoCode("VYO-2VY")).toBe(true);
    expect(matchesPlayerDemoCode("VYO 2VZ")).toBe(false);
    expect(matchesPlayerDemoCode(null)).toBe(false);
  });

  it("signs an expiring, tamper-evident virtual device session", () => {
    const session = createPlayerDemoSession({ now, secret });
    expect(session?.maxAge).toBe(playerDemoSessionLifetimeSeconds);
    expect(
      isValidPlayerDemoSession({ now, secret, value: session?.value })
    ).toBe(true);
    expect(
      isValidPlayerDemoSession({
        now,
        secret,
        value: `${session?.value}tampered`
      })
    ).toBe(false);
  });

  it("rejects expired sessions and missing server secrets", () => {
    const session = createPlayerDemoSession({ now, secret });
    expect(
      isValidPlayerDemoSession({
        now: now + (playerDemoSessionLifetimeSeconds + 1) * 1_000,
        secret,
        value: session?.value
      })
    ).toBe(false);
    expect(createPlayerDemoSession({ now, secret: "short" })).toBeNull();
  });
});

