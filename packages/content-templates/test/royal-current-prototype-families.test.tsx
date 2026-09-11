import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import type { PlayerDynamicTemplatePayload } from "@veyocast/contracts";

import {
  createDynamicTemplateView,
  dynamicTemplateMinimumPlaybackMs,
  royalStandingPlaybackPages,
  royalStandingPlaybackDurationMs,
  royalStandingScrollDistance,
  royalStandingScrollMetrics,
  royalStandingScrollOffset
} from "../src/dynamic-template-view";
import { editorialArenaDefaultTheme } from "../src/editorial-arena-theme";

const renderer = readFileSync(
  fileURLToPath(new URL("../src/editorial-arena-renderer.tsx", import.meta.url)),
  "utf8"
);
const stylesheet = readFileSync(
  fileURLToPath(new URL("../src/editorial-arena-renderer.module.css", import.meta.url)),
  "utf8"
);

const logoId = "33333333-3333-4333-8333-333333333333";
const imageId = "44444444-4444-4444-8444-444444444444";

const themePresentation = {
  appearance: {
    designRevision: "royal-current-v8",
    motionEnabled: false,
    palette: { background: "club", primary: "#2459ED", secondary: null, version: 1 },
    schemaVersion: 2,
    surfaces: { clubLogoBackground: "#FFFFFF", homeLogoBackground: "#FFFFFF" },
    typography: {
      baseScale: 1,
      bodyFontRef: "vc-roboto-v1",
      displayFontRef: "vc-roboto-v1",
      sportScale: 1
    }
  },
  catalogVersion: "1.0.0",
  resolvedMode: {
    mode: "light",
    policy: { kind: "fixed", mode: "light" },
    resolvedAt: "2026-09-09T12:00:00.000Z",
    timezone: "Europe/Amsterdam"
  },
  selection: {
    accent: "#2459ED",
    categoryOverrides: [],
    modePolicy: { kind: "fixed", mode: "light" },
    ref: { catalog: "v2", id: "fieldflow", version: "1.0.0" },
    support: null
  },
  settingsRevision: 1,
  snapshotVersion: 2
} as const;

function payload(
  slideType: PlayerDynamicTemplatePayload["slideType"],
  data: Record<string, unknown>,
  orientation: "landscape" | "portrait" = "landscape",
  royalCurrent = true
): PlayerDynamicTemplatePayload {
  return {
    assets: {
      [imageId]: {
        bytes: 1024,
        checksumSha256: "c".repeat(64),
        mimeType: "image/png",
        url: "blob:https://player.veyocast.nl/content-image"
      },
      [logoId]: {
        bytes: 512,
        checksumSha256: "b".repeat(64),
        mimeType: "image/png",
        url: "blob:https://player.veyocast.nl/team-logo"
      }
    },
    data: {
      brand: {
        clubName: "Testvereniging",
        logoMediaAssetId: logoId,
        primaryColor: "#2459ED"
      },
      ...data,
      ...(royalCurrent ? { themePresentation } : {}),
      type: slideType
    },
    orientation,
    schemaVersion: 1,
    slideType,
    snapshotHash: "a".repeat(64),
    snapshotId: "11111111-1111-4111-8111-111111111111",
    templateSlug: `editorial-arena-${slideType.replaceAll("_", "-")}-${orientation}`,
    templateVersionId: "22222222-2222-4222-8222-222222222222"
  };
}

function fixture(overrides: Record<string, unknown> = {}) {
  return {
    awayLogoMediaAssetId: logoId,
    awayRoom: "B2",
    awayTeam: "Uitvereniging JO17-1",
    date: "12-09-2026",
    dressingRoom: "Wedstrijdsecretariaat",
    field: "2 A",
    homeLogoMediaAssetId: logoId,
    homeMatch: true,
    homeRoom: "A1",
    homeTeam: "Testvereniging JO17-1",
    id: "wedstrijd-1",
    kickoffAt: "2099-09-12T12:30:00.000Z",
    kickoffTime: "14:30",
    officials: [{ displayName: "Robin Fluit", role: "Scheidsrechter" }],
    primary: "Testvereniging JO17-1 – Uitvereniging JO17-1",
    status: "scheduled",
    venueName: "Sportpark De Test",
    ...overrides
  };
}

