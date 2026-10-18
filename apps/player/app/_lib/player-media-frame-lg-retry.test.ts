import { Script, createContext } from "node:vm";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";
import { renderLgLegacyHtml } from "./lg-legacy-page";
import { mediaFrameClubmuurAsset } from "./player-media-frame";

/** Actual generated sibling declarations, including future resolver helpers.
 * Startup/network initialisation is excluded; the playback path stays real. */
function generatedPlaybackFunctions() {
  const html = renderLgLegacyHtml();
  const source = html.slice(html.indexOf("<script>") + 8, html.indexOf("</script>"));
  const file = ts.createSourceFile("lg-generated.js", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const statement = file.statements[0];
  if (!statement || !ts.isExpressionStatement(statement)) throw Error("Expected generated LG statement");
  let invocation: ts.Expression = statement.expression;
  while (ts.isParenthesizedExpression(invocation)) invocation = invocation.expression;
  if (!ts.isCallExpression(invocation)) throw Error("Expected generated LG IIFE");
  let expression: ts.Expression = invocation.expression;
  while (ts.isParenthesizedExpression(expression)) expression = expression.expression;
  if (!ts.isFunctionExpression(expression)) throw Error("Expected generated LG body");
  return expression.body.statements.filter(node => ts.isFunctionDeclaration(node) || ts.isVariableStatement(node) && node.declarationList.declarations.some(declaration => ts.isIdentifier(declaration.name) && ["CONFIG", "mediaFrameBackgroundStyle", "validMediaFrameBackground"].includes(declaration.name.text))).map(node => node.getText(file)).join("\n");
}
class Element {
  style: Record<string, string> = {};
  className = "";
  parentNode: { removeChild: (element: Element) => void } | null = null;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  oncanplay: (() => void) | null = null;
  onloadedmetadata: (() => void) | null = null;
  onplaying: (() => void) | null = null;
  ontimeupdate: (() => void) | null = null;
  onended: (() => void) | null = null;
  paused = true;
  readyState = 0;
  videoWidth = 0;
  videoHeight = 0;
  currentTime = 0;
  networkState = 0;
  error = { code: 4 };
  private source = "";
  constructor(readonly tagName: "VIDEO" | "IMG", private readonly deferred: (callback: () => void) => void) {}
  set src(value: string) { this.source = value; if (this.tagName === "IMG") this.deferred(() => this.onload?.()); }
  get src() { return this.source; }
  setAttribute() {}
  removeAttribute(name: string) { if (name === "src") this.source = ""; }
  load() {}
  pause() { this.paused = true; }
  play() { this.paused = false; return Promise.resolve(); }
  decode() { return Promise.resolve(); }
  decodedFrame() { this.readyState = 2; this.videoWidth = 1920; this.videoHeight = 1080; this.paused = false; this.onplaying?.(); }
}
type Runtime = {
  envelope: { manifest: { releaseId: string; items: object[]; presentationDefaults: object } };
  currentItem: object | null; currentElement: Element | null; currentObjectUrls: string[];
  pendingElement: Element | null; pendingObjectUrls: string[]; activeIndex: number;
  playbackGeneration: number; offline: boolean; itemFailures: Record<string, unknown>;
  presentedReleaseId?: string;
};
function fixture(background: "private" | "clubmuur", transport: "cache" | "native") {
  const callbacks: Array<() => void> = [], elements: Element[] = [];
  const deferred = (callback: () => void) => { callbacks.push(callback); };
  const urls = new Map<string, { kind: "main" | "background" | "lkg"; revoked: boolean }>();
  let serial = 0, clock = 1000;
  const timers = new Map<number, { at: number; callback: () => void; interval?: number }>();
  const root = { style: {} as Record<string, string>, appendChild(element: Element) { elements.push(element); element.parentNode = root; }, removeChild(element: Element) { const index = elements.indexOf(element); if (index >= 0) elements.splice(index, 1); element.parentNode = null; } };
  const mainHash = "a".repeat(64), backgroundHash = background === "clubmuur" ? mediaFrameClubmuurAsset.sha256 : "b".repeat(64);
  const key = background === "clubmuur" ? "clubmuur" : "23100000-0000-4000-8000-000000000001";
  const reads: string[] = [];
  const cache = { match: async (path: string) => {
    reads.push(path);
    if (!path.endsWith(mainHash) && !path.endsWith(backgroundHash)) return undefined;
    return { blob: async () => ({ size: 123, kind: path.endsWith(mainHash) ? "main" : "background" }) };
  } };
  const item = { id: "23100000-0000-4000-8000-000000000002", kind: "video", fitMode: "contain", source: { url: "https://storage.test/verified-main.mp4", bytes: 123, checksumSha256: mainHash, mimeType: "video/mp4" }, mediaFrameBackground: { schemaVersion: 1, themeId: "fieldflow", accentColor: "#1763ed", background: background === "clubmuur" ? { kind: "preset", preset: "clubmuur" } : { kind: "image", mediaAssetId: key, checksumSha256: backgroundHash, position: "center" } }, mediaFrameBackgroundAssets: { [key]: { url: background === "clubmuur" ? mediaFrameClubmuurAsset.path : "https://storage.test/verified-background.png", bytes: 123, checksumSha256: backgroundHash, mimeType: "image/png" } }, _legacyMediaFrameUrls: {} as Record<string, string> };
  const previous = new Element("IMG", deferred); previous.className = "visible"; root.appendChild(previous); urls.set("blob:lkg", { kind: "lkg", revoked: false });
  const runtime: Runtime = { envelope: { manifest: { releaseId: "current-release", items: [item], presentationDefaults: {} } }, currentItem: null, currentElement: previous, currentObjectUrls: ["blob:lkg"], pendingElement: null, pendingObjectUrls: [], activeIndex: 0, playbackGeneration: 0, offline: transport === "cache", itemFailures: {} };
  const fail = vi.fn(), ready = vi.fn();
  const schedule = (callback: () => void, delay: number, interval?: number) => { const id = ++serial; timers.set(id, { at: clock + delay, callback, interval }); return id; };
  const window = { location: { href: "https://player.test/lg/legacy", origin: "https://player.test" }, navigator: { onLine: transport !== "cache" }, caches: { open: async () => cache }, URL: { createObjectURL(blob: { kind: "main" | "background" }) { const url = `blob:cache-${++serial}`; urls.set(url, { kind: blob.kind, revoked: false }); return url; }, revokeObjectURL(url: string) { const value = urls.get(url); if (value) value.revoked = true; } }, setTimeout: (callback: () => void, delay: number) => schedule(callback, delay), clearTimeout: (id: number) => timers.delete(id), setInterval: (callback: () => void, delay: number) => schedule(callback, delay, delay), clearInterval: (id: number) => timers.delete(id), requestAnimationFrame: (callback: () => void) => { callback(); return ++serial; } };
  const context = createContext({ runtime, window, URL, navigator: { serviceWorker: transport === "cache" ? { controller: { scriptURL: "https://player.test/sw.js" } } : undefined }, document: { createElement: (name: string) => new Element(name === "video" ? "VIDEO" : "IMG", deferred) }, playerMediaTraffic: { add: vi.fn() }, legacyIsCompositionZone: false });
  new Script(generatedPlaybackFunctions()).runInContext(context);
  // Only unrelated chrome/publication boundaries are replaced. Cache/style/source/
  // cancellation/commit/retirement and actual video fallback functions stay real.
  Object.assign(context, { byId: () => root, playableItems: () => [item], hideDefaultWaiting: vi.fn(), setState: vi.fn(), cancelLegacyEngage: vi.fn(), playLegacyEngage: () => false, playLegacyYouTube: () => false, validDynamicTemplate: () => false, mediaReady: ready, lgEngageFallbackReady: vi.fn(), lgCompositionIdentity: () => "full", sendHeartbeat: vi.fn(), log: vi.fn(), monotonicNow: () => clock, rememberNativeNetworkVideo: vi.fn(), failItem: fail, nextItem: vi.fn() });
  const run = (source: string) => new Script(source).runInContext(context);
  const settle = async () => { for (let i = 0; i < 40; i++) { await Promise.resolve(); while (callbacks.length) callbacks.shift()!(); } };
  const advance = (milliseconds: number) => { clock += milliseconds; for (const [id, timer] of [...timers]) if (timer.at <= clock) { timers.delete(id); timer.callback(); if (timer.interval) timers.set(id, { ...timer, at: clock + timer.interval }); } };
  return { runtime, item, previous, urls, root, reads, fail, ready, key, mainHash, run, settle, advance };
}
for (const background of ["private", "clubmuur"] as const) for (const transport of ["cache", "native"] as const) for (const state of ["pending", "committed"] as const) {
  describe(`generated LG ${background} background, ${transport} retry`, () => {
    it(`keeps the background owned and live after ${state} replacement and 220ms retirement`, async () => {
      const value = fixture(background, transport);
      value.run("playCurrent()"); await value.settle();
      const first = value.runtime.pendingElement!;
      expect(first.tagName).toBe("VIDEO");
      const originalBackground = value.item._legacyMediaFrameUrls[value.key]!;
      expect(value.urls.get(originalBackground)).toEqual({ kind: "background", revoked: false });
      // play() resolving is not a decoded first frame and cannot replace LKG.
      expect(value.runtime.currentElement).toBe(value.previous);
      expect(value.ready).not.toHaveBeenCalled();
      if (state === "committed") { first.decodedFrame(); value.advance(220); expect(value.runtime.currentElement).toBe(first); }
      const previousVisible = value.runtime.currentElement;
      first.onerror?.(); await value.settle();
      const replacement = value.runtime.pendingElement!;
      expect(replacement).not.toBe(first);
      expect(replacement.src).toBe(transport === "cache" ? `/__veyocast-player-cache/${value.mainHash}` : "https://storage.test/verified-main.mp4");
      expect(value.runtime.currentElement).toBe(previousVisible);
      replacement.decodedFrame(); value.advance(220);
      expect(value.runtime.currentElement).toBe(replacement);
      const activeBackground = value.item._legacyMediaFrameUrls[value.key]!;
      expect(replacement.style.backgroundImage).toContain(activeBackground);
      // Before the fix the background is revoked at pending cancel or when the
      // committed predecessor is retired, while the new video still refers to it.
      expect(value.urls.get(activeBackground), "replacement background remains valid after old-media cleanup").toEqual({ kind: "background", revoked: false });
      expect(value.runtime.currentObjectUrls).toContain(activeBackground);
      expect(value.fail).not.toHaveBeenCalled();
    });
  });
}
