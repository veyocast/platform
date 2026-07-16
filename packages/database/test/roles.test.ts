import { describe, expect, it } from "vitest";

import {
  invitationStatuses,
  platformRoles,
  platformTenantMutationRoles,
  tenantAdministrationRoles,
  tenantRoles,
  tenantStatuses,
  tenantWriteRoles
} from "../src";

describe("@castivo/database role constants", () => {
  it("keeps canonical platform roles in database order", () => {
    expect(platformRoles).toEqual([
      "platform_owner",
      "platform_admin",
      "platform_support",
      "platform_viewer"
    ]);
  });

  it("keeps canonical tenant roles and capability groups explicit", () => {
    expect(tenantRoles).toEqual([
      "tenant_owner",
      "tenant_admin",
      "tenant_editor",
      "tenant_viewer"
    ]);
    expect(tenantAdministrationRoles).toEqual(["tenant_owner", "tenant_admin"]);
    expect(tenantWriteRoles).toEqual(["tenant_owner", "tenant_admin", "tenant_editor"]);
  });

  it("keeps status unions aligned with database enums", () => {
    expect(platformTenantMutationRoles).toEqual(["platform_owner", "platform_admin"]);
    expect(tenantStatuses).toEqual(["active", "paused", "archived"]);
    expect(invitationStatuses).toEqual(["pending", "accepted", "revoked", "expired"]);
  });
});
