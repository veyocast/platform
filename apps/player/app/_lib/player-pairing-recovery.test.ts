import { describe, expect, it } from "vitest";

import {
  maximumPersistedPairingDelayMs,
  pairingRequestNonceRotationThresholdMs,
  resolvePersistedPairingDelay,
  shouldRotatePairingRequestNonce
} from "./player-pairing-recovery";

describe("resolvePersistedPairingDelay", () => {
  it("honours a current bounded backend retry window", () => {
    expect(resolvePersistedPairingDelay(125_000, 100_000)).toBe(25_000);
  });

  it("discards expired retry state", () => {
    expect(resolvePersistedPairingDelay(99_999, 100_000)).toBe(0);
  });

  it("discards implausible future state after a device clock change", () => {
    expect(
      resolvePersistedPairingDelay(
        100_000 + maximumPersistedPairingDelayMs + 1,
        100_000
      )
    ).toBe(0);
  });
});

describe("pairing request nonce recovery", () => {
  it("keeps the idempotency key during a short temporary outage", () => {
    expect(shouldRotatePairingRequestNonce(10_000, 69_999)).toBe(false);
  });

  it("rotates a poisoned idempotency key after one bounded minute", () => {
    expect(
      shouldRotatePairingRequestNonce(
        10_000,
        10_000 + pairingRequestNonceRotationThresholdMs
      )
    ).toBe(true);
  });

  it("does not rotate without a recorded transient failure", () => {
    expect(shouldRotatePairingRequestNonce(null, 100_000)).toBe(false);
  });
});
