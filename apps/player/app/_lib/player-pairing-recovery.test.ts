import { describe, expect, it } from "vitest";

import {
  maximumPersistedPairingDelayMs,
  resolvePersistedPairingDelay
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
