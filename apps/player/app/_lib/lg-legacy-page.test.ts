import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { Script, createContext } from "node:vm";
import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

import { createRoyalCurrentPalette } from "../../../../packages/content-templates/src/royal-current-theme";

import { renderLgLegacyHtml } from "./lg-legacy-page";
import { syncPlayerStatusCopy } from "./player-status-presentation";

function inlineRuntime(html: string) {
  return html.slice(html.indexOf("<script>") + "<script>".length, html.indexOf("</script>"));
}

describe("Royal Current Static LG", () => {
  it("leaves the first pageshow to boot and revalidates a restored page, online recovery and visibility", () => {
    const source = inlineRuntime(renderLgLegacyHtml());
    const events = source.slice(source.lastIndexOf('window.addEventListener("online"'), source.lastIndexOf('window.addEventListener("offline"'));
    const handlers: Record<string, (event?: { persisted?: boolean }) => void> = {};
    let checks = 0;
    const context = {
      runtime: { offline: true },
      window: { addEventListener: (name: string, handler: typeof handlers[string]) => { handlers[name] = handler; } },
      document: { visibilityState: "hidden", addEventListener: (name: string, handler: typeof handlers[string]) => { handlers[name] = handler; } },
      restartGoalRealtime: () => undefined,
      invalidateManifest: () => { checks++; }
    };
    new Script(events).runInNewContext(context);
    handlers.pageshow!({ persisted: false });
    expect(checks).toBe(0);
    handlers.pageshow!({ persisted: true });
    expect(checks).toBe(1);
    handlers.online!();
    expect(context.runtime.offline).toBe(false);
    expect(checks).toBe(2);
    handlers.visibilitychange!();
    expect(checks).toBe(2);
    context.document.visibilityState = "visible";
    handlers.visibilitychange!();
    expect(checks).toBe(3);
  });

  it("restores only the verified eligible assets of a pre-revision mixed cache while fresh and revisioned empty releases remain complete", () => {
    const source = inlineRuntime(renderLgLegacyHtml());
    const assets = source.slice(source.indexOf("function cacheAsset("), source.indexOf("function sha256Hex("));
    const selection = source.slice(source.indexOf("function releaseAssetItems("), source.indexOf("function legacyDynamicTemplateHasRenderableContent("));
    const validate = source.slice(source.indexOf("function validateCachedRelease("), source.indexOf("function readReleaseStore("));
    const image = { id: "visible", kind: "image", source: { url: "/visible.svg", bytes: 12, checksumSha256: "a".repeat(64), mimeType: "image/svg+xml" } };
    const empty = { ...image, id: "old-empty", eligible: false, source: { ...image.source, url: "/empty.svg", checksumSha256: "b".repeat(64) }, dynamicTemplate: { schemaVersion: 1, data: { sport: { items: [] } }, assets: {} } };
    const envelope = { manifest: { schemaVersion: 1, items: [empty, image] } };
    const stored = { ...image.source, cacheKey: "/cache/" + image.source.checksumSha256, itemId: image.id, kind: "media" };
    const makeContext = (input: unknown, storedAssets: unknown[]) => {
      let result: boolean | undefined;
      const context = { input, storedAssets, CONFIG: { cachePathPrefix: "/cache/", sitesSystemAssets: [] },
        isManifestEnvelope: () => true, lgCompositionZones: (value: { children?: unknown[] }) => value.children ?? [],
        lgSyncBinaryValid: () => true, lgDynamicDataValid: () => true, validMediaFrameBackground: () => true,
        templateRecord: (value: unknown) => value && typeof value === "object" ? value : null,
        legacyDynamicTemplateHasRenderableContent: (item: { eligible?: boolean }) => item.eligible !== false,
        openAssetCache: (cb: (error: null, cache: object) => void) => cb(null, {}),
        inspectCachedAssets: (_cache: unknown, expected: unknown[], cb: (error: null, missing: unknown[]) => void) => cb(null, expected.every(value => storedAssets.some(stored => JSON.stringify(stored) === JSON.stringify(value))) ? [] : ["missing"]),
        done: (valid: boolean) => { result = valid; }
      };
      new Script(assets + selection + validate + ";validateCachedRelease({envelope:input,assets:storedAssets},done);").runInNewContext(context);
      return { result, fresh: new Script(assets + selection + ";releaseAssets(input);").runInNewContext(context) as unknown[] };
    };
    // These entries are the exact normalized metadata written by the old app.
    const normalized = { bytes: stored.bytes, cacheKey: stored.cacheKey, checksumSha256: stored.checksumSha256, itemId: stored.itemId, kind: stored.kind, mimeType: stored.mimeType, url: stored.url };
    expect(makeContext(envelope, [normalized])).toMatchObject({ result: true, fresh: [{ itemId: "old-empty" }, { itemId: "visible" }] });
    expect(makeContext({ manifest: { schemaVersion: 1, items: [{ ...empty, dynamicData: { dataRevision: 5 } }, image] } }, [normalized]).result).toBe(false);
    expect(makeContext({ manifest: { schemaVersion: 1, items: [{ ...empty, dynamicTemplate: { ...empty.dynamicTemplate, data: { snapshot: { dataRevision: 5 } } } }, image] } }, [normalized]).result).toBe(false);
    expect(makeContext({ manifest: { schemaVersion: 1, items: [empty] } }, []).result).toBe(false);
    expect(makeContext(envelope, [{ ...normalized, bytes: 13 }]).result).toBe(false);
    const composed = { manifest: { schemaVersion: 1, items: [image] }, children: [{ id: "side", envelope }] };
    expect(makeContext(composed, [normalized]).result).toBe(true);
    expect(makeContext({ ...composed, children: [{ id: "side", envelope: { manifest: { schemaVersion: 1, items: [{ ...empty, dynamicData: { dataRevision: 5 } }, image] } } }] }, [normalized]).result).toBe(false);
  });

  it("verifies the immutable assets of an empty dynamic item while preserving playback eligibility", () => {
    const source = inlineRuntime(renderLgLegacyHtml());
    const body = source.slice(source.indexOf("function releaseAssetItems("), source.indexOf("function legacyDynamicTemplateHasRenderableContent("));
    const empty = { id: "empty", kind: "image", source: { url: "/empty.png" }, eligible: false };
    const image = { id: "image", kind: "image", source: { url: "/image.png" }, eligible: true };
    const context = { input: { manifest: { items: [empty, image, { ...image, id: "disabled", enabled: false }] } }, legacyDynamicTemplateHasRenderableContent: (item: { eligible: boolean }) => item.eligible };
    expect(new Script(body + ";releaseAssetItems(input).map(function(item){return item.id;});").runInNewContext(context)).toEqual(["empty", "image"]);
    expect(new Script(body + ";playableItems(input).map(function(item){return item.id;});").runInNewContext(context)).toEqual(["image"]);
  });

  it("clears a prepared empty release only after successful persistence and reports its actual waiting frame", () => {
    const source = inlineRuntime(renderLgLegacyHtml());
    const activate = source.slice(source.indexOf("function activatePendingRelease("), source.indexOf("function nextItem("));
    const play = source.slice(source.indexOf("function playCurrent("), source.indexOf("function playLegacyVerifiedFallback("));
    for (const failure of [true, false]) {
      const old = { manifest: { releaseId: "old", items: [{ id: "old-item" }] } }, fresh = { manifest: { releaseId: "fresh", items: [] } };
      const calls: string[] = [], frames: Array<() => void> = [];
      let complete!: (error: string | null) => void;
      const runtime = { envelope: old, pendingRelease: { generation: 2, envelope: fresh, assets: ["verified"] }, targetGeneration: 2, activationInFlight: false, playbackGeneration: 5, currentElement: { old: true }, currentItem: old.manifest.items[0], activeIndex: 0, publicationTrace: null, offline: false, presentedEmptyIdentity: null };
      const context = { runtime, legacyIsCompositionZone: false, window: { requestAnimationFrame: (fn: () => void) => frames.push(fn) }, publicationOrder: () => [], persistRelease: (_envelope: unknown, _assets: unknown, cb: typeof complete) => { calls.push("persist"); complete = cb; }, playableItems: (envelope: typeof old) => envelope.manifest.items, setState: (value: string) => calls.push(value), log: () => undefined, releaseIdOf: (envelope: typeof old) => envelope.manifest.releaseId, clearMedia: () => { calls.push("clear"); runtime.currentElement = null as unknown as typeof runtime.currentElement; runtime.playbackGeneration++; }, showDefaultWaiting: () => calls.push("waiting"), emptyFrameIdentity: () => "verified-empty-fresh", hasVisibleEmptyFrame: () => true, mediaReady: () => calls.push("frame"), activated: (ok: boolean) => { calls.push(ok ? "accepted" : "rejected"); if (ok) new Script("playCurrent();").runInNewContext(context); } };
      new Script(activate + play + ";activatePendingRelease(activated);").runInNewContext(context);
      expect(calls).toEqual(["persist"]); expect(runtime.currentElement).toEqual({ old: true });
      complete(failure ? "LEGACY_RELEASE_PERSIST_FAILED" : null);
      if (failure) { expect(runtime.envelope).toBe(old); expect(runtime.currentElement).toEqual({ old: true }); expect(calls).not.toContain("clear"); }
      else { expect(runtime.envelope).toBe(fresh); expect(calls).toContain("waiting"); expect(calls).not.toContain("frame"); frames.shift()!(); frames.shift()!(); expect(calls.at(-1)).toBe("frame"); expect(runtime.presentedEmptyIdentity).toBe("verified-empty-fresh"); }
    }
  });

  it("retains a verified empty dataset as the previous LKG when fresh content follows it", () => {
    const source = inlineRuntime(renderLgLegacyHtml());
    const persist = source.slice(source.indexOf("function persistRelease("), source.indexOf("function garbageCollectCachedMedia("));
    const current = { envelope: { manifest: { releaseId: "same", identity: "empty5" } } };
    const fresh = { manifest: { releaseId: "same", identity: "fresh6" } };
    const previous: unknown[] = [], active: unknown[] = [], request = { result: current, onsuccess: () => undefined };
    const transaction = { objectStore: (name: string) => name === "active" ? { get: () => request, put: (value: unknown) => active.push(value) } : { put: (value: unknown) => previous.push(value) }, abort: () => undefined };
    const context = { fresh, runtime: { targetGeneration: 1, deviceToken: "device-only", currentElement: null, presentedEmptyIdentity: "empty5", preparingGeneration: 1 }, CONFIG: { activeReleaseStore: "active", previousReleaseStore: "previous" }, openPlayerDatabase: (cb: (error: null, database: unknown) => void) => cb(null, { transaction: () => transaction, close: () => undefined }), releaseIdOf: () => "same", lgCompositionIdentity: () => "full", lgEnvelopeDataIdentity: (envelope: typeof fresh) => envelope.manifest.identity, emptyFrameIdentity: (envelope: typeof fresh) => envelope.manifest.identity, done: () => undefined };
    new Script(persist + ";persistRelease(fresh,[],done);").runInNewContext(context);
    request.onsuccess(); expect(previous).toEqual([current]); expect(active).toHaveLength(1);
    expect(active[0]).toMatchObject({ deviceToken: "device-only", envelope: fresh });
  });

  it("keeps the generic OnzeTrots LG projection and playback valid ECMAScript 5", () => {
    const acorn=createRequire(import.meta.url)('next/dist/compiled/acorn') as {parse:(source:string,options:{ecmaVersion:number})=>unknown};
    const source=inlineRuntime(renderLgLegacyHtml());
    const projection=source.slice(source.indexOf('function templateRuntimeThemeId('),source.indexOf('function templateVisitorArrivalValue('));
    const playback=source.slice(source.indexOf('function playLedScoresLiveMatchTemplate('),source.indexOf('function playImage('));
    expect(()=>acorn.parse(projection+playback,{ecmaVersion:5})).not.toThrow();
  });
  it("projects old generic OnzeTrots font/accent choices at runtime without changing body or FieldFlow", () => {
    const html=renderLgLegacyHtml(),source=inlineRuntime(html);
    const start=source.indexOf('function templateRuntimeThemeId('),end=source.indexOf('function templateVisitorArrivalValue(',start);
    const values:Record<string,string>={'--vc-theme-body-font':'"Source Serif 4"','--vc-theme-display-font':'"Anton"','--accent':'#FF5C20'};
    const root={style:{setProperty:(name:string,value:string)=>{values[name]=value;}},setAttribute:()=>undefined};
    const context={root,CONFIG:{onzeTrotsBrand:{primary:'#03438A',headerFontFamily:'OTMarker'}},values};
    new Script(source.slice(start,end)+';templateApplyOnzeTrotsBrand(root,"onzetrots-tv");').runInNewContext(context);
    expect(values).toMatchObject({'--vc-theme-body-font':'"Source Serif 4"','--vc-theme-display-font':'"OTMarker"','--vc-theme-display-weight':'400','--vc-theme-accent':'#03438A','--accent':'#03438A','--live-accent':'#03438A'});
    const before={...values};new Script(source.slice(start,end)+';templateApplyOnzeTrotsBrand(root,"fieldflow");').runInNewContext(context);expect(values).toEqual(before);
    expect(html).toContain('href="/onzetrots-approved-v1/assets/fonts/club-font-9.ttf" as="font"');
  });
  it("requires the actual OT header face before dispatching generic live-match playback on LG", async () => {
    const source=inlineRuntime(renderLgLegacyHtml());
    const playback=source.slice(source.indexOf('function playDynamicTemplate('),source.indexOf('function playImage('));
    for(const outcome of ['loaded','error','missing'] as const){
      let complete!:(faces:{status:string}[])=>void;
      const calls:string[]=[];
      const item={kind:'video',dynamicTemplate:{slideType:'ledscores_live_match',data:{}}};
      const context={item,runtime:{playbackGeneration:7,currentItem:item},CONFIG:{onzeTrotsBrand:{headerFontFamily:'OTMarker'}},templateRecord:(value:unknown)=>value,templateRuntimeThemeId:()=> 'onzetrots-tv',document:{fonts:{load:(font:string)=>{calls.push(font);return new Promise<{status:string}[]>(resolve=>{complete=resolve;});}}},playLedScoresLiveMatchTemplate:()=>calls.push('live'),playVideo:()=>calls.push('binary'),log:()=>undefined};
      new Script(playback+';playDynamicTemplate(item,"cached-video",[],7);').runInNewContext(context);
      expect(calls).toEqual(['400 16px OTMarker']);
      complete(outcome==='missing'?[]:[{status:outcome}]);
      await new Promise(resolve=>setTimeout(resolve,0));
      expect(calls).toEqual(['400 16px OTMarker',outcome==='loaded'?'live':'binary']);
    }
  });
  it("ververst alleen URL-toegang voor dezelfde bevroren mediaframebron", () => {
    const source = inlineRuntime(renderLgLegacyHtml());
    const body = source.slice(source.indexOf("function refreshMediaFrameMediaAccess("), source.indexOf("function liveDataChanged("));
    const current = { mediaFrameBackground: { schemaVersion: 1, background: { kind: "preset", preset: "clubmuur" } }, mediaFrameBackgroundAssets: { clubmuur: { checksumSha256: "a".repeat(64), bytes: 123, mimeType: "image/webp", url: "old-signature" } } };
    const fresh = structuredClone(current); fresh.mediaFrameBackgroundAssets.clubmuur.url = "new-signature";
    const context = { current, fresh };
    new Script(body + ";refreshMediaFrameMediaAccess(current,fresh);").runInNewContext(context);
    expect(current.mediaFrameBackgroundAssets.clubmuur.url).toBe("new-signature");
    fresh.mediaFrameBackgroundAssets.clubmuur.bytes += 1; fresh.mediaFrameBackgroundAssets.clubmuur.url = "unverified-signature";
    new Script(body + ";refreshMediaFrameMediaAccess(current,fresh);").runInNewContext(context);
    expect(current.mediaFrameBackgroundAssets.clubmuur.url).toBe("new-signature");
    const binary: Record<string, unknown> = {};
    new Script(body + ";refreshMediaFrameMediaAccess(current,fresh);").runInNewContext({ current: binary, fresh });
    expect(binary).toEqual({});
  });
  it("gebruikt de Source-wachtpresentatie met echte tenantnaam en behoudt de bestaande verborgen klok", () => {
    const html = renderLgLegacyHtml();

    expect(html).toContain('id="default-waiting"');
    expect(html.includes("Narrowcasting voor sportverenigingen!")).toBe(false);
    expect(html.includes("VEYOCAST · VOORBEELD")).toBe(false);
    expect(html.includes("Dit scherm wacht op jouw verhaal.")).toBe(true);
    expect(html).toContain("showDefaultWaiting(envelope)");
    expect(html).toContain("default-waiting-clock");
    expect(html).toContain("/assets/full-dark.svg");
  });

  it("rendert verjaardagkaarten per kaart met vaste 1/2/4/6 rasters", () => {
    const html = renderLgLegacyHtml();

    expect(html).toContain("legacy-birthday-layout");
    expect(html).toContain("legacy-birthday-card");
    expect(html).toContain("legacy-birthday-photo");
    expect(html).toContain("startBirthdayConfetti");
    expect(html).toContain("legacyBirthdayPageSize");
    expect(html).toContain("[1, 2, 4, 6]");
    expect(html).toContain("birthdayPresentation.maxPerPortraitPage");
    expect(html).toContain("birthdayPresentation.maxPerLandscapePage");
  });

  it("activeert de nieuwe vormgeving uitsluitend voor frozen appearance v2", () => {
    const html = renderLgLegacyHtml();

    expect(html).toContain("Number(presentation.snapshotVersion) !== 2");
    expect(html).toContain("Number(appearance.schemaVersion) === 2");
    expect(html).toContain('appearance.designRevision, "") === "royal-current-v8"');
    expect(html).toContain('if (royalCurrent) {\n        root.setAttribute("data-design-revision", "royal-current-v8")');
    expect(html).toContain("var pages = templatePages(items, 10);");
    expect(html).toContain('if (!royalCurrent) {\n                arenaQr.appendChild(templateNode("span", "", "Scan voor het artikel"))');
    expect(html).toContain("function templateNewsConfig(snapshot)");
    expect(html).toContain("legacy-royal-news-title");
    expect(html).toContain("--rc-news-title-size");
    expect(html).toContain('title = templateText(templateNewsConfig(snapshot).title, "Nieuws")');
    expect(html).toContain("snapshot._veyocastThemeColorOverrides");
    expect(html).toContain("templateRecord(tenantThemeOverrides[editorialMode])");
    expect(html).toContain("legacyDynamicTemplateHasRenderableContent(item)");
    expect(html).toContain('data-empty-slot", "true"');
  });

  it("porteert het gedeelde palet exact zonder moderne CSS-kleurfuncties", () => {
    const html = renderLgLegacyHtml();
    const runtime = inlineRuntime(html);
    const start = runtime.indexOf("function legacyRoyalNormalizeHex");
    const end = runtime.indexOf("function templateLegacyMatchCancelled");
    const context: Record<string, unknown> = {};
    const paletteSource = runtime.slice(start, end);
    const royalCss = html.slice(
      html.indexOf('.dynamic-template.editorial-arena[data-design-revision="royal-current-v8"]'),
      html.indexOf("@media(max-height:650px)")
    );

    new Script(`
      function templateText(value, fallback) {
        return typeof value === "string" && value.trim() ? value.trim() : fallback;
      }
      function templateRecord(value) {
        return value && typeof value === "object" && !Array.isArray(value) ? value : null;
      }
      ${paletteSource}
      result = [
        legacyCreateRoyalCurrentPalette({ version: 1, primary: "#2459ED", background: "club", secondary: null }, "royal"),
        legacyCreateRoyalCurrentPalette({ version: 1, primary: "#BF263B", background: "neutral", secondary: "#08734D" }, "glass")
      ];
    `).runInNewContext(context);

    expect(context.result).toEqual([
      createRoyalCurrentPalette({ version: 1, primary: "#2459ED", background: "club", secondary: null }, "royal"),
      createRoyalCurrentPalette({ version: 1, primary: "#BF263B", background: "neutral", secondary: "#08734D" }, "glass")
    ]);
    expect(royalCss).not.toContain("color-mix(");
    expect(royalCss).not.toContain(":has(");
    expect(paletteSource).not.toContain("color-mix(");
  });

  it("gebruikt de exacte shell-assen en statische Roboto-gewichten", () => {
    const html = renderLgLegacyHtml();

    expect(html).toContain("grid-template-rows:80px minmax(148px,auto) minmax(0,1fr)");
    expect(html).toContain("padding:32px 64px 76px!important");
    expect(html).toContain("right:64px!important;bottom:22px!important;left:64px!important");
    expect(html).toContain("grid-template-rows:96px minmax(192px,auto) minmax(0,1fr)");
    expect(html).toContain("padding:36px 38px 84px!important");
    expect(html).toContain("right:38px!important;bottom:24px!important;left:38px!important");
    expect(html).not.toContain("legacy-royal-sideband");
    [400, 500, 700, 900].forEach((weight) => {
      expect(html).toContain(`/fonts/royal-current/roboto-${weight}.woff2`);
      expect(html).toContain(`font-weight:${weight};font-display:block`);
    });
  });

  it("berekent wedstrijdhoogtes en paginering met gedeelde geometrie", () => {
    const html = renderLgLegacyHtml();

    expect(html).toContain('data-design-revision="royal-current-v8"] .legacy-fixture-list');
    expect(html).toContain("grid-auto-rows:var(--sport-list-row-height,96px)");
    expect(html).toContain("height:var(--sport-list-row-height,96px);min-height:var(--sport-list-row-height,96px)");
    expect(html).toContain("grid-auto-rows:var(--sport-list-row-height,148px)");
    expect(html).toContain("height:var(--sport-list-row-height,148px);min-height:var(--sport-list-row-height,148px)");
    expect(html).toContain('Math.ceil(itemCount / 2) + ",var(--sport-list-row-height,96px))"');
    expect(html).toContain(
      "font-family:var(--vc-theme-body-font,\"VeyoCast Royal Current Roboto\")"
    );
    expect(html).toContain(
      "font-family:var(--vc-theme-display-font,\"VeyoCast Royal Current Roboto\")"
    );
    expect(html).toContain(
      "templateThemeFontFamily(royalThemeFontFamilies, royalBodyFontRef, \"vc-roboto-v1\")"
    );
    expect(html).toContain(
      "templateThemeFontFamily(royalThemeFontFamilies, royalDisplayFontRef, \"vc-roboto-v1\")"
    );
    expect(html).toContain(
      "templateThemeFontFamily(themeFontFamilies, bodyFontRef, defaultBodyFontRef)"
    );
    expect(html).toContain(
      "templateThemeFontFamily(themeFontFamilies, displayFontRef, defaultDisplayFontRef)"
    );
    expect(html).toContain(
      "var defaultSportScale = Number(themeAppearance.schemaVersion) === 2 ? 1 : 1.12"
    );
    expect(html).toContain(
      "? 24 * baseScale * sportScale\n        : 24 * baseScale * sportScale / 1.12"
    );
    expect(html).toContain(
      "? 42 * baseScale * sportScale\n        : 42 * baseScale * sportScale / 1.12"
    );
    expect(html).toContain("responsiveList ? listLayout.capacity");
    expect(html).toContain("resolveSportListLayout");
    expect(html).toContain(".legacy-fixture-list,.legacy-result-list{display:grid;grid-auto-rows:var(--sport-list-row-height,115px)");
    expect(html).toContain(".portrait .legacy-fixture-list{grid-auto-rows:var(--sport-list-row-height,221px)}");
    expect(html).toContain(".portrait .legacy-result-list{grid-auto-rows:var(--sport-list-row-height,314px)}");
  });

  it("behoudt vaste bezoekslots, QR-only nieuws, afgelast op tijd en een pinned standrij", () => {
    const html = renderLgLegacyHtml();

    expect(html).toContain('arrivalGrid.setAttribute("data-slots", String(cardsPerPage))');
    expect(html).toContain('while (arrivalGrid.children.length < cardsPerPage)');
    expect(html).toContain('templateText(item.awayLogoMediaAssetId, templateText(item.logoMediaAssetId, ""))');
    expect(html).toContain("legacy-royal-arrival-watermark");
    expect(html).toContain("rgba(var(--matte-rgb),.80) 33.333%");
    expect(html).toContain('"span", "legacy-match-time legacy-cancelled-kickoff", "Afgelast"');
    expect(html).toContain("fixtureHasCancelled && !displayConfiguration.showTime");
    expect(html).toContain("legacy-royal-standing-pinned");
    expect(html).toContain('["#", "Team", "G", "W", "GL", "V", "P", "DV", "DT", "+/−", "Vorm"]');
    expect(html).toContain("renderLegacyRoyalStandingRow(pinnedTeam, payload, \"pinned\")");
    expect(html).toContain("arenaQr.appendChild(arenaQrImage)");
  });

  it("levert de vier gecontroleerde fontbinaries met de gelockte hashes", () => {
    const expected = {
      400: "48c3fa6f86c54f1d9bb519220713d4b0a1f8cd1a589a3c03b9fa82e98ecb13e3",
      500: "24369e1b2461af9dcefecaf9cc93d64cf22a4c5bac32506100b9e21014507bcf",
      700: "b4d07892cde715d50bb69c1982df496385d1dfd8f9d1867c31f19a3c8634cfae",
      900: "edcdf3f60252a5987bedc9c86b5422d972ba509bbbe60d58925310c744a33e28"
    } as const;

    Object.entries(expected).forEach(([weight, hash]) => {
      const bytes = readFileSync(
        new URL(`../../public/fonts/royal-current/roboto-${weight}.woff2`, import.meta.url)
      );
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(hash);
    });
  });

  it("blijft als één oude-webOS-compatibele inline runtime parsen", () => {
    const runtime = inlineRuntime(renderLgLegacyHtml());

    expect(runtime).not.toContain("=>");
    expect(runtime).not.toContain("?.");
    expect(runtime).not.toContain("??");
    expect(() => new Script(runtime)).not.toThrow();
  });
});

