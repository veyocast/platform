import { describe, expect, it, vi } from "vitest";
import { parseLedScoresMessage } from "@veyocast/integrations/server";

import {
  createLedScoresLiveMatchState,
  runLedScoresConnectorLoop,
  SupabaseLedScoresConnectorBackend,
  type ClaimedLedScoresConnection,
  type LedScoresConnectorBackend,
  type LedScoresPlayerSnapshot
} from "../src/ledscores-connector-runner";

const connection: ClaimedLedScoresConnection = {
  clubSlug: "duindorp-sv",
  connectionId: "10000000-0000-4000-8000-000000000001",
  endpointUrl: "wss://wss.ledscores.score.tel/clubs/duindorp-sv/scores/",
  mappings: [
    { side: "own", teamKey: "23603", teamName: "Duindorp SV" },
    { side: "opponent", teamKey: "27753", teamName: "Tegenstander" }
  ],
  tenantId: "20000000-0000-4000-8000-000000000002"
};

function fakeBackend(
  overrides: Partial<LedScoresConnectorBackend> = {}
): LedScoresConnectorBackend {
  return {
    claim: vi.fn(async () => []),
    dispatch: vi.fn(async () => 0),
    dispatchOverlay: vi.fn(async () => 0),
    enrichGoal: vi.fn(async () => 0),
    recordState: vi.fn(async () => true),
    release: vi.fn(async () => true),
    renew: vi.fn(async () => true),
    syncPlayers: vi.fn(async () => []),
    touch: vi.fn(async () => true),
    upsertLiveState: vi.fn(async () => undefined),
    ...overrides
  };
}

