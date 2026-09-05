import { describe, expect, it } from "vitest";

import { resolveTenantThemeAuthority } from "./tenant-theme";

describe("centrale tenantstijl", () => {
  it("gebruikt de opgeslagen FieldFlow-kleuren voor beide modi", () => {
    const base = resolveTenantThemeAuthority(null, "2026-09-05T12:00:00.000Z");
    const authority = resolveTenantThemeAuthority({
      default_theme_id: "fieldflow",
      default_theme_version: "1.0.0",
      theme_color_overrides: {
        fieldflow: {
          ...base.theme,
          light: { ...base.theme.light, canvas: "#123456" }
        }
      },
      theme_mode_policy: { kind: "fixed", mode: "light" },
      timezone_name: "Europe/Amsterdam"
    }, "2026-09-05T12:00:00.000Z");

    expect(authority.theme.light.canvas).toBe("#123456");
    expect(authority.theme.dark).toEqual(base.theme.dark);
    expect(authority.selection.ref).toEqual({
      catalog: "v2",
      id: "fieldflow",
      version: "1.0.0"
    });
  });

  it("valt bij een onveilig kleurcontrast terug op FieldFlow", () => {
    const base = resolveTenantThemeAuthority(null, "2026-09-05T12:00:00.000Z");
    const authority = resolveTenantThemeAuthority({
      default_theme_id: "fieldflow",
      default_theme_version: "1.0.0",
      theme_color_overrides: {
        fieldflow: {
          ...base.theme,
          light: {
            ...base.theme.light,
            surface: "#FFFFFF",
            text: "#FFFFFF"
          }
        }
      },
      theme_mode_policy: { kind: "fixed", mode: "light" }
    }, "2026-09-05T12:00:00.000Z");

    expect(authority.theme).toEqual(base.theme);
  });
});
