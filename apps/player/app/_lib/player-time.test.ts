import { describe, expect, it } from "vitest";

import {
  normalizePlayerTimestamp,
  parsePlayerTimestamp
} from "./player-time";

describe("Player timestamps", () => {
  it("normaliseert PostgreSQL-microseconden voor oudere webOS-browsers", () => {
    const value = "2026-07-30T13:48:32.536822+00:00";

    expect(normalizePlayerTimestamp(value)).toBe(
      "2026-07-30T13:48:32.536Z"
    );
    expect(parsePlayerTimestamp(value)).toBe(
      Date.UTC(2026, 6, 30, 13, 48, 32, 536)
    );
  });

  it("weigert een ongeldige vervaldatum", () => {
    expect(normalizePlayerTimestamp("geen datum")).toBeNull();
    expect(parsePlayerTimestamp("geen datum")).toBeNaN();
  });
});
