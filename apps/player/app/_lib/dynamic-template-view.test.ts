import { describe, expect, it } from "vitest";

import {
  createDynamicTemplateView,
  dynamicTemplateMinimumPlaybackMs,
  dynamicTemplatePageDurationMs
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
      templateSlug: "editorial-arena-menubord-dark-landscape"
    });

    expect(view?.theme).toBe("dark");
    expect(view?.pages).toHaveLength(3);
    expect(view?.pages[0]).toMatchObject({ kind: "menu" });
    expect(dynamicTemplatePageDurationMs(30, 3)).toBe(10_000);
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
      templateSlug: "editorial-arena-menubord-dark-landscape"
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
      templateSlug: "editorial-arena-nieuws-dark-landscape"
    });

    expect(view?.pages).toHaveLength(2);
    expect(view?.pages[1]).toMatchObject({
      item: { title: "Tweede bericht" },
      kind: "news"
    });
  });

  it("koppelt portrait RSS-media en de ingestelde tijd aan iedere HTML-pagina", () => {
    const heroId = "33333333-3333-4333-8333-333333333333";
    const logoId = "44444444-4444-4444-8444-444444444444";
    const qrId = "55555555-5555-4555-8555-555555555555";
    const payload = {
      ...base,
      assets: {
        [heroId]: {
          bytes: 1024,
          checksumSha256: "c".repeat(64),
          mimeType: "image/webp",
          url: "blob:https://player.veyocast.test/hero"
        },
        [logoId]: {
          bytes: 512,
          checksumSha256: "d".repeat(64),
          mimeType: "image/webp",
          url: "/__veyocast-player-cache/logo"
        },
        [qrId]: {
          bytes: 768,
          checksumSha256: "e".repeat(64),
          mimeType: "image/webp",
          url: "/__veyocast-player-cache/qr"
        }
      },
      data: {
        news: {
          articles: [
            {
              author: "Sportredactie",
              externalId: "1",
              heroMediaAssetId: heroId,
              link: "https://example.test/article?utm_source=rss",
              qrMediaAssetId: qrId,
              title: "Eerste bericht"
            },
            { externalId: "2", title: "Tweede bericht" }
          ],
          providerLogoMediaAssetId: logoId,
          secondsPerSlide: 7,
          sourceName: "AD:voetbal",
          title: "Voetbalnieuws"
        },
        type: "news"
      },
      orientation: "portrait",
      slideType: "news",
      templateSlug: "editorial-arena-nieuws-dark-portrait"
    } as const;
    const view = createDynamicTemplateView(payload);

    expect(view).toMatchObject({
      pageDurationMs: 7_000,
      providerLogoUrl: "/__veyocast-player-cache/logo",
      title: "Voetbalnieuws"
    });
    expect(view?.pages[0]).toMatchObject({
      item: {
        author: "Sportredactie",
        heroUrl: "blob:https://player.veyocast.test/hero",
        qrUrl: "/__veyocast-player-cache/qr"
      },
      kind: "news"
    });
    expect(dynamicTemplateMinimumPlaybackMs(payload)).toBe(14_000);
    expect(dynamicTemplatePageDurationMs(30, 2, view?.pageDurationMs)).toBe(
      7_000
    );
  });

  it("verbergt oudere snapshotregels van hetzelfde nieuwsartikel", () => {
    const view = createDynamicTemplateView({
      ...base,
      data: {
        news: {
          articles: [
            {
              externalId: "latest",
              link: "https://example.test/article?utm_source=rss",
              title: "Laatste update"
            },
            {
              externalId: "older",
              link: "https://example.test/article?fbclid=old",
              title: "Eerdere update"
            }
          ],
          sourceName: "Clubnieuws"
        },
        type: "news"
      },
      slideType: "news",
      templateSlug: "editorial-arena-nieuws-dark-portrait"
    });

    expect(view?.pages).toHaveLength(1);
    expect(view?.pages[0]).toMatchObject({
      item: { id: "latest", title: "Laatste update" },
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
      templateSlug: "editorial-arena-volgende-wedstrijd-light-landscape"
    });

    expect(view?.pages[0]).toMatchObject({
      awayTeam: "Bezoekers",
      homeTeam: "VeyoCast 1",
      kind: "match"
    });
  });

  it("bouwt de clubeditie-stand uit gestructureerde HTML/CSS-rijen", () => {
    const teamLogoId = "99999999-9999-4999-8999-999999999999";
    const view = createDynamicTemplateView({
      ...base,
      assets: {
        [teamLogoId]: {
          bytes: 512,
          checksumSha256: "f".repeat(64),
          mimeType: "image/webp",
          url: "/__veyocast-player-cache/team-logo"
        }
      },
      data: {
        brand: { primaryColor: "#123456" },
        sport: {
          competition: { name: "Vierde klasse" },
          items: [{
            drawn: 3,
            form: ["win", "draw", "loss"],
            goalDifference: 18,
            goalsAgainst: 12,
            goalsFor: 30,
            id: "team-1",
            lost: 1,
            logoMediaAssetId: teamLogoId,
            played: 16,
            points: 39,
            position: 1,
            selected: true,
            teamName: "VeyoCast 1",
            won: 12
          }],
          pool: { name: "4C" },
          season: "2026/2027",
          title: "Stand"
        },
        type: "sport_standing"
      },
      slideType: "sport_standing",
      templateSlug: "editorial-arena-competitiestand-dark-landscape"
    });

    expect(view).toMatchObject({
      accentColor: "#123456",
      clubLogoUrl: "/__veyocast-player-cache/team-logo",
      standingContext: {
        competition: "Vierde klasse",
        pool: "4C",
        season: "2026/2027"
      },
      templateStyle: "standing-club-edition"
    });
    expect(view?.pages[0]).toMatchObject({
      items: [{
        form: ["win", "draw", "loss"],
        logoUrl: "/__veyocast-player-cache/team-logo",
        points: 39,
        selected: true,
        teamName: "VeyoCast 1"
      }],
      kind: "standing"
    });
  });

  it("toont maximaal achttien standregels per portraitpagina", () => {
    const view = createDynamicTemplateView({
      ...base,
      data: {
        brand: { primaryColor: "#123456" },
        sport: {
          items: Array.from({ length: 19 }, (_, index) => ({
            drawn: 0,
            form: ["win", "draw", "loss"],
            goalDifference: 18 - index,
            goalsAgainst: 12,
            goalsFor: 30,
            id: `team-${index + 1}`,
            lost: 1,
            played: 16,
            points: 39 - index,
            position: index + 1,
            selected: false,
            teamName: `Vereniging ${index + 1}`,
            won: 12
          })),
          title: "Stand"
        },
        type: "sport_standing"
      },
      orientation: "portrait",
      slideType: "sport_standing",
      templateSlug: "editorial-arena-competitiestand-dark-portrait"
    });

    expect(view?.pages).toHaveLength(2);
    expect(view?.pages[0]).toMatchObject({
      items: expect.arrayContaining([
        expect.objectContaining({ teamName: "Vereniging 18" })
      ]),
      kind: "standing"
    });
    expect(view?.pages[1]).toMatchObject({
      items: [expect.objectContaining({ teamName: "Vereniging 19" })],
      kind: "standing"
    });
  });

  it("toont tien standregels per landscapepagina", () => {
    const view = createDynamicTemplateView({
      ...base,
      data: {
        sport: {
          items: Array.from({ length: 11 }, (_, index) => ({
            id: `team-${index + 1}`,
            position: index + 1,
            teamName: `Vereniging ${index + 1}`
          }))
        },
        type: "sport_standing"
      },
      slideType: "sport_standing",
      templateSlug: "editorial-arena-competitiestand-dark-landscape"
    });

    expect(view?.pages).toHaveLength(2);
    expect(view?.pages[0]).toMatchObject({
      items: expect.arrayContaining([
        expect.objectContaining({ teamName: "Vereniging 10" })
      ]),
      kind: "standing"
    });
  });

  it("bouwt een prijslijst met vaste fotovakken en negen landscaperijen", () => {
    const photoId = "77777777-7777-4777-8777-777777777777";
    const view = createDynamicTemplateView({
      ...base,
      assets: {
        [photoId]: {
          bytes: 512,
          checksumSha256: "7".repeat(64),
          mimeType: "image/webp",
          url: "/__veyocast-player-cache/product"
        }
      },
      data: {
        brand: { primaryColor: "#315CFF" },
        priceList: {
          sections: [{
            column: "left",
            id: "dranken",
            name: "Dranken",
            order: 0,
            products: Array.from({ length: 10 }, (_, index) => ({
              description: "Koel geserveerd",
              formattedPrice: `€ ${index + 1},50`,
              id: `product-${index + 1}`,
              imageMediaAssetId: index === 0 ? photoId : null,
              name: `Product ${index + 1}`,
              photoVisible: index < 2
            }))
          }],
          title: "Kantineprijzen"
        },
        type: "price_list"
      },
      slideType: "price_list",
      templateSlug: "editorial-arena-prijslijst-dark-landscape"
    });

    expect(view).toMatchObject({
      accentColor: "#315CFF",
      pages: [
        { kind: "price-list" },
        { kind: "price-list" }
      ],
      title: "Kantineprijzen"
    });
    const firstPage = view?.pages[0];
    expect(firstPage?.kind).toBe("price-list");
    if (firstPage?.kind !== "price-list") return;
    expect(firstPage.page.columns.left).toHaveLength(9);
    expect(firstPage.page.columns.left[1]).toMatchObject({
      item: { image: { kind: "image", url: "/__veyocast-player-cache/product" } },
      kind: "product"
    });
    expect(firstPage.page.columns.left[2]).toMatchObject({
      item: { image: { kind: "empty" }, photoVisible: true },
      kind: "product"
    });
    const secondPage = view?.pages[1];
    expect(secondPage?.kind).toBe("price-list");
    if (secondPage?.kind !== "price-list") return;
    expect(secondPage.page.columns.left[0]).toMatchObject({
      continuation: true,
      kind: "category"
    });
  });

  it("houdt verborgen prijslijstfoto's ook zonder asset als leeg vak", () => {
    const view = createDynamicTemplateView({
      ...base,
      data: {
        priceList: {
          sections: [{
            column: "right",
            id: "snacks",
            name: "Snacks",
            order: 0,
            products: [{
              formattedPrice: "€ 3,00",
              id: "snack-1",
              imageMediaAssetId: "77777777-7777-4777-8777-777777777777",
              name: "Tosti",
              photoVisible: false
            }]
          }],
          title: "Prijslijst"
        },
        type: "price_list"
      },
      orientation: "portrait",
      slideType: "price_list",
      templateSlug: "editorial-arena-prijslijst-light-portrait"
    });

    expect(view?.theme).toBe("light");
    expect(view?.pages[0]).toMatchObject({
      kind: "price-list",
      page: {
        columns: {
          right: [
            { kind: "category" },
            { item: { image: { kind: "empty" }, photoVisible: false }, kind: "product" }
          ]
        }
      }
    });
  });

  it("weigert payloads met een niet-vertrouwd contract", () => {
    expect(createDynamicTemplateView({
      ...base,
      data: {},
      injectedScript: "alert(1)",
      slideType: "news",
      templateSlug: "editorial-arena-nieuws-dark-landscape"
    })).toBeNull();
  });

  it("activeert geen type zonder complete databron", () => {
    expect(createDynamicTemplateView({
      ...base,
      data: {
        sport: {
          items: [{ id: "person-1", primary: "Voorbeeldspeler" }]
        },
        type: "sport_team"
      },
      slideType: "sport_team",
      templateSlug: "editorial-arena-teamvoorstelling-dark-landscape"
    })).toBeNull();
  });
});
