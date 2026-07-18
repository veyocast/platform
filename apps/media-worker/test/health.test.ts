import { describe, expect, it } from "vitest";

import { getWorkerHealth } from "../src/index";

describe("media worker runtime skeleton", () => {
  it("reports deterministic health metadata", () => {
    expect(getWorkerHealth(new Date("2026-01-01T00:00:00.000Z"))).toEqual({
      service: "VeyoCast Media Worker",
      status: "ok",
      checkedAt: "2026-01-01T00:00:00.000Z",
      controlUrl: "http://localhost:3000"
    });
  });
});
