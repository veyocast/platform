import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();

vi.mock("../../../_lib/player-supabase", () => ({
  createPlayerAnonClient: () => ({ rpc }),
  isLivePlayerConfigured: () => true
}));

import { GET } from "./route";

const installationCredential = "i".repeat(48);

describe("player command API", () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it("stuurt canonieke commandtimestamps en een gezaghebbende servertijd", async () => {
    rpc.mockResolvedValue({
      data: {
        commands: [{
          commandType: "RECOVER_PAIRING",
          createdAt: "2026-08-01T08:25:00.123456+00:00",
          expiresAt: "2026-08-01T08:40:00.654321+00:00",
          id: "33333333-3333-4333-8333-333333333333",
          nonce: "44444444-4444-4444-8444-444444444444",
          payload: {}
        }],
        ok: true
      },
      error: null
    });
    const before = Date.now();

    const response = await GET(commandRequest());
    const after = Date.now();
    const body = (await response.json()) as {
      commands: Array<{ createdAt: string; expiresAt: string }>;
      ok: boolean;
      serverTime: string;
    };

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body).toMatchObject({
      commands: [{
        createdAt: "2026-08-01T08:25:00.123Z",
        expiresAt: "2026-08-01T08:40:00.654Z"
      }],
      ok: true
    });
    expect(Date.parse(body.serverTime)).toBeGreaterThanOrEqual(before);
    expect(Date.parse(body.serverTime)).toBeLessThanOrEqual(after);
  });

  it("levert een command met ongeldige timestamps niet aan een Player", async () => {
    rpc.mockResolvedValue({
      data: {
        commands: [{
          commandType: "RECOVER_PAIRING",
          createdAt: "geen datum",
          expiresAt: "ook geen datum",
          id: "33333333-3333-4333-8333-333333333333",
          nonce: "44444444-4444-4444-8444-444444444444",
          payload: {}
        }],
        ok: true
      },
      error: null
    });

    const response = await GET(commandRequest());
    const body = (await response.json()) as { commands: unknown[] };

    expect(response.status).toBe(200);
    expect(body.commands).toEqual([]);
  });
});

function commandRequest() {
  return new Request("https://player.veyocast.nl/api/player/commands", {
    headers: {
      Authorization: `Bearer ${installationCredential}`
    }
  });
}
