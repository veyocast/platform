import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import type { PlayerDynamicTemplatePayload } from "@veyocast/contracts";

import { createDynamicTemplateView } from "../src/dynamic-template-view";

const css = readFileSync(
  fileURLToPath(new URL("../src/editorial-arena-renderer.module.css", import.meta.url)),
  "utf8"
);
const renderer = readFileSync(
  fileURLToPath(new URL("../src/editorial-arena-renderer.tsx", import.meta.url)),
  "utf8"
);

const logoAssetId = "33333333-3333-4333-8333-333333333333";
const photoAssetId = "44444444-4444-4444-8444-444444444444";

const royalCurrentPresentation = {
  appearance: {
    designRevision: "royal-current-v8",
    motionEnabled: false,
    palette: {
      background: "club",
      primary: "#2459ED",
      secondary: null,
      version: 1
    },
    schemaVersion: 2,
    surfaces: {
      clubLogoBackground: "#FFFFFF",
      homeLogoBackground: "#FFFFFF"
    },
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
  sport: Record<string, unknown>,
  orientation: "landscape" | "portrait" = "landscape"
): PlayerDynamicTemplatePayload {
  return {
    assets: {
      [logoAssetId]: {
        bytes: 512,
        checksumSha256: "b".repeat(64),
        mimeType: "image/png",
        url: "blob:https://player.veyocast.nl/away-logo"
      },
      [photoAssetId]: {
        bytes: 1024,
        checksumSha256: "c".repeat(64),
        mimeType: "image/png",
        url: "blob:https://player.veyocast.nl/activity-photo"
      }
    },
    data: {
      brand: { clubName: "Duindorp SV", primaryColor: "#2459ED" },
      sport,
      themePresentation: royalCurrentPresentation,
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

describe("Royal Current moderne renderer", () => {
  it("activeert de vaste v8-shell en zet motion uit vanuit het snapshot", () => {
    const view = createDynamicTemplateView(payload("sport_program", {
      items: [{
        awayTeam: "Quick MO11-2",
        homeTeam: "Duindorp SV MO11-1",
        id: "wedstrijd-1",
        primary: "Duindorp SV MO11-1 – Quick MO11-2",
        time: "08:30"
      }]
    }));

    expect(view).toMatchObject({
      designRevision: "royal-current-v8",
      motionEnabled: false
    });
    expect(renderer).toContain("data-design-revision={view.designRevision}");
    expect(renderer).toContain('data-motion-state={effectiveMotionEnabled ? "on" : "off"}');
    expect(renderer).toContain('window.matchMedia("(prefers-reduced-motion: reduce)")');
    expect(renderer).toContain("Onze club. Ons verhaal.");
    expect(css).toContain("top: calc(300px + var(--arena-viewport-inset-y, 0px));");
    expect(css).toContain("left: calc(150px + var(--arena-viewport-inset-x, 0px));");
    expect(css).toContain("top: calc(372px + var(--arena-viewport-inset-y, 0px));");
    expect(css).toContain("left: calc(101px + var(--arena-viewport-inset-x, 0px));");
    expect(css).toContain('src: url("./fonts/roboto-latin-700-normal.woff2") format("woff2");');
    expect(css).toContain("font-weight: 600 700;");
  });

  it("reserveert standaard drie bezoekerplekken en gebruikt het echte uitlogo", () => {
    const dynamicTemplate = payload("sport_visitor_arrivals", {
      items: [{
        awayLogoMediaAssetId: logoAssetId,
        awayTeam: "Quick MO11-2",
        field: "2 A",
        homeMatch: true,
        homeRoom: "1",
        homeTeam: "Duindorp SV MO11-1",
        id: "welkom-1",
        kickoffAt: "2026-09-12T06:30:00.000Z",
        kickoffTime: "08:30",
        primary: "Duindorp SV MO11-1 – Quick MO11-2"
      }]
    });
    const view = createDynamicTemplateView(dynamicTemplate, new Date("2026-09-09T12:00:00Z"));

    expect(view?.arrivalSlots).toBe(3);
    expect(view?.pages[0]?.kind === "arrivals" ? view.pages[0].items[0]?.logoUrl : "")
      .toBe("blob:https://player.veyocast.nl/away-logo");
    expect(renderer).toContain("data-slots={fixedSlots}");
    expect(renderer).toContain("const emptySlots = Math.max(0, fixedSlots - page.items.length)");
    expect(renderer).toContain("const visitorLogo = arrivalConfig.showClubLogo");
    expect(renderer).toContain("? entry.awayLogoUrl || entry.logoUrl");
    expect(renderer).toContain("Array.from({ length: emptySlots }");
    expect(css).toContain("grid-template-columns: repeat(var(--arrival-slots), minmax(0, 1fr));");
    expect(css).toContain("width: min(56%, 560px);");

    const twoSlotView = createDynamicTemplateView(payload("sport_visitor_arrivals", {
      arrivalConfig: { cardCount: 2 },
      items: []
    }));
    expect(twoSlotView?.arrivalSlots).toBe(2);
  });

  it("houdt het echte eigen team gepind én in de bronvolgorde", () => {
    const dynamicTemplate = payload("sport_standing", {
      items: Array.from({ length: 9 }, (_, index) => ({
        id: `team-${index + 1}`,
        played: 3,
        points: 9 - index,
        position: index + 1,
        primary: index === 1 ? "Duindorp SV" : `Team ${index + 1}`,
        selected: index === 1,
        teamName: index === 1 ? "Duindorp SV" : `Team ${index + 1}`
      }))
    }, "portrait");
    const view = createDynamicTemplateView(dynamicTemplate);
    const standingPage = view?.pages[0];

    expect(view?.standingPinnedTeam).toMatchObject({ id: "team-2", position: 2 });
    expect(standingPage?.kind === "standing"
      ? standingPage.items.map((team) => team.id)
      : []).toEqual(["team-1", "team-2", "team-3", "team-4"]);
    expect(view?.pages).toHaveLength(3);
    expect(view?.pages.flatMap((page) => page.kind === "standing" ? page.items : []))
      .toHaveLength(9);
    expect(renderer).toContain('data-testid="standing-pinned-team"');
    expect(renderer).toContain("{column.map((team) => (");
    expect(renderer).toContain("highlighted={!royalCurrent && team.selected}");
  });

  it("toont Afgelast op de tijdpositie ook wanneer tijd uit staat", () => {
    const view = createDynamicTemplateView(payload("sport_program", {
      displayConfig: { showTime: false },
      items: [{
        awayTeam: "DUNO 2",
        homeTeam: "Duindorp SV 2",
        id: "afgelast-1",
        primary: "Duindorp SV 2 – DUNO 2",
        status: "afgelast",
        time: "08:30"
      }]
    }));
    const programRenderer = renderer.slice(
      renderer.indexOf("function ProgramRow"),
      renderer.indexOf("function ResultRow")
    );

    expect(view?.sportDisplay?.showTime).toBe(false);
    expect(view?.pages[0]?.kind === "sport-list" ? view.pages[0].items[0]?.status : "")
      .toBe("afgelast");
    expect(programRenderer).toContain("const cancelled = isCancelledMatch(item)");
    expect(programRenderer).toContain("const timeCell = matchTimeCellKind(");
    expect(programRenderer).toContain('data-field="time" data-status="cancelled"');
    expect(programRenderer.indexOf('timeCell === "cancelled"')).toBeLessThan(
      programRenderer.indexOf('timeCell === "time"')
    );
    const genericRows = renderer.slice(
      renderer.indexOf("function ArenaRow"),
      renderer.indexOf("function TeamMini")
    );
    expect(genericRows).toContain('kind === "cancellation" || isCancelledMatch(item)');
    expect(genericRows).toContain('{cancelled ? "Afgelast" : item.time');
  });

  it("houdt onbekende uitslagen leeg en nieuws-QR vrij van begeleidende tekst", () => {
    const resultView = createDynamicTemplateView(payload("sport_results", {
      items: [{
        awayScore: null,
        awayTeam: "DUNO 2",
        homeScore: null,
        homeTeam: "Duindorp SV 2",
        id: "uitslag-1",
        primary: "Duindorp SV 2 – DUNO 2"
      }]
    }));
    const newsPayload = payload("news", {});
    newsPayload.data = {
      ...newsPayload.data,
      news: {
        articles: [{
          externalId: "nieuws-1",
          intro: "Een rustig nieuwsbericht uit de vereniging.",
          link: "https://duindorpsv.nl/nieuws/1",
          qrMediaAssetId: logoAssetId,
          title: "Nieuws uit de club"
        }]
      }
    };
    const newsView = createDynamicTemplateView(newsPayload);
    const resultRenderer = renderer.slice(
      renderer.indexOf("function ResultRow"),
      renderer.indexOf("function MatchSecondaryLine")
    );
    const newsRenderer = renderer.slice(
      renderer.indexOf('if (page.kind === "news")'),
      renderer.indexOf('if (page.kind === "standing")')
    );

    expect(resultView?.pages[0]?.kind === "sport-list"
      ? resultView.pages[0].items[0]
      : null).toMatchObject({ awayScore: null, homeScore: null });
    expect(newsView?.pages[0]?.kind === "news" ? newsView.pages[0].item?.title : "")
      .toBe("Nieuws uit de club");
    expect(resultRenderer).toContain('aria-label={scoreKnown');
    expect(resultRenderer).toContain('"Uitslag nog niet bekend"');
    expect(resultRenderer).toContain("{scoreKnown ? <>");
    expect(newsRenderer).toContain("article && view.designRevision === \"royal-current-v8\"");
    expect(newsRenderer).toContain("<ArenaNewsQr article={article} label={false} />");
    expect(newsRenderer.slice(
      newsRenderer.indexOf('view.designRevision === "royal-current-v8"'),
      newsRenderer.indexOf(": article ? (")
    )).not.toContain("article.title");
  });

  it("projecteert echte agenda-afbeeldingen achter de activiteitkopie", () => {
    const view = createDynamicTemplateView(payload("sport_activities", {
      items: Array.from({ length: 4 }, (_, index) => ({
        date: "12-09-2026",
        id: `activiteit-${index + 1}`,
        photoMediaAssetId: photoAssetId,
        primary: `Clubmiddag ${index + 1}`,
        secondary: "Samen in de kantine",
        time: "15:00",
        venueName: "Sportpark Houtrust"
      }))
    }));

    expect(view?.pages).toHaveLength(2);
    expect(view?.pages[0]?.kind === "sport-list" ? view.pages[0].items : [])
      .toHaveLength(3);
    expect(view?.pages[0]?.kind === "sport-list" ? view.pages[0].items[0]?.photoUrl : "")
      .toBe("blob:https://player.veyocast.nl/activity-photo");
    expect(renderer).toContain("<RoyalActivityCard entry={entry}");
    expect(renderer).toContain("className={styles.royalActivityImage} src={entry.photoUrl}");
    expect(css).toContain("opacity: .3;");
    expect(css).toContain("object-position: 60% center;");
  });

  it("houdt iedere sponsorcreative in een eigen v8-spotlight", () => {
    const view = createDynamicTemplateView(payload("sport_sponsor", {
      items: Array.from({ length: 4 }, (_, index) => ({
        id: `sponsor-${index + 1}`,
        logoMediaAssetId: logoAssetId,
        meta: "Samen sterk voor de vereniging",
        primary: `Clubpartner ${index + 1}`,
        secondary: "Eerste selectie"
      }))
    }, "portrait"));

    expect(view?.pages).toHaveLength(4);
    expect(view?.pages.every((page) => (
      page.kind === "sponsor" && page.items.length === 1
    ))).toBe(true);
    expect(view?.pages.flatMap((page) => (
      page.kind === "sponsor" ? page.items.map((item) => item.primary) : []
    ))).toEqual([
      "Clubpartner 1",
      "Clubpartner 2",
      "Clubpartner 3",
      "Clubpartner 4"
    ]);
  });
});
