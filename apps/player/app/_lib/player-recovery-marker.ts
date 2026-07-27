import {
  localStorageRecoveryMarkerKey,
  playerRecoveryMarkerTtlMs
} from "./player-storage";

export type PlayerRecoveryMarker = {
  completedAt: number;
  expiresAt: number;
  mode: "hard" | "soft";
  pairingPrepared: boolean;
  version: 1;
};

export function consumePlayerRecoveryMarker(
  storage: Pick<Storage, "getItem" | "removeItem">,
  now = Date.now()
): PlayerRecoveryMarker | null {
  let raw: string | null = null;
  try {
    raw = storage.getItem(localStorageRecoveryMarkerKey);
    storage.removeItem(localStorageRecoveryMarkerKey);
  } catch {
    return null;
  }
  if (!raw) return null;

  try {
    const value = JSON.parse(raw) as Partial<PlayerRecoveryMarker>;
    if (
      value.version !== 1 ||
      (value.mode !== "soft" && value.mode !== "hard") ||
      typeof value.completedAt !== "number" ||
      typeof value.expiresAt !== "number" ||
      value.completedAt > now + 5_000 ||
      value.expiresAt <= now ||
      value.expiresAt - value.completedAt > playerRecoveryMarkerTtlMs + 5_000
    ) {
      return null;
    }
    return {
      completedAt: value.completedAt,
      expiresAt: value.expiresAt,
      mode: value.mode,
      pairingPrepared: value.pairingPrepared === true,
      version: 1
    };
  } catch {
    return null;
  }
}
