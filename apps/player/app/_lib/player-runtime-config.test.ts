import { describe, expect, it } from "vitest";

import {
  defaultManifestSyncIntervalMs,
  defaultWatchdogTimeoutMs,
  resolvePlayerRuntimeTiming
} from "./player-runtime-config";

describe("player runtime timing", () => {
  it("keeps production defaults when timing parameters are absent", () => {
    expect(resolvePlayerRuntimeTiming(new URLSearchParams(), true)).toEqual({
      durationOverrideMs: null,
      manifestSyncIntervalMs: defaultManifestSyncIntervalMs,
      watchdogTimeoutMs: defaultWatchdogTimeoutMs
    });
  });

  it("ignores every test timing override in production", () => {
    const searchParams = new URLSearchParams(
      "durationMs=500&syncMs=250&watchdogMs=250"
    );
    expect(resolvePlayerRuntimeTiming(searchParams, false)).toEqual({
      durationOverrideMs: null,
      manifestSyncIntervalMs: defaultManifestSyncIntervalMs,
      watchdogTimeoutMs: defaultWatchdogTimeoutMs
    });
  });

  it("accepts and bounds explicit timing overrides in development", () => {
    const searchParams = new URLSearchParams(
      "durationMs=100&syncMs=90000&watchdogMs=1000"
    );
    expect(resolvePlayerRuntimeTiming(searchParams, true)).toEqual({
      durationOverrideMs: 250,
      manifestSyncIntervalMs: defaultManifestSyncIntervalMs,
      watchdogTimeoutMs: 1_000
    });
  });
});
