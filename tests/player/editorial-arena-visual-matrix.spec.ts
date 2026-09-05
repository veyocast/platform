import { expect, test } from "@playwright/test";

import {
  freezeThemePresentation,
  themeCatalog,
  themeToEditorialTokens
} from "@veyocast/content-templates/theme-catalog";
import type {
  EditorialNewsVariant,
  EditorialThemeConfig,
  PlayerDynamicTemplatePayload
} from "@veyocast/contracts";
import { playerDynamicTemplatePayloadSchema } from "@veyocast/contracts";

const playerURL = `http://127.0.0.1:${process.env.PLAYER_PORT ?? 3106}`;
const snapshotId = "10000000-0000-4000-8000-000000000001";
const imageId = "10000000-0000-4000-8000-000000000002";
const fixtureVariants = [
  "price-with-photo",
  "price-without-photo",
  "news-hero",
  "news-fullscreen",
  "news-grid",
  "news-text-only",
  "standing-10",
  "standing-20",
  "program-5",
  "program-20",
  "results-5",
  "results-20",
  "team-roster",
  "sponsor-spotlight",
  "training-schedule",
  "volunteer-call"
] as const;

test("volledige FieldFlow-outputmatrix van 64 cellen", async ({ page }) => {
  test.setTimeout(180_000);
  await page.emulateMedia({ reducedMotion: "reduce" });

  for (const variant of fixtureVariants) {
    for (const orientation of ["landscape", "portrait"] as const) {
      for (const themeMode of ["light", "dark"] as const) {
        await test.step(`${variant} · ${orientation} · ${themeMode}`, async () => {
          const viewport = orientation === "landscape"
            ? { height: 1080, width: 1920 }
            : { height: 1920, width: 1080 };
          await page.setViewportSize(viewport);
          const payload = buildPayload(variant, orientation, themeMode);
          const parsedPayload = playerDynamicTemplatePayloadSchema.safeParse(payload);
          if (!parsedPayload.success) throw new Error(parsedPayload.error.message);
          await page.goto("about:blank");
          await page.goto(`${playerURL}/thumbnail#payload=${encodePayload(payload)}`);
          await page.waitForFunction(
            () => document.documentElement.dataset.thumbnailReady === "true"
          );

          const slide = page.locator("[data-slide-type]");
          await expect(slide).toBeVisible();
          await expect(slide).toHaveAttribute("data-orientation", orientation);
          await expect(slide).toHaveAttribute("data-theme", themeMode);
          await expect(slide).toHaveAttribute("data-theme-id", "fieldflow");
          const geometry = await slide.evaluate((element) => {
            const content = element.querySelector("main");
            const footer = element.querySelector("footer");
            const contentBox = content?.getBoundingClientRect();
            const footerBox = footer?.getBoundingClientRect();
            return {
              allImagesComplete: Array.from(element.querySelectorAll("img"))
                .every((image) => image.complete),
              clientHeight: element.clientHeight,
              clientWidth: element.clientWidth,
              footerClearsContent: !contentBox || !footerBox ||
                contentBox.bottom <= footerBox.top + 1,
              scrollHeight: element.scrollHeight,
              scrollWidth: element.scrollWidth
            };
          });
          expect(geometry.scrollWidth).toBe(geometry.clientWidth);
          expect(geometry.scrollHeight).toBe(geometry.clientHeight);
          expect(geometry.footerClearsContent).toBe(true);
          expect(geometry.allImagesComplete).toBe(true);
          if (variant.startsWith("results-")) {
            const rows = slide.locator("[data-result-row]");
            await expect(rows).toHaveCount(
              Math.min(
                countForVariant(variant),
                orientation === "portrait" ? 5 : 6
              )
            );
            expect(await rows.first().evaluate(
              (element) => Number.parseFloat(getComputedStyle(element).fontSize)
            )).toBe(orientation === "portrait" ? 27 : 30);
            expect(await rows.first().locator(":scope > strong").evaluate(
              (element) => Number.parseFloat(getComputedStyle(element).fontSize)
            )).toBe(46.5);
          }
          if (variant === "news-fullscreen") {
            const composition = await page.locator(
              '[data-news-variant="fullscreen_gradient"]'
            ).evaluate((layout) => {
              const layoutBox = layout.getBoundingClientRect();
              const hero = layout.querySelector<HTMLElement>(":scope > section");
              const story = layout.querySelector<HTMLElement>(":scope > article");
              const intro = story?.querySelector<HTMLElement>(":scope > p");
              const storyBox = story?.getBoundingClientRect();
              return {
                introFontSize: intro
                  ? Number.parseFloat(getComputedStyle(intro).fontSize)
                  : 0,
                overlay: hero
                  ? getComputedStyle(hero, "::after").backgroundImage
                  : "none",
                storyHeightRatio: storyBox ? storyBox.height / layoutBox.height : 0,
                storyTopRatio: storyBox
                  ? (storyBox.top - layoutBox.top) / layoutBox.height
                  : 0,
                storyWidthRatio: storyBox ? storyBox.width / layoutBox.width : 0
              };
            });
            expect(composition.overlay).not.toBe("none");
            if (orientation === "landscape") {
              expect(composition.introFontSize).toBeGreaterThanOrEqual(30);
              expect(composition.storyWidthRatio).toBeGreaterThanOrEqual(0.6);
              expect(composition.storyWidthRatio).toBeLessThanOrEqual(0.64);
              expect(composition.storyTopRatio).toBeLessThan(0.01);
            } else {
              expect(composition.introFontSize).toBeGreaterThanOrEqual(32);
              expect(composition.storyHeightRatio).toBeGreaterThanOrEqual(0.49);
              expect(composition.storyHeightRatio).toBeLessThanOrEqual(0.51);
              expect(composition.storyTopRatio).toBeGreaterThanOrEqual(0.49);
              expect(composition.storyTopRatio).toBeLessThanOrEqual(0.51);
            }
          }
          await expect(page).toHaveScreenshot(
            `${variant}-${orientation}-${themeMode}.png`,
            { animations: "disabled", caret: "hide", maxDiffPixelRatio: 0.002 }
          );
        });
      }
    }
  }
});

