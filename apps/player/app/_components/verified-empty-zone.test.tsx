import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VerifiedEmptyZone, hasVisibleEmptyZoneFrame } from "./verified-empty-zone";
import { ScreenCompositionZone } from "./screen-composition-zone";
import { ScreenCompositionBoundary } from "../_lib/screen-composition-boundary";
import { demoOnlineDeviceToken, getPlayerManifestForToken, isPlayerManifestItemPlayable } from "../_lib/player-manifest";

function visibleFrame() {
  const bounds = { left: 0, top: 0, right: 600, bottom: 900, width: 600, height: 900 };
  const style = { display: "block", visibility: "visible", opacity: "1" };
  const ancestor = { parentElement: null, style: { ...style } };
  const root = { parentElement: ancestor, style: { ...style }, getBoundingClientRect: () => bounds,
    querySelector: () => heading };
  const heading = { textContent: "Geen gegevens", parentElement: root, style: { ...style },
    getBoundingClientRect: () => ({ ...bounds, left: 20, right: 580, top: 400, bottom: 450, height: 50, width: 560 }) };
  vi.stubGlobal("getComputedStyle", (element: { style: typeof style }) => element.style);
  return { root, heading, ancestor, element: root as unknown as HTMLElement };
}
function emptyEnvelope() {
  const result = getPlayerManifestForToken(demoOnlineDeviceToken);
  if (!result.ok) throw Error("Existing release fixture unavailable");
  const body = structuredClone(result.body), item = body.manifest.items[0]!;
  body.manifest.items = [item];
  item.dynamicTemplate = { schemaVersion: 1, snapshotId: "10000000-0000-4000-8000-000000000295", templateVersionId: "20000000-0000-4000-8000-000000000295", snapshotHash: "a".repeat(64), templateSlug: "historical-empty-results", orientation: "landscape", slideType: "sport_results", data: { type: "sport_results", sport: { items: [] } } };
  return body;
}
const callbacks = { onFrame: () => undefined, onBoundary: () => undefined };
describe("verified empty playback zones", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("requires actual visible text inside the zone rather than renderer readiness", () => {
    const value = visibleFrame();
    expect(hasVisibleEmptyZoneFrame(value.element)).toBe(true);
    value.heading.textContent = " "; expect(hasVisibleEmptyZoneFrame(value.element)).toBe(false);
    expect(hasVisibleEmptyZoneFrame(null)).toBe(false);
  });
  it.each(["transparent", "hidden", "no-layout", "outside-zone"] as const)("rejects a %s placeholder as a frame", mode => {
    const value = visibleFrame();
    if (mode === "transparent") value.ancestor.style.opacity = "0";
    if (mode === "hidden") value.root.style.visibility = "hidden";
    if (mode === "no-layout") value.root.getBoundingClientRect = () => ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 });
    if (mode === "outside-zone") value.heading.getBoundingClientRect = () => ({ left: 700, right: 800, top: 400, bottom: 450, width: 100, height: 50 });
    expect(hasVisibleEmptyZoneFrame(value.element)).toBe(false);
  });
  it("preserves the existing fullscreen ready copy and does not invent an item activation", () => {
    const html = renderToStaticMarkup(<VerifiedEmptyZone fullscreen identity="main:release:empty2" screenName="Eigen scherm" paused={false} {...callbacks} />);
    expect(html).toContain("Dit scherm wacht op jouw verhaal.");
    expect(html).toContain('data-player-empty-zone="main:release:empty2"');
    expect(html).toContain('data-player-handoff="waiting-for-first-frame"');
    expect(html).not.toContain("first-frame-ready");
  });
  it("renders the explicit empty zone instead of falling back to an ineligible first result item", () => {
    const envelope = emptyEnvelope();
    expect(isPlayerManifestItemPlayable(envelope.manifest.items[0]!)).toBe(false);
    const html = renderToStaticMarkup(<ScreenCompositionZone zoneId="side" envelope={envelope} paused={false} boundary={new ScreenCompositionBoundary()} onActivation={() => undefined} {...callbacks} onDomFailure={() => undefined} liveMatchStates={new Map()} watchdogTimeoutMs={10000} />);
    expect(html).toContain("Geen gegevens"); expect(html).toContain("data-player-empty-zone");
  });
  it("continues selecting an eligible ordinary slide in a mixed zone", () => {
    const envelope = emptyEnvelope(), visible = { ...envelope.manifest.items[0]!, id: "ordinary-image", accessibilityName: "Blijft spelen", dynamicTemplate: undefined };
    envelope.manifest.items.push(visible);
    const html = renderToStaticMarkup(<ScreenCompositionZone zoneId="side" envelope={envelope} paused={false} boundary={new ScreenCompositionBoundary()} onActivation={() => undefined} {...callbacks} onDomFailure={() => undefined} liveMatchStates={new Map()} watchdogTimeoutMs={10000} />);
    expect(html).not.toContain("data-player-empty-zone"); expect(html).toContain("Blijft spelen");
  });
});
