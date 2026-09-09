import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  compileLedScoresCanvasScene,
  createDefaultLedScoresCanvasExperience
} from "@veyocast/contracts";

import {
  classifyScheduledGoal,
  drainTerminalAcknowledgementQueue,
  enrichGoal,
  goalCanvasValues,
  isGoalEnrichmentExpiredAtServerTime,
  LedScoresGoalOverlay,
  LedScoresGoalOverlayContent,
  ledScoresScoringTeam,
  parseGoalMessage,
  parseSseBlock,
  parseTerminalAcknowledgements,
  runLedScoresRealtimeConnectionLoop,
  scheduledGoalEnrichmentCompletion,
  shouldApplyGoalEnrichmentSequence
} from "./ledscores-goal-overlay";
import type { FrozenPlayerTheme } from "./player-presentation-theme";

const deliveryId = "11111111-1111-4111-8111-111111111111";
const eventId = "22222222-2222-4222-8222-222222222222";
const mediaAssetId = "33333333-3333-4333-8333-333333333333";
const sponsorMediaAssetId = "44444444-4444-4444-8444-444444444444";
const soundMediaAssetId = "55555555-5555-4555-8555-555555555555";

describe("LED Scores Player protocol", () => {
  it.each([
    ["own", 2, 1, 1, 1, "Doelpunt voor eigen team"],
    ["opponent", 1, 2, 1, 1, "Doelpunt tegenstander"],
    ["unknown", 2, 1, 1, 1, "Doelpunt van onbekend team"]
  ] as const)(
    "rendert Royal goalmoment %s met de bevroren authority",
    (scoringSide, homeScore, awayScore, previousHomeScore, previousAwayScore, label) => {
      const parsed = parseGoalMessage(goalMessage({
        payload: {
          awayScore,
          homeScore,
          previousAwayScore,
          previousHomeScore,
          scoringSide
        }
      }));
      if (!parsed) throw new Error("Expected Royal goal moment");

      const html = renderToStaticMarkup(createElement(LedScoresGoalOverlay, {
        goal: parsed.goal,
        theme: royalTheme
      }));

      expect(html).toContain(`data-scoring-side="${scoringSide}"`);
      expect(html).toContain('data-design-revision="royal-current-v8"');
      expect(html).toContain('data-motion-state="off"');
      expect(html).toContain('--bg:#0a1124');
      expect(html).toContain(label);
    }
  );

  it("behoudt de legacy-goal bij een ongeldige scene en accepteert een geldige pair", () => {
    const pair = createDefaultLedScoresCanvasExperience().scenes.goalOwn;
    const valid = parseGoalMessage(goalMessage({ payload: { scene: pair } }));
    const invalid = parseGoalMessage(goalMessage({
      payload: {
        scene: { landscape: pair.landscape, portrait: pair.landscape }
      }
    }));
    expect(valid?.goal.scene).toEqual(pair);
    expect(invalid?.goal).not.toBeNull();
    expect(invalid?.goal.scene).toBeNull();
  });

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

  it.each([
    ["own", 2, 1, 1, 1, { awayLogo: null, homeLogo: "https://storage.test/club.webp", scoringTeamLogo: "https://storage.test/club.webp" }],
    ["own", 1, 2, 1, 1, { awayLogo: "https://storage.test/club.webp", homeLogo: null, scoringTeamLogo: "https://storage.test/club.webp" }],
    ["opponent", 2, 1, 1, 1, { awayLogo: "https://storage.test/club.webp", homeLogo: null, scoringTeamLogo: null }],
    ["opponent", 1, 2, 1, 1, { awayLogo: null, homeLogo: "https://storage.test/club.webp", scoringTeamLogo: null }]
  ] as const)(
    "koppelt het eigen clublogo veilig bij %s met stand %i-%i",
    (scoringSide, homeScore, awayScore, previousHomeScore, previousAwayScore, expected) => {
      const parsed = parseGoalMessage(goalMessage({
        payload: {
          awayScore,
          homeScore,
          previousAwayScore,
          previousHomeScore,
          scoringSide
        }
      }));
      if (!parsed) throw new Error("Expected canvas goal");

      expect(goalCanvasValues(
        parsed.goal,
        undefined,
        "https://storage.test/club.webp"
      ).images).toMatchObject(expected);
    }
  );

  it.each([
    ["own", "live", "DOELPUNT"],
    ["opponent", "live", "TEGENDOELPUNT"],
    ["unknown", "live", "DOELPUNT"],
    ["opponent", "synthetic_test", "LIVE-TEST · TEGENDOELPUNT"]
  ] as const)(
    "bindt voor %s/%s het juiste wedstrijdlabel",
    (scoringSide, eventKind, expected) => {
      const parsed = parseGoalMessage(goalMessage({
        payload: { eventKind, scoringSide }
      }));
      if (!parsed) throw new Error("Expected canvas goal");

      expect(goalCanvasValues(parsed.goal).text.eventLabel).toBe(expected);
    }
  );

  it("laat canvasinhoud winnen van legacy-copy en gebruikt alleen echte scorerdata", () => {
    const pair = createDefaultLedScoresCanvasExperience().scenes.goalOwn;
    const parsed = parseGoalMessage(goalMessage({ payload: { scene: pair } }));
    if (!parsed) throw new Error("Expected canvas goal");
    const goal = {
      ...parsed.goal,
      design: {
        ...parsed.goal.design,
        headline: "ALLEEN LEGACY HEADLINE",
        scorerFallback: "ALLEEN LEGACY SCORER",
        secondaryText: "ALLEEN LEGACY SUBTEKST"
      },
      player: null,
      scorerName: null
    };
    const resolvedText = compileLedScoresCanvasScene(
      pair.landscape,
      goalCanvasValues(goal)
    ).flatMap((layer) => layer.type === "text" ? [layer.resolvedText] : []);

    expect(resolvedText).toContain("GOAAAL!");
    expect(resolvedText).toContain("D. Jansen");
    expect(resolvedText.join(" ")).not.toContain("ALLEEN LEGACY");
    expect(goalCanvasValues(goal).text.scorerName).toBeUndefined();
  });

  it("toont de sponsorbadge ook boven een moderne canvasscene", () => {
    const pair = createDefaultLedScoresCanvasExperience().scenes.goalOwn;
    const parsed = parseGoalMessage(goalMessage({
      assets: [{
        checksum: "c".repeat(64),
        mediaAssetId: sponsorMediaAssetId,
        mimeType: "image/webp",
        url: "https://storage.test/sponsor.webp"
      }],
      payload: {
        scene: pair,
        sponsorMediaAssetId
      }
    }));
    if (!parsed) throw new Error("Expected canvas goal");

    const html = renderToStaticMarkup(createElement(LedScoresGoalOverlay, {
      goal: parsed.goal
    }));

    expect(html).toContain('data-testid="ledscores-goal-canvas"');
    expect(html).toContain('data-testid="ledscores-goal-sponsor"');
    expect(html).toContain("canvasSponsor");
    expect(html).toContain("https://storage.test/sponsor.webp");
  });

  it("valt bij een mislukte canvasachtergrond terug op de vaste goaloverlay", () => {
    const defaults = createDefaultLedScoresCanvasExperience().scenes.goalOwn;
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
    const parsed = parseGoalMessage(goalMessage({
      assets: [
        {
          checksum: "a".repeat(64),
          mediaAssetId,
          mimeType: "video/mp4",
          url: "https://storage.test/failed-canvas-background.mp4"
        },
        {
          checksum: "b".repeat(64),
          mediaAssetId: sponsorMediaAssetId,
          mimeType: "image/webp",
          url: "https://storage.test/sponsor.webp"
        },
        {
          checksum: "c".repeat(64),
          mediaAssetId: soundMediaAssetId,
          mimeType: "video/mp4",
          url: "https://storage.test/goal-sound.mp4"
        }
      ],
      payload: {
        scene,
        soundMediaAssetId,
        sponsorMediaAssetId
      }
    }));
    if (!parsed) throw new Error("Expected canvas goal");

    const html = renderToStaticMarkup(createElement(
      LedScoresGoalOverlayContent,
      {
        canvasBackgroundFailed: true,
        goal: parsed.goal,
        onCanvasBackgroundError: () => undefined
      }
    ));

    expect(html).toContain('data-testid="ledscores-goal-overlay"');
    expect(html).not.toContain('data-testid="ledscores-goal-canvas"');
    expect(html).toContain("GOAL!");
    expect(html).toContain("https://storage.test/sponsor.webp");
    expect(html).toContain("https://storage.test/goal-sound.mp4");
  });

  it("parseert complete SSE-blokken en negeert keepalives of kapotte JSON", () => {
    expect(parseSseBlock('event: goal\ndata: {"ok":true}')).toEqual({
      event: "goal",
      value: { ok: true }
    });
    expect(parseSseBlock('event: match_state\ndata: {"ok":true}')).toEqual({
      event: "match_state",
      value: { ok: true }
    });
    expect(parseSseBlock(": keepalive 1")).toBeNull();
    expect(parseSseBlock("event: goal\ndata: {")).toBeNull();
    expect(parseSseBlock("event: Goal!\ndata: {}" )).toBeNull();
  });

  it("probeert na een tijdelijke 204 met begrensde back-off opnieuw", async () => {
    const statuses = [204, 204, 204, 204, 204, 204, 204, 401];
    const delays: number[] = [];
    let requests = 0;

    await runLedScoresRealtimeConnectionLoop({
      fetchStream: async () => {
        const status = statuses[requests] ?? 401;
        requests += 1;
        return new Response(null, { status });
      },
      onEvent: () => undefined,
      random: () => 0,
      signal: new AbortController().signal,
      token: "a".repeat(32),
      wait: async (milliseconds) => {
        delays.push(milliseconds);
      }
    });

    expect(requests).toBe(8);
    expect(delays).toEqual([1_000, 2_000, 4_000, 8_000, 16_000, 30_000, 30_000]);
  });

  it("spreidt ook retries die de maximale back-off hebben bereikt", async () => {
    const statuses = [204, 204, 204, 204, 204, 204, 204, 401];
    const delays: number[] = [];
    let requests = 0;

    await runLedScoresRealtimeConnectionLoop({
      fetchStream: async () => {
        const status = statuses[requests] ?? 401;
        requests += 1;
        return new Response(null, { status });
      },
      onEvent: () => undefined,
      random: () => 0.5,
      signal: new AbortController().signal,
      token: "a".repeat(32),
      wait: async (milliseconds) => {
        delays.push(milliseconds);
      }
    });

    expect(delays.slice(-2)).toEqual([29_750, 29_750]);
  });

  it("classificeert een geplande delivery voordat een nieuwe goal de timer vervangt", () => {
    const first = {
      deliveryId: "11111111-1111-4111-8111-111111111111",
      eventId: "22222222-2222-4222-8222-222222222222"
    };

    expect(classifyScheduledGoal(null, first)).toBe("schedule");
    expect(classifyScheduledGoal(first, first)).toBe("same_delivery");
    expect(classifyScheduledGoal(first, {
      deliveryId: "33333333-3333-4333-8333-333333333333",
      eventId: first.eventId
    })).toBe("same_event");
    expect(classifyScheduledGoal(first, {
      deliveryId: "44444444-4444-4444-8444-444444444444",
      eventId: "55555555-5555-4555-8555-555555555555"
    })).toBe("replace");
  });

  it("houdt scorerrevisies monotone en bevestigt vooraf toegepaste verrijking terminaal", () => {
    const enrichment = {
      deliveryId: "44444444-4444-4444-8444-444444444444",
      eventId,
      executeAt: "2026-08-31T18:00:01.000Z",
      expiresAt: "2026-08-31T18:01:00.000Z",
      player: {
        id: "player-10",
        name: "D. Jansen",
        number: "10",
        photoUrl: null
      },
      sequence: 2,
      serverTime: "2026-08-31T18:00:02.000Z"
    };

    expect(shouldApplyGoalEnrichmentSequence(null, 2)).toBe(true);
    expect(shouldApplyGoalEnrichmentSequence(2, 1)).toBe(false);
    expect(shouldApplyGoalEnrichmentSequence(2, 2)).toBe(false);
    expect(isGoalEnrichmentExpiredAtServerTime(
      enrichment,
      Date.parse("2036-08-31T18:00:00.000Z")
    )).toBe(false);
    expect(isGoalEnrichmentExpiredAtServerTime({
      ...enrichment,
      serverTime: "2026-08-31T18:01:01.000Z"
    }, Date.parse("2016-08-31T18:00:00.000Z"))).toBe(true);
    expect(scheduledGoalEnrichmentCompletion(enrichment)).toMatchObject({
      delivery: enrichment,
      detail: "scheduled_goal_enriched",
      status: "rendered"
    });

    const pair = createDefaultLedScoresCanvasExperience().scenes.goalOwn;
    const parsed = parseGoalMessage(goalMessage({ payload: { scene: pair } }));
    if (!parsed) throw new Error("Expected canvas goal");
    const enriched = enrichGoal(parsed.goal, enrichment.player);
    expect(enriched.scene).toBe(parsed.goal.scene);
    expect(goalCanvasValues(enriched).text).toMatchObject({
      scorerName: "D. Jansen",
      scorerNumber: "#10"
    });
  });

  it("leest de gedeelde terminale ACK-outbox begrensd en first-terminal-wins", () => {
    const now = Date.parse("2026-08-31T18:30:00.000Z");
    const first = {
      createdAt: now - 1_000,
      deliveryId: "11111111-1111-4111-8111-111111111111",
      detail: "render_latency_ms:12",
      eventId: "22222222-2222-4222-8222-222222222222",
      expiresAt: now - 500,
      status: "rendered"
    };

    expect(parseTerminalAcknowledgements([
      first,
      { ...first, status: "skipped" },
      {
        ...first,
        createdAt: now - 8 * 24 * 60 * 60 * 1_000,
        deliveryId: "33333333-3333-4333-8333-333333333333"
      },
      { ...first, deliveryId: "44444444-4444-4444-8444-444444444444", status: "received" }
    ], now)).toEqual([first]);
  });

  it("leegt 200 succesvolle terminale ACKs zonder paginering als retry te tellen", async () => {
    const queue = Array.from({ length: 200 }, (_, index) => terminalAcknowledgement(index));
    const retryAttempts: number[] = [];
    let delivered = 0;

    const result = await drainTerminalAcknowledgementQueue({
      deliver: async (entry) => {
        delivered += 1;
        const queuedIndex = queue.findIndex((candidate) => candidate.deliveryId === entry.deliveryId);
        queue.splice(queuedIndex, 1);
        return "done";
      },
      read: () => [...queue],
      waitForRetry: async (attempt) => {
        retryAttempts.push(attempt);
      }
    });

    expect(result).toBe("done");
    expect(delivered).toBe(200);
    expect(queue).toEqual([]);
    expect(retryAttempts).toEqual([]);
  });

  it("gebruikt back-off alleen voor een echte retry en stopt op credentialfout", async () => {
    const retriedQueue = [terminalAcknowledgement(1)];
    const retryAttempts: number[] = [];
    let deliveryAttempts = 0;

    const retried = await drainTerminalAcknowledgementQueue({
      deliver: async () => {
        deliveryAttempts += 1;
        if (deliveryAttempts === 1) return "retry";
        retriedQueue.pop();
        return "done";
      },
      read: () => [...retriedQueue],
      waitForRetry: async (attempt) => {
        retryAttempts.push(attempt);
      }
    });

    const credentialQueue = [terminalAcknowledgement(2)];
    let credentialAttempts = 0;
    const credential = await drainTerminalAcknowledgementQueue({
      deliver: async () => {
        credentialAttempts += 1;
        return "credential";
      },
      read: () => [...credentialQueue],
      waitForRetry: async () => {
        throw new Error("Credentialfouten mogen geen retry starten");
      }
    });

    expect(retried).toBe("done");
    expect(deliveryAttempts).toBe(2);
    expect(retryAttempts).toEqual([1]);
    expect(credential).toBe("credential");
    expect(credentialAttempts).toBe(1);
    expect(credentialQueue).toHaveLength(1);
  });

  it("annuleert een wachtende 204-retry zonder nog een request te starten", async () => {
    const controller = new AbortController();
    let requests = 0;
    let markWaitStarted: () => void = () => undefined;
    const waitStarted = new Promise<void>((resolve) => {
      markWaitStarted = resolve;
    });

    const connection = runLedScoresRealtimeConnectionLoop({
      fetchStream: async () => {
        requests += 1;
        return new Response(null, { status: 204 });
      },
      onEvent: () => undefined,
      random: () => 0,
      signal: controller.signal,
      token: "a".repeat(32),
      wait: async (_milliseconds, signal) => {
        markWaitStarted();
        if (signal.aborted) return;
        await new Promise<void>((resolve) => {
          signal.addEventListener("abort", () => resolve(), { once: true });
        });
      }
    });

    await waitStarted;
    controller.abort();
    await connection;

    expect(requests).toBe(1);
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

function terminalAcknowledgement(index: number) {
  const now = Date.parse("2026-08-31T18:30:00.000Z");
  return {
    createdAt: now,
    deliveryId: `delivery-${index}`,
    detail: null,
    eventId: `event-${index}`,
    expiresAt: now + 10_000,
    status: "rendered" as const
  };
}

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