function buildPayload(
  variant: typeof fixtureVariants[number],
  orientation: "landscape" | "portrait",
  themeMode: "dark" | "light"
): PlayerDynamicTemplatePayload {
  const selection = {
    accent: null,
    categoryOverrides: [],
    modePolicy: { kind: "fixed" as const, mode: themeMode },
    ref: {
      catalog: "v2" as const,
      id: "fieldflow" as const,
      version: themeCatalog.fieldflow.version
    },
    support: null
  };
  const themePresentation = freezeThemePresentation({
    instant: "2026-09-02T12:00:00.000Z",
    selection,
    timezone: "Europe/Amsterdam"
  });
  const theme: EditorialThemeConfig = {
    dark: themeToEditorialTokens(freezeThemePresentation({
      instant: "2026-09-02T12:00:00.000Z",
      selection: { ...selection, modePolicy: { kind: "fixed", mode: "dark" } },
      timezone: "Europe/Amsterdam"
    })),
    light: themeToEditorialTokens(freezeThemePresentation({
      instant: "2026-09-02T12:00:00.000Z",
      selection: { ...selection, modePolicy: { kind: "fixed", mode: "light" } },
      timezone: "Europe/Amsterdam"
    })),
    mode: themeMode
  };
  const data = variant.startsWith("price-")
    ? priceData(variant === "price-with-photo", theme)
    : variant.startsWith("news-")
      ? newsData(newsVariant(variant), theme)
      : sportData(variant, theme);
  const slideType = variant.startsWith("price-")
    ? "menu"
    : variant.startsWith("news-")
      ? "news"
      : variant.startsWith("standing-")
        ? "sport_standing"
        : variant.startsWith("program-")
          ? "sport_program"
          : variant === "team-roster"
            ? "sport_team"
            : variant === "sponsor-spotlight"
              ? "sport_sponsor"
              : variant === "training-schedule"
                ? "sport_trainings"
                : variant === "volunteer-call"
                  ? "sport_volunteers"
                  : "sport_results";
  return {
    assets: {
      [imageId]: {
        bytes: 481,
        checksumSha256: "a".repeat(64),
        mimeType: "image/png",
        url: `${playerURL}/editorial-arena-fixture.svg`
      }
    },
    data: {
      ...data,
      themePresentation
    },
    orientation,
    schemaVersion: 1,
    slideType,
    snapshotHash: "b".repeat(64),
    snapshotId,
    templateSlug: `editorial-arena-${slideType.replaceAll("_", "-")}-${themeMode}-${orientation}`,
    templateVersionId: "10000000-0000-4000-8000-000000000003"
  };
}

