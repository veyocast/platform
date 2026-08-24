import { describe, expect, it } from "vitest";

import {
  normalizeOnboardingSlug,
  parseOnboardingSourceKeys,
  validateRegistrationInput
} from "./onboarding-contract";

describe("Vector onboarding contract", () => {
  it("creates a deterministic safe tenant slug", () => {
    expect(
      normalizeOnboardingSlug(
        "  Duindorp SV & Vrienden! ",
        "12345678-1111-4111-8111-111111111111"
      )
    ).toBe("duindorp-sv-vrienden-12345678");
  });

  it("only keeps supported source keys once", () => {
    expect(
      parseOnboardingSourceKeys(["sportlink", "youtube", "rss", "sportlink"])
    ).toEqual(["rss", "sportlink"]);
  });

  it("requires matching long passwords and explicit acceptance", () => {
    expect(
      validateRegistrationInput({
        accepted: true,
        displayName: "Nora Beheerder",
        email: " NORA@EXAMPLE.NL ",
        password: "correct-horse-battery",
        passwordConfirmation: "correct-horse-battery"
      })
    ).toEqual({
      displayName: "Nora Beheerder",
      email: "nora@example.nl",
      password: "correct-horse-battery"
    });
    expect(
      validateRegistrationInput({
        accepted: false,
        displayName: "Nora",
        email: "nora@example.nl",
        password: "correct-horse-battery",
        passwordConfirmation: "correct-horse-battery"
      })
    ).toBeNull();
  });
});
