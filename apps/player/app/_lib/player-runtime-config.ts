export const defaultManifestSyncIntervalMs = 60_000;
export const defaultWatchdogTimeoutMs = 12_000;

export type PlayerRuntimeTiming = {
  durationOverrideMs: number | null;
  manifestSyncIntervalMs: number;
  watchdogTimeoutMs: number;
};

export function resolvePlayerRuntimeTiming(
  searchParams: URLSearchParams,
  allowTestOverrides: boolean
): PlayerRuntimeTiming {
  if (!allowTestOverrides) {
    return {
      durationOverrideMs: null,
      manifestSyncIntervalMs: defaultManifestSyncIntervalMs,
      watchdogTimeoutMs: defaultWatchdogTimeoutMs
    };
  }

  return {
    durationOverrideMs: readBoundedNumber(searchParams, "durationMs", 250, 10_000),
    manifestSyncIntervalMs:
      readBoundedNumber(
        searchParams,
        "syncMs",
        250,
        defaultManifestSyncIntervalMs
      ) ?? defaultManifestSyncIntervalMs,
    watchdogTimeoutMs:
      readBoundedNumber(searchParams, "watchdogMs", 250, 60_000) ??
      defaultWatchdogTimeoutMs
  };
}

function readBoundedNumber(
  searchParams: URLSearchParams,
  name: string,
  minimum: number,
  maximum: number
) {
  if (!searchParams.has(name)) return null;
  const rawValue = searchParams.get(name);
  if (rawValue === null || rawValue.trim() === "") return null;
  const value = Number(rawValue);
  if (!Number.isFinite(value)) return null;
  return Math.max(minimum, Math.min(value, maximum));
}
