import { describe, expect, it, vi } from "vitest";

import {
  runLedScoresConnectorLoop,
  SupabaseLedScoresConnectorBackend,
  type ClaimedLedScoresConnection,
  type LedScoresConnectorBackend
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
    const backend: LedScoresConnectorBackend = {
      claim: vi.fn(async () => {
        if (claimed) return [];
        claimed = true;
        return [connection];
      }),
      dispatch,
      recordState: vi.fn(async () => true),
      release: vi.fn(async () => true),
      renew: vi.fn(async () => true),
      touch: vi.fn(async () => true)
    };
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

  it("persists a baseline but not every clock-only source update", async () => {
    const controller = new AbortController();
    const now = Date.now();
    let claimed = false;
    const backend: LedScoresConnectorBackend = {
      claim: vi.fn(async () => {
        if (claimed) return [];
        claimed = true;
        return [connection];
      }),
      dispatch: vi.fn(async () => 0),
      recordState: vi.fn(async () => true),
      release: vi.fn(async () => true),
      renew: vi.fn(async () => true),
      touch: vi.fn(async () => true)
    };
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
          socket.message(scoreMessage(3, null, now - 1_000, "baseline"));
          socket.message(scoreMessage(3, null, now - 500, "clock-only"));
          setTimeout(() => controller.abort(), 10);
        });
        return socket as unknown as WebSocket;
      },
      workerId: "worker:test"
    });
    await loop;
    expect(backend.touch).toHaveBeenCalledOnce();
    expect(backend.dispatch).not.toHaveBeenCalled();
  });

  it("bounds a connection attempt and records a reconnectable timeout", async () => {
    const controller = new AbortController();
    let claimed = false;
    const recordState = vi.fn(async (input: Parameters<LedScoresConnectorBackend["recordState"]>[0]) => {
      if (input.eventType === "connection_error") controller.abort();
      return true;
    });
    const backend: LedScoresConnectorBackend = {
      claim: vi.fn(async () => {
        if (claimed) return [];
        claimed = true;
        return [connection];
      }),
      dispatch: vi.fn(async () => 0),
      recordState,
      release: vi.fn(async () => true),
      renew: vi.fn(async () => true),
      touch: vi.fn(async () => true)
    };
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
      startedAt: new Date(updatedAt - 3_600_000).toISOString(),
      teams: { away: 27753, home: 23603 },
      time: 2807,
      updateId,
      updatedAt: new Date(updatedAt).toISOString()
    },
    type: "scores"
  });
}
