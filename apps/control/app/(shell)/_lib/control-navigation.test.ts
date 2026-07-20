import { describe, expect, it } from "vitest";

import {
  getControlSessionRoles,
  getNavigationForRoles,
  getNavigationGroupsForRoles
} from "./control-navigation";

describe("control navigation", () => {
  it("keeps platform links out of tenant-only navigation", () => {
    const links = getNavigationForRoles(["tenant_admin"]).map(
      (item) => item.href
    );

    expect(links).toStrictEqual([
      "/dashboard",
      "/dashboard/media",
      "/dashboard/playlists",
      "/dashboard/releases",
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

    expect(groups.map((group) => group.id)).toStrictEqual([
      "platform-overview",
      "platform-organization",
      "tenant-overview",
      "tenant-content",
      "tenant-distribution",
      "tenant-organization"
    ]);
    expect(groups.filter((group) => group.scope === "tenant").map((group) => group.title)).toStrictEqual([
      "Overzicht",
      "Content",
      "Distributie",
      "Organisatie"
    ]);
    expect(groups.flatMap((group) => group.items).filter((item) => item.scope === "tenant").map((item) => item.href)).toStrictEqual([
      "/dashboard",
      "/dashboard/media",
      "/dashboard/playlists",
      "/dashboard/releases",
      "/dashboard/screens",
      "/dashboard/team",
      "/dashboard/auditlog",
      "/dashboard/settings"
    ]);
    expect(groups.flatMap((group) => group.items).some((item) => item.href === "/dashboard/pilot")).toBe(false);
  });

  it("combines platform roles with only the active tenant role", () => {
    expect(
      getControlSessionRoles(
        ["platform_admin", "platform_admin"],
        "tenant_viewer"
      )
    ).toStrictEqual(["platform_admin", "tenant_viewer"]);
  });

  it.each([
    {
      expectedScopes: ["platform"],
      role: "platform_admin" as const
    },
    {
      expectedScopes: ["tenant"],
      role: "tenant_admin" as const
    },
    {
      expectedScopes: ["tenant"],
      role: "tenant_editor" as const
    }
  ])("keeps the $role journey inside its permitted context", ({ expectedScopes, role }) => {
    const groups = getNavigationGroupsForRoles([role], role !== "platform_admin");

    expect([...new Set(groups.map((group) => group.scope))]).toStrictEqual(expectedScopes);
    expect(groups.every((group) => group.items.length > 0)).toBe(true);
    expect(groups.flatMap((group) => group.items).some((item) => item.href === "/dashboard/pilot")).toBe(false);
  });
});
