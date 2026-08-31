import { describe, expect, it } from "vitest";

import {
  deriveLedScoresFeatureAvailability,
  parseLedScoresEffectiveState
} from "./ledscores-feature-state";

const tenantId = "12345678-1234-4234-9234-123456789abc";

function state(overrides: Record<string, unknown> = {}) {
  return {
    configuredEnabled: true,
    definitionAvailable: true,
    enabled: true,
    flagKey: "ledscores_realtime",
    killSwitchActive: false,
    revision: 2,
    tenantId,
    ...overrides
  };
}

describe("LED Scores effectieve featurestatus", () => {
  it("accepteert uitsluitend de canonieke tenantgebonden response", () => {
    expect(parseLedScoresEffectiveState(state(), tenantId)).toEqual(state());
    expect(
      parseLedScoresEffectiveState(state({ tenantId: crypto.randomUUID() }), tenantId)
    ).toBeNull();
    expect(
      parseLedScoresEffectiveState(state({ flagKey: "venue_twin" }), tenantId)
    ).toBeNull();
  });

  it("weigert een tegenstrijdige effectieve vrijgave fail-closed", () => {
    expect(
      parseLedScoresEffectiveState(state({ killSwitchActive: true }), tenantId)
    ).toBeNull();
    expect(
      parseLedScoresEffectiveState(state({ configuredEnabled: false }), tenantId)
    ).toBeNull();
    expect(
      parseLedScoresEffectiveState(state({ revision: 1.5 }), tenantId)
    ).toBeNull();
  });

  it.each([
    [null, "unavailable"],
    [state({ definitionAvailable: false, enabled: false }), "definition_missing"],
    [state({ enabled: false, killSwitchActive: true }), "globally_blocked"],
    [state({ configuredEnabled: false, enabled: false }), "not_released"],
    [state({ enabled: false }), "tenant_blocked"],
    [state(), "available"]
  ] as const)("leidt beschikbaarheid %s veilig af", (input, expected) => {
    const parsed = input === null
      ? null
      : parseLedScoresEffectiveState(input, tenantId);
    expect(deriveLedScoresFeatureAvailability(parsed)).toBe(expected);
  });
});
