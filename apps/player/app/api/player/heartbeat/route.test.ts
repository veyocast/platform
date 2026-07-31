import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();

vi.mock("../../../_lib/player-supabase", () => ({
  createPlayerAnonClient: () => ({ rpc })
}));

import { POST } from "./route";

describe("player heartbeat API", () => {
  beforeEach(() => {
    rpc.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("normaliseert een onbekende syncfase zodat een geldige heartbeat niet faalt", async () => {
    rpc
      .mockResolvedValueOnce({
        data: "71000000-0000-4000-8000-000000000001",
        error: null
      })
      .mockResolvedValueOnce({
        data: null,
        error: { code: "AUTOMATION_NOT_CONFIGURED" }
      });

    const response = await heartbeat({
      runtimeState: "PLAYING",
      syncPhase: "lg-legacy"
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true });
    expect(rpc).toHaveBeenNthCalledWith(
      1,
      "record_player_heartbeat_v2",
      expect.objectContaining({
        p_runtime_state: "PLAYING",
        p_sync_phase: null
      })
    );
  });

  it("verwijdert een geldige schermcredential niet bij een heartbeat-validatiefout", async () => {
    rpc
      .mockResolvedValueOnce({
        data: null,
        error: { code: "23514" }
      })
      .mockResolvedValueOnce({
        data: "PAIRED",
        error: null
      });

    const response = await heartbeat({
      runtimeState: "PLAYING",
      syncPhase: "active"
    });
    const body = (await response.json()) as {
      error: { code: string };
    };

    expect(response.status).toBe(503);
    expect(body.error.code).toBe("PLAYER_API_UNAVAILABLE");
  });

  it("blijft een werkelijk onbekende schermcredential definitief afwijzen", async () => {
    rpc
      .mockResolvedValueOnce({
        data: null,
        error: { code: "P0002" }
      })
      .mockResolvedValueOnce({
        data: "INVALID_DEVICE_TOKEN",
        error: null
      });

    const response = await heartbeat({
      runtimeState: "READY",
      syncPhase: null
    });
    const body = (await response.json()) as {
      error: { code: string };
    };

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("INVALID_DEVICE_TOKEN");
  });
});

function heartbeat(body: {
  runtimeState: string;
  syncPhase: string | null;
}) {
  return POST(
    new Request("https://player.veyocast.nl/api/player/heartbeat", {
      body: JSON.stringify({
        activeReleaseId: null,
        currentItemId: null,
        desiredReleaseId: null,
        networkState: "online",
        ...body
      }),
      headers: {
        Authorization: `Bearer ${"d".repeat(48)}`,
        "Content-Type": "application/json"
      },
      method: "POST"
    })
  );
}
