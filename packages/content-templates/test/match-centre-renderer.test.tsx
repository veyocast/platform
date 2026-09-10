import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import type { PlayerDynamicTemplatePayload } from "@veyocast/contracts";

import {
  createDynamicTemplateView,
  formatMatchCentreClock,
  formatMatchCentrePageCounter
} from "../src/dynamic-template-view";
import {
  editorialArenaDarkTokens,
  editorialArenaLightTokens
} from "../src/editorial-arena-theme";
import {
  matchListForcesTimeColumn,
  matchTimeCellKind
} from "../src/editorial-arena-renderer";

const css = readFileSync(
  fileURLToPath(new URL("../src/editorial-arena-renderer.module.css", import.meta.url)),
  "utf8"
);
const renderer = readFileSync(
  fileURLToPath(new URL("../src/editorial-arena-renderer.tsx", import.meta.url)),
  "utf8"
);

const themePresentation = {
  appearance: {
    schemaVersion: 1,
    surfaces: {
      clubLogoBackground: "#E7F5EE",
      homeLogoBackground: "#FFFFFF"
    },
    typography: {
      baseScale: 1,
      bodyFontRef: "vc-inter-v1",
      displayFontRef: "vc-manrope-v1",
      sportScale: 1.12
    }
  },
  catalogVersion: "1.0.0",
  resolvedMode: {
    mode: "light",
    policy: { kind: "fixed", mode: "light" },
    resolvedAt: "2026-09-06T13:33:00.000Z",
    timezone: "Europe/Amsterdam"
  },
  selection: {
    accent: null,
    categoryOverrides: [],
    modePolicy: { kind: "fixed", mode: "light" },
    ref: { catalog: "v2", id: "fieldflow", version: "1.0.0" },
    support: null
  },
  settingsRevision: 7,
  snapshotVersion: 2
} as const;

function programPayload(
  itemCount: number,
  slideType: "sport_program" | "sport_results" | "sport_team" = "sport_program",
  options: {
    columns?: "one" | "two";
    displayConfig?: Partial<Record<
      | "showAwayDressingRoom"
      | "showAwayLogo"
      | "showDate"
      | "showDressingRoom"
      | "showField"
      | "showHomeAway"
      | "showHomeDressingRoom"
      | "showHomeLogo"
      | "showLogo"
      | "showReferee"
      | "showSportpark"
      | "showTime",
      boolean
    >>;
    orientation?: "landscape" | "portrait";
  } = {}
): PlayerDynamicTemplatePayload {
  return {
    data: {
      brand: { clubName: "Duindorp SV", primaryColor: "#315CFF" },
      sport: {
        displayConfig: {
          columns: options.columns ?? "one",
          showDressingRoom: false,
          showField: true,
          showHomeAway: true,
          showLogo: true,
          showReferee: false,
          ...options.displayConfig
        },
        items: Array.from({ length: itemCount }, (_, index) => ({
          awayTeam: `Uit ${index + 1}`,
          date: "12-09-2026",
          field: `Veld ${index + 1}`,
          homeTeam: `Thuis ${index + 1}`,
          id: `wedstrijd-${index + 1}`,
          primary: `Thuis ${index + 1} – Uit ${index + 1}`,
          time: "08:30"
        })),
        title: "Clubprogramma komende 7 dagen"
      },
      themePresentation,
      type: slideType
    },
    orientation: options.orientation ?? "landscape",
    schemaVersion: 1,
    slideType,
    snapshotHash: "a".repeat(64),
    snapshotId: "11111111-1111-4111-8111-111111111111",
    templateSlug: "editorial-arena-programma-light-landscape",
    templateVersionId: "22222222-2222-4222-8222-222222222222"
  };
}

function hiddenTimeRows(
  slideType: "sport_program" | "sport_results",
  statuses: [string, string]
) {
  const payload = programPayload(2, slideType, {
    displayConfig: { showTime: false }
  });
  const sport = payload.data.sport as Record<string, unknown>;
  const items = Array.isArray(sport.items) ? sport.items : [];
  sport.items = items.map((item, index) => ({
    ...(item as Record<string, unknown>),
    awayScore: slideType === "sport_results" ? 1 : undefined,
    homeScore: slideType === "sport_results" ? 2 : undefined,
    status: statuses[index]
  }));
  const view = createDynamicTemplateView(payload);
  return view?.pages[0]?.kind === "sport-list" ? view.pages[0].items : [];
}

