import { afterEach, describe, expect, it, vi } from "vitest";
import { QueueWakeup, type RenderQueue } from "../src/queue-wakeup";

afterEach(() => vi.useRealTimers());
describe("bounded idle worker traffic", () => {
  it("honors Retry-After even when a safety claim would otherwise be due", async () => {
    vi.useFakeTimers(); vi.setSystemTime(1_000_000);
    const read = vi.fn(async () => { throw Object.assign(new Error("429"), { retryAfterMs: 120_000 }); });
    const gate = new QueueWakeup(read);
    const controller = new AbortController();
    await gate.wait("studio", controller.signal); gate.settled("studio", "idle");
    let claims = 0;
    const waiting = gate.wait("studio", controller.signal).then(() => { if (!controller.signal.aborted) claims++; });
    await vi.advanceTimersByTimeAsync(119_000);
    expect(claims).toBe(0); expect(read).toHaveBeenCalledTimes(1);
    controller.abort(); await waiting;
    expect(vi.getTimerCount()).toBe(0);
  });
  it("simulates a full empty day: >94% fewer requests including shared hints", async () => {
    vi.useFakeTimers(); vi.setSystemTime(1_000_000);
    const read = vi.fn(async () => ({ media: false, studio: false, dynamic: false }));
    const gate = new QueueWakeup(read, { random: () => 0.5 });
    const controller = new AbortController();
    const claims = { media: 0, studio: 0, dynamic: 0 };
    const loops = (["media", "studio", "dynamic"] as RenderQueue[]).map(async (queue) => {
      while (!controller.signal.aborted) {
        await gate.wait(queue, controller.signal);
        if (controller.signal.aborted) break;
        claims[queue] += 1;
        gate.settled(queue, "idle");
      }
    });
    await vi.advanceTimersByTimeAsync(86_400_000);
    controller.abort(); await Promise.all(loops);
    const requests = Object.values(claims).reduce((a, b) => a + b, 0) + read.mock.calls.length;
    console.info(JSON.stringify({ measurement: "simulated-idle-day", seconds: 86400,
      claims, hintRequests: read.mock.calls.length, requests,
      // Compact hint is JSON 0; empty table-valued claims serialize as [].
      modeledJsonPayloadBytes: read.mock.calls.length + 2 * Object.values(claims).reduce((a, b) => a + b, 0),
      excluded: "HTTP/TLS headers, compression, provider billing, real work" }));
    expect(claims.studio).toBeLessThanOrEqual(1572);
    expect(requests).toBeLessThan(478521 * 0.06);
    expect(gate.counters.emptyClaims).toBe(Object.values(claims).reduce((a, b) => a + b, 0));
    expect(gate.counters.workClaims).toBe(0);
  });

  it("wakes new work within five seconds after long idle and drains without waiting", async () => {
    vi.useFakeTimers(); vi.setSystemTime(1_000_000);
    let hasWork = false;
    const gate = new QueueWakeup(async () => ({ media: false, studio: hasWork, dynamic: false }), { random: () => 0.5 });
    const controller = new AbortController();
    let pickedUpAt = 0;
    const loop = (async () => {
      while (!controller.signal.aborted) {
        await gate.wait("studio", controller.signal);
        if (controller.signal.aborted) break;
        if (hasWork) { pickedUpAt = Date.now(); gate.settled("studio", "completed"); break; }
        gate.settled("studio", "idle");
      }
    })();
    await vi.advanceTimersByTimeAsync(600_000);
    hasWork = true; const queuedAt = Date.now();
    await vi.advanceTimersByTimeAsync(5_000); await loop;
    expect(pickedUpAt - queuedAt).toBeLessThanOrEqual(5_000);
    let drained = false;
    await gate.wait("studio", controller.signal).then(() => { drained = true; });
    expect(drained).toBe(true);
    controller.abort();
  });

  it("backs off a broken hint endpoint while retaining lease recovery and aborts cleanly", async () => {
    vi.useFakeTimers(); vi.setSystemTime(1_000_000);
    const read = vi.fn(async () => { throw new Error("503"); });
    const gate = new QueueWakeup(read, { random: () => 0.5 });
    const controller = new AbortController();
    const work = (async () => { while (!controller.signal.aborted) {
      await gate.wait("studio", controller.signal);
      if (!controller.signal.aborted) gate.settled("studio", "idle");
    } })();
    await vi.advanceTimersByTimeAsync(600_000);
    controller.abort(); await work;
    expect(read.mock.calls.length).toBeLessThan(15);
    expect(gate.counters.emptyClaims).toBeGreaterThan(8);
    expect(vi.getTimerCount()).toBe(0);
  });
});
