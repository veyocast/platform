import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type {
  ActiveLedScoresMatchOverlay,
  LedScoresLiveMatchConfig,
  LedScoresMatchState
} from "../_lib/ledscores-match-experience";
import {
  LedScoresLiveMatchSlide,
  LedScoresMatchOverlay
} from "./ledscores-match-experience";
import { DynamicTemplateMedia } from "./dynamic-template-media";

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
    expect(html).toContain("Duindorp live");
  });
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
  side: "home",
  underlayPolicy: "pause"
};
