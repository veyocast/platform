import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { createDefaultLedScoresCanvasExperience } from "@veyocast/contracts";
import {
  createRoyalCurrentAppearance,
  freezeThemePresentation
} from "@veyocast/content-templates";

import type {
  ActiveLedScoresMatchOverlay,
  LedScoresLiveMatchConfig,
  LedScoresMatchState,
  LedScoresOverlayAsset
} from "../_lib/ledscores-match-experience";
import {
  LedScoresLiveMatchSlide,
  LedScoresMatchOverlay,
  LedScoresMatchOverlayContent
} from "./ledscores-match-experience";
import { DynamicTemplateMedia } from "./dynamic-template-media";
import type { FrozenPlayerTheme } from "./player-presentation-theme";

describe("LED Scores responsive match renderers", () => {
  it("rendert een portrait match center met actuele stand, klok en verloop", () => {
    const html = renderToStaticMarkup(
      <LedScoresLiveMatchSlide
        config={config}
        now={Date.parse("2026-08-31T18:00:10.000Z")}
        orientation="portrait"
        state={state}
      />
    );
    expect(html).toContain('data-orientation="portrait"');
    expect(html).toContain('data-accent="contrast"');
    expect(html).toContain("01:05");
    expect(html).toContain("D. Jansen");
    expect(html).toContain("Stand Duindorp sv 1 2, Bezoekers 1");
    expect(html).toContain("Wedstrijdverloop");
  });

  it.each([
    ["match_center", "landscape", "Wedstrijdverloop"],
    ["scoreboard", "portrait", "Actuele tussenstand"]
  ] as const)(
    "projecteert de frozen Royal authority op liveview %s/%s",
    (template, orientation, expected) => {
      const html = renderToStaticMarkup(
        <LedScoresLiveMatchSlide
          config={{ ...config, template }}
          now={Date.parse("2026-08-31T18:00:10.000Z")}
          orientation={orientation}
          state={state}
          theme={royalTheme}
        />
      );

      expect(html).toContain(`data-template="${template}"`);
      expect(html).toContain(`data-orientation="${orientation}"`);
      expect(html).toContain('data-design-revision="royal-current-v8"');
      expect(html).toContain('data-motion-state="off"');
      expect(html).toContain('--bg:#0a1124');
      expect(html).toContain(expected);
    }
  );

  it.each([
    ["lineup", "home", "Opstelling"],
    ["lineup", "away", "Opstelling"],
    ["match_start", null, "Aftrap"],
    ["half_time", null, "Rust"],
    ["match_end", null, "Eindstand"]
  ] as const)("rendert Royal matchmoment %s/%s", (kind, side, headline) => {
    const html = renderToStaticMarkup(
      <LedScoresMatchOverlay
        overlay={{
          ...overlay,
          design: { ...overlay.design, headline },
          kind,
          lineup: kind === "lineup" ? overlay.lineup : [],
          side
        }}
        theme={royalTheme}
      />
    );

    expect(html).toContain('data-design-revision="royal-current-v8"');
    expect(html).toContain('data-motion-state="off"');
    expect(html).toContain(headline);
    if (side === "home") expect(html).toContain("Thuisteam");
    if (side === "away") expect(html).toContain("Uitteam");
  });

  it("rendert een line-up uitsluitend uit de geselecteerde spelers", () => {
    const html = renderToStaticMarkup(<LedScoresMatchOverlay overlay={overlay} />);
    expect(html).toContain("Opstelling");
    expect(html).toContain("D. Jansen");
    expect(html).toContain("M. de Wit");
    expect(html).toContain('data-template="team-grid"');
    expect(html).toContain('data-testid="ledscores-match-overlay"');
    expect(html).toContain('data-logo-position="left"');
    expect(html).toContain('data-logo-scale="medium"');
    expect(html).toContain('data-typography="display"');
  });

  it("rendert een gepubliceerde canvasopstelling via bindings", () => {
    const html = renderToStaticMarkup(
      <LedScoresMatchOverlay overlay={{
        ...overlay,
        design: {
          ...overlay.design,
          headline: "Alleen legacy opstelling",
          secondaryText: "Alleen legacy subtekst"
        },
        scene: createDefaultLedScoresCanvasExperience().scenes.lineupHome
      }} />
    );
    expect(html).toContain('data-testid="ledscores-match-canvas"');
    expect(html).toContain("D. Jansen");
    expect(html).toContain("Duindorp sv 1");
    expect(html).toContain("Onze opstelling");
    expect(html).not.toContain("Alleen legacy");
    expect(html).not.toContain('data-testid="ledscores-match-overlay"');
  });

  it("valt bij een mislukte canvasachtergrond terug op de vaste matchoverlay", () => {
    const mediaAssetId = "66666666-6666-4666-8666-666666666666";
    const defaults = createDefaultLedScoresCanvasExperience().scenes.lineupHome;
    const scene = {
      ...defaults,
      landscape: {
        ...defaults.landscape,
        background: {
          focusX: 0.5,
          focusY: 0.5,
          kind: "media" as const,
          mediaAssetId,
          objectFit: "cover" as const,
          overlayColor: "#0a0a0a",
          overlayOpacity: 0.25
        }
      }
    };
    const assets = new Map<string, LedScoresOverlayAsset>([[mediaAssetId, {
      checksum: "a".repeat(64),
      mediaAssetId,
      mimeType: "video/mp4",
      url: "https://storage.test/failed-match-background.mp4"
    }]]);
    const html = renderToStaticMarkup(
      <LedScoresMatchOverlayContent
        canvasBackgroundFailed
        lineupPagination={{
          pageCount: 1,
          pageIndex: 0,
          players: overlay.lineup
        }}
        onCanvasBackgroundError={() => undefined}
        overlay={{ ...overlay, assets, scene }}
      />
    );

    expect(html).toContain('data-testid="ledscores-match-overlay"');
    expect(html).not.toContain('data-testid="ledscores-match-canvas"');
    expect(html).toContain("Opstelling");
    expect(html).toContain("D. Jansen");
  });

  it("verbergt de score zonder teamidentiteit te verliezen", () => {
    const momentHtml = renderToStaticMarkup(
      <LedScoresMatchOverlay overlay={{
        ...overlay,
        design: { ...overlay.design, showPreviousScore: false },
        kind: "match_start",
        lineup: [],
        side: null
      }} />
    );
    expect(momentHtml).toContain("Duindorp sv 1 tegen Bezoekers");
    expect(momentHtml).not.toContain("Stand Duindorp sv 1");
  });

  it("pagineert een liggende opstelling op elf spelers zonder overflow", () => {
    const pagedOverlay: ActiveLedScoresMatchOverlay = {
      ...overlay,
      lineup: Array.from({ length: 12 }, (_, index) => ({
        id: `p-${index + 1}`,
        name: `Speler ${index + 1}`,
        number: String(index + 1),
        photoUrl: null
      }))
    };
    const html = renderToStaticMarkup(
      <LedScoresMatchOverlay overlay={pagedOverlay} />
    );
    expect(html).toContain("Speler 11");
    expect(html).not.toContain("Speler 12");
    expect(html).toContain("Pagina 1 van 2");
  });

  it("onderschept de immutable live-match slide in de gewone playlist-renderer", () => {
    const html = renderToStaticMarkup(
      <DynamicTemplateMedia
        item={{
          durationSeconds: 10,
          dynamicTemplate: {
            data: {
              liveMatch: {
                configuration: {
                  outsideMatchBehavior: "last_known",
                  showClock: true,
                  showTimeline: true,
                  template: "match_center",
                  timelineLimit: 5
                },
                connectionId: state.connectionId,
                connectionName: "Duindorp live",
                state: {
                  ...state,
                  sourceUpdatedAt: new Date(state.sourceUpdatedAt).toISOString(),
                  staleAfter: new Date(state.staleAfter).toISOString(),
                  stateRevision: state.revision
                }
              },
              themePresentation: frozenThemeSnapshot,
              type: "ledscores_live_match"
            },
            orientation: "landscape",
            schemaVersion: 1,
            slideType: "ledscores_live_match",
            snapshotHash: "a".repeat(64),
            snapshotId: "44444444-4444-4444-8444-444444444444",
            templateSlug: "ledscores-live-match-landscape",
            templateVersionId: "55555555-5555-4555-8555-555555555555"
          },
          id: "live-match-item",
          title: "Live wedstrijd"
        }}
        onEnded={() => undefined}
        onReady={() => undefined}
      />
    );
    expect(html).toContain('data-testid="ledscores-live-match-slide"');
    expect(html).toContain('data-design-revision="royal-current-v8"');
    expect(html).toContain('--bg:#0a1124');
    expect(html).toContain("Duindorp live");
  });
});

