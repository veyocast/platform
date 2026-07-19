import { describe, expect, it } from "vitest";

import {
  decideTenantOperation,
  invitationStatuses,
  isPlatformRole,
  isTenantRole,
  platformRoles,
  tenantRoles,
  tenantStatuses
} from "../src";

describe("identity domain", () => {
  it("keeps roles and lifecycle states exhaustive", () => {
    expect(platformRoles).toHaveLength(4);
    expect(tenantRoles).toHaveLength(4);
    expect(tenantStatuses).toEqual(["active", "paused", "archived"]);
    expect(invitationStatuses).toEqual(["pending", "accepted", "revoked", "expired"]);
    expect(isPlatformRole("platform_support")).toBe(true);
    expect(isTenantRole("tenant_editor")).toBe(true);
  });
});

describe("tenant lifecycle policy", () => {
  it("allows all normal operations for active tenants", () => {
    expect(decideTenantOperation("active", "publish")).toEqual({
      allowed: true,
      reason: "allowed"
    });
  });

  it("keeps paused tenants readable and playing but blocks new mutations", () => {
    expect(decideTenantOperation("paused", "read").allowed).toBe(true);
    expect(decideTenantOperation("paused", "existing_playback").allowed).toBe(true);
    expect(decideTenantOperation("paused", "pair")).toEqual({
      allowed: false,
      reason: "tenant_paused"
    });
  });

  it("keeps archived tenants out of normal control flows without blacking out cached playback", () => {
    expect(decideTenantOperation("archived", "read")).toEqual({
      allowed: false,
      reason: "tenant_archived"
    });
    expect(decideTenantOperation("archived", "existing_playback").allowed).toBe(true);
  });
});