function priceData(withPhoto: boolean, theme: EditorialThemeConfig) {
  const products = Array.from({ length: 12 }, (_, index) => ({
    active: true,
    available: true,
    category: index < 6 ? "Warme dranken" : "Broodjes",
    currency: "EUR",
    description: index % 3 ? "Vers bereid met lokale ingrediënten" : null,
    externalId: `product-${index}`,
    id: `20000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    imageMediaAssetId: withPhoto && index % 2 === 0 ? imageId : null,
    name: index === 4
      ? "Tosti met extra lange Nederlandse productnaam"
      : `Clubproduct ${index + 1}`,
    priceMinor: 225 + index * 35,
    sortOrder: index,
    sourceUpdatedAt: "2026-08-13T09:00:00.000Z"
  }));
  const entries = (start: number, end: number) => [
    { category: start === 0 ? "Warme dranken" : "Broodjes", kind: "category" as const },
    ...products.slice(start, end).map((product) => ({
      kind: "product" as const,
      productId: product.id
    }))
  ];
  return {
    brand: { clubName: "Sportvereniging FieldFlow", primaryColor: "#169B62" },
    editorial: {
      newsVariant: "hero_split",
      priceList: {
        categoryPhotoModes: { Broodjes: withPhoto ? "show" : "reserve-empty" },
        columns: { left: entries(0, 6), right: entries(6, 12) },
        productFocalPoints: Object.fromEntries(products.map((product, index) => [
          product.id,
          { x: index % 2 ? 0.35 : 0.65, y: 0.45 }
        ]))
      },
      pricePhotoMode: withPhoto ? "show" : "reserve-empty",
      schemaVersion: 2,
      theme
    },
    menu: { products, title: "Clubkaart" },
    type: "menu"
  };
}

function newsData(variant: EditorialNewsVariant, theme: EditorialThemeConfig) {
  return {
    brand: { clubName: "Sportvereniging FieldFlow", primaryColor: "#169B62" },
    editorial: {
      newsFocalPoint: { x: 0.68, y: 0.36 },
      newsVariant: variant,
      pricePhotoMode: "show",
      schemaVersion: 2,
      theme
    },
    news: {
      articles: Array.from({ length: 4 }, (_, index) => ({
        author: "Redactie",
        externalId: `news-${index}`,
        heroMediaAssetId: variant === "text_only" ? null : imageId,
        intro: "Een compact bericht met alle relevante informatie voor leden en bezoekers van de vereniging.",
        link: `https://example.com/nieuws/${index}`,
        publishedAt: `2026-08-1${3 - index}T09:00:00.000Z`,
        sourceName: "Clubnieuws",
        title: index === 0
          ? "Een lange nieuwstitel die de Editorial Arena-clamp aantoonbaar beproeft"
          : `Nieuwsbericht ${index + 1}`
      })),
      secondsPerSlide: 10,
      sourceName: "Clubnieuws",
      title: "Laatste nieuws"
    },
    type: "news"
  };
}

