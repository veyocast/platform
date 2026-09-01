import { describe, expect, it } from "vitest";

import { createDefaultLedScoresCanvasExperience } from "@veyocast/contracts";

import {
  chooseLatestLedScoresMatchState,
  formatLedScoresClock,
  isLedScoresMatchStateStale,
  ledScoresMatchServerNow,
  parseLedScoresCanvasScenePair,
  parseLedScoresGoalEnrichmentMessage,
  parseLedScoresLiveMatchConfig,
  parseLedScoresMatchOverlayMessage,
  parseLedScoresMatchStateMessage,
  parseLedScoresOverlayAssets,
  readStoredLedScoresMatchStates,
  resolveLedScoresClockSeconds,
  writeStoredLedScoresMatchStates
} from "./ledscores-match-experience";

const connectionId = "11111111-1111-4111-8111-111111111111";
const deliveryId = "22222222-2222-4222-8222-222222222222";
const eventId = "33333333-3333-4333-8333-333333333333";
const logoId = "44444444-4444-4444-8444-444444444444";

describe("LED Scores match experience contract", () => {
  it("valideert beide canvasoriëntaties en valt veilig terug bij een ongeldige pair", () => {
    const pair = createDefaultLedScoresCanvasExperience().scenes.lineupHome;
    expect(parseLedScoresCanvasScenePair(pair)).toEqual(pair);
    expect(parseLedScoresCanvasScenePair({
      landscape: pair.landscape,
      portrait: pair.landscape
    })).toBeNull();

    const missingAssetPair = structuredClone(pair);
    missingAssetPair.landscape.background = {
      focusX: 0.5,
      focusY: 0.5,
      kind: "media",
      mediaAssetId: "99999999-9999-4999-8999-999999999999",
      objectFit: "cover",
      overlayColor: "#0a0a0a",
      overlayOpacity: 0.2
    };
    expect(parseLedScoresCanvasScenePair(missingAssetPair)).toBeNull();
    const signedAssets = parseLedScoresOverlayAssets([{
      checksum: "a".repeat(64),
      mediaAssetId: "99999999-9999-4999-8999-999999999999",
      mimeType: "video/mp4",
      url: "https://storage.test/signed-background.mp4"
    }]);
    expect(parseLedScoresCanvasScenePair(missingAssetPair, signedAssets))
      .not.toBeNull();
  });

  it("begrensd de signed immutable assetmap op 24 canvasassets", () => {
    const assets = Array.from({ length: 25 }, (_, index) => ({
      checksum: "a".repeat(64),
      mediaAssetId: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
      mimeType: "image/webp",
      url: `https://storage.test/scene-${index}.webp`
    }));
    expect(parseLedScoresOverlayAssets(assets).size).toBe(24);
  });

  it("normaliseert een expliciet geselecteerde thuisopstelling en veilige spelersfoto's", () => {
    const scene = createDefaultLedScoresCanvasExperience().scenes.lineupHome;
    const message = {
      assets: [{
        checksum: "a".repeat(64),
        mediaAssetId: logoId,
        mimeType: "image/webp",
        url: "https://storage.test/signed-club-logo.webp"
      }],
      executeAt: "2026-08-31T18:00:00.750Z",
      expiresAt: "2026-08-31T18:00:12.000Z",
      id: deliveryId,
      payload: {
        away: { name: "Bezoekers", score: 0, teamKey: "away-key" },
        design: {
          logoPosition: "center",
          logoScale: "large",
          showPreviousScore: true,
          showScorer: false,
          template: "team-grid",
          typography: "body"
        },
        durationMs: 9_000,
        eventId,
        home: { name: "Duindorp sv 1", score: 0, teamKey: "home-key" },
        lineup: [
          {
            id: "led-player-10",
            name: "D. Jansen",
            number: 10,
            photoUrl: "https://storage.test/signed-player.webp"
          },
          {
            id: "led-player-11",
            name: "M. de Wit",
            number: "11",
            photoUrl: "javascript:alert(1)"
          }
        ],
        lineupPageDurationMs: 5_000,
        logoMediaAssetId: logoId,
        ownTeamKeys: ["home-key", "away-key"],
        overlayKind: "lineup",
        scene,
        side: "home"
      },
      serverTime: "2026-08-31T18:00:00.000Z"
    };
    const parsed = parseLedScoresMatchOverlayMessage(message);

    expect(parsed?.overlay).toMatchObject({
      design: {
        logoPosition: "center",
        logoScale: "large",
        showPreviousScore: false,
        showScorer: true,
        templateId: "team-grid",
        typography: "body"
      },
      kind: "lineup",
      lineupPageDurationMs: 5_000,
      side: "home",
      scene,
      underlayPolicy: "pause"
    });
    expect(parsed?.overlay.lineup).toEqual([
      expect.objectContaining({ name: "D. Jansen", number: "10", photoUrl: "https://storage.test/signed-player.webp" }),
      expect.objectContaining({ name: "M. de Wit", number: "11", photoUrl: null })
    ]);
    expect(parsed?.overlay.home.logoUrl).toBe("https://storage.test/signed-club-logo.webp");
    expect(parsed?.overlay.away.logoUrl).toBe("https://storage.test/signed-club-logo.webp");
    expect(parseLedScoresMatchOverlayMessage({ ...message, assets: [] })
      ?.overlay.home.logoUrl).toBeNull();
  });

  it("weigert een line-up zonder zijde of zonder expliciete selectie", () => {
    const base = {
      executeAt: "2026-08-31T18:00:00.750Z",
      expiresAt: "2026-08-31T18:00:12.000Z",
      id: deliveryId,
      payload: {
        awayTeam: "Bezoekers",
        awayScore: 0,
        durationMs: 9_000,
        eventId,
        homeTeam: "Duindorp sv 1",
        homeScore: 0,
        overlayKind: "lineup"
      },
      serverTime: "2026-08-31T18:00:00.000Z"
    };
    expect(parseLedScoresMatchOverlayMessage(base)).toBeNull();
    expect(parseLedScoresMatchOverlayMessage({
      ...base,
      payload: { ...base.payload, lineup: [], side: "away" }
    })).toBeNull();
  });

  it("normaliseert late doelpuntenmakerverrijking zonder provider-URL toe te laten", () => {
    const parsed = parseLedScoresGoalEnrichmentMessage({
      executeAt: "2026-08-31T18:00:01.200Z",
      expiresAt: "2026-08-31T18:00:10.000Z",
      id: deliveryId,
      payload: {
        eventId,
        player: {
          id: "player-10",
          name: "D. Jansen",
          number: 10,
          photoUrl: "https://storage.test/signed-player.webp"
        },
        sequence: 3
      },
      serverTime: "2026-08-31T18:00:01.100Z"
    });
    expect(parsed?.player).toEqual({
      id: "player-10",
      name: "D. Jansen",
      number: "10",
      photoUrl: "https://storage.test/signed-player.webp"
    });
    expect(parsed?.sequence).toBe(3);
  });

  it("leest de begrensde live state en bevriest een lopende klok op staleAfter", () => {
    const state = parseLedScoresMatchStateMessage(matchState());
    expect(state).not.toBeNull();
    expect(state?.timeline).toHaveLength(2);
    expect(resolveLedScoresClockSeconds(
      state?.clock ?? null,
      Date.parse("2026-08-31T18:00:30.000Z"),
      state?.staleAfter
    )).toBe(75);
    expect(formatLedScoresClock(75)).toBe("01:15");
  });

  it("ankert stale en wedstrijdklok op servertijd bij een scheve deviceklok", () => {
    const skewedClientNow = Date.parse("2036-08-31T18:00:10.000Z");
    const state = parseLedScoresMatchStateMessage({
      serverTime: "2026-08-31T18:00:10.000Z",
      state: matchState()
    }, skewedClientNow);
    if (!state) throw new Error("Expected match state");
    expect(ledScoresMatchServerNow(state, skewedClientNow)).toBe(
      Date.parse("2026-08-31T18:00:10.000Z")
    );
    expect(isLedScoresMatchStateStale(state, skewedClientNow)).toBe(false);
    expect(resolveLedScoresClockSeconds(
      state.clock,
      ledScoresMatchServerNow(state, skewedClientNow),
      state.staleAfter
    )).toBe(55);

    const persisted = parseLedScoresMatchStateMessage(state, skewedClientNow + 5_000);
    expect(persisted?.serverTimeOffsetMs).toBe(state.serverTimeOffsetMs);
    expect(isLedScoresMatchStateStale(persisted!, skewedClientNow + 25_000)).toBe(true);
  });

  it("accepteert provider-matchsleutels tot de databasegrens van 300 tekens", () => {
    const matchKey = `match:${"x".repeat(250)}`;
    expect(parseLedScoresMatchStateMessage(matchState({ matchKey }))?.matchKey)
      .toBe(matchKey);
  });

  it("kiest geen oudere state over een recentere revision", () => {
    const latest = parseLedScoresMatchStateMessage(matchState())!;
    const older = parseLedScoresMatchStateMessage(matchState({
      sourceUpdatedAt: "2026-08-31T17:59:59.000Z",
      stateRevision: 99
    }))!;
    expect(chooseLatestLedScoresMatchState(latest, older)).toBe(latest);
  });

  it("bewaart alleen geldige, recente last-known states per verbinding", () => {
    const memory = new Map<string, string>();
    const storage = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => { memory.set(key, value); }
    };
    const state = parseLedScoresMatchStateMessage(matchState())!;
    expect(writeStoredLedScoresMatchStates(storage, [state])).toBe(true);
    expect(readStoredLedScoresMatchStates(
      storage,
      Date.parse("2026-09-01T12:00:00.000Z")
    )).toEqual([state]);
    expect(readStoredLedScoresMatchStates(
      storage,
      Date.parse("2026-09-10T12:00:00.000Z")
    )).toEqual([]);
  });

  it("leest de immutable live-slideconfig en gekoppelde fallbackstate", () => {
    const config = parseLedScoresLiveMatchConfig({
      liveMatch: {
        connectionId,
        accentMode: "neutral",
        outsideMatchBehavior: "last_known",
        showClock: true,
        showTimeline: true,
        state: matchState(),
        template: "match_center",
        timelineLimit: 4,
        title: "Duindorp live"
      }
    });
    expect(config).toMatchObject({
      accentMode: "neutral",
      connectionId,
      fallbackState: expect.objectContaining({ matchKey: "match-2026-08-31" }),
      template: "match_center",
      timelineLimit: 4,
      title: "Duindorp live"
    });
  });
});