function statusHarness(options: { playback?: boolean; failed?: boolean; offlineHint?: boolean; expiry?: string } = {}) {
  const elements = new Map<string, {
    hidden: boolean; className: string; textContent: string; innerHTML: string;
    attributes: Record<string, string>; setAttribute(name: string, value: string): void;
  }>();
  const byId = (id: string) => {
    let element = elements.get(id);
    if (!element) {
      element = { hidden: id === "status", className: "", textContent: "", innerHTML: "", attributes: {},
        setAttribute(name, value) { this.attributes[name] = value; } };
      elements.set(id, element);
    }
    return element;
  };
  const runtime = {
    envelope: options.playback ? {} : null,
    currentElement: options.playback ? { parentNode: {}, className: "legacy-media-layer visible" } : null,
    currentItem: options.playback ? { id: "owned-active-item" } : null,
    itemFailures: options.failed ? { "owned-active-item": 1 } : {},
    identityReady: true, offline: false, state: "BOOTING", defaultWaitingTimer: null
  };
  const context = createContext({ runtime, byId, STATUS_COPY: syncPlayerStatusCopy,
    CONFIG: { pairingExpiryKey: "expiry" },
    safeRead: () => options.expiry ?? null,
    now: () => Date.parse("2026-10-18T18:00:00Z"),
    setText: (id: string, text: string) => { byId(id).textContent = text; },
    window: { clearTimeout() {}, setTimeout() { return 1; }, navigator: { onLine: options.offlineHint !== false } }
  });
  const source = inlineRuntime(renderLgLegacyHtml());
  new Script(source.slice(source.indexOf("function parsePlayerTimestamp(value)"), source.indexOf("function errorCode(body, fallback)"))).runInContext(context);
  new Script(source.slice(source.indexOf("function hasHealthyVisiblePlayback()"), source.indexOf("function notifyLgWrapperReady()"))).runInContext(context);
  return { runtime, byId, run: (command: string) => new Script(command).runInContext(context) };
}