const frozenThemeSnapshot = freezeThemePresentation({
  appearance: createRoyalCurrentAppearance(),
  instant: "2026-09-09T12:00:00.000Z",
  selection: {
    accent: "#2459ED",
    categoryOverrides: [],
    modePolicy: { kind: "fixed", mode: "dark" },
    ref: { catalog: "v2", id: "fieldflow", version: "1.0.0" },
    support: null
  },
  settingsRevision: 8,
  timezone: "Europe/Amsterdam"
});

const state: LedScoresMatchState = {
  away: { logoUrl: null, name: "Bezoekers", score: 1 },
  clock: {
    anchorAt: "2026-08-31T18:00:00.000Z",
    anchorSeconds: 55,
    direction: "up",
    maxSeconds: 5_400,
    running: true
  },
  connectionId: "11111111-1111-4111-8111-111111111111",
  home: { logoUrl: null, name: "Duindorp sv 1", score: 2 },
  matchKey: "match-1",
  periodLabel: "Eerste helft",
  revision: "4",
  schemaVersion: 1,
  sequence: 4,
  serverTimeOffsetMs: null,
  sourceUpdatedAt: "2026-08-31T18:00:00.000Z",
  staleAfter: "2026-08-31T18:01:00.000Z",
  status: "live",
  timeline: [{
    awayScore: 1,
    clockLabel: "27'",
    homeScore: 2,
    id: "goal-2",
    kind: "goal",
    label: "Goal Duindorp sv 1",
    occurredAt: "2026-08-31T17:59:00.000Z",
    playerName: "D. Jansen",
    side: "home"
  }]
};

