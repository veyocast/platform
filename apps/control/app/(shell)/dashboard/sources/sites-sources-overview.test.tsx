import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SourcesOverview } from "./sites-sources-overview";
import type { SourceOverviewData } from "./sites-sources-model";
vi.stubGlobal("React", React);
const data: SourceOverviewData = { failed: false, sources: [], cards: [{ id: "sportlink", health: { label: "Aandacht nodig", tone: "critical" }, connectionCount: 1, detail: "Laatste datasetpoging mislukt." }] };
describe("Exacte Sources-kaarten sluiten op echte bronroutes en rollen aan", () => {
  it("toont de vier oorspronkelijke providers met echte bronstatus en alle beschikbare routes", () => {
    const html = renderToStaticMarkup(createElement(SourcesOverview, { data, canManage: true, canDesign: true, canReadProducts: true }));
    expect((html.match(/<article\b/gu) ?? [])).toHaveLength(4); expect(html).toContain("Aandacht nodig"); expect(html).toContain("1 opgeslagen koppeling");
    for (const path of ["/dashboard/sources/sportlink", "/dashboard/studio/sportlink", "/dashboard/sources/led-scores", "/dashboard/studio/led-scores", "/dashboard/integrations/twelve-products", "/dashboard/slides/menu-studio/new", "/dashboard/sources/youtube"]) expect(html).toContain(path);
    expect(html).not.toContain("Demogegevens"); expect(html).not.toContain("Duindorp SV"); expect(html).not.toContain("Demo beschikbaar");
  });
  it("biedt zonder schrijfrol alleen lezen en maakt statusproblemen herstelbaar", () => {
    const html = renderToStaticMarkup(createElement(SourcesOverview, { data: { ...data, failed: true }, canManage: false, canDesign: false, canReadProducts: false }));
    expect(html).toContain("Koppeling bekijken"); expect(html).not.toContain("Open Sportlink Studio"); expect(html).not.toContain('href="/dashboard/integrations/twelve-products"'); expect(html).toContain("Vernieuw de pagina");
  });
});
