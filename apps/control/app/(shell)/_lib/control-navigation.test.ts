import { describe, expect, it } from "vitest";

import {
  getControlSessionRoles,
  getNavigationGroupsForPathname,
  getNavigationForRoles,
  getNavigationGroupsForRoles,
  isImmersiveEditorPath
} from "./control-navigation";

describe("control navigation", () => {
  it("keeps platform links out of tenant-only navigation", () => {
    const links = getNavigationForRoles(["tenant_admin"]).map(
      (item) => item.href
    );

    expect(links).toStrictEqual([
      "/dashboard",
      "/dashboard/studio",
      "/dashboard/sponsors",
      "/dashboard/engage",
      "/dashboard/media",
      "/dashboard/playlists",
      "/dashboard/slides",
      "/dashboard/screens",
      "/dashboard/planning",
      "/dashboard/playlist-templates",
      "/dashboard/publications",
      "/dashboard/sources",
      "/dashboard/team",
      "/dashboard/activity",
      "/dashboard/settings",
      "/dashboard/account",
      "/dashboard/support"
    ]);
  });

  it("groups links by the roles available in the session", () => {
    const groups = getNavigationGroupsForRoles([
      "platform_admin",
      "tenant_viewer"
    ]);

    expect(groups.map((group) => group.id)).toStrictEqual([
      "platform-operations",
      "platform-customers",
      "platform-support",
      "platform-product",
      "tenant-today",
      "tenant-content",
      "tenant-broadcast",
      "tenant-sources",
      "tenant-growth",
      "tenant-organization"
    ]);
    expect(groups.filter((group) => group.scope === "tenant").map((group) => group.title)).toStrictEqual([
      "Vandaag",
      "Content",
      "Uitzenden",
      "Bronnen",
      "Groei",
      "Organisatie"
    ]);
    expect(groups.flatMap((group) => group.items).filter((item) => item.scope === "tenant").map((item) => item.href)).toStrictEqual([
      "/dashboard",
      "/dashboard/studio",
      "/dashboard/media",
      "/dashboard/playlists",
      "/dashboard/slides",
      "/dashboard/playlist-templates",
      "/dashboard/screens",
      "/dashboard/planning",
      "/dashboard/publications",
      "/dashboard/sources",
      "/dashboard/sponsors",
      "/dashboard/engage",
      "/dashboard/team",
      "/dashboard/activity",
      "/dashboard/settings",
      "/dashboard/account",
      "/dashboard/support"
    ]);
    expect(groups.flatMap((group) => group.items).some((item) => item.href === "/dashboard/pilot")).toBe(false);
  });

  it("reserveert de immersieve shell alleen voor echte editorroutes", () => {
    expect(isImmersiveEditorPath("/dashboard/playlists/playlist-id")).toBe(true);
    expect(isImmersiveEditorPath("/dashboard/studio/design-id")).toBe(true);
    expect(isImmersiveEditorPath("/dashboard/studio")).toBe(false);
    expect(isImmersiveEditorPath("/dashboard/studio/new")).toBe(false);
    expect(isImmersiveEditorPath("/dashboard/studio/templates")).toBe(false);
    expect(isImmersiveEditorPath("/dashboard/studio/design-id/renders/job-id")).toBe(false);
  });

  it("combines platform roles with only the active tenant role", () => {
    expect(
      getControlSessionRoles(
        ["platform_admin", "platform_admin"],
        "tenant_viewer"
      )
    ).toStrictEqual(["platform_admin", "tenant_viewer"]);
  });

  it("builds custom-role navigation from effective capabilities", () => {
    const links = getNavigationForRoles([
      "tenant.overview.read",
      "tenant.media.read",
      "tenant.screen.read",
      "tenant.screen.manage"
    ]).map((item) => item.href);

    expect(links).toStrictEqual([
      "/dashboard",
      "/dashboard/media",
      "/dashboard/screens"
    ]);
  });

  it("keeps a sponsor committee inside the compact Sponsor Hub workspace", () => {
    expect(getNavigationForRoles([
      "tenant.sponsor.read",
      "tenant.sponsor.write",
      "tenant.sponsor.report"
    ]).map((item) => item.href)).toStrictEqual(["/dashboard/sponsors"]);
  });

  it("shows only navigation for the route context while keeping all permitted groups available", () => {
    const groups = getNavigationGroupsForRoles([
      "platform_admin",
      "tenant_viewer"
    ]);

    expect(
      getNavigationGroupsForPathname(groups, "/platform/tenants", "tenant")
        .map((group) => group.scope)
    ).toStrictEqual(["platform", "platform", "platform", "platform"]);
    expect(
      getNavigationGroupsForPathname(groups, "/dashboard/media", "platform")
        .map((group) => group.scope)
    ).toStrictEqual([
      "tenant",
      "tenant",
      "tenant",
      "tenant",
      "tenant",
      "tenant"
    ]);
    expect(
      getNavigationGroupsForPathname(groups, "/context", "tenant")
        .every((group) => group.scope === "tenant")
    ).toBe(true);
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
