import { describe, expect, it, vi } from "vitest";

import { consumePlayerRecoveryMarker } from "./player-recovery-marker";
import {
  localStorageRecoveryMarkerKey,
  playerRecoveryMarkerTtlMs
} from "./player-storage";

describe("Player recoverymarker", () => {
  it("wordt na een geldige recovery precies eenmaal geconsumeerd", () => {
    const now = 20_000;
    const storage = {
      getItem: vi.fn(() =>
        JSON.stringify({
          completedAt: now - 100,
          expiresAt: now + playerRecoveryMarkerTtlMs - 100,
          mode: "soft",
          pairingPrepared: true,
          version: 1
        })
      ),
      removeItem: vi.fn()
    };

    expect(consumePlayerRecoveryMarker(storage, now)).toMatchObject({
      mode: "soft",
      pairingPrepared: true
    });
    expect(storage.removeItem).toHaveBeenCalledWith(
      localStorageRecoveryMarkerKey
    );
  });

  it("negeert een verlopen of te lang geldige marker", () => {
    const now = 50_000;
    const expiredStorage = {
      getItem: () =>
        JSON.stringify({
          completedAt: now - playerRecoveryMarkerTtlMs - 1,
          expiresAt: now - 1,
          mode: "soft",
          version: 1
        }),
      removeItem: vi.fn()
    };
    const forgedStorage = {
      getItem: () =>
        JSON.stringify({
          completedAt: now,
          expiresAt: now + playerRecoveryMarkerTtlMs * 2,
          mode: "hard",
          version: 1
        }),
      removeItem: vi.fn()
    };

    expect(consumePlayerRecoveryMarker(expiredStorage, now)).toBeNull();
    expect(consumePlayerRecoveryMarker(forgedStorage, now)).toBeNull();
  });

  it("blokkeert de Player niet wanneer storage of JSON defect is", () => {
    const throwingStorage = {
      getItem: () => {
        throw new Error("storage disabled");
      },
      removeItem: vi.fn()
    };
    const corruptStorage = {
      getItem: () => "{",
      removeItem: vi.fn()
    };

    expect(consumePlayerRecoveryMarker(throwingStorage)).toBeNull();
    expect(consumePlayerRecoveryMarker(corruptStorage)).toBeNull();
  });
});