const config: LedScoresLiveMatchConfig = {
  accentMode: "contrast",
  connectionId: state.connectionId,
  fallbackState: null,
  outsideMatchBehavior: "last_known",
  showClock: true,
  showStatus: true,
  showTimeline: true,
  template: "match_center",
  timelineLimit: 5,
  title: "Duindorp live"
};

const overlay: ActiveLedScoresMatchOverlay = {
  assets: new Map(),
  away: state.away,
  deliveryId: "22222222-2222-4222-8222-222222222222",
  design: {
    animation: "impact",
    headline: "Opstelling",
    logoPosition: "left",
    logoScale: "medium",
    palette: "ink-black",
    secondaryText: "",
    showClock: false,
    showPreviousScore: false,
    showScorer: true,
    templateId: "team-grid",
    typography: "display"
  },
  durationMs: 9_000,
  eventId: "33333333-3333-4333-8333-333333333333",
  eventKind: "live",
  home: state.home,
  kind: "lineup",
  lineup: [
    { id: "p-10", name: "D. Jansen", number: "10", photoUrl: null },
    { id: "p-11", name: "M. de Wit", number: "11", photoUrl: null }
  ],
  lineupPageDurationMs: 6_000,
  matchClock: null,
  periodLabel: null,
  scene: null,
  side: "home",
  underlayPolicy: "pause"
};

const royalTheme: FrozenPlayerTheme = {
  designRevision: "royal-current-v8",
  mode: "dark",
  motionEnabled: false,
  snapshot: {} as FrozenPlayerTheme["snapshot"],
  style: {
    "--accent": "#6a8ef3",
    "--bg": "#0a1124",
    "--ink": "#f5f7fb"
  } as FrozenPlayerTheme["style"]
};