function sportData(
  variant: typeof fixtureVariants[number],
  theme: EditorialThemeConfig
) {
  const special = [
    "team-roster",
    "sponsor-spotlight",
    "training-schedule",
    "volunteer-call"
  ].includes(variant);
  const count = special
    ? 8
    : variant.endsWith("-5") ? 5 : variant.endsWith("-10") ? 10 : 20;
  const standing = variant.startsWith("standing-");
  const results = variant.startsWith("results-");
  const slideType = variant === "team-roster"
    ? "sport_team"
    : variant === "sponsor-spotlight"
      ? "sport_sponsor"
      : variant === "training-schedule"
        ? "sport_trainings"
        : variant === "volunteer-call"
          ? "sport_volunteers"
          : standing
            ? "sport_standing"
            : results ? "sport_results" : "sport_program";
  const items = Array.from({ length: count }, (_, index) => standing ? ({
    drawn: index % 4,
    form: ["win", index % 2 ? "draw" : "loss", "win"],
    goalDifference: 22 - index,
    goalsAgainst: 10 + index,
    goalsFor: 32,
    id: `team-${index}`,
    lost: index % 3,
    played: 12,
    points: 34 - index,
    position: index + 1,
    selected: index === 6,
    teamName: index === 6 ? "Sportvereniging Editorial Lange Clubnaam" : `Vereniging ${index + 1}`,
    won: 10 - (index % 4),
    zone: index < 2 ? "promotion" : index >= count - 2 ? "relegation" : ""
  }) : special ? ({
    id: `${slideType}-${index}`,
    logoMediaAssetId: variant === "sponsor-spotlight" ? imageId : null,
    photoMediaAssetId: variant === "team-roster" ? imageId : null,
    primary: variant === "team-roster"
      ? `Selectiespeler met lange naam ${index + 1}`
      : variant === "sponsor-spotlight"
        ? `Clubpartner ${index + 1}`
        : variant === "training-schedule"
          ? `Team onder ${11 + index}`
          : `Vrijwilligersrol ${index + 1}`,
    secondary: variant === "training-schedule"
      ? "Dinsdag en donderdag · 19:30"
      : variant === "volunteer-call"
        ? "Gastheer of gastvrouw op wedstrijddagen"
        : "Eerste selectie",
    status: variant === "volunteer-call" ? "Open rol" : "Gepubliceerd",
    meta: variant === "sponsor-spotlight"
      ? "Samen sterk voor de vereniging"
      : "Sportpark FieldFlow"
  }) : ({
    awayScore: results ? index % 3 : null,
    awayTeam: `Uitclub ${index + 1}`,
    date: `za ${16 + index} aug`,
    homeScore: results ? 3 - (index % 3) : null,
    homeTeam: index === 2 ? "Sportvereniging Editorial Lange Clubnaam" : `Thuisclub ${index + 1}`,
    id: `match-${index}`,
    meta: results ? "Definitief" : "Competitie",
    primary: `Thuisclub ${index + 1} – Uitclub ${index + 1}`,
    selected: index === 2,
    secondary: "Vierde klasse · Poule A",
    status: results ? "Gespeeld" : "Gepland",
    time: results ? "FT" : `${14 + (index % 5)}:30`,
    venue: "Sportpark De Arena"
  }));
  return {
    brand: { clubName: "Sportvereniging FieldFlow", primaryColor: "#169B62" },
    editorial: {
      newsVariant: "hero_split",
      pricePhotoMode: "show",
      schemaVersion: 2,
      theme
    },
    sport: {
      competition: { name: "Vierde klasse" },
      items,
      pool: { name: "Poule A" },
      season: "2026/2027",
      title: standing
        ? "Stand"
        : results
          ? "Uitslagen"
          : variant === "team-roster"
            ? "Ons team"
            : variant === "sponsor-spotlight"
              ? "Clubpartners"
              : variant === "training-schedule"
                ? "Trainingen"
                : variant === "volunteer-call"
                  ? "Vrijwilligers"
                  : "Programma"
    },
    type: slideType
  };
}

function newsVariant(variant: typeof fixtureVariants[number]): EditorialNewsVariant {
  if (variant === "news-fullscreen") return "fullscreen_gradient";
  if (variant === "news-grid") return "news_grid";
  if (variant === "news-text-only") return "text_only";
  return "hero_split";
}

function encodePayload(payload: PlayerDynamicTemplatePayload) {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function countForVariant(variant: typeof fixtureVariants[number]) {
  return variant.endsWith("-5") ? 5 : variant.endsWith("-10") ? 10 : 20;
}
