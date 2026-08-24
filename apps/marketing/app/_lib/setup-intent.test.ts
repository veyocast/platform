import { describe, expect, it } from "vitest";

import {
  createSetupIntentToken,
  parseSetupIntentInput,
  verifySetupIntentToken
} from "./setup-intent";

const secret = "test-only-setup-intent-secret-with-more-than-32-bytes";
const now = Date.UTC(2026, 7, 24, 12, 0, 0);

const validInput = {
  branch: "sportclub",
  modules: ["sportlink", "own-media"],
  zones: [
    { count: 1, goal: "welcome", id: "entrance" },
    { count: 2, goal: "menu", id: "clubhouse" },
    { count: 0, goal: "live-info", id: "main" },
    { count: 0, goal: "internal", id: "boardroom" }
  ]
} as const;

describe("venue setup intent", () => {
  it("roundtrips a signed, price-derived intent", () => {
    const input = parseSetupIntentInput(validInput);
    expect(input).not.toBeNull();

    const payload = verifySetupIntentToken(
      createSetupIntentToken(input!, secret, now),
      secret,
      now
    );

    expect(payload).toMatchObject({
      branch: "sportclub",
      grossMonthlyCents: 1_785,
      pricePerScreenGrossCents: 595,
      screenCount: 3,
      version: 1
    });
  });

  it("rejects tampering, expiry and a different secret", () => {
    const input = parseSetupIntentInput(validInput)!;
    const token = createSetupIntentToken(input, secret, now);
    const [payload, signature] = token.split(".");

    expect(verifySetupIntentToken(`${payload}x.${signature}`, secret, now)).toBeNull();
    expect(
      verifySetupIntentToken(
        token,
        "another-test-only-secret-that-is-long-enough-123",
        now
      )
    ).toBeNull();
    expect(verifySetupIntentToken(token, secret, now + 24 * 60 * 60 * 1_000 + 1_000)).toBeNull();
  });

  it("rejects fractional counts, duplicate zones and empty venues", () => {
    expect(
      parseSetupIntentInput({
        ...validInput,
        zones: validInput.zones.map((zone, index) =>
          index === 0 ? { ...zone, count: 1.5 } : zone
        )
      })
    ).toBeNull();
    expect(
      parseSetupIntentInput({
        ...validInput,
        zones: [validInput.zones[0], validInput.zones[0], ...validInput.zones.slice(2)]
      })
    ).toBeNull();
    expect(
      parseSetupIntentInput({
        ...validInput,
        zones: validInput.zones.map((zone) => ({ ...zone, count: 0 }))
      })
    ).toBeNull();
  });

  it("rejects a token whose signed derived price was forged", () => {
    const input = parseSetupIntentInput(validInput)!;
    const token = createSetupIntentToken(input, secret, now);
    const [encoded] = token.split(".");
    const payload = JSON.parse(Buffer.from(encoded!, "base64url").toString("utf8"));
    payload.grossMonthlyCents = 1;

    const forgedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
    expect(verifySetupIntentToken(`${forgedPayload}.${token.split(".")[1]}`, secret, now)).toBeNull();
  });
});