describe("LED Scores connector backend", () => {
  it("parses only an allowlisted claimed websocket URL", async () => {
    const client = { rpc: vi.fn().mockResolvedValue({
      data: [{
        club_slug: connection.clubSlug,
        connection_id: connection.connectionId,
        endpoint_url: connection.endpointUrl,
        mappings: connection.mappings.map((mapping) => ({
          side: mapping.side,
          teamKey: mapping.teamKey,
          teamName: mapping.teamName
        })),
        tenant_id: connection.tenantId
      }],
      error: null
    }) };
    const backend = new SupabaseLedScoresConnectorBackend(
      "https://project.supabase.co",
      "service-role",
      client
    );
    await expect(backend.claim("worker:test", 45, 10)).resolves.toEqual([connection]);
    expect(client.rpc).toHaveBeenCalledWith("claim_ledscores_connections_v1", {
      p_lease_seconds: 45,
      p_limit: 10,
      p_worker_id: "worker:test"
    });
  });

  it("rejects a claimed URL that escaped the fixed provider host", async () => {
    const client = { rpc: vi.fn().mockResolvedValue({
      data: [{
        club_slug: connection.clubSlug,
        connection_id: connection.connectionId,
        endpoint_url: "wss://example.invalid/steal",
        mappings: [],
        tenant_id: connection.tenantId
      }],
      error: null
    }) };
    const backend = new SupabaseLedScoresConnectorBackend(
      "https://project.supabase.co",
      "service-role",
      client
    );
    await expect(backend.claim("worker:test", 45, 10))
      .rejects.toThrow(/endpoint/);
  });

  it("uses the dedicated player, state, overlay and scorer RPC contracts", async () => {
    const client = { rpc: vi.fn(async (name: string) => ({
      data: name === "sync_ledscores_players_v1"
        ? { acceptedPlayers: [{ playerKey: "home-7", teamKey: "23603" }] }
        : name === "dispatch_ledscores_match_overlay_v1"
          || name === "enrich_ledscores_goal_v1"
          ? { deliveryCount: 2 }
          : { outcome: "stored" },
      error: null
    })) };
    const backend = new SupabaseLedScoresConnectorBackend(
      "https://project.supabase.co",
      "service-role",
      client
    );
    const sourceObservedAt = "2026-08-31T17:20:00.000Z";
    await expect(backend.syncPlayers({
      connectionId: connection.connectionId,
      players: [{
        active: true,
        name: "Speler Zeven",
        number: 7,
        photoProviderAssetVersionId: null,
        photoSourceUrl: "https://api.ledscores.score.tel/players/home-7.webp",
        playerKey: "home-7",
        teamKey: "23603"
      }],
      sourceObservedAt,
      workerId: "worker:test"
    })).resolves.toEqual([{ playerKey: "home-7", teamKey: "23603" }]);
    await backend.upsertLiveState({
      connectionId: connection.connectionId,
      sourceObservedAt,
      state: { matchKey: "match:wedstrijd-1", schemaVersion: 1 },
      workerId: "worker:test"
    });
    await expect(backend.dispatchOverlay({
      canonicalKey: "a".repeat(64),
      connectionId: connection.connectionId,
      eventType: "match_start",
      payload: { homeTeamKey: "23603", matchKey: "match:wedstrijd-1", schemaVersion: 1 },
      sourceObservedAt,
      sourceUpdateId: "start-1",
      workerId: "worker:test"
    })).resolves.toBe(2);
    await expect(backend.enrichGoal({
      connectionId: connection.connectionId,
      enrichment: {
        canonicalKey: "b".repeat(64),
        goalCanonicalKey: "c".repeat(64),
        matchIdentity: "match:wedstrijd-1",
        resultingScore: 1,
        scoreboardSide: "home",
        scorer: {
          active: true,
          goalImageUrl: null,
          id: "home-7",
          name: "Speler Zeven",
          number: "7"
        },
        scoringTeamKey: "23603",
        sourceObservedAt,
        sourceUpdateId: "scorer-1"
      },
      workerId: "worker:test"
    })).resolves.toBe(2);

    expect(client.rpc).toHaveBeenCalledWith("sync_ledscores_players_v1", {
      p_connection_id: connection.connectionId,
      p_players: [expect.objectContaining({
        photoSourceUrl: "https://api.ledscores.score.tel/players/home-7.webp",
        playerKey: "home-7",
        teamKey: "23603"
      })],
      p_source_observed_at: sourceObservedAt,
      p_worker_id: "worker:test"
    });
    expect(client.rpc).toHaveBeenCalledWith("upsert_ledscores_live_match_state_v1", {
      p_connection_id: connection.connectionId,
      p_source_observed_at: sourceObservedAt,
      p_state: { matchKey: "match:wedstrijd-1", schemaVersion: 1 },
      p_worker_id: "worker:test"
    });
    expect(client.rpc).toHaveBeenCalledWith("dispatch_ledscores_match_overlay_v1",
      expect.objectContaining({
        p_canonical_key: "a".repeat(64),
        p_event_type: "match_start"
      }));
    expect(client.rpc).toHaveBeenCalledWith("enrich_ledscores_goal_v1",
      expect.objectContaining({
        p_goal_canonical_key: "c".repeat(64),
        p_provider_player_key: "home-7",
        p_shirt_number: 7
      }));
  });
});

