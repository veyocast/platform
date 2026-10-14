import { createHash } from "node:crypto";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { sitesCurrentPresentationSourceRevision, sitesCurrentPresentationVersion, sitesDynamicConfigurationSchema, sitesLegacyPresentationSourceRevision, sitesLegacyPresentationVersion, sitesPresentationSchema } from "@veyocast/contracts";
import { SitesStaticView } from "../src/sites-static-view";
import { sitesStudioV17Css, sitesV17Css } from "../src/sites-v17-styles";

describe("Sites v17 frozen source identity", () => {
  it("accepts only the exact legacy and current renderer/source pairs", () => {
    const base = { schemaVersion: 1 as const, themeId: "onzetrots-tv" as const, orientation: "landscape" as const, provider: "sportlink" as const, title: "Stand" };
    expect(sitesDynamicConfigurationSchema.parse({ ...base, rendererVersion: sitesLegacyPresentationVersion, sourceRevision: sitesLegacyPresentationSourceRevision }).rendererVersion).toBe("sites-v11");
    expect(sitesDynamicConfigurationSchema.parse({ ...base, rendererVersion: sitesCurrentPresentationVersion, sourceRevision: sitesCurrentPresentationSourceRevision, unifiedKind: "competitie" }).rendererVersion).toBe("sites-v17");
    expect(() => sitesDynamicConfigurationSchema.parse({ ...base, rendererVersion: sitesCurrentPresentationVersion, sourceRevision: sitesLegacyPresentationSourceRevision, unifiedKind: "competitie" })).toThrow();
    expect(() => sitesDynamicConfigurationSchema.parse({ ...base, rendererVersion: sitesCurrentPresentationVersion, sourceRevision: sitesCurrentPresentationSourceRevision })).toThrow();
  });

  it("keeps the exact CSS cascade from Source commit 6800bc8", () => {
    expect(sitesV17Css).toHaveLength(82601);
    expect(createHash("sha256").update(sitesV17Css).digest("hex")).toBe("86577e4dbb4b0905eba6905bbc57226863a00d56591aeab7c6f6d60d2307d7f7");
    expect(sitesStudioV17Css).toHaveLength(17620);
    expect(createHash("sha256").update(sitesStudioV17Css).digest("hex")).toBe("209df95ad22ffe3fdd896bd0eb9ecead3009dd36bf1861ed912b73b4a7239563");
  });

  it("renders a scanable inline QR without an external link in trusted markup", () => {
    const presentation = sitesPresentationSchema.parse({
      kind: "dynamic", configuration: { schemaVersion: 1, rendererVersion: sitesCurrentPresentationVersion, sourceRevision: sitesCurrentPresentationSourceRevision, themeId: "onzetrots-tv", orientation: "landscape", provider: "sportlink", unifiedKind: "rss", title: "Clubnieuws", rssLayout: "fullscreen", qrUrl: "https://veyocast.nl/nieuws" },
      content: { kind: "clubnieuws", title: "Clubnieuws", clubName: "Vereniging", rows: [{ id: "news-1", primary: "Nieuwsbericht", secondary: "Lees het volledige bericht.", tag: "Clubnieuws", value: "14 oktober" }] }
    });
    const markup = renderToStaticMarkup(<SitesStaticView presentation={presentation}/>);
    expect(markup).toContain('aria-label="Voorbeeld Clubnieuws, 16:9"');
    expect(markup).toContain('aria-label="QR-code"');
    expect(markup).toContain("14 oktober");
    expect(markup).not.toContain('href="https://veyocast.nl/nieuws"');
    expect(markup).not.toContain("<main");
  });
});
