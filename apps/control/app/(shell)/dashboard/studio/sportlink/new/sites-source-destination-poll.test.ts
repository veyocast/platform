import { afterEach, describe, expect, it, vi } from "vitest";
import { pollSitesSourceDestination } from "./sites-source-destination-poll";
const command = { destination: { mode: "publish" as const, playlistId: "saved-playlist", expectedRevision: 7, screenIds: ["actual-screen"] }, designs: [{ slideId: "saved-slide", snapshotId: "actual-snapshot", clientId: "stable-client-id", durationSeconds: 15 }], idempotencyKey: "stable-key" };
afterEach(() => vi.useRealTimers());
describe("Bronbestemming wacht begrensd zonder een nieuwe batchsleutel of gedeeltelijke opslag", () => {
  it("pollt elke twee seconden pending→ready met hetzelfde command en stopt daarna", async () => {
    vi.useFakeTimers(); const prepare = vi.fn().mockResolvedValueOnce({ outcome: "pending", message: "Voorbereiden" }).mockResolvedValue({ outcome: "ready", actualRevision: 8, url: "/actual-publish" }); const onResult = vi.fn(), onPending = vi.fn();
    pollSitesSourceDestination({ command, prepare, onResult, onPending }); await vi.advanceTimersByTimeAsync(0); expect(prepare).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1999); expect(prepare).toHaveBeenCalledTimes(1); await vi.advanceTimersByTimeAsync(1); expect(prepare).toHaveBeenCalledTimes(2); expect(prepare.mock.calls[0]![0]).toBe(command); expect(prepare.mock.calls[1]![0]).toBe(command);
    await vi.advanceTimersByTimeAsync(90_000); expect(prepare).toHaveBeenCalledTimes(2); expect(onResult).toHaveBeenLastCalledWith({ outcome: "ready", actualRevision: 8, url: "/actual-publish" }); expect(onPending.mock.calls).toEqual([[true], [false]]);
  });
  it("stopt uiterlijk na negentig seconden wachten met concreet herstel en bewaart het command", async () => {
    vi.useFakeTimers(); const prepare = vi.fn().mockResolvedValue({ outcome: "pending", message: "Voorbereiden" }); const onResult = vi.fn(), onPending = vi.fn();
    pollSitesSourceDestination({ command, prepare, onResult, onPending }); await vi.advanceTimersByTimeAsync(120_000);
    expect(prepare).toHaveBeenCalledTimes(46); expect(onResult).toHaveBeenLastCalledWith(expect.objectContaining({ outcome: "pending", message: expect.stringContaining("langer dan verwacht") })); expect(onPending).toHaveBeenLastCalledWith(false); expect(prepare.mock.calls.every(([value]) => value === command)).toBe(true);
  });
  it("begrensd een ontbrekende serverresponse op dertig seconden en accepteert een latere response niet als success", async () => {
    vi.useFakeTimers(); let resolve!: (value: { outcome: "ready"; actualRevision: number; url: string }) => void; const prepare = vi.fn(() => new Promise<{ outcome: "ready"; actualRevision: number; url: string }>(done => { resolve = done; })); const onResult = vi.fn(), onPending = vi.fn();
    pollSitesSourceDestination({ command, prepare, onResult, onPending }); await vi.advanceTimersByTimeAsync(29_999); expect(onResult).not.toHaveBeenCalled(); await vi.advanceTimersByTimeAsync(1);
    expect(onResult).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ outcome: "failed", message: expect.stringContaining("dezelfde sleutel") })); expect(onPending).toHaveBeenLastCalledWith(false);
    resolve({ outcome: "ready", actualRevision: 8, url: "/late-confirmation" }); await vi.advanceTimersByTimeAsync(90_000); expect(onResult).toHaveBeenCalledOnce(); expect(prepare).toHaveBeenCalledOnce();
  });
  it("stopt bij stale conflict of uitval zonder automatische rebase, en negeert een late response na sluiten", async () => {
    vi.useFakeTimers(); const onResult = vi.fn(), onPending = vi.fn(); const prepare = vi.fn().mockResolvedValue({ outcome: "conflict", message: "Playlist gewijzigd" });
    pollSitesSourceDestination({ command, prepare, onResult, onPending }); await vi.advanceTimersByTimeAsync(90_000); expect(prepare).toHaveBeenCalledOnce(); expect(onResult).toHaveBeenLastCalledWith({ outcome: "conflict", message: "Playlist gewijzigd" });
    prepare.mockRejectedValue(new Error("secret-provider-detail")); pollSitesSourceDestination({ command, prepare, onResult, onPending }); await vi.advanceTimersByTimeAsync(0); expect(JSON.stringify(onResult.mock.lastCall)).not.toContain("secret-provider"); expect(onResult).toHaveBeenLastCalledWith(expect.objectContaining({ outcome: "failed" }));
    let resolve!: (value: { outcome: "pending"; message: string }) => void; const delayed = vi.fn(() => new Promise<{ outcome: "pending"; message: string }>(done => { resolve = done; })); const previous = onResult.mock.calls.length;
    const cancel = pollSitesSourceDestination({ command, prepare: delayed, onResult, onPending }); cancel(); resolve({ outcome: "pending", message: "Late" }); await vi.advanceTimersByTimeAsync(90_000); expect(delayed).toHaveBeenCalledOnce(); expect(onResult).toHaveBeenCalledTimes(previous);
  });
});