describe("LG Source-statusgrenzen", () => {
  it("toont uitsluitend bestaande download-/verificatiefasen zonder verzonnen percentages", () => {
    const view = statusHarness();
    view.run('setState("DOWNLOADING")');
    expect(view.byId("status").attributes["data-stage"]).toBe("download");
    expect(view.byId("title").textContent).toBe("We zetten alles klaar.");
    expect(view.byId("status-progress").hidden).toBe(false);
    view.run('setState("VERIFYING")');
    expect(view.byId("status").attributes["data-stage"]).toBe("verify");
    expect(view.byId("status-progress-label").textContent).toBe("Bestanden controleren");
    const progress = renderLgLegacyHtml().match(/<div class="px-sync-track"[^>]*>/)?.[0];
    expect(progress).toContain('role="progressbar"');
    expect(progress).not.toContain("aria-valuenow");
  });

  it("bedekt gezonde zichtbare last-known-good niet bij voorbereiding of verbindingsfout", () => {
    const view = statusHarness({ playback: true });
    view.run('setState("DOWNLOADING"); setState("VERIFYING"); showStatus("", "", "Werkelijke oorzaak", "NETWORK_ERROR")');
    expect(view.byId("status").hidden).toBe(true);
    expect(view.runtime.currentElement?.className).toBe("legacy-media-layer visible");
  });

  it("toont een echt mislukte huidige eerste weergave met oorzaak en herstelactie", () => {
    const view = statusHarness({ playback: true, failed: true });
    view.run('showStatus("", "", "Het bestand is beschadigd.", "LEGACY_ASSET_CHECKSUM_MISMATCH")');
    expect(view.byId("status").hidden).toBe(false);
    expect(view.byId("detail").textContent).toBe("Het bestand is beschadigd.");
    expect(view.byId("status-retry").hidden).toBe(false);
  });

  it("verbergt een door de server verlopen code zonder pairing of opslag te wijzigen", () => {
    const view = statusHarness({ expiry: "2026-10-18T19:00:00Z" });
    view.run('showPairing("ABC 123"); showStatus("", "", "Vraag opnieuw een code aan.", "PAIRING_CODE_EXPIRED")');
    expect(view.byId("status").attributes["data-stage"]).toBe("pairing-expired");
    expect(view.byId("pairing").hidden).toBe(true);
    expect(view.byId("pairing-code").textContent).toBe("");
  });

  it("laat de server beslissen over geldigheid bij een voorlopende TV-klok en normaliseert microseconden", () => {
    const view = statusHarness({ expiry: "2026-10-18T16:00:00.123456+00:00" });
    view.run('showPairing("ABC 123")');
    expect(view.byId("status").attributes["data-stage"]).toBe("pairing");
    expect(view.byId("pairing-code").textContent).toBe("ABC 123");
    expect(view.byId("pairing-code").innerHTML).toBe("ABC <b>123</b>");
    expect(view.byId("pairing-expiry").textContent).toContain("Code geldig tot");
  });

  it.each([undefined, "ongeldige-tijd"])("verbergt een code waarvan de tijdelijke geldigheid niet leesbaar is: %s", expiry => {
    const view = statusHarness({ expiry });
    view.run('showPairing("ABC 123")');
    expect(view.byId("status").attributes["data-stage"]).toBe("error");
    expect(view.byId("pairing").hidden).toBe(true);
    expect(view.byId("pairing-code").textContent).toBe("");
  });

  it("toont alleen de echte tijdelijke code en expiry", () => {
    const view = statusHarness({ expiry: "2026-10-18T19:00:00Z" });
    view.run('showPairing("ABC 123")');
    expect(view.byId("pairing-code").textContent).toBe("ABC 123");
    expect(view.byId("pairing-expiry").textContent).toContain("Code geldig tot");
    expect(view.byId("pairing").hidden).toBe(false);
    view.run('showPairing("invalid-code")');
    expect(view.byId("pairing").hidden).toBe(true);
    expect(view.byId("pairing-code").textContent).toBe("");
  });

  it("verwisselt een onbetrouwbare browserhint niet met bewezen netwerkuitval", () => {
    const view = statusHarness({ offlineHint: false });
    view.run('showStatus("", "", "De dienst reageert niet.", "INSTALLATION_API_UNAVAILABLE")');
    expect(view.byId("status").attributes["data-stage"]).toBe("error");
    view.run('showStatus("", "", "De verbinding is weg.", "NETWORK_ERROR")');
    expect(view.byId("status").attributes["data-stage"]).toBe("offline-empty");
  });
});
