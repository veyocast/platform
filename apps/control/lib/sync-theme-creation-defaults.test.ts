import { describe, expect, it } from "vitest";
import { syncContentFamilies, syncSlidePresentationSchema, type SyncThemeCreationDefaults } from "@veyocast/contracts";
import { createSyncStudioStarter } from "@veyocast/studio";
import { applySyncThemeCreationDefaults, syncThemeCreationStarterDefaults } from "./sync-theme-creation-defaults";

describe("Source defaults project into the real frozen presentation", () => {
  it("uses actual Source store colors and independent immutable starter objects", () => {
    const a = syncThemeCreationStarterDefaults("fieldflow"), b = syncThemeCreationStarterDefaults("onzetrots-tv");
    expect(a).toEqual({ accent: "#006D83", font: "Manrope", mode: "light", scale: 100, background: "clubkleur", motion: "rustig", showLogo: true });
    expect(b).toEqual({ ...a, accent: "#1268e8" }); a.accent = "#000000"; expect(syncThemeCreationStarterDefaults("fieldflow").accent).toBe("#006D83");
  });
  it.each(syncContentFamilies.flatMap(({ id }) => (["fieldflow", "onzetrots-tv"] as const).flatMap(theme => (["landscape", "portrait"] as const).map(orientation => ({ family: id, theme, orientation })))))("keeps real content identity for $family/$theme/$orientation", ({ family, theme, orientation }) => {
    const seed = createSyncStudioStarter({ family, tenantName: "Mijn echte vereniging", orientation }).syncPresentation!;
    seed.title = "Eigen titel"; seed.body = "Werkelijke eigen toelichting"; seed.footer = "Eigen clubtekst";
    const before = JSON.stringify(seed), defaults = syncThemeCreationStarterDefaults(theme), result = applySyncThemeCreationDefaults(seed, theme, defaults);
    expect(syncSlidePresentationSchema.safeParse(result).success).toBe(true);
    expect({ ...result, theme: seed.theme, style: seed.style }).toEqual(seed);
    expect(result.style).toMatchObject({ accent: defaults.accent, font: "Manrope", fontChanged: true, background: "light", motion: "rustig", showLogo: true, scale: 100 });
    expect(JSON.stringify(seed)).toBe(before); expect(result.rows).toEqual([]); expect(result.news).toEqual([]);
  });
  it.each(["light", "dark", "auto"] as const)("uses exact withTheme precedence for %s, preserving verified club identity", mode => {
    const seed = createSyncStudioStarter({ family: "welcome", tenantName: "Eigen club" }).syncPresentation!;
    seed.club.logo = { kind: "tenant", mediaAssetId: "23500000-0000-4000-8000-000000000003", checksumSha256: "b".repeat(64) };
    seed.style.background = "photo"; seed.style.backgroundAsset = { ...seed.club.logo };
    seed.style.alignment = "right"; seed.style.safeMargin = 9; seed.style.showFooter = false;
    const defaults: SyncThemeCreationDefaults = { ...syncThemeCreationStarterDefaults("onzetrots-tv"), mode, font: "Georgia", scale: 119, background: "stadium", motion: "dynamisch", showLogo: false };
    const result = applySyncThemeCreationDefaults(seed, "onzetrots-tv", defaults);
    expect(result.style).toMatchObject({ font: "Serif", fontChanged: true, scale: 119, background: mode === "light" ? "light" : "stadium", alignment: "right", safeMargin: 9, showFooter: false, showLogo: false, motion: "dynamisch" });
    expect(result.style).not.toHaveProperty("backgroundAsset"); expect(result.club.logo).toEqual(seed.club.logo); expect(seed.style.backgroundAsset).toBeDefined();
  });
  it.each(["clubkleur", "gradient", "stadium"] as const)("resolves dark/auto %s once, without runtime policies or URLs", background => {
    const seed = createSyncStudioStarter({ family: "free", tenantName: "Eigen club" }).syncPresentation!;
    const result = applySyncThemeCreationDefaults(seed, "fieldflow", { ...syncThemeCreationStarterDefaults("fieldflow"), mode: "auto", background });
    expect(result.style.background).toBe(background === "clubkleur" ? "gradient" : background);
    expect(result).not.toHaveProperty("modePolicy"); expect(JSON.stringify(result)).not.toContain("http");
  });
});
