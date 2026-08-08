import { describe, expect, it } from "vitest";

import { shouldReloadPlayerApplication } from "./player-app-update";

describe("player application updates", () => {
  it("requests a reload only for a different advertised deployment", () => {
    expect(shouldReloadPlayerApplication("release-a", "release-b")).toBe(true);
    expect(shouldReloadPlayerApplication("release-a", "release-a")).toBe(false);
    expect(shouldReloadPlayerApplication("release-a", null)).toBe(false);
    expect(shouldReloadPlayerApplication("release-a", "  ")).toBe(false);
  });
});
