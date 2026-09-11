import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { Script } from "node:vm";

import { describe, expect, it } from "vitest";

import { createRoyalCurrentPalette } from "../../../../packages/content-templates/src/royal-current-theme";

import { renderLgLegacyHtml } from "./lg-legacy-page";

function inlineRuntime(html: string) {
  return html.slice(html.indexOf("<script>") + "<script>".length, html.indexOf("</script>"));
}

describe("Royal Current Static LG", () => {
  it("bevat de product-owned premium waiting fallback met tenantbranding en klok", () => {
    const html = renderLgLegacyHtml();

    expect(html).toContain('id="default-waiting"');
    expect(html).toContain("Narrowcasting voor sportverenigingen!");
    expect(html).toContain("showDefaultWaiting(envelope)");
    expect(html).toContain("default-waiting-clock");
    expect(html).toContain("/brand/veyocast-logo-primary.svg");
  });

  it("activeert de nieuwe vormgeving uitsluitend voor frozen appearance v2", () => {
    const html = renderLgLegacyHtml();

    expect(html).toContain("Number(presentation.snapshotVersion) !== 2");
    expect(html).toContain("Number(appearance.schemaVersion) === 2");
    expect(html).toContain('appearance.designRevision, "") === "royal-current-v8"');
    expect(html).toContain('if (royalCurrent) {\n        root.setAttribute("data-design-revision", "royal-current-v8")');
    expect(html).toContain("var pages = templatePages(items, 10);");
    expect(html).toContain('if (!royalCurrent) {\n                arenaQr.appendChild(templateNode("span", "", "Scan voor het artikel"))');
    expect(html).toContain("snapshot._veyocastThemeColorOverrides");
    expect(html).toContain("templateRecord(tenantThemeOverrides[editorialMode])");
    expect(html).toContain("legacyDynamicTemplateHasRenderableContent(item)");
    expect(html).toContain('data-empty-slot", "true"');
  });

  it("porteert het gedeelde palet exact zonder moderne CSS-kleurfuncties", () => {
    const html = renderLgLegacyHtml();
    const runtime = inlineRuntime(html);
    const start = runtime.indexOf("function legacyRoyalNormalizeHex");
    const end = runtime.indexOf("function templateLegacyMatchCancelled");
    const context: Record<string, unknown> = {};
    const paletteSource = runtime.slice(start, end);
    const royalCss = html.slice(
      html.indexOf('.dynamic-template.editorial-arena[data-design-revision="royal-current-v8"]'),
      html.indexOf("@media(max-height:650px)")
    );

    new Script(`
      function templateText(value, fallback) {
        return typeof value === "string" && value.trim() ? value.trim() : fallback;
      }
      function templateRecord(value) {
        return value && typeof value === "object" && !Array.isArray(value) ? value : null;
      }
      ${paletteSource}
      result = [
        legacyCreateRoyalCurrentPalette({ version: 1, primary: "#2459ED", background: "club", secondary: null }, "royal"),
        legacyCreateRoyalCurrentPalette({ version: 1, primary: "#BF263B", background: "neutral", secondary: "#08734D" }, "glass")
      ];
    `).runInNewContext(context);

    expect(context.result).toEqual([
      createRoyalCurrentPalette({ version: 1, primary: "#2459ED", background: "club", secondary: null }, "royal"),
      createRoyalCurrentPalette({ version: 1, primary: "#BF263B", background: "neutral", secondary: "#08734D" }, "glass")
    ]);
    expect(royalCss).not.toContain("color-mix(");
    expect(royalCss).not.toContain(":has(");
    expect(paletteSource).not.toContain("color-mix(");
  });

  it("gebruikt de exacte shell-assen en statische Roboto-gewichten", () => {
    const html = renderLgLegacyHtml();

    expect(html).toContain("grid-template-rows:80px minmax(148px,auto) minmax(0,1fr)");
    expect(html).toContain("padding:32px 64px 76px 150px!important");
    expect(html).toContain("right:64px!important;bottom:22px!important;left:150px!important");
    expect(html).toContain("grid-template-rows:96px minmax(192px,auto) minmax(0,1fr)");
    expect(html).toContain("padding:36px 38px 84px 101px!important");
    expect(html).toContain("right:38px!important;bottom:24px!important;left:101px!important");
    [400, 500, 700, 900].forEach((weight) => {
      expect(html).toContain(`/fonts/royal-current/roboto-${weight}.woff2`);
      expect(html).toContain(`font-weight:${weight};font-display:block`);
    });
  });

  it("spiegelt de vaste moderne wedstrijdhoogtes en paginering zonder v1 te wijzigen", () => {
    const html = renderLgLegacyHtml();

    expect(html).toContain('data-design-revision="royal-current-v8"] .legacy-fixture-list');
    expect(html).toContain("grid-auto-rows:96px");
    expect(html).toContain("height:96px;min-height:96px");
    expect(html).toContain("grid-auto-rows:148px");
    expect(html).toContain("height:148px;min-height:148px");
    expect(html).toContain('Math.ceil(itemCount / 2) + ",96px)"');
    expect(html).toContain(
      "font-family:var(--vc-theme-body-font,\"VeyoCast Royal Current Roboto\")"
    );
    expect(html).toContain(
      "font-family:var(--vc-theme-display-font,\"VeyoCast Royal Current Roboto\")"
    );
    expect(html).toContain(
      "templateThemeFontFamily(royalThemeFontFamilies, royalBodyFontRef, \"vc-roboto-v1\")"
    );
    expect(html).toContain(
      "templateThemeFontFamily(royalThemeFontFamilies, royalDisplayFontRef, \"vc-roboto-v1\")"
    );
    expect(html).toContain(
      "templateThemeFontFamily(themeFontFamilies, bodyFontRef, defaultBodyFontRef)"
    );
    expect(html).toContain(
      "templateThemeFontFamily(themeFontFamilies, displayFontRef, defaultDisplayFontRef)"
    );
    expect(html).toContain(
      "var defaultSportScale = Number(themeAppearance.schemaVersion) === 2 ? 1 : 1.12"
    );
    expect(html).toContain(
      "? 24 * baseScale * sportScale\n        : 24 * baseScale * sportScale / 1.12"
    );
    expect(html).toContain(
      "? 42 * baseScale * sportScale\n        : 42 * baseScale * sportScale / 1.12"
    );
    expect(html).toContain(
      'slideType === "sport_results" ? (orientation === "portrait" ? 5 : 6) * (displayColumns === "two" ? 2 : 1)'
    );
    expect(html).toContain(
      'slideType === "sport_program" ? (orientation === "portrait" ? 7 : 6) * (displayColumns === "two" ? 2 : 1)'
    );
    expect(html).toContain(".legacy-fixture-list,.legacy-result-list{display:grid;grid-auto-rows:115px");
    expect(html).toContain(".portrait .legacy-fixture-list{grid-auto-rows:221px}");
    expect(html).toContain(".portrait .legacy-result-list{grid-auto-rows:314px}");
  });

  it("behoudt vaste bezoekslots, QR-only nieuws, afgelast op tijd en een pinned standrij", () => {
    const html = renderLgLegacyHtml();

    expect(html).toContain('arrivalGrid.setAttribute("data-slots", String(cardsPerPage))');
    expect(html).toContain('while (arrivalGrid.children.length < cardsPerPage)');
    expect(html).toContain('templateText(item.awayLogoMediaAssetId, templateText(item.logoMediaAssetId, ""))');
    expect(html).toContain("legacy-royal-arrival-watermark");
    expect(html).toContain("rgba(var(--matte-rgb),.80) 33.333%");
    expect(html).toContain('"span", "legacy-match-time legacy-cancelled-kickoff", "Afgelast"');
    expect(html).toContain("fixtureHasCancelled && !displayConfiguration.showTime");
    expect(html).toContain("legacy-royal-standing-pinned");
    expect(html).toContain('["#", "Team", "G", "W", "GL", "V", "P", "DV", "DT", "+/−", "Vorm"]');
    expect(html).toContain("renderLegacyRoyalStandingRow(pinnedTeam, payload, \"pinned\")");
    expect(html).toContain("arenaQr.appendChild(arenaQrImage)");
  });

  it("levert de vier gecontroleerde fontbinaries met de gelockte hashes", () => {
    const expected = {
      400: "48c3fa6f86c54f1d9bb519220713d4b0a1f8cd1a589a3c03b9fa82e98ecb13e3",
      500: "24369e1b2461af9dcefecaf9cc93d64cf22a4c5bac32506100b9e21014507bcf",
      700: "b4d07892cde715d50bb69c1982df496385d1dfd8f9d1867c31f19a3c8634cfae",
      900: "edcdf3f60252a5987bedc9c86b5422d972ba509bbbe60d58925310c744a33e28"
    } as const;

    Object.entries(expected).forEach(([weight, hash]) => {
      const bytes = readFileSync(
        new URL(`../../public/fonts/royal-current/roboto-${weight}.woff2`, import.meta.url)
      );
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(hash);
    });
  });

  it("blijft als één oude-webOS-compatibele inline runtime parsen", () => {
    const runtime = inlineRuntime(renderLgLegacyHtml());

    expect(runtime).not.toContain("=>");
    expect(runtime).not.toContain("?.");
    expect(runtime).not.toContain("??");
    expect(() => new Script(runtime)).not.toThrow();
  });
});
