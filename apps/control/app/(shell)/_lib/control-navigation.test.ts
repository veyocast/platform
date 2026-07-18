import { describe, expect, it } from "vitest";

import {
  getNavigationForRoles,
  getNavigationGroupsForRoles,
  hasControlRole
} from "./control-navigation";

describe("control navigation", () => {
  it("keeps platform links out of tenant-only navigation", () => {
    const links = getNavigationForRoles(["tenant_admin"]).map(
      (item) => item.href
    );

    expect(links).toStrictEqual([
      "/dashboard",
      "/dashboard/pilot",
      "/dashboard/media",
      "/dashboard/playlists",
      "/dashboard/screens",
      "/dashboard/team",
      "/dashboard/auditlog",
      "/dashboard/settings"
    ]);
  });

  it("groups links by the roles available in the session", () => {
    const groups = getNavigationGroupsForRoles([
      "platform_admin",
      "tenant_viewer"
    ]);

    expect(groups.map((group) => group.scope)).toStrictEqual([
      "platform",
      "tenant"
    ]);
    expect(groups.at(1)?.items.map((item) => item.href)).toStrictEqual([
      "/dashboard",
      "/dashboard/media",
      "/dashboard/playlists",
      "/dashboard/screens"
    ]);
  });

  it("allows tenant admins to satisfy tenant viewer routes", () => {
    expect(hasControlRole(["tenant_admin"], "tenant_viewer")).toBe(true);
    expect(hasControlRole(["tenant_viewer"], "tenant_admin")).toBe(false);
  });
});