function standingItems(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    drawn: index % 3,
    form: ["win", "draw", "loss"],
    goalsAgainst: index + 2,
    goalsFor: index + 8,
    id: `stand-${index + 1}`,
    lost: index % 2,
    played: 12,
    points: 30 - index,
    position: index + 1,
    primary: `Vereniging ${index + 1} 1`,
    selected: index === 2,
    teamName: `Vereniging ${index + 1} 1`,
    won: 9 - index % 4
  }));
}

function withThemeMotion(
  dynamicTemplate: PlayerDynamicTemplatePayload,
  motionEnabled: boolean
): PlayerDynamicTemplatePayload {
  return {
    ...dynamicTemplate,
    data: {
      ...dynamicTemplate.data,
      themePresentation: {
        ...themePresentation,
        appearance: {
          ...themePresentation.appearance,
          motionEnabled
        }
      }
    }
  };
}

function renderProjection(dynamicTemplate: PlayerDynamicTemplatePayload) {
  const view = createDynamicTemplateView(dynamicTemplate);
  expect(view).not.toBeNull();
  return JSON.stringify(view);
}

function todayBirthday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Amsterdam"
  }).formatToParts(new Date());
  const number = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return { day: number("day"), month: number("month") };
}

describe("Royal Current prototypefamilies", () => {
  const fixtureFamilies = [
    ["sport_results", "results", { items: [fixture({ awayScore: 1, homeScore: 3 })] }],
    ["sport_program", "program", { items: [fixture()] }],
    ["sport_dressing_rooms", "dressing-rooms", { items: [fixture()] }],
    ["sport_officials", "officials", { items: [fixture()] }],
    ["sport_cancellations", "cancellations", {
      items: [fixture({ status: "cancelled" })]
    }]
  ] as const;

  it.each(fixtureFamilies)("rendert %s als semantische %s-compositie", (slideType, family, sport) => {
    const projection = renderProjection(payload(slideType, { sport }));

    expect(renderer).toContain(`data-render-family="${family}"`);
    expect(projection).toContain("Testvereniging JO17-1");
    expect(projection).toContain("Uitvereniging JO17-1");
  });

  it("rendert stand, nieuws en agenda met echte snapshotdata", () => {
    const standing = renderProjection(payload("sport_standing", {
      sport: {
        items: [{
          drawn: 1,
          form: ["win", "draw"],
          goalsAgainst: 2,
          goalsFor: 8,
          id: "stand-1",
          lost: 0,
          played: 4,
          points: 10,
          position: 1,
          primary: "Testvereniging 1",
          selected: true,
          teamName: "Testvereniging 1",
          won: 3
        }]
      }
    }));
    const news = renderProjection(payload("news", {
      news: {
        articles: [{
          externalId: "nieuws-1",
          heroMediaAssetId: imageId,
          intro: "Nieuws uit de echte payload.",
          link: "https://example.test/nieuws",
          qrMediaAssetId: logoId,
          title: "Clubnieuws zonder fixturetekst"
        }]
      }
    }));
    const activities = renderProjection(payload("sport_activities", {
      sport: { items: [fixture({ photoMediaAssetId: imageId, primary: "Open clubdag" })] }
    }));

    expect(renderer).toContain('data-render-family="standing"');
    expect(standing).toContain("Testvereniging 1");
    expect(renderer).toContain('data-render-family="news"');
    expect(news).toContain("Nieuws uit de echte payload.");
    expect(renderer).toContain('data-render-family="activities"');
    expect(activities).toContain("Open clubdag");
  });

  it("houdt verjaardagsfoto en kaarten per pagina in de bestaande familie", () => {
    const today = todayBirthday();
    const birthdays = renderProjection(payload("sport_birthdays", {
      sport: {
        birthdays: [
          { age: 12, day: today.day, displayName: "Vandaag jarig", id: "birthday-today", isToday: true, month: today.month, role: "Speler", teams: [{ name: "JO15-1" }] },
          { age: 13, day: today.day + 1, displayName: "Tweede naam", id: "birthday-next", month: today.month, role: "Trainer", teams: [] }
        ],
        configuration: {
          emptyBehavior: "skip",
          period: { days: 7, mode: "next_7_days" },
          presentation: { backgroundColor: "#111827", backgroundMediaAssetId: imageId, cardStyle: "glass", confetti: true, gradientOverlay: true, layout: "auto", logoPosition: "top_left", maxPerLandscapePage: 2, maxPerPortraitPage: 2, motion: false, pageDurationSeconds: 8, radius: "lg", textAlign: "center", themeMode: "light", useTenantTheme: true },
          selection: { emphasizeToday: true, includeUnknownRoles: true, nameMode: "full", roleFilter: "all", selectedRoles: [], selectedTeamIds: [], showAge: true, showDate: true, showDayOfWeek: true, showPhoto: false, showRole: true, showTeam: true, showTeamRole: true },
          title: "Verjaardagen"
        },
        fetchedAt: new Date().toISOString(),
        timezone: "Europe/Amsterdam"
      }
    }));

    expect(renderer).toContain("birthdayCardPhoto");
    expect(renderer).toContain("birthdayConfetti");
    expect(renderer).not.toContain("BirthdayPortrait");
    expect(birthdays).toContain('"pageSize":2');
    expect(birthdays).toContain('"layout":"celebration_grid"');
  });

  it("bouwt vier unieke Royal nieuwsartikelen als twee pagina's met elk een tweede bericht", () => {
    const newsData = {
      editorial: {
        newsVariant: "news_grid",
        pricePhotoMode: "show",
        schemaVersion: 2,
        theme: editorialArenaDefaultTheme
      },
      news: {
        articles: Array.from({ length: 4 }, (_, index) => ({
          externalId: `nieuws-${index + 1}`,
          heroMediaAssetId: imageId,
          intro: `Echte intro ${index + 1}`,
          link: `https://example.test/nieuws/${index + 1}`,
          qrMediaAssetId: logoId,
          source: "Clubredactie",
          title: `Echt nieuwsbericht ${index + 1}`
        }))
      }
    };
    const royal = createDynamicTemplateView(payload("news", newsData));
    const legacy = createDynamicTemplateView(payload(
      "news",
      newsData,
      "landscape",
      false
    ));
    const royalFirst = royal?.pages[0];
    const legacyFirst = legacy?.pages[0];

    expect(royal?.newsVariant).toBe("news_grid");
    expect(royal?.pages).toHaveLength(2);
    expect(royalFirst?.kind === "news" ? royalFirst.secondaryItems : [])
      .toEqual([expect.objectContaining({
        heroUrl: "blob:https://player.veyocast.nl/content-image",
        intro: "Echte intro 2",
        title: "Echt nieuwsbericht 2"
      })]);
    expect(royal?.pages[1]?.kind === "news" ? royal.pages[1] : null)
      .toMatchObject({
        item: { title: "Echt nieuwsbericht 3" },
        secondaryItems: [{ title: "Echt nieuwsbericht 4" }]
      });
    expect(legacyFirst?.kind === "news" ? legacyFirst.secondaryItems : [])
      .toHaveLength(2);
    expect(renderer).toContain('data-image={secondary.heroUrl ? "visible" : "missing"}');
    expect(renderer).toContain("src={secondary.heroUrl}");
    expect(renderer).toContain("{secondary.intro ? <p>{secondary.intro}</p> : null}");
    expect(stylesheet).toContain("grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);");
    expect(stylesheet).toContain("grid-row: 1 / 3;");
    expect(stylesheet).toContain("grid-template-columns: 30% minmax(0, 1fr);");
    expect(stylesheet).toContain("grid-template-rows: minmax(280px, .9fr) auto minmax(220px, .6fr);");
    expect(stylesheet).toContain("grid-template-columns: 34% minmax(0, 1fr);");
  });

  it("reserveert bij fullscreen nieuws QR-ruimte op de vastgepinde buitenrand", () => {
    const fullscreenRules = stylesheet.slice(
      stylesheet.indexOf('.arenaRoot[data-design-revision="royal-current-v8"] .arenaNewsLayout[data-news-variant="fullscreen_gradient"] .arenaNewsStory'),
      stylesheet.indexOf('.arenaRoot[data-design-revision="royal-current-v8"] .arenaNewsLayout[data-news-variant="text_only"]')
    );
    const portraitFullscreenRules = stylesheet.slice(
      stylesheet.indexOf('.arenaRoot[data-design-revision="royal-current-v8"][data-orientation="portrait"] .arenaNewsLayout[data-news-variant="fullscreen_gradient"] .arenaNewsStory'),
      stylesheet.indexOf('.arenaRoot[data-design-revision="royal-current-v8"][data-orientation="portrait"] .arenaNewsLayout[data-news-variant="text_only"]')
    );

    expect(fullscreenRules).toContain("padding: 38px 38px 252px;");
    expect(fullscreenRules).toContain("-webkit-line-clamp: 8;");
    expect(fullscreenRules).toContain("right: 92px;");
    expect(fullscreenRules).toContain("bottom: 30px;");
    expect(portraitFullscreenRules).toContain("padding: 38px 38px 250px;");
    expect(portraitFullscreenRules).toContain("-webkit-line-clamp: 5;");
    expect(portraitFullscreenRules).toContain("right: 61px;");
    expect(portraitFullscreenRules).toContain("bottom: 61px;");
    expect(renderer).toContain('label={view.designRevision !== "royal-current-v8"}');
  });

  it("rendert menu en prijslijst volgens hun afzonderlijke prototypegeometrie", () => {
    const menu = renderProjection(payload("menu", {
      menu: {
        products: [
          { category: "Warm", id: "koffie", name: "Koffie", priceMinor: 250 },
          { category: "Koud", id: "water", name: "Water", priceMinor: 200 }
        ],
        title: "Kantinemenu"
      }
    }));
    const priceList = renderProjection(payload("price_list", {
      priceList: {
        sections: [{
          column: "left",
          id: "dranken",
          name: "Dranken",
          order: 1,
          products: [{
            description: "Vers gezet",
            formattedPrice: "€ 2,50",
            id: "koffie",
            imageMediaAssetId: imageId,
            name: "Koffie",
            photoVisible: true
          }]
        }],
        title: "Prijslijst"
      }
    }));
    const priceListWithoutPhoto = renderProjection(payload("price_list", {
      priceList: {
        sections: [{
          column: "left",
          id: "dranken",
          name: "Dranken",
          order: 1,
          products: [{
            description: "Vers gezet",
            formattedPrice: "€ 2,50",
            id: "koffie",
            imageMediaAssetId: imageId,
            name: "Koffie",
            photoVisible: false
          }]
        }],
        title: "Prijslijst"
      }
    }));

    expect(renderer).toContain('data-render-family="menu"');
    expect(menu).toContain("Kantinemenu");
    expect(menu).toContain("Koffie");
    expect(renderer).toContain('data-render-family="price-list"');
    expect(renderer).toContain('data-image={feature ? "visible" : "missing"}');
    expect(priceList).toContain("Vers gezet");
    expect(priceList).toContain("€ 2,50");
    expect(priceList).toContain('"kind":"price-list"');
    expect(priceList).toContain('"kind":"image"');
    expect(priceList).toContain("blob:https://player.veyocast.nl/content-image");
    expect(priceListWithoutPhoto).toContain('"kind":"empty"');
    expect(priceListWithoutPhoto).not.toContain(
      "blob:https://player.veyocast.nl/content-image"
    );
  });

  it.each([
    ["sport_match_of_the_day", "match-of-the-day"],
    ["sport_next_match", "next-match"]
  ] as const)("rendert %s als volledige wedstrijdhero", (slideType, family) => {
    const projection = renderProjection(payload(slideType, { sport: { items: [fixture()] } }, "portrait"));

    expect(renderer).toContain('data-render-family={family}');
    expect(renderer).toContain(`? "match-of-the-day"`);
    expect(family).toMatch(/^(?:match-of-the-day|next-match)$/u);
    expect(projection).toContain("14:30");
    expect(projection).toContain("Sportpark De Test");
  });

  it("rendert bezoekers en scheidsrechters als verschillende ontvangstfamilies", () => {
    const visitors = renderProjection(payload("sport_visitor_arrivals", {
      sport: { items: [fixture({ primary: "Uitvereniging JO17-1" })] }
    }));
    const referees = renderProjection(payload("sport_referee_arrivals", {
      sport: {
        items: [fixture({
          primary: "Robin Fluit",
          secondary: "Testvereniging 1 – Uitvereniging 1",
          status: "Scheidsrechter"
        })]
      }
    }, "portrait"));

    expect(renderer).toContain('data-render-family={visitorArrivals ? "visitor-arrivals" : "referee-arrivals"}');
    expect(visitors).toContain("Uitvereniging JO17-1");
    expect(referees).toContain("Robin Fluit");
    expect(referees).toContain("Wedstrijdsecretariaat");
  });

  it("projecteert arrival-opties typed en rendert elk opgeslagen veld conditioneel", () => {
    const config = {
      cardCount: 4,
      dutyDeskText: "Melden bij wedstrijdzaken",
      pageDurationSeconds: 19,
      showArrivalTime: false,
      showClubLogo: false,
      showCompetition: true,
      showDressingRoom: false,
      showField: false,
      showKickoffTime: true,
      showSponsor: true,
      showWelcome: false,
      sponsorMediaAssetId: imageId,
      welcomeText: "Welkom {{team}} bij {{club}}"
    };
    const visitors = createDynamicTemplateView(payload("sport_visitor_arrivals", {
      sport: {
        arrivalConfig: config,
        items: [fixture({ arrivalAt: "2099-09-12T11:30:00.000Z" })]
      }
    }));
    const referees = createDynamicTemplateView(payload("sport_referee_arrivals", {
      sport: {
        arrivalConfig: config,
        items: Array.from({ length: 4 }, (_, index) => fixture({
          arrivalAt: "2099-09-12T11:30:00.000Z",
          id: `official-${index + 1}`,
          logoMediaAssetId: logoId,
          primary: `Official ${index + 1}`,
          secondary: "Aankomst: 13:30 · Aanvang: 14:30"
        }))
      }
    }));

    expect(visitors?.arrivalSlots).toBe(3);
    expect(visitors?.pageDurationMs).toBe(19_000);
    expect(visitors?.arrivalConfig).toEqual({
      dutyDeskText: "Melden bij wedstrijdzaken",
      showArrivalTime: false,
      showClubLogo: false,
      showCompetition: true,
      showDressingRoom: false,
      showField: false,
      showKickoffTime: true,
      showSponsor: true,
      showWelcome: false,
      welcomeText: "Welkom {{team}} bij {{club}}"
    });
    expect(visitors?.arrivalSponsorUrl).toBe("");
    expect(referees?.pages[0]?.kind === "arrivals" ? referees.pages[0].items : [])
      .toHaveLength(4);
    expect(referees?.pageDurationMs).toBe(19_000);
    expect(referees?.arrivalSponsorUrl)
      .toBe("blob:https://player.veyocast.nl/content-image");
    expect(renderer).toContain("config.showWelcome ? (");
    expect(renderer).toContain("config.showClubLogo ? (");
    expect(renderer).toContain("config.showArrivalTime ? (");
    expect(renderer).toContain("config.showKickoffTime ? (");
    expect(renderer).toContain("config.showCompetition ? (");
    expect(renderer).toContain("config.showDressingRoom ? (");
    expect(renderer).toContain("config.showField ? (");
    expect(renderer).toContain("<dt>Kleedkamer thuis</dt>");
    expect(renderer).toContain("<dt>Kleedkamer uit</dt>");
    expect(renderer).toContain("<dt>Scheidsrechter</dt>");
    expect(renderer).toContain("{config.dutyDeskText}");
    const refereeLabel = renderer.slice(
      renderer.indexOf("function refereeMatchLabel"),
      renderer.indexOf("function RoyalMatchHero")
    );
    expect(refereeLabel).not.toContain("secondary");
    expect(stylesheet).toContain('.arenaArrivalCard[data-arrival-kind] strong {');
    expect(stylesheet).toContain("margin-top: 0;");
    expect(stylesheet).toContain("padding-top: 0;");
    expect(stylesheet).toContain("border-top: 0;");
  });

  it("rendert verjaardagen in de Royal-kaartcompositie", () => {
    const birthday = todayBirthday();
    const projection = renderProjection(payload("sport_birthdays", {
      sport: {
        birthdays: [{
          age: 18,
          day: birthday.day,
          displayName: "Alex Tester",
          externalId: "birthday-1",
          month: birthday.month,
          role: "Speler",
          teams: [{ externalId: "team-1", name: "JO19-1" }]
        }],
        fetchedAt: new Date().toISOString(),
        timezone: "Europe/Amsterdam"
      }
    }, "portrait"));

    expect(renderer).toContain('data-render-family="birthdays"');
    expect(projection).toContain("Alex Tester");
    expect(projection).toContain('"age":18');
  });

  it("past v8-defaults en begrensde prototypepaginering toe zonder legacy te muteren", () => {
    const dressing = createDynamicTemplateView(payload("sport_dressing_rooms", {
      sport: { items: [fixture()] }
    }));
    const officials = createDynamicTemplateView(payload("sport_officials", {
      sport: { items: [fixture()] }
    }));
    const referees = createDynamicTemplateView(payload("sport_referee_arrivals", {
      sport: { items: [fixture(), fixture({ id: "wedstrijd-2" }), fixture({ id: "wedstrijd-3" })] }
    }));
    const legacyMenu = createDynamicTemplateView(payload("menu", {
      menu: { products: [{ category: "Warm", id: "koffie", name: "Koffie" }] }
    }, "landscape", false));

    expect(dressing?.sportDisplay).toMatchObject({
      showAwayDressingRoom: true,
      showHomeDressingRoom: true
    });
    expect(officials?.sportDisplay?.showReferee).toBe(true);
    expect(referees?.pages).toHaveLength(2);
    expect(referees?.pages[0]?.kind === "arrivals" ? referees.pages[0].items : [])
      .toHaveLength(2);
    expect(legacyMenu?.designRevision).toBe("legacy");
  });

  it("houdt de Royal-stand exact 3 seconden stil en scrolt daarna 34 logische px per seconde", () => {
    expect(royalStandingScrollMetrics).toMatchObject({
      endHoldMs: 3_000,
      speedPxPerSecond: 34,
      startHoldMs: 3_000
    });
    expect(royalStandingScrollDistance(20, "landscape")).toBe(902);
    expect(royalStandingPlaybackDurationMs(20, "landscape")).toBe(32_530);
    expect(royalStandingScrollOffset(2_999, 902)).toBe(0);
    expect(royalStandingScrollOffset(3_000, 902)).toBe(0);
    expect(royalStandingScrollOffset(4_000, 902)).toBe(34);
    expect(royalStandingScrollOffset(60_000, 902)).toBe(902);
  });

  it("laat autoplay wachten op de volledige stand en pagineert rustig bij motion-off", () => {
    const motionOn = withThemeMotion(payload("sport_standing", {
      sport: { items: standingItems(20) }
    }), true);
    const motionOff = payload("sport_standing", {
      sport: { items: standingItems(20) }
    });
    const movingView = createDynamicTemplateView(motionOn);
    const pagedView = createDynamicTemplateView(motionOff);
    const movingPages = royalStandingPlaybackPages(movingView?.pages ?? [], true);
    const quietPages = royalStandingPlaybackPages(pagedView?.pages ?? [], false);

    expect(movingView?.pages).toHaveLength(3);
    expect(movingPages).toHaveLength(1);
    expect(movingPages[0]?.kind === "standing" ? movingPages[0].items : [])
      .toHaveLength(20);
    expect(quietPages).toHaveLength(3);
    expect(movingView?.minimumPlaybackMs).toBe(32_530);
    expect(dynamicTemplateMinimumPlaybackMs(motionOn)).toBe(32_530);
    expect(pagedView?.pages).toHaveLength(3);
    expect(pagedView?.pages.every((page) =>
      page.kind === "standing" && page.items.length <= 7
    )).toBe(true);
    expect(pagedView?.minimumPlaybackMs).toBeUndefined();
    expect(dynamicTemplateMinimumPlaybackMs(motionOff)).toBe(15_000);

    expect(renderer).toContain('window.matchMedia("(prefers-reduced-motion: reduce)")');
    expect(renderer).toContain("royalStandingPlaybackPages(view.pages, standingAutoScroll)");
    expect(renderer).toContain("window.requestAnimationFrame(renderFrame)");
    expect(renderer).toContain("royalStandingScrollOffset(elapsedMs, maximum)");
    expect(renderer).toContain("viewport.scrollTop = maximum");
    expect(renderer).toContain('viewport.dataset.scrollComplete = "true"');
    expect(stylesheet).toContain(".arenaStandingRows[data-auto-scroll]");
    expect(stylesheet).toContain("height: 70px;");
    expect(stylesheet).toContain("height: 220px !important;");
  });

  it("toont Royal-stand in bronvolgorde met de exacte twaalf kolommen", () => {
    const summary = renderer.indexOf('data-testid="standing-summary"');
    const heading = renderer.indexOf('data-testid="standing-head"', summary);
    const pinned = renderer.indexOf('data-testid="standing-pinned-team"', heading);
    const rows = renderer.indexOf('data-standing-window=""', pinned);
    const royalHeading = renderer.slice(
      renderer.indexOf("{royalCurrent ? (", heading),
      renderer.indexOf(") : (", heading)
    );
    const royalLandscapeStart = renderer.indexOf('if (royalOrientation === "landscape")');
    const royalLandscapeReturn = renderer.indexOf("    return (", royalLandscapeStart);
    const legacyStandingReturn = renderer.indexOf("\n  return (", royalLandscapeReturn);
    const royalLandscape = renderer.slice(royalLandscapeStart, legacyStandingReturn);

    expect(summary).toBeGreaterThan(-1);
    expect(heading).toBeGreaterThan(summary);
    expect(pinned).toBeGreaterThan(heading);
    expect(rows).toBeGreaterThan(pinned);
    expect(royalHeading).toContain("<span>#</span><span>Logo</span><span>Club + team</span>");
    expect(royalHeading).toContain("<span>G</span><span>W</span><span>GL</span><span>V</span>");
    expect(royalHeading).toContain("<span>P</span><span>DV</span><span>DT</span><span>+/−</span>");
    expect(royalHeading).toContain("<span>Vorm</span>");
    expect(royalLandscape).toContain("styles.royalStandingLogo");
    expect(royalLandscape).toContain("styles.royalStandingName");
    expect(royalLandscape).not.toContain("arenaStandingZone");
    expect(renderer).toContain("<strong>Volledige stand · {totalTeams} teams</strong>");
    expect(renderer).toContain("<div><dt>G</dt><dd>{team.played ?? \"–\"}</dd></div>");
    expect(renderer).toContain("<div><dt>+/−</dt><dd>{signed(team.goalDifference)}</dd></div>");
  });
});
