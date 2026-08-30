import { describe, expect, it } from "vitest";

import {
  ledScoresScoringTeam,
  parseGoalMessage,
  parseSseBlock
} from "./ledscores-goal-overlay";

const deliveryId = "11111111-1111-4111-8111-111111111111";
const eventId = "22222222-2222-4222-8222-222222222222";
const mediaAssetId = "33333333-3333-4333-8333-333333333333";

describe("LED Scores Player protocol", () => {
  it("normaliseert een begrensd doelpuntbericht en alleen veilige signed media", () => {
    const parsed = parseGoalMessage(goalMessage({
      assets: [
        {
          checksum: "a".repeat(64),
          mediaAssetId,
          mimeType: "video/mp4",
          url: "https://storage.test/signed-goal.mp4"
        },
        {
          checksum: "b".repeat(64),
          mediaAssetId: "44444444-4444-4444-8444-444444444444",
          mimeType: "text/html",
          url: "javascript:alert(1)"
        }
      ]
    }));

    expect(parsed).not.toBeNull();
    expect(parsed?.goal).toMatchObject({
      awayScore: 1,
      durationMs: 8_000,
      eventId,
      homeScore: 2,
      mediaAssetId,
      scoringSide: "own",
      underlayPolicy: "pause"
    });
    expect(parsed?.goal.assets.size).toBe(1);
  });

  it("weigert onvolledige, te lange of ongeldige realtime payloads", () => {
    expect(parseGoalMessage({ payload: {} })).toBeNull();
    expect(parseGoalMessage(goalMessage({ payload: { durationMs: 60_000 } }))).toBeNull();
    expect(parseGoalMessage(goalMessage({ payload: { scoringSide: "third-party" } }))).toBeNull();
    expect(parseGoalMessage(goalMessage({ payload: { scoringSide: "unknown" } }))?.goal)
      .toMatchObject({ scoringSide: "unknown", soundVolume: 70 });
  });

  it("leidt de scorende ploeg af uit de scoredelta, ook wanneer het eigen team uit speelt", () => {
    expect(ledScoresScoringTeam({
      awayScore: 2,
      awayTeam: "Duindorp sv 1",
      homeScore: 1,
      homeTeam: "Tegenstander",
      previousAwayScore: 1,
      previousHomeScore: 1,
      scoringSide: "own"
    })).toBe("Duindorp sv 1");
  });

  it("parseert complete SSE-blokken en negeert keepalives of kapotte JSON", () => {
    expect(parseSseBlock('event: goal\ndata: {"ok":true}')).toEqual({
      event: "goal",
      value: { ok: true }
    });
    expect(parseSseBlock(": keepalive 1")).toBeNull();
    expect(parseSseBlock("event: goal\ndata: {")).toBeNull();
    expect(parseSseBlock("event: Goal!\ndata: {}" )).toBeNull();
  });
});

function goalMessage(overrides: {
  assets?: unknown[];
  payload?: Record<string, unknown>;
} = {}) {
  return {
    assets: overrides.assets ?? [],
    executeAt: "2026-08-30T12:00:00.750Z",
    expiresAt: "2026-08-30T12:00:10.750Z",
    id: deliveryId,
    payload: {
      awayScore: 1,
      awayTeam: "Uitteam",
      design: {
        animation: "impact",
        headline: "GOAL!",
        logoPosition: "left",
        palette: "electric-orange",
        scorerFallback: "Doelpunt!",
        secondaryText: "Voor de club",
        showClock: true,
        showPreviousScore: true,
        showScorer: true,
        typography: "display"
      },
      durationMs: 8_000,
      eventId,
      eventKind: "live",
      homeScore: 2,
      homeTeam: "Duindorp sv 1",
      mediaAssetId,
      previousAwayScore: 1,
      previousHomeScore: 1,
      scoringSide: "own",
      underlayPolicy: "pause",
      ...overrides.payload
    },
    serverTime: "2026-08-30T12:00:00.000Z"
  };
}
