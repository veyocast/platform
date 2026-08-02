import { describe, expect, it } from "vitest";

import {
  createDynamicTemplateView,
  dynamicTemplateMinimumPlaybackMs
} from "./dynamic-template-view";

const base = {
  orientation: "landscape",
  schemaVersion: 1,
  snapshotHash: "a".repeat(64),
  snapshotId: "11111111-1111-4111-8111-111111111111",
  templateVersionId: "22222222-2222-4222-8222-222222222222"
} as const;

describe("trusted dynamic template view", () => {
  it("verdeelt een uitgebreid menu zonder tekst te verkleinen", () => {
    const view = createDynamicTemplateView({
      ...base,
      data: {
        menu: {
          products: Array.from({ length: 17 }, (_, index) => ({
            currency: "EUR",
            id: `product-${index}`,
            name: `Product ${index + 1}`,
            priceMinor: 250 + index
          })),
          title: "Kantinemenu"
        },
        type: "menu"
      },
      slideType: "menu",
      templateSlug: "menu-clubhouse-dark-landscape"
    });

    expect(view?.theme).toBe("dark");
    expect(view?.pages).toHaveLength(3);
    expect(view?.pages[0]).toMatchObject({ kind: "menu" });
    expect(dynamicTemplateMinimumPlaybackMs({
      ...base,
      data: {
        menu: {
          products: Array.from({ length: 17 }, (_, index) => ({
            id: `product-${index}`,
            name: `Product ${index + 1}`
          }))
        },
        type: "menu"
      },
      slideType: "menu",
      templateSlug: "menu-clubhouse-dark-landscape"
    })).toBe(15_000);
  });

  it("maakt ieder nieuwsartikel een afzonderlijke pagina", () => {
    const view = createDynamicTemplateView({
      ...base,
      data: {
        news: {
          articles: [
            { externalId: "1", title: "Eerste bericht" },
            { externalId: "2", title: "Tweede bericht" }
          ],
          sourceName: "Clubnieuws"
        },
        type: "news"
      },
      slideType: "news",
      templateSlug: "news-newsroom-dark-landscape"
    });

    expect(view?.pages).toHaveLength(2);
    expect(view?.pages[1]).toMatchObject({
      item: { title: "Tweede bericht" },
      kind: "news"
    });
  });

  it("bouwt Match Centre alleen uit genormaliseerde tekstvelden", () => {
    const view = createDynamicTemplateView({
      ...base,
      data: {
        sport: {
          items: [{
            id: "match-1",
            meta: "Veld 1",
            primary: "VeyoCast 1 – Bezoekers",
            secondary: "14:30",
            status: "scheduled"
          }],
          title: "Volgende wedstrijd"
        },
        type: "sport_next_match"
      },
      slideType: "sport_next_match",
      templateSlug: "sportlink-next-match-match-centre-light-landscape"
    });

    expect(view?.pages[0]).toMatchObject({
      awayTeam: "Bezoekers",
      homeTeam: "VeyoCast 1",
      kind: "match"
    });
  });

  it("weigert payloads met een niet-vertrouwd contract", () => {
    expect(createDynamicTemplateView({
      ...base,
      data: {},
      injectedScript: "alert(1)",
      slideType: "news",
      templateSlug: "news-newsroom-dark-landscape"
    })).toBeNull();
  });
});
