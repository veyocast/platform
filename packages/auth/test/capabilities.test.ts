import { describe, expect, it } from "vitest";

import {
  capabilities,
  decideCapability,
  getCapabilitiesForRoles,
  hasCapability
} from "../src";

describe("capability decisions", () => {
  it("keeps platform owner exhaustive", () => {
    expect(getCapabilitiesForRoles(["platform_owner"])).toEqual(capabilities);
  });

  it("reserves platform user management for the platform owner", () => {
    expect(hasCapability(["platform_admin"], "platform.user.manage")).toBe(false);
    expect(hasCapability(["platform_owner"], "platform.user.manage")).toBe(true);
  });

  it("allows tenant editors to author and publish but not manage screens or team", () => {
    expect(hasCapability(["tenant_editor"], "tenant.media.write")).toBe(true);
    expect(hasCapability(["tenant_editor"], "tenant.playlist.publish")).toBe(true);
    expect(hasCapability(["tenant_editor"], "tenant.screen.manage")).toBe(false);
    expect(hasCapability(["tenant_editor"], "tenant.team.manage")).toBe(false);
  });

  it("keeps tenant viewers read-only", () => {
    expect(hasCapability(["tenant_viewer"], "tenant.media.read")).toBe(true);
    expect(decideCapability(["tenant_viewer"], "tenant.media.write")).toEqual({
      allowed: false,
      capability: "tenant.media.write",
      reason: "missing_capability"
    });
  });

  it("unions capabilities without duplicate entries", () => {
    const result = getCapabilitiesForRoles(["tenant_admin", "tenant_editor"]);
    expect(new Set(result).size).toBe(result.length);
  });
});
