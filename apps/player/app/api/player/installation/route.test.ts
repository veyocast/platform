import { createHash } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();

vi.mock("../../../_lib/player-supabase", () => ({
  createPlayerAnonClient: () => ({ rpc }),
  isLivePlayerConfigured: () => true
}));

import { nativeRecoveryCookieName } from "../../../_lib/player-native-recovery";
import { POST } from "./route";

describe("player installation API", () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it("rotates both credentials after authenticated Android reinstall recovery", async () => {
    rpc.mockResolvedValue({
      data: {
        boundDeviceId: "51000000-0000-4000-8000-000000000153",
        created: false,
        credentialRotated: true,
        deviceCredentialRotated: true,
        installationId: "52000000-0000-4000-8000-000000000153",
        nativeRecovered: true,
        ok: true
      },
      error: null
    });
    const nativeCredential = "a".repeat(64);
    const response = await POST(
      new Request("https://player.veyocast.nl/api/player/installation", {
        body: JSON.stringify({
          installationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
        }),
        headers: {
          "Content-Type": "application/json",
          Cookie: `${nativeRecoveryCookieName}=${nativeCredential}`
        },
        method: "POST"
      })
    );
    const body = (await response.json()) as {
      bound: boolean;
      deviceCredential: string;
      installationCredential: string;
      ok: boolean;
    };

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body).toMatchObject({ bound: true, ok: true });
    expect(body.deviceCredential).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(body.installationCredential).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(rpc).toHaveBeenCalledWith(
      "register_player_installation_v2",
      expect.objectContaining({
        p_native_recovery_credential_hash: sha256(nativeCredential),
        p_new_device_credential_hash: sha256(body.deviceCredential),
        p_new_credential_hash: sha256(body.installationCredential)
      })
    );
  });

  it("does not treat a malformed cookie as a recovery credential", async () => {
    rpc.mockResolvedValue({
      data: {
        boundDeviceId: null,
        created: true,
        credentialRotated: false,
        deviceCredentialRotated: false,
        installationId: "52000000-0000-4000-8000-000000000154",
        nativeRecovered: false,
        ok: true
      },
      error: null
    });
    const response = await POST(
      new Request("https://player.veyocast.nl/api/player/installation", {
        body: JSON.stringify({
          installationId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
        }),
        headers: {
          "Content-Type": "application/json",
          Cookie: `${nativeRecoveryCookieName}=public-mac-address`
        },
        method: "POST"
      })
    );
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.deviceCredential).toBeUndefined();
    expect(rpc).toHaveBeenCalledWith(
      "register_player_installation_v2",
      expect.objectContaining({
        p_native_recovery_credential_hash: null
      })
    );
  });
});

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