function matchState(overrides: Record<string, unknown> = {}) {
  return {
    away: { name: "Bezoekers", score: 1 },
    clock: {
      anchorAt: "2026-08-31T18:00:00.000Z",
      anchorSeconds: 45,
      direction: "up",
      maxSeconds: 5_400,
      running: true
    },
    connectionId,
    home: { name: "Duindorp sv 1", score: 2 },
    matchKey: "match-2026-08-31",
    periodLabel: "Eerste helft",
    schemaVersion: 1,
    sourceUpdatedAt: "2026-08-31T18:00:00.000Z",
    staleAfter: "2026-08-31T18:00:30.000Z",
    stateRevision: 4,
    status: "live",
    timeline: [
      {
        awayScore: 0,
        clockLabel: "12'",
        homeScore: 1,
        id: "goal-1",
        kind: "goal",
        label: "Goal Duindorp sv 1",
        occurredAt: "2026-08-31T17:45:00.000Z",
        playerName: "M. de Wit",
        side: "home"
      },
      {
        awayScore: 1,
        clockLabel: "27'",
        homeScore: 2,
        id: "goal-2",
        kind: "goal",
        label: "Goal Duindorp sv 1",
        occurredAt: "2026-08-31T17:59:00.000Z",
        playerName: "D. Jansen",
        side: "home"
      }
    ],
    ...overrides
  };
}
