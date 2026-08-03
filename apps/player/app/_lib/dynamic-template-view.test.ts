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
        }
      },
      data: {
        news: {
          articles: [
            {
              author: "Sportredactie",
              externalId: "1",
              heroMediaAssetId: heroId,
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
        heroUrl: "blob:https://player.veyocast.test/hero"
      },
      kind: "news"
    });
    expect(dynamicTemplateMinimumPlaybackMs(payload)).toBe(14_000);
    expect(dynamicTemplatePageDurationMs(30, 2, view?.pageDurationMs)).toBe(
      7_000
    );
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
    const view = createDynamicTemplateView({
      ...base,
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
