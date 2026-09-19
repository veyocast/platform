import { describe, expect, it } from "vitest";
import { LatestPlayerTarget } from "./latest-player-target";

describe("one latest screen target", () => {
  it("invalidates nine pending generations without queuing them", () => {
    const latest = new LatestPlayerTarget();
    const tokens = Array.from({ length: 10 }, (_, index) => latest.observe(`release-${index}`, "screen", String(index + 1))!);
    expect(tokens.slice(0, -1).every((token) => token.signal.aborted && !token.isCurrent())).toBe(true);
    expect(tokens[9]!.isCurrent()).toBe(true);
  });
  it("rejects an old target response, but accepts another playlist with a lower config version", () => {
    const latest = new LatestPlayerTarget();
    const a = latest.observe("playlist-A-config-100", "screen", "12")!;
    const b = latest.observe("playlist-B-config-2", "screen", "13")!;
    expect(a.isCurrent()).toBe(false);
    expect(latest.observe("playlist-A-config-100", "screen", "12")).toBeNull();
    expect(b.isCurrent()).toBe(true);
  });
  it("rejects a legacy response after an ordered target, but permits a new screen assignment", () => {
    const latest = new LatestPlayerTarget();
    const current = latest.observe("A", "screen-A", "20")!;
    expect(latest.observe("old-response", "screen-A")).toBeNull();
    expect(current.isCurrent()).toBe(true);
    expect(latest.observe("B", "screen-B", "1")?.isCurrent()).toBe(true);
    expect(current.isCurrent()).toBe(false);
  });
  it("invalidates a late download and a callback just before activation", async () => {
    const latest = new LatestPlayerTarget();
    const b = latest.observe("B", "screen", "2")!;
    let complete!: () => void;
    const delayed = new Promise<void>((resolve) => { complete = resolve; });
    const activations: string[] = [];
    const obsolete = delayed.then(() => { if (b.isCurrent()) activations.push("B"); });
    const d = latest.observe("D", "screen", "4")!;
    if (d.isCurrent()) activations.push("D");
    complete();
    await obsolete;
    expect(activations).toEqual(["D"]);
    latest.cancel();
    expect(d.isCurrent()).toBe(false);
  });
});