describe("LED Scores live match state", () => {
  it("keeps state bounded and reconstructs both scores for every timeline point", () => {
    const status = parseLedScoresMessage(JSON.stringify({
      message: {
        endedAt: null,
        matchId: "wedstrijd-1",
        paused: false,
        period: 2,
        scoreboard: { away: 1, home: 2, scored: null },
        scorers: {
          away: [null, {
            period: 1,
            player: { active: true, id: "away-9", name: "Uitspeler", number: 9 },
            time: 200
          }],
          home: [null, {
            period: 1,
            player: { active: true, id: "home-7", name: "Speler Zeven", number: 7 },
            time: 100
          }, {
            period: 2,
            player: { active: true, id: "home-11", name: "Speler Elf", number: 11 },
            time: 300
          }]
        },
        startedAt: "2026-08-31T17:00:00.000Z",
        teams: { away: 27753, home: 23603 },
        time: 300,
        updateId: "state-42",
        updatedAt: "2026-08-31T17:20:00.000Z"
      },
      type: "scores"
    }));
    const state = createLedScoresLiveMatchState({
      acceptedPlayers: [{
        active: true,
        name: "Speler Zeven",
        number: 7,
        photoProviderAssetVersionId: "30000000-0000-4000-8000-000000000003",
        photoSourceUrl: "https://api.ledscores.score.tel/players/home-7.webp",
        playerKey: "home-7",
        teamKey: "23603"
      }, {
        active: true,
        name: "Speler Elf",
        number: 11,
        photoProviderAssetVersionId: null,
        photoSourceUrl: null,
        playerKey: "home-11",
        teamKey: "23603"
      }],
      connection,
      direction: "up",
      status
    });

    expect(state).toMatchObject({
      away: { name: "Tegenstander", score: 1, teamKey: "27753" },
      awayTeamKey: "27753",
      home: { name: "Duindorp SV", score: 2, teamKey: "23603" },
      homeTeamKey: "23603",
      matchKey: "match:wedstrijd-1",
      schemaVersion: 1,
      staleAfter: 30,
      status: "live",
      timeline: [
        expect.objectContaining({ awayScore: 0, homeScore: 1, playerName: "Speler Zeven" }),
        expect.objectContaining({ awayScore: 1, homeScore: 1, playerName: null }),
        expect.objectContaining({ awayScore: 1, homeScore: 2, playerName: "Speler Elf" })
      ]
    });
    expect(state).not.toHaveProperty("rosters");
    expect(state).not.toHaveProperty("selectedLineups");
    expect(JSON.stringify(state)).not.toContain("api.ledscores.score.tel");
    expect(JSON.stringify(state)).not.toContain("photoProviderAssetVersionId");
  });
});

