import { afterEach, expect, it, vi } from "vitest";
import { createMediaTraffic } from "./media-traffic";
import { safeMediaTraffic, mediaTrafficWarning } from "./player-heartbeat";

afterEach(() => vi.useRealTimers());
it("bounds failed downloads and accepts only allowlisted cumulative counters", () => {
  vi.useFakeTimers(); vi.setSystemTime(1_000_000);
  const meter = createMediaTraffic();
  for (const delay of [30_000, 60_000, 3_600_000]) {
    expect(meter.allow("checksum")).toBe(true);
    meter.failure("checksum");
    expect(meter.allow("checksum")).toBe(false);
    vi.advanceTimersByTime(delay);
  }
  meter.add("networkPayloadBytes", 194174);
  meter.add("localReadBytes", 194174 * 100);
  const snapshot = meter.snapshot();
  expect(safeMediaTraffic({ ...snapshot, signedUrl: "secret", other: "personal" })).toEqual(snapshot);
  expect(safeMediaTraffic({ ...snapshot, downloads: -1 })).toBeNull();
  expect(safeMediaTraffic({ ...snapshot, networkPayloadBytes: Infinity })).toBeNull();
  meter.success("checksum");
  expect(meter.allow("checksum")).toBe(true);
});

it("bounds warning frequency and failure state, and honors a server cooldown", () => {
  vi.useFakeTimers(); vi.setSystemTime(1_000_000);
  const meter = createMediaTraffic();
  meter.defer("asset", Date.now() + 120_000);
  meter.failure("asset");
  vi.advanceTimersByTime(60_000);
  expect(meter.allow("asset")).toBe(false);
  vi.advanceTimersByTime(60_000);
  expect(meter.allow("asset")).toBe(true);
  meter.downloaded("asset"); meter.downloaded("asset"); meter.downloaded("asset");
  const snapshot = safeMediaTraffic(meter.snapshot());
  expect(mediaTrafficWarning("test-device", snapshot)?.event).toBe("player.media_budget");
  for (let i = 0; i < 100; i++) expect(mediaTrafficWarning("test-device", snapshot)).toBeNull();
  vi.advanceTimersByTime(60_000);
  expect(mediaTrafficWarning("test-device", snapshot)).toBeNull();
  meter.downloaded("asset");
  expect(mediaTrafficWarning("test-device", safeMediaTraffic(meter.snapshot()))).not.toBeNull();
});
