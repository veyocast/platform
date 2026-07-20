import { describe, expect, it } from "vitest";

import {
  resolveTenantContext,
  safeControlReturnPath,
  type TenantMembershipContext
} from "./tenant-context";

const memberships = [
  {
    id: "10000000-0000-4000-8000-000000000001",
    name: "Vereniging Noord",
    role: "tenant_admin",
    slug: "vereniging-noord",
    status: "active"
  },
  {
    id: "10000000-0000-4000-8000-000000000002",
    name: "Vereniging Zuid",
    role: "tenant_viewer",
    slug: "vereniging-zuid",
    status: "paused"
  },
  {
    id: "10000000-0000-4000-8000-000000000003",
    name: "Vereniging Archief",
    role: "tenant_owner",
    slug: "vereniging-archief",
    status: "archived"
  }
] as const satisfies readonly TenantMembershipContext[];

describe("explicit tenant context", () => {
  it("never chooses the first membership implicitly", () => {
    expect(resolveTenantContext(memberships, null)).toEqual({
      context: null,
      reason: "needs_selection"
    });
  });

  it("selects only the exact server-known membership", () => {
    expect(resolveTenantContext(memberships, "vereniging-zuid")).toEqual({
      context: memberships[1],
      reason: "selected"
    });
  });

  it("fails closed for hostile, revoked and archived contexts", () => {
    expect(resolveTenantContext(memberships, "../../platform").reason).toBe(
      "invalid_context"
    );
    expect(resolveTenantContext(memberships, "andere-vereniging").reason).toBe(
      "membership_revoked"
    );
    expect(
      resolveTenantContext(memberships, "vereniging-archief").reason
    ).toBe("tenant_archived");
  });

  it("allows paused context for reads while preserving its status", () => {
    expect(resolveTenantContext(memberships, "vereniging-zuid")).toMatchObject({
      context: { status: "paused" },
      reason: "selected"
    });
  });

  it("blocks open redirects and non-Control destinations", () => {
    expect(safeControlReturnPath("https://attacker.test/dashboard")).toBe(
      "/dashboard"
    );
    expect(safeControlReturnPath("//attacker.test/dashboard")).toBe(
      "/dashboard"
    );
    expect(safeControlReturnPath("/api/health")).toBe("/dashboard");
    expect(safeControlReturnPath("/dashboard/media?upload=1#queue")).toBe(
      "/dashboard/media?upload=1#queue"
    );
  });
});
