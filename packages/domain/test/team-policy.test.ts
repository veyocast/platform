import { describe, expect, it } from "vitest";

import {
  decidePlatformRoleMutation,
  decideTenantRoleMutation
} from "../src";

describe("tenant team mutation policy", () => {
  it("lets owners transfer roles while protecting self and the last owner", () => {
    expect(decideTenantRoleMutation({ actorRole: "tenant_owner", isSelf: false, nextRole: "tenant_owner", ownerCount: 1, targetRole: "tenant_admin" }).allowed).toBe(true);
    expect(decideTenantRoleMutation({ actorRole: "tenant_owner", isSelf: true, nextRole: "tenant_admin", ownerCount: 2, targetRole: "tenant_owner" }).reason).toBe("self_lockout");
    expect(decideTenantRoleMutation({ actorRole: "tenant_owner", isSelf: false, nextRole: "tenant_admin", ownerCount: 1, targetRole: "tenant_owner" }).reason).toBe("last_owner");
  });

  it("keeps tenant admins below owner scope", () => {
    expect(decideTenantRoleMutation({ actorRole: "tenant_admin", isSelf: false, nextRole: "tenant_viewer", ownerCount: 1, targetRole: "tenant_editor" }).allowed).toBe(true);
    expect(decideTenantRoleMutation({ actorRole: "tenant_admin", isSelf: false, nextRole: "tenant_owner", ownerCount: 1, targetRole: "tenant_editor" }).reason).toBe("insufficient_role");
  });
});

describe("platform team mutation policy", () => {
  it("reserves platform role management for owners and prevents lockout", () => {
    expect(decidePlatformRoleMutation({ actorRole: "platform_owner", isSelf: false, nextRole: "platform_admin", ownerCount: 2, targetRole: "platform_viewer" }).allowed).toBe(true);
    expect(decidePlatformRoleMutation({ actorRole: "platform_owner", isSelf: true, nextRole: null, ownerCount: 2, targetRole: "platform_owner" }).reason).toBe("self_lockout");
    expect(decidePlatformRoleMutation({ actorRole: "platform_owner", isSelf: false, nextRole: null, ownerCount: 1, targetRole: "platform_owner" }).reason).toBe("last_owner");
    expect(decidePlatformRoleMutation({ actorRole: "platform_admin", isSelf: false, nextRole: "platform_viewer", ownerCount: 1, targetRole: null }).reason).toBe("insufficient_role");
  });
});