describe("LED Scores connector loop", () => {
  it("baselines first and dispatches exactly one fresh score transition", async () => {
    const controller = new AbortController();
    const now = Date.now();
    const dispatch = vi.fn(async () => {
      controller.abort();
      return 2;
    });
    let claimed = false;
    const backend = fakeBackend({
      claim: vi.fn(async () => {
        if (claimed) return [];
        claimed = true;
        return [connection];
      }),
      dispatch
    });
    const socket = new FakeWebSocket();
    const loop = runLedScoresConnectorLoop({
      backend,
      claimIntervalMs: 1_000,
      leaseSeconds: 45,
      maxConnections: 5,
      signal: controller.signal,
      webSocketFactory: (url) => {
        expect(url).toBe(connection.endpointUrl);
        queueMicrotask(() => {
          socket.emit("open", new Event("open"));
          socket.message(scoreMessage(3, null, now - 1_500, "before"));
          socket.message(scoreMessage(4, {
            date: new Date(now - 500).toISOString(), id: 2, side: "home"
          }, now - 400, "after"));
        });
        return socket as unknown as WebSocket;
      },
      workerId: "worker:test"
    });
    await loop;
    expect(dispatch).toHaveBeenCalledOnce();
    expect(dispatch).toHaveBeenCalledWith(
      connection,
      "worker:test",
      expect.objectContaining({
        homeScore: 4,
        previousHomeScore: 3,
        scoringSide: "own"
      })
    );
    expect(backend.release).toHaveBeenCalledWith(
      connection.connectionId,
      "worker:test",
      "worker_shutdown"
    );
  });

  it("normalizes uppercase provider team IDs across identity, players, goals and state", async () => {
    const controller = new AbortController();
    const now = Date.now();
    let claimed = false;
    const casedConnection: ClaimedLedScoresConnection = {
      ...connection,
      mappings: [
        { side: "own", teamKey: "home", teamName: "Thuisnaam" },
        { side: "opponent", teamKey: "away", teamName: "Uitnaam" }
      ]
    };
    const states: Record<string, unknown>[] = [];
    const backend = fakeBackend({
      claim: vi.fn(async () => {
        if (claimed) return [];
        claimed = true;
        return [casedConnection];
      }),
      syncPlayers: vi.fn(async (
        input: Parameters<LedScoresConnectorBackend["syncPlayers"]>[0]
      ) => input.players.map((player) => ({
        playerKey: player.playerKey,
        teamKey: player.teamKey
      }))),
      upsertLiveState: vi.fn(async (input) => {
        states.push(input.state);
        const home = input.state.home as { score?: number } | undefined;
        if (home?.score === 1) controller.abort();
      })
    });
    const socket = new FakeWebSocket();
    const lineup = { home: { players: [
      { active: true, id: "Player-7", name: "Speler Zeven", number: 7 }
    ] } };
    await runLedScoresConnectorLoop({
      backend,
      claimIntervalMs: 100,
      leaseSeconds: 45,
      maxConnections: 1,
      signal: controller.signal,
      webSocketFactory: () => {
        queueMicrotask(() => {
          socket.emit("open", new Event("open"));
          socket.message(providerMessage(now - 1_000, "upper-baseline", {
            lineup,
            lineups: { home: ["Player-7"] },
            matchId: null,
            scoreboard: { away: 0, home: 0, scored: null },
            teams: { away: " AWAY ", home: "HOME" }
          }));
          socket.message(providerMessage(now - 500, "upper-goal", {
            lineup,
            lineups: { home: ["Player-7"] },
            matchId: null,
            scoreboard: {
              away: 0,
              home: 1,
              scored: {
                date: new Date(now - 550).toISOString(),
                id: "goal-button",
                side: "home"
              }
            },
            scorers: { home: [null, {
              period: 1,
              player: lineup.home.players[0],
              time: 120
            }] },
            teams: { away: "AWAY", home: " HOME " }
          }));
        });
        return socket as unknown as WebSocket;
      },
      workerId: "worker:test"
    });

    expect(backend.syncPlayers).toHaveBeenCalledWith(expect.objectContaining({
      players: [expect.objectContaining({ playerKey: "Player-7", teamKey: "home" })]
    }));
    expect(backend.dispatch).toHaveBeenCalledWith(
      casedConnection,
      "worker:test",
      expect.objectContaining({
        homeTeam: "Thuisnaam",
        matchIdentity: "fixture:home:away:2026-08-31T17:00:00.000Z",
        scoringSide: "own",
        scoringTeamKey: "home"
      })
    );
    expect(states.at(-1)).toMatchObject({
      awayTeamKey: "away",
      home: { name: "Thuisnaam", teamKey: "home" },
      homeTeamKey: "home",
      matchKey: "fixture:home:away:2026-08-31T17:00:00.000Z"
    });
  });

  it("accepts an older provider baseline using its current observation time", async () => {
    const controller = new AbortController();
    const now = Date.now();
    const providerBaselineAt = now - 20 * 60_000;
    let claimed = false;
    const backend = fakeBackend({
      claim: vi.fn(async () => {
        if (claimed) return [];
        claimed = true;
        return [connection];
      })
    });
    const socket = new FakeWebSocket();
    const loop = runLedScoresConnectorLoop({
      backend,
      claimIntervalMs: 100,
      leaseSeconds: 45,
      maxConnections: 1,
      persistIntervalMs: 60_000,
      signal: controller.signal,
      webSocketFactory: () => {
        queueMicrotask(() => {
          socket.emit("open", new Event("open"));
          socket.message(scoreMessage(3, null, providerBaselineAt, "baseline"));
          socket.message(scoreMessage(3, null, providerBaselineAt + 500, "clock-only"));
          setTimeout(() => controller.abort(), 10);
        });
        return socket as unknown as WebSocket;
      },
      workerId: "worker:test"
    });
    await loop;
    expect(backend.touch).toHaveBeenCalledOnce();
    expect(backend.upsertLiveState).toHaveBeenCalledOnce();
    expect(backend.dispatch).not.toHaveBeenCalled();
    const playerObservation = vi.mocked(backend.syncPlayers).mock.calls[0]?.[0]
      .sourceObservedAt;
    const stateObservation = vi.mocked(backend.upsertLiveState).mock.calls[0]?.[0]
      .sourceObservedAt;
    expect(Date.parse(playerObservation ?? "")).toBeGreaterThanOrEqual(now);
    expect(Date.parse(stateObservation ?? "")).toBeGreaterThanOrEqual(now);
    expect(vi.mocked(backend.upsertLiveState).mock.calls[0]?.[0].state.sourceUpdatedAt)
      .toBe(new Date(providerBaselineAt).toISOString());
    expect(backend.touch).toHaveBeenCalledWith(
      connection.connectionId,
      "worker:test",
      expect.any(Object),
      new Date(providerBaselineAt).toISOString()
    );
  });

  it("publishes a detected countdown direction immediately and then resumes throttling", async () => {
    const controller = new AbortController();
    const now = Date.now();
    let claimed = false;
    const directions: string[] = [];
    const backend = fakeBackend({
      claim: vi.fn(async () => {
        if (claimed) return [];
        claimed = true;
        return [connection];
      }),
      upsertLiveState: vi.fn(async (
        input: Parameters<LedScoresConnectorBackend["upsertLiveState"]>[0]
      ) => {
        const clock = input.state.clock as { direction?: string } | null;
        if (clock?.direction) directions.push(clock.direction);
      })
    });
    const socket = new FakeWebSocket();
    await runLedScoresConnectorLoop({
      backend,
      claimIntervalMs: 100,
      leaseSeconds: 45,
      maxConnections: 1,
      persistIntervalMs: 60_000,
      signal: controller.signal,
      webSocketFactory: () => {
        queueMicrotask(() => {
          socket.emit("open", new Event("open"));
          socket.message(providerMessage(now - 1_000, "clock-120", { time: 120 }));
          socket.message(providerMessage(now - 750, "clock-119", { time: 119 }));
          socket.message(providerMessage(now - 500, "clock-118", { time: 118 }));
          setTimeout(() => controller.abort(), 10);
        });
        return socket as unknown as WebSocket;
      },
      workerId: "worker:test"
    });

    expect(directions).toEqual(["up", "down"]);
  });

  it("dispatches selected and active lineup candidates without inventing a fallback", async () => {
    const controller = new AbortController();
    const now = Date.now();
    let claimed = false;
    const dispatchOverlay = vi.fn(async (
      _input: Parameters<LedScoresConnectorBackend["dispatchOverlay"]>[0]
    ) => {
      void _input;
      controller.abort();
      return 2;
    });
    const backend = fakeBackend({
      claim: vi.fn(async () => {
        if (claimed) return [];
        claimed = true;
        return [connection];
      }),
      dispatchOverlay,
      syncPlayers: vi.fn(async (
        input: Parameters<LedScoresConnectorBackend["syncPlayers"]>[0]
      ) => input.players
        .filter((player) => player.teamKey === "23603")
        .map((player) => ({ playerKey: player.playerKey, teamKey: player.teamKey })))
    });
    const socket = new FakeWebSocket();
    const lineup = {
      home: { players: [
        { active: true, id: "home-7", name: "Speler Zeven", number: 7 },
        { active: true, id: "home-12", name: "Speler Twaalf", number: 12 },
        { active: false, id: "home-14", name: "Wissel", number: 14 }
      ] }
    };
    await runLedScoresConnectorLoop({
      backend,
      claimIntervalMs: 100,
      leaseSeconds: 45,
      maxConnections: 1,
      signal: controller.signal,
      webSocketFactory: () => {
        queueMicrotask(() => {
          socket.emit("open", new Event("open"));
          socket.message(providerMessage(now - 1_000, "baseline", {
            displayTeam: null,
            lineup,
            lineups: { home: ["home-12", "home-7"] }
          }));
          socket.message(providerMessage(now - 500, "show-home", {
            displayTeam: "home",
            lineup,
            lineups: { home: ["home-12", "home-7"] }
          }));
        });
        return socket as unknown as WebSocket;
      },
      workerId: "worker:test"
    });

    expect(dispatchOverlay).toHaveBeenCalledOnce();
    const payload = vi.mocked(dispatchOverlay).mock.calls[0]?.[0].payload;
    expect(payload).toMatchObject({
      activePlayers: [
        expect.objectContaining({ id: "home-7", name: "Speler Zeven" }),
        expect.objectContaining({ id: "home-12", name: "Speler Twaalf" })
      ],
      awayTeamKey: "27753",
      homeTeamKey: "23603",
      selectedPlayers: [
        expect.objectContaining({ id: "home-12" }),
        expect.objectContaining({ id: "home-7" })
      ],
      side: "home",
      teamKey: "23603"
    });
    expect(payload).not.toHaveProperty("lineup");
  });

  it("hydrates selected players first and then active fallback players", async () => {
    const controller = new AbortController();
    const now = Date.now();
    let claimed = false;
    const hydratedPlayerKeys: string[][] = [];
    const backend = fakeBackend({
      claim: vi.fn(async () => {
        if (claimed) return [];
        claimed = true;
        return [connection];
      }),
      hydratePlayerAssets: vi.fn(async (
        _connection: ClaimedLedScoresConnection,
        players: readonly LedScoresPlayerSnapshot[]
      ) => {
        hydratedPlayerKeys.push(players.map((player) => player.playerKey));
        controller.abort();
        return new Map<string, string>();
      }),
      syncPlayers: vi.fn(async (
        input: Parameters<LedScoresConnectorBackend["syncPlayers"]>[0]
      ) => input.players
        .filter((player) => player.teamKey === "23603")
        .map((player) => ({ playerKey: player.playerKey, teamKey: player.teamKey })))
    });
    const socket = new FakeWebSocket();
    const lineup = { home: { players: [
      {
        active: true,
        goalImage: "https://api.ledscores.score.tel/players/home-7.webp",
        id: "home-7",
        name: "Actieve fallback",
        number: 7
      },
      {
        active: true,
        goalImage: "https://api.ledscores.score.tel/players/home-12.webp",
        id: "home-12",
        name: "Geselecteerde speler",
        number: 12
      },
      {
        active: false,
        goalImage: "https://api.ledscores.score.tel/players/home-14.webp",
        id: "home-14",
        name: "Inactieve wissel",
        number: 14
      }
    ] } };
    await runLedScoresConnectorLoop({
      backend,
      claimIntervalMs: 100,
      leaseSeconds: 45,
      maxConnections: 1,
      signal: controller.signal,
      webSocketFactory: () => {
        queueMicrotask(() => {
          socket.emit("open", new Event("open"));
          socket.message(providerMessage(now - 500, "baseline", {
            lineup,
            lineups: { home: ["home-12"] }
          }));
        });
        return socket as unknown as WebSocket;
      },
      workerId: "worker:test"
    });

    expect(hydratedPlayerKeys).toEqual([["home-12", "home-7"]]);
  });

  it("dispatches one late lineup refresh when the displayed roster arrives separately", async () => {
    const controller = new AbortController();
    const now = Date.now();
    let claimed = false;
    const dispatchOverlay = vi.fn(async () => {
      controller.abort();
      return 1;
    });
    const backend = fakeBackend({
      claim: vi.fn(async () => {
        if (claimed) return [];
        claimed = true;
        return [connection];
      }),
      dispatchOverlay,
      syncPlayers: vi.fn(async (
        input: Parameters<LedScoresConnectorBackend["syncPlayers"]>[0]
      ) => input.players
        .filter((player) => player.teamKey === "23603")
        .map((player) => ({ playerKey: player.playerKey, teamKey: player.teamKey })))
    });
    const socket = new FakeWebSocket();
    const lateLineup = { home: { players: [
      { active: true, id: "home-7", name: "Late basisspeler", number: 7 }
    ] } };
    await runLedScoresConnectorLoop({
      backend,
      claimIntervalMs: 100,
      leaseSeconds: 45,
      maxConnections: 1,
      signal: controller.signal,
      webSocketFactory: () => {
        queueMicrotask(() => {
          socket.emit("open", new Event("open"));
          socket.message(providerMessage(now - 1_500, "baseline", {
            displayTeam: null,
            lineups: { home: ["home-7"] }
          }));
          socket.message(providerMessage(now - 1_000, "show-before-roster", {
            displayTeam: "home",
            lineups: { home: ["home-7"] }
          }));
          socket.message(providerMessage(now - 500, "late-roster", {
            displayTeam: "home",
            lineup: lateLineup,
            lineups: { home: ["home-7"] }
          }));
        });
        return socket as unknown as WebSocket;
      },
      workerId: "worker:test"
    });

    expect(dispatchOverlay).toHaveBeenCalledOnce();
    expect(dispatchOverlay).toHaveBeenCalledWith(expect.objectContaining({
      eventType: "lineup",
      payload: expect.objectContaining({
        selectedPlayers: [expect.objectContaining({ id: "home-7" })]
      }),
      sourceUpdateId: "late-roster"
    }));
  });

  it("maps start, rest and end to overlays but resumes from rest through state only", async () => {
    const controller = new AbortController();
    const now = Date.now();
    let claimed = false;
    const overlayTypes: string[] = [];
    const backend = fakeBackend({
      claim: vi.fn(async () => {
        if (claimed) return [];
        claimed = true;
        return [connection];
      }),
      dispatchOverlay: vi.fn(async (input) => {
        overlayTypes.push(input.eventType);
        if (overlayTypes.length === 3) controller.abort();
        return 1;
      })
    });
    const socket = new FakeWebSocket();
    await runLedScoresConnectorLoop({
      backend,
      claimIntervalMs: 100,
      leaseSeconds: 45,
      maxConnections: 1,
      signal: controller.signal,
      webSocketFactory: () => {
        queueMicrotask(() => {
          socket.emit("open", new Event("open"));
          socket.message(providerMessage(now - 2_500, "pre-match", { startedAt: null }));
          socket.message(providerMessage(now - 2_000, "started", {
            startedAt: new Date(now - 2_000).toISOString()
          }));
          socket.message(providerMessage(now - 1_500, "rest", {
            rest: true,
            startedAt: new Date(now - 2_000).toISOString()
          }));
          socket.message(providerMessage(now - 1_000, "resumed", {
            rest: false,
            startedAt: new Date(now - 2_000).toISOString()
          }));
          socket.message(providerMessage(now - 500, "ended", {
            endedAt: new Date(now - 500).toISOString(),
            startedAt: new Date(now - 2_000).toISOString()
          }));
        });
        return socket as unknown as WebSocket;
      },
      workerId: "worker:test"
    });

    expect(overlayTypes).toEqual(["match_start", "half_time", "match_end"]);
    expect(backend.upsertLiveState).toHaveBeenCalledTimes(5);
  });

  it("never waits for a player-photo download before goal and scorer delivery", async () => {
    const controller = new AbortController();
    const now = Date.now();
    let claimed = false;
    const calls: string[] = [];
    const neverResolvingPhoto = new Promise<ReadonlyMap<string, string>>(() => undefined);
    const backend = fakeBackend({
      claim: vi.fn(async () => {
        if (claimed) return [];
        claimed = true;
        return [connection];
      }),
      dispatch: vi.fn(async () => {
        calls.push("goal");
        return 2;
      }),
      enrichGoal: vi.fn(async () => {
        calls.push("scorer");
        controller.abort();
        return 2;
      }),
      hydratePlayerAssets: vi.fn(async () => {
        calls.push("photo-download");
        return neverResolvingPhoto;
      }),
      syncPlayers: vi.fn(async (
        input: Parameters<LedScoresConnectorBackend["syncPlayers"]>[0]
      ) => input.players
        .filter((player) => player.teamKey === "23603")
        .map((player) => ({ playerKey: player.playerKey, teamKey: player.teamKey }))),
      touch: vi.fn(async (
        ...args: Parameters<LedScoresConnectorBackend["touch"]>
      ) => {
        const baseline = args[2];
        if (baseline.homeScore === 1) calls.push("goal-touch");
        return true;
      }),
      upsertLiveState: vi.fn(async (
        input: Parameters<LedScoresConnectorBackend["upsertLiveState"]>[0]
      ) => {
        const home = input.state.home as { score?: number } | undefined;
        if (home?.score === 1) calls.push("goal-state");
      })
    });
    const socket = new FakeWebSocket();
    const lineup = { home: { players: [{
      active: true,
      goalImage: "https://api.ledscores.score.tel/players/home-7.webp",
      id: "home-7",
      name: "Speler Zeven",
      number: 7
    }] } };
    await runLedScoresConnectorLoop({
      backend,
      claimIntervalMs: 100,
      leaseSeconds: 45,
      maxConnections: 1,
      signal: controller.signal,
      webSocketFactory: () => {
        queueMicrotask(() => {
          socket.emit("open", new Event("open"));
          socket.message(providerMessage(now - 1_000, "baseline", {
            lineup,
            lineups: { home: ["home-7"] },
            scoreboard: { away: 0, home: 0, scored: null }
          }));
          socket.message(providerMessage(now - 500, "goal-with-scorer", {
            lineup,
            lineups: { home: ["home-7"] },
            scoreboard: {
              away: 0,
              home: 1,
              scored: {
                date: new Date(now - 550).toISOString(),
                id: "goal-button",
                side: "home"
              }
            },
            scorers: { home: [null, {
              period: 1,
              player: lineup.home.players[0],
              time: 120
            }] }
          }));
        });
        return socket as unknown as WebSocket;
      },
      workerId: "worker:test"
    });

    expect(calls).toContain("photo-download");
    expect(calls.indexOf("goal")).toBeLessThan(calls.indexOf("goal-touch"));
    expect(calls.indexOf("goal")).toBeLessThan(calls.indexOf("goal-state"));
    expect(calls.indexOf("goal")).toBeLessThan(calls.indexOf("scorer"));
    const persistedBaselines = vi.mocked(backend.recordState).mock.calls
      .flatMap(([input]) => input.baseline ? [input.baseline] : []);
    const touchedBaselines = vi.mocked(backend.touch).mock.calls.map((call) => call[2]);
    expect(JSON.stringify([...persistedBaselines, ...touchedBaselines]))
      .not.toContain("Speler Zeven");
    expect(JSON.stringify([...persistedBaselines, ...touchedBaselines]))
      .not.toContain("api.ledscores.score.tel");
  });

  it("bounds a connection attempt and records a reconnectable timeout", async () => {
    const controller = new AbortController();
    let claimed = false;
    const recordState = vi.fn(async (input: Parameters<LedScoresConnectorBackend["recordState"]>[0]) => {
      if (input.eventType === "connection_error") controller.abort();
      return true;
    });
    const backend = fakeBackend({
      claim: vi.fn(async () => {
        if (claimed) return [];
        claimed = true;
        return [connection];
      }),
      recordState
    });
    await runLedScoresConnectorLoop({
      backend,
      claimIntervalMs: 100,
      connectTimeoutMs: 25,
      leaseSeconds: 45,
      maxConnections: 1,
      random: () => 0,
      signal: controller.signal,
      webSocketFactory: () => new FakeWebSocket() as unknown as WebSocket,
      workerId: "worker:test"
    });
    expect(recordState).toHaveBeenCalledWith(expect.objectContaining({
      detail: expect.objectContaining({ code: "ledscores_connect_timeout" }),
      eventType: "connection_error"
    }));
    expect(backend.release).toHaveBeenCalledOnce();
  });
});

