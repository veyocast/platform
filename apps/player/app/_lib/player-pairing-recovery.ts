export const maximumPersistedPairingDelayMs = 10 * 60_000;
export const pairingRequestNonceRotationThresholdMs = 60_000;

export function resolvePersistedPairingDelay(
  storedTimestamp: number,
  now = Date.now()
) {
  if (!Number.isFinite(storedTimestamp) || storedTimestamp <= now) {
    return 0;
  }

  const remainingMs = storedTimestamp - now;
  return remainingMs <= maximumPersistedPairingDelayMs ? remainingMs : 0;
}

export function shouldRotatePairingRequestNonce(
  firstTransientFailureAt: number | null,
  now = Date.now()
) {
  return (
    firstTransientFailureAt !== null &&
    Number.isFinite(firstTransientFailureAt) &&
    Number.isFinite(now) &&
    now - firstTransientFailureAt >= pairingRequestNonceRotationThresholdMs
  );
}
