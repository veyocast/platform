import { describe, expect, it } from "vitest";

import {
  createDynamicTemplateView,
  dynamicTemplateMinimumPlaybackMs,
  dynamicTemplatePageDurationMs,
  dynamicTemplateShouldSkip,
  resolveWelcomeMotionPreset
} from "./dynamic-template-view";

const base = {
  orientation: "landscape",
  schemaVersion: 1,
  snapshotHash: "a".repeat(64),
  snapshotId: "11111111-1111-4111-8111-111111111111",
  templateVersionId: "22222222-2222-4222-8222-222222222222"
} as const;

describe("trusted dynamic template view", () => {
  it("rendert MenuDocument.v2 via dezelfde MenuScene voor Player en Control", () => {
    const view = createDynamicTemplateView({
      ...base,
      data: {
        menuDocument: {
          assets: [],
          createdAt: "2026-08-21T12:00:00.000Z",
          id: "menu-1",
          pages: [{
            blocks: [{
              id: "category-1",
              layout: {
                landscape: { h: 704, rotation: 0, w: 846, x: 96, y: 248 },
                portrait: { h: 1388, rotation: 0, w: 450, x: 72, y: 348 }
              },
              order: 0,
              productNodes: [{
                id: "placement-1",
                kind: "product",
                order: 0,
                productRef: { productId: "product-1", source: "manual" },
                snapshotFallback: {
                  available: true,
                  name: "Espresso",
                  price: { amountMinor: 250, currency: "EUR", taxMode: "inclusive" }
                }
              }],
              source: { source: "manual", sourceCategoryId: "dranken", sourceName: "Dranken" },
              type: "category"
            }],
            id: "page-1",
            order: 0
          }],
          publication: {
            assetManifestVersion: "1.0.0",
            contentFitVersion: "dom-measured-2.0.0",
            documentRevision: 2,
            publishedAt: "2026-08-21T12:00:00.000Z",
            rendererVersion: "2.0.0",
            themeManifestVersion: "1.0.0"
          },
          revision: 2,
          schemaVersion: "menu-document.v2",
          tenantId: "tenant-1",
          theme: {
            brand: { accent: "#FF5C20" },
            mode: "light",
            themeId: "editorial",
            themeVersion: "1.0.0"
          },
          title: "Lunch",
          updatedAt: "2026-08-21T12:00:00.000Z"
        },
        type: "price_list"
      },
      slideType: "price_list",
      templateSlug: "editorial-arena-prijslijst-light-landscape"
    });

    expect(view).toMatchObject({
      sourceLabel: "Menu Studio",
      themeId: "editorial",
      title: "Lunch"
    });
    expect(view?.pages[0]).toMatchObject({
      kind: "menu-v2",
      page: {
        columns: {
          left: [
            { kind: "category", label: "Dranken" },
            { kind: "product", product: { snapshotFallback: { name: "Espresso" } } }
          ]
        }
      }
    });
  });

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
    expect(view?.pages).toHaveLength(2);
    expect(view?.pages[0]).toMatchObject({ kind: "menu" });
    expect(dynamicTemplatePageDurationMs(30, 2)).toBe(15_000);
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
    })).toBe(10_000);
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

  it("toont maximaal twintig standregels per portraitpagina", () => {
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

    expect(view?.pages).toHaveLength(1);
    expect(view?.pages[0]).toMatchObject({
      items: expect.arrayContaining([
        expect.objectContaining({ teamName: "Vereniging 19" })
      ]),
      kind: "standing"
    });
  });

  it("houdt elf standregels op één landscape-pagina voor tweekolomsweergave", () => {
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

    expect(view?.pages).toHaveLength(1);
    expect(view?.pages[0]).toMatchObject({
      items: expect.arrayContaining([
        expect.objectContaining({ teamName: "Vereniging 10" }),
        expect.objectContaining({ teamName: "Vereniging 11" })
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

  it("pagineert aankomsten deterministisch en respecteert lege-skip", () => {
    const payload = {
      ...base,
      data: { sport: {
        arrivalConfig: { cardCount: 2, emptyBehavior: "skip" },
        items: Array.from({ length: 5 }, (_, index) => ({
          id: `arrival-${index}`, primary: `Team ${index}`, secondary: "Aanvang 14:30", meta: "Kleedkamer 4"
        })),
        pageDurationSeconds: 9,
        title: "Welkom"
      }, type: "sport_visitor_arrivals" },
      slideType: "sport_visitor_arrivals",
      templateSlug: "editorial-arena-bezoekers-aankomst-light-landscape"
    } as const;
    const view = createDynamicTemplateView(payload);
    expect(view?.pages).toHaveLength(3);
    expect(view?.pageDurationMs).toBe(9_000);
    expect(view?.arrivalMotionPreset).toBe("auto");
    expect(Array.from({ length: 5 }, (_, index) =>
      resolveWelcomeMotionPreset("auto", 0, index, 5))).toEqual([
      "aurora-rise",
      "spotlight-bloom",
      "kinetic-split",
      "prism-swipe",
      "grand-flip"
    ]);
    expect(resolveWelcomeMotionPreset("grand-flip", 8, 3, 4))
      .toBe("grand-flip");
    expect(dynamicTemplateShouldSkip(payload)).toBe(false);
    expect(dynamicTemplateShouldSkip({
      ...payload,
      data: { ...payload.data, sport: { ...payload.data.sport, items: [] } }
    })).toBe(true);
  });

  it("filtert en pagineert verjaardagen opnieuw op lokale Player-datum", () => {
    const payload = {
      ...base,
      data: { sport: {
        birthdays: [
          { age: 14, day: 31, displayName: "Sophie met een uitzonderlijk lange Nederlandse achternaam", id: "birthday-1", month: 12, role: "Speler", teamIds: ["team-1"], teams: [{ externalId: "team-1", name: "JO15-1" }] },
          { age: null, day: 1, displayName: "Milan van Dijk", id: "birthday-2", month: 1, role: null, teams: [] },
          { age: 40, day: 8, displayName: "Verlopen Persoon", id: "birthday-3", month: 1, role: "Trainer", teams: [] }
        ],
        configuration: {
          emptyBehavior: "skip", period: { days: 7, mode: "next_7_days" }, schemaVersion: 1,
          presentation: { backgroundColor: "#111827", backgroundMediaAssetId: null, cardStyle: "glass", confetti: true, gradientOverlay: true, layout: "auto", logoPosition: "top_left", maxPerLandscapePage: 1, maxPerPortraitPage: 1, motion: true, pageDurationSeconds: 8, radius: "lg", textAlign: "left", themeMode: "dark", useTenantTheme: true },
          selection: { emphasizeToday: true, includeUnknownRoles: true, nameMode: "full", roleFilter: "all", selectedRoles: [], selectedTeamIds: [], showAge: true, showDate: true, showDayOfWeek: true, showPhoto: true, showRole: true, showTeam: true },
          title: "Verjaardagen"
        }, fetchedAt: "2026-12-30T20:00:00.000Z", timezone: "Europe/Amsterdam", title: "Verjaardagen"
      }, type: "sport_birthdays" },
      slideType: "sport_birthdays",
      templateSlug: "editorial-arena-sport-birthdays-dark-landscape"
    } as const;
    const view = createDynamicTemplateView(payload, new Date("2026-12-31T23:30:00.000Z"));
    expect(view?.pages).toHaveLength(1);
    expect(view?.pages[0]).toMatchObject({
      items: [{ age: null, displayName: "Milan van Dijk", isToday: true }],
      kind: "birthday", layout: "spotlight"
    });
    expect(view?.pageDurationMs).toBe(8_000);
  });

  it("slaat lege en verlopen verjaardagssnapshots zonder zwart frame over", () => {
    const payload = {
      ...base,
      data: { sport: {
        birthdays: [],
        configuration: {
          emptyBehavior: "skip", period: { days: 1, mode: "today" }, schemaVersion: 1,
          presentation: { backgroundColor: "#111827", backgroundMediaAssetId: null, cardStyle: "glass", confetti: false, gradientOverlay: true, layout: "auto", logoPosition: "top_left", maxPerLandscapePage: 4, maxPerPortraitPage: 3, motion: false, pageDurationSeconds: 8, radius: "lg", textAlign: "left", themeMode: "dark", useTenantTheme: true },
          selection: { emphasizeToday: true, includeUnknownRoles: true, nameMode: "first", roleFilter: "all", selectedRoles: [], selectedTeamIds: [], showAge: false, showDate: true, showDayOfWeek: true, showPhoto: false, showRole: false, showTeam: false },
          title: "Verjaardagen"
        }, fetchedAt: new Date().toISOString(), timezone: "Europe/Amsterdam"
      }, type: "sport_birthdays" },
      slideType: "sport_birthdays", templateSlug: "editorial-arena-sport-birthdays-dark-landscape"
    } as const;
    expect(createDynamicTemplateView(payload)?.pages).toEqual([]);
    expect(dynamicTemplateShouldSkip(payload)).toBe(true);
  });

  it("kiest Spotlight, Celebration Grid en Birthday Roll en toont iedere pagina", () => {
    for (const [count, pages, layout] of [
      [1, 1, "spotlight"], [2, 1, "celebration_grid"],
      [4, 1, "celebration_grid"], [5, 1, "birthday_roll"],
      [8, 1, "birthday_roll"], [9, 2, "birthday_roll"]
    ] as const) {
      const view = createDynamicTemplateView(birthdayFixture(count), new Date("2026-06-15T10:00:00.000Z"));
      expect(view?.pages, `${count} personen`).toHaveLength(pages);
      expect(view?.pages[0], `${count} personen`).toMatchObject({ kind: "birthday", layout });
      expect(view?.pages.flatMap((page) => page.kind === "birthday" ? page.items : []), `${count} personen`).toHaveLength(count);
    }
    const portrait = createDynamicTemplateView({
      ...birthdayFixture(8), orientation: "portrait",
      templateSlug: "editorial-arena-sport-birthdays-dark-portrait"
    }, new Date("2026-06-15T10:00:00.000Z"));
    expect(portrait?.pages).toHaveLength(3);
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

function birthdayFixture(count: number) {
  return {
    ...base,
    data: { sport: {
      birthdays: Array.from({ length: count }, (_, index) => ({
        age: index % 2 ? null : 12 + index, day: 15,
        displayName: index === 0 ? "Een uitzonderlijk lange Nederlandse productiewaardige naam" : `Persoon ${index + 1}`,
        id: `birthday-${index}`, month: 6, role: index % 2 ? null : "Speler",
        teamIds: [], teams: []
      })),
      configuration: {
        emptyBehavior: "skip", period: { days: 7, mode: "next_7_days" }, schemaVersion: 1,
        presentation: { backgroundColor: "#111827", backgroundMediaAssetId: null, cardStyle: "glass", confetti: true, gradientOverlay: true, layout: "auto", logoPosition: "top_left", maxPerLandscapePage: 8, maxPerPortraitPage: 3, motion: true, pageDurationSeconds: 8, radius: "lg", textAlign: "left", themeMode: "dark", useTenantTheme: true },
        selection: { emphasizeToday: true, includeUnknownRoles: true, nameMode: "full", roleFilter: "all", selectedRoles: [], selectedTeamIds: [], showAge: true, showDate: true, showDayOfWeek: true, showPhoto: true, showRole: true, showTeam: true },
        title: "Verjaardagen"
      }, fetchedAt: "2026-06-15T09:00:00.000Z", timezone: "Europe/Amsterdam"
    }, type: "sport_birthdays" },
    slideType: "sport_birthdays",
    templateSlug: "editorial-arena-sport-birthdays-dark-landscape"
  } as const;
}
