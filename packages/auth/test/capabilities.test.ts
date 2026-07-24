import { describe, expect, it } from "vitest";

import {
  capabilities,
  decideCapability,
  getCapabilitiesForRoles,
  hasCapability,
  MissingCapabilityError,
  requireCapability,
  roleCapabilityMatrix
} from "../src";
import { platformRoles, tenantRoles } from "@veyocast/domain";

describe("capability decisions", () => {
  it("keeps platform owner exhaustive", () => {
    expect(getCapabilitiesForRoles(["platform_owner"])).toEqual(capabilities);
  });

  it("reserves platform user management for the platform owner", () => {
    expect(hasCapability(["platform_admin"], "platform.user.manage")).toBe(false);
    expect(hasCapability(["platform_owner"], "platform.user.manage")).toBe(true);
  });

  it("lets tenant editors prepare content without publishing or managing the tenant", () => {
    expect(hasCapability(["tenant_editor"], "tenant.media.write")).toBe(true);
    expect(hasCapability(["tenant_editor"], "tenant.playlist.write")).toBe(true);
    expect(hasCapability(["tenant_editor"], "tenant.playlist.publish")).toBe(false);
    expect(hasCapability(["tenant_editor"], "tenant.screen.manage")).toBe(false);
    expect(hasCapability(["tenant_editor"], "tenant.team.manage")).toBe(false);
    expect(hasCapability(["tenant_admin"], "tenant.playlist.publish")).toBe(true);
  });

  it("keeps tenant viewers read-only", () => {
    expect(hasCapability(["tenant_viewer"], "tenant.media.read")).toBe(true);
    expect(decideCapability(["tenant_viewer"], "tenant.media.write")).toEqual({
      allowed: false,
      capability: "tenant.media.write",
      reason: "missing_capability"
    });
    expect(hasCapability(["tenant_viewer"], "tenant.support.export")).toBe(false);
    expect(hasCapability(["tenant_admin"], "tenant.support.export")).toBe(true);
  });

  it("unions capabilities without duplicate entries", () => {
    const result = getCapabilitiesForRoles(["tenant_admin", "tenant_editor"]);
    expect(new Set(result).size).toBe(result.length);
  });

  it("defines every role exactly once and only with canonical capabilities", () => {
    expect(Object.keys(roleCapabilityMatrix).sort()).toEqual(
      [...platformRoles, ...tenantRoles].sort()
    );

    for (const role of [...platformRoles, ...tenantRoles]) {
      expect(new Set(roleCapabilityMatrix[role]).size).toBe(
        roleCapabilityMatrix[role].length
      );
      expect(
        roleCapabilityMatrix[role].every((capability) =>
          capabilities.includes(capability)
        )
      ).toBe(true);
    }
  });

  it("decides every role and capability combination from the canonical matrix", () => {
    for (const role of [...platformRoles, ...tenantRoles]) {
      for (const capability of capabilities) {
        const expected = roleCapabilityMatrix[role].includes(capability);
        expect(hasCapability([role], capability)).toBe(expected);
        expect(decideCapability([role], capability)).toEqual({
          allowed: expected,
          capability,
          reason: expected ? "allowed" : "missing_capability"
        });
      }
    }
  });

  it("fails closed through the central requireCapability boundary", () => {
    expect(() =>
      requireCapability(["tenant_viewer"], "tenant.media.write")
    ).toThrowError(MissingCapabilityError);
    expect(() =>
      requireCapability(["tenant_editor"], "tenant.media.write")
    ).not.toThrow();
  });

  it("accepts a server-resolved capability set without inventing role permissions", () => {
    const effectiveCapabilities = [
      "tenant.overview.read",
      "tenant.media.read",
      "tenant.screen.manage"
    ] as const;

    expect(hasCapability(effectiveCapabilities, "tenant.screen.manage")).toBe(true);
    expect(hasCapability(effectiveCapabilities, "tenant.playlist.write")).toBe(false);
    expect(() =>
      requireCapability(effectiveCapabilities, "tenant.playlist.write")
    ).toThrowError(MissingCapabilityError);
  });

  it("separates Studio authoring, tenant-wide management and viewing", () => {
    expect(hasCapability(["tenant_editor"], "tenant.studio.create")).toBe(true);
    expect(hasCapability(["tenant_editor"], "tenant.studio.render")).toBe(true);
    expect(hasCapability(["tenant_editor"], "tenant.studio.edit_all")).toBe(false);
    expect(hasCapability(["tenant_viewer"], "tenant.studio.read")).toBe(true);
    expect(hasCapability(["tenant_viewer"], "tenant.studio.create")).toBe(false);
    expect(hasCapability(["tenant_admin"], "tenant.studio.template.manage")).toBe(true);
  });
});
