import { describe, expect, it } from "vitest";

import {
  classifyScheduledGoal,
  drainTerminalAcknowledgementQueue,
  isGoalEnrichmentExpiredAtServerTime,
  ledScoresScoringTeam,
  parseGoalMessage,
  parseSseBlock,
  parseTerminalAcknowledgements,
  runLedScoresRealtimeConnectionLoop,
  scheduledGoalEnrichmentCompletion,
  shouldApplyGoalEnrichmentSequence
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
