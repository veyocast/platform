import { createHash } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();

vi.mock("../../../../_lib/player-supabase", () => ({
  createPlayerAnonClient: () => ({ rpc }),
  isLivePlayerConfigured: () => true
}));

import { POST } from "./route";

describe("pairing recovery API", () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it("accepteert de duurzame installatiecredential zonder pending token", async () => {
    rpc.mockResolvedValue({
      data: {
        bindingState: "UNPAIRED",
        cancelledPendingPairing: true,
        ok: true
      },
      error: null
    });
    const credential = "i".repeat(32);
    const installationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const response = await POST(
      new Request("https://player.veyocast.nl/api/player/pairing/recover", {
        body: JSON.stringify({ installationId, mode: "soft" }),
        headers: {
          "Content-Type": "application/json",
          "X-VeyoCast-Installation-Credential": credential
        },
        method: "POST"
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      bindingState: "UNPAIRED",
      cancelledPendingPairing: true,
      ok: true
    });
    expect(rpc).toHaveBeenCalledWith("recover_player_pairing_v3", {
      p_installation_credential_hash: sha256(credential),
      p_installation_id_hash: sha256(installationId),
      p_pending_token_hash: null,
      p_recovery_mode: "soft"
    });
  });

  it("vertaalt een definitief ongeldige recoverycredential machineleesbaar", async () => {
    rpc.mockResolvedValue({
      data: { code: "RECOVERY_CREDENTIAL_INVALID", ok: false },
      error: null
    });
    const response = await POST(
      new Request("https://player.veyocast.nl/api/player/pairing/recover", {
        body: JSON.stringify({
          installationId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          mode: "hard"
        }),
        headers: {
          Authorization: `Bearer ${"p".repeat(32)}`,
          "Content-Type": "application/json"
        },
        method: "POST"
      })
    );
    const body = (await response.json()) as {
      error: { code: string };
    };

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("RECOVERY_CREDENTIAL_INVALID");
  });

  it("weigert een niet-geauthenticeerde recoverymelding", async () => {
    const response = await POST(
      new Request("https://player.veyocast.nl/api/player/pairing/recover", {
        body: JSON.stringify({
          installationId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          mode: "soft"
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      })
    );

    expect(response.status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });
});

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