class FakeWebSocket extends EventTarget {
  close() {
    this.emit("close", new Event("close"));
  }

  emit(type: string, event: Event) {
    this.dispatchEvent(event.type === type ? event : new Event(type));
  }

  message(data: string) {
    this.dispatchEvent(new MessageEvent("message", { data }));
  }
}

function scoreMessage(
  home: number,
  scored: { date: string; id: number; side: "home" } | null,
  updatedAt: number,
  updateId: string
) {
  return JSON.stringify({
    message: {
      endedAt: null,
      matchId: "wedstrijd-1",
      paused: false,
      period: 2,
      scoreboard: { away: 2, home, scored },
      startedAt: "2026-08-31T17:00:00.000Z",
      teams: { away: 27753, home: 23603 },
      time: 2807,
      updateId,
      updatedAt: new Date(updatedAt).toISOString()
    },
    type: "scores"
  });
}

function providerMessage(
  updatedAt: number,
  updateId: string,
  overrides: Record<string, unknown> = {}
) {
  return JSON.stringify({
    message: {
      endedAt: null,
      matchId: "wedstrijd-1",
      paused: false,
      period: 1,
      rest: false,
      scoreboard: { away: 0, home: 0, scored: null },
      startedAt: "2026-08-31T17:00:00.000Z",
      teams: { away: 27753, home: 23603 },
      time: 120,
      updateId,
      updatedAt: new Date(updatedAt).toISOString(),
      ...overrides
    },
    type: "scores"
  });
}
