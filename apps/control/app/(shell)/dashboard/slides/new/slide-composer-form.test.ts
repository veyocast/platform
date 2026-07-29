import { describe, expect, it } from "vitest";

import {
  sourceHasContent,
  sourceMatchesSlideType,
  type SlideSourceOption
} from "./slide-composer-form";

const source: SlideSourceOption = {
  id: "source-id",
  itemCount: 0,
  kind: "rss",
  lastErrorCode: null,
  lastSuccessfulSyncAt: null,
  name: "Clubnieuws",
  providerStatus: "ready"
};

describe("dynamische slide-opties", () => {
  it("combineert elk slidetype uitsluitend met de juiste bronsoort", () => {
    expect(sourceMatchesSlideType("rss", "news")).toBe(true);
    expect(sourceMatchesSlideType("rss", "menu")).toBe(false);
    expect(sourceMatchesSlideType("manual_products", "menu")).toBe(true);
    expect(sourceMatchesSlideType("sportlink", "sport_program")).toBe(true);
    expect(sourceMatchesSlideType("rss", "sport_program")).toBe(false);
  });

  it("blokkeert een RSS-bron zonder renderbare artikelen", () => {
    expect(sourceHasContent(source)).toBe(false);
  });

  it("behoudt laatste goede RSS-inhoud na een tijdelijke syncfout", () => {
    expect(sourceHasContent({
      ...source,
      itemCount: 4,
      lastErrorCode: "rss_fetch_unavailable",
      providerStatus: "error"
    })).toBe(true);
  });

  it("gebruikt Sportlink pas na de eerste geslaagde synchronisatie", () => {
    expect(sourceHasContent({ ...source, kind: "sportlink" })).toBe(false);
    expect(sourceHasContent({
      ...source,
      kind: "sportlink",
      lastSuccessfulSyncAt: "2026-07-29T18:00:00.000Z"
    })).toBe(true);
  });
});