describe("Match Centre renderer", () => {
  it("formatteert de tenanttijd deterministisch als dd-mm-yyyy | HH:mm", () => {
    expect(formatMatchCentreClock(
      "2026-09-06T13:33:00.000Z",
      "Europe/Amsterdam"
    )).toBe("06-09-2026 | 15:33");
    expect(formatMatchCentreClock(
      "2026-09-06T13:33:00.000Z",
      "Geen/Geldige-Zone"
    )).toBe("06-09-2026 | 13:33");
    expect(formatMatchCentreClock("geen-datum", "Europe/Amsterdam")).toBe("—");
  });

  it("houdt item 100 bereikbaar via clubpaginering en verruimt andere sporten niet", () => {
    const view = createDynamicTemplateView(programPayload(101));
    const items = view?.pages.flatMap((page) =>
      page.kind === "sport-list" ? page.items : []
    );
    const teamView = createDynamicTemplateView(programPayload(101, "sport_team"));
    const teamItemCount = teamView?.pages.reduce(
      (count, page) => count + ("items" in page ? page.items.length : 0),
      0
    );

    expect(view?.sportDisplay).toMatchObject({
      columns: "one",
      showAwayDressingRoom: false,
      showAwayLogo: true,
      showDate: true,
      showHomeDressingRoom: false,
      showHomeLogo: true,
      showLogo: true,
      showSportpark: true,
      showTime: true
    });
    expect(view?.pages).toHaveLength(17);
    expect(items).toHaveLength(100);
    expect(items?.at(-1)?.id).toBe("wedstrijd-100");
    expect(teamItemCount).toBe(40);
  });

  it("zet MATCHCENTRE, paginanummer en bevroren previewtijd in de header", () => {
    const view = createDynamicTemplateView(programPayload(17));
    const firstPage = view?.pages[0];

    expect(formatMatchCentrePageCounter(
      0,
      view?.pages.length ?? 0
    )).toBe("01 / 03");
    expect(formatMatchCentreClock(
      themePresentation.resolvedMode.resolvedAt,
      themePresentation.resolvedMode.timezone
    )).toBe("06-09-2026 | 15:33");
    expect(
      firstPage?.kind === "sport-list" ? firstPage.items : []
    ).toHaveLength(6);
    expect(renderer).toContain("<strong>MATCHCENTRE</strong>");
    expect(renderer).toContain(
      "<time dateTime={clock.instant}>{clock.label}</time>"
    );
    expect(renderer).toContain(
      "{!matchCentre ? <span>{view.sourceLabel}</span> : null}"
    );
    expect(renderer).not.toContain("VerticalSlideIndex");
  });

  it("ankert het zichtbare frame aan gelijke vierzijdige safe-area en staggered cards", () => {
    expect(css).toContain(
      "top: calc(52px + var(--arena-viewport-inset-y, 0px));"
    );
    expect(css).toContain(
      "bottom: calc(52px + var(--arena-viewport-inset-y, 0px));"
    );
    expect(css).toContain(
      "left: calc(52px + var(--arena-viewport-inset-x, 0px));"
    );
    expect(css).toContain("@keyframes matchRowIn");
    expect(css).toContain("var(--arena-row-delay) both");
    expect(css).not.toContain(".arenaVerticalIndex");
  });

  it("pagineert twee kolommen alleen liggend en houdt portrait op één kolom", () => {
    const landscape = createDynamicTemplateView(programPayload(
      20,
      "sport_program",
      { columns: "two" }
    ));
    const portrait = createDynamicTemplateView(programPayload(
      20,
      "sport_program",
      { columns: "two", orientation: "portrait" }
    ));

    expect(landscape?.pages).toHaveLength(2);
    expect(landscape?.pages[0]?.kind === "sport-list"
      ? landscape.pages[0].items
      : []).toHaveLength(12);
    expect(portrait?.pages).toHaveLength(3);
    expect(portrait?.pages[0]?.kind === "sport-list"
      ? portrait.pages[0].items
      : []).toHaveLength(7);
  });

  it("projecteert alle optionele wedstrijdvelden onafhankelijk en met legacy fallbacks", () => {
    const keys = [
      "showAwayDressingRoom", "showAwayLogo", "showDate",
      "showDressingRoom", "showField", "showHomeAway",
      "showHomeDressingRoom", "showHomeLogo", "showLogo",
      "showReferee", "showSportpark", "showTime"
    ] as const;
    const allOff = Object.fromEntries(keys.map((key) => [key, false]));
    const allOn = Object.fromEntries(keys.map((key) => [key, true]));
    expect(createDynamicTemplateView(programPayload(
      1,
      "sport_program",
      { displayConfig: allOff }
    ))?.sportDisplay).toMatchObject(allOff);
    expect(createDynamicTemplateView(programPayload(
      1,
      "sport_program",
      { displayConfig: allOn }
    ))?.sportDisplay).toMatchObject(allOn);
    const legacy = createDynamicTemplateView(programPayload(
      1,
      "sport_program",
      { displayConfig: { showDressingRoom: true, showLogo: false } }
    ));
    expect(legacy?.sportDisplay).toMatchObject({
      showAwayDressingRoom: true,
      showAwayLogo: false,
      showHomeDressingRoom: true,
      showHomeLogo: false
    });
  });

  it("ordent programma- en uitslagvelden stabiel zonder thuis-uitbadges", () => {
    const program = renderer.slice(
      renderer.indexOf("function ProgramRow"),
      renderer.indexOf("function ResultRow")
    );
    const result = renderer.slice(
      renderer.indexOf("function ResultRow"),
      renderer.indexOf("function MatchSecondaryLine")
    );
    const secondary = renderer.slice(
      renderer.indexOf("function MatchSecondaryLine"),
      renderer.indexOf("function programPrimaryColumns")
    );
    const expectOrder = (source: string, fields: string[]) => {
      let previous = -1;
      for (const field of fields) {
        const current = source.indexOf(`data-field="${field}"`);
        expect(current).toBeGreaterThan(previous);
        previous = current;
      }
    };
    expectOrder(program, [
      "date", "time", "home-logo", "home-team", "home-room", "versus",
      "away-logo", "away-team", "away-room"
    ]);
    expectOrder(result, [
      "date", "time", "home-logo", "home-team", "score", "away-logo",
      "away-team"
    ]);
    expectOrder(secondary, ["referee", "field", "sportpark"]);
    expect(program).not.toContain("<em>Thuis</em>");
    expect(program).not.toContain("<em>Uit</em>");
    expect(renderer).toContain('"Uitslag nog niet bekend"');
    expect(renderer).toContain("{scoreKnown ? <>");
    expect(css).toMatch(
      /\.arenaFixtureList \{[^}]*grid-auto-rows: var\(--arena-row-height\);[^}]*align-content: start;/u
    );
    expect(css).toMatch(
      /\.arenaProgramRow \{[^}]*grid-template-rows: minmax\(0, 1fr\) auto;/u
    );
    expect(css).toMatch(
      /\.arenaMatchSecondary \{[^}]*justify-content: flex-end;[^}]*font-size: \.52em;/u
    );
    expect(css).toMatch(
      /\.arenaResultScore \{[^}]*min-width: 112px;[^}]*justify-content: center;[^}]*font-variant-numeric: tabular-nums;/u
    );
    expect(renderer).toContain(
      'minmax(var(--arena-match-date-min, 140px), .72fr)'
    );
    expect(renderer).toContain(
      'minmax(0, var(--arena-match-team-fr, 1.55fr))'
    );
    expect(renderer).toContain(
      'minmax(0, var(--arena-match-room-fr, .88fr))'
    );
    expect(renderer).toContain('var(--arena-match-vs-min, 36px)');
    expect(css).toMatch(
      /data-design-revision="royal-current-v8"\]\[data-orientation="portrait"\][\s\S]*?--arena-match-date-min: 150px;[\s\S]*?--arena-match-team-fr: 1\.75fr;/u
    );
    expect(css).toMatch(
      /data-design-revision="royal-current-v8"\]\[data-orientation="portrait"\][\s\S]*?\.arenaMatchSecondary span \{[^}]*flex: 1 1 0;[^}]*text-align: right;/u
    );
  });

  it("reserveert bij gemengd programma een gedeelde tijdkolom wanneer tijd verborgen is", () => {
    const mixed = hiddenTimeRows("sport_program", ["afgelast", "gepland"]);
    const scheduled = hiddenTimeRows("sport_program", ["gepland", "gepland"]);
    const forceTimeColumn = matchListForcesTimeColumn(mixed, false);
    const program = renderer.slice(
      renderer.indexOf("function ProgramRow"),
      renderer.indexOf("function ResultRow")
    );

    expect(forceTimeColumn).toBe(true);
    expect(matchTimeCellKind(true, false, forceTimeColumn)).toBe("cancelled");
    expect(matchTimeCellKind(false, false, forceTimeColumn)).toBe("placeholder");
    expect(matchListForcesTimeColumn(scheduled, false)).toBe(false);
    expect(matchTimeCellKind(false, false, false)).toBe("hidden");
    expect(program).toContain('timeCell !== "hidden"');
    expect(program).toContain('timeCell === "placeholder"');
    expect(program).toContain('data-time-placeholder=""');
  });

  it("reserveert bij gemengde uitslagen een gedeelde tijdkolom wanneer tijd verborgen is", () => {
    const mixed = hiddenTimeRows("sport_results", ["afgelast", "definitief"]);
    const scheduled = hiddenTimeRows("sport_results", ["definitief", "definitief"]);
    const forceTimeColumn = matchListForcesTimeColumn(mixed, false);
    const result = renderer.slice(
      renderer.indexOf("function ResultRow"),
      renderer.indexOf("function MatchSecondaryLine")
    );

    expect(forceTimeColumn).toBe(true);
    expect(matchTimeCellKind(true, false, forceTimeColumn)).toBe("cancelled");
    expect(matchTimeCellKind(false, false, forceTimeColumn)).toBe("placeholder");
    expect(matchListForcesTimeColumn(scheduled, false)).toBe(false);
    expect(matchTimeCellKind(false, false, false)).toBe("hidden");
    expect(result).toContain('timeCell !== "hidden"');
    expect(result).toContain('timeCell === "placeholder"');
    expect(result).toContain('data-time-placeholder=""');
  });

  it("laat een onbekende uitslag leeg en accepteert alleen veilige gehele scores", () => {
    const cases = [
      { awayScore: null, expectedAway: null, expectedHome: null, homeScore: null },
      { awayScore: "", expectedAway: null, expectedHome: null, homeScore: "" },
      { awayScore: 2, expectedAway: 2, expectedHome: 0, homeScore: 0 },
      { awayScore: 1000, expectedAway: null, expectedHome: null, homeScore: -1 }
    ] as const;

    for (const scoreCase of cases) {
      const payload = programPayload(1);
      const sport = payload.data.sport as Record<string, unknown>;
      const items = Array.isArray(sport.items) ? sport.items : [];
      sport.items = items.map((item) => ({
        ...(item as Record<string, unknown>),
        awayScore: scoreCase.awayScore,
        homeScore: scoreCase.homeScore
      }));
      const view = createDynamicTemplateView(payload);
      const firstPage = view?.pages[0];
      const firstItem = firstPage?.kind === "sport-list"
        ? firstPage.items[0]
        : null;

      expect(firstItem?.homeScore).toBe(scoreCase.expectedHome);
      expect(firstItem?.awayScore).toBe(scoreCase.expectedAway);
    }
  });

  it("houdt aangepaste paletkleuren semantisch gekoppeld aan de rijen", () => {
    const payload = programPayload(1);
    payload.data.editorial = {
      newsVariant: "hero_split",
      pricePhotoMode: "show",
      schemaVersion: 2,
      theme: {
        dark: editorialArenaDarkTokens,
        light: {
          ...editorialArenaLightTokens,
          panel: "#223344",
          row: "#123456",
          text: "#FEDCBA",
          textMuted: "#ABCDEF"
        },
        mode: "light"
      }
    };
    const view = createDynamicTemplateView(payload);
    expect(view?.themeTokens).toMatchObject({
      panel: "#223344",
      row: "#123456",
      text: "#FEDCBA",
      textMuted: "#ABCDEF"
    });
    expect(renderer).toContain(
      "...editorialThemeCssVariables(view.themeTokens)"
    );
    expect(css).toContain("background: var(--vc-row);");
    expect(css).toContain("color: var(--vc-text-muted);");
    expect(css).toContain(
      "background: var(--vc-home-logo-background, var(--vc-panel));"
    );
  });
});
