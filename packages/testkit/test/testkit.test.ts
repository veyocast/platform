import { describe, expect, it } from "vitest";

import { createStableTestId, expectDefined } from "../src/index";

describe("testkit helpers", () => {
  it("normalizes stable test ids", () => {
    expect(createStableTestId("tenant", "  FC VeyoCast 2026  ")).toBe(
      "tenant-fc-veyocast-2026"
    );
  });

  it("throws when a required value is missing", () => {
    expect(() => expectDefined(undefined, "tenantId")).toThrow(
      "tenantId must be defined"
    );
  });
});
