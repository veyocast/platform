import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { expect, type Page } from "@playwright/test";
import {
  isSyncOnzeTrotsPresentation,
  syncSlidePresentationSchema,
  syncSlideRendererAssets,
  type SyncSlidePresentation,
} from "../../packages/contracts/src/index";
import { createSyncTemplatePreview } from "../../apps/control/app/(shell)/dashboard/studio/sync-template-preview";

export const s302Origin = "http://127.0.0.1:3496";
export type S302Surface = "control-preview" | "player-media";
export type S302Renderer = "sync-onzetrots-v9" | "sync-onzetrots-v1";
type S302Layout = { family?: "fixtures" | "results" | "matchday"; orientation?: "landscape" | "portrait"; count?: 0 | 3 | 5 };
let bundle = "";

/** Actual production preview and exported PlayerRuntime media component.
 * Controlled transport only: this is not a Next/Auth/manifest/offline-app test. */
export function prepareS302Fixture() {
  const require = createRequire(join(process.cwd(), "package.json"));
  const compiler = require.resolve("esbuild", { paths: [require.resolve("tsx")] });
  const entry = `
    import React from 'react';
    import {createRoot} from 'react-dom/client';
    import {PlaybackMedia} from './apps/player/app/_components/player-runtime';
    import {SyncSlidePreview} from './apps/control/app/(shell)/dashboard/playlists/_components/sites/sync-studio-preview';
    async function main(){
      const props=globalThis.fixture,item=props.item;
      item.syncSystemAssetUrls={};
      for(const asset of props.assets){
        const response=await fetch(asset.path),bytes=await response.arrayBuffer();
        const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(value=>value.toString(16).padStart(2,'0')).join('');
        if(!response.ok||hash!==asset.sha256||bytes.byteLength!==asset.bytes)throw Error('S302_ASSET_INTEGRITY');
        item.syncSystemAssetUrls[asset.path]=URL.createObjectURL(new Blob([bytes],{type:asset.mimeType}));
      }
      globalThis.s302Ready=[];globalThis.s302Pages=[];globalThis.s302Ended=[];
      const ready=id=>globalThis.s302Ready.push({id,at:performance.now()});
      createRoot(document.getElementById('root')).render(
        <div data-s302-surface={props.surface} style={{width:1920,height:1080}}>
        {props.surface==='control-preview'
          ?<SyncSlidePreview presentation={props.presentation} assetUrls={{}} durationSeconds={8} id={item.id} active onPageChange={page=>globalThis.s302Pages.push({page,at:performance.now()})}/>
          :<PlaybackMedia item={item} onReady={ready} onEnded={id=>globalThis.s302Ended.push({id,at:performance.now()})} onFailure={(id,code)=>{globalThis.s302Failure=code;}} watchdogTimeoutMs={10000}/>
        }</div>
      );
    }
    main().catch(error=>{globalThis.s302Failure=error.message;});
  `;
  const script = `const output=await require(${JSON.stringify(compiler)}).build({stdin:{contents:${JSON.stringify(entry)},resolveDir:process.cwd(),loader:'tsx'},nodePaths:[process.cwd()+'/apps/player/node_modules'],bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',loader:{'.css':'empty','.module.css':'empty'},define:{'process.env':'{}'}});process.stdout.write(output.outputFiles[0].text);`;
  bundle = execFileSync(process.execPath, ["-e", `(async()=>{${script}})().catch(error=>{console.error(error.message);process.exitCode=1})`], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024, timeout: 30_000 });
  return { bundleSha256: createHash("sha256").update(bundle).digest("hex"), boundary: "Real Control SyncSlidePreview and PlayerRuntime PlaybackMedia; controlled local assets, without full Next/Auth/manifest/LKG startup." };
}

export function s302Presentation(tail: 1 | 2 | 3, renderer: S302Renderer, layout: S302Layout = {}) {
  const sample = createSyncTemplatePreview(layout.family ?? "fixtures", renderer);
  if (!isSyncOnzeTrotsPresentation(sample)) throw Error("S302_RENDERER_REQUIRED");
  const program = createSyncTemplatePreview("fixtures", renderer);
  const original = isSyncOnzeTrotsPresentation(program) ? program.rich?.fixtures?.[0] : undefined;
  if (!original?.home.logo || !original.away.logo) throw Error("S302_REAL_CREST_FIXTURE_REQUIRED");
  const fixtures = Array.from({ length: layout.count ?? 6 + tail }, (_, index) => ({
    ...original,
    id: `s302-match-${index + 1}`,
    kickoffAt: new Date(Date.parse("2026-11-09T12:00:00Z") + index * 30 * 60_000).toISOString(),
    home: { ...original.home, name: `Duindorp SV JO17-${index + 1}` },
    away: { ...original.away, name: `Sportvereniging Scheveningen JO17-${index + 1}` },
    status: layout.family === "results" ? "finished" as const : "scheduled" as const,
    homeScore: layout.family === "results" ? index : null,
    awayScore: layout.family === "results" ? 0 : null,
  }));
  const presentation = syncSlidePresentationSchema.parse({
    ...sample, orientation: layout.orientation ?? "landscape", title: "Vandaag op het veld",
    style: { ...sample.style, motion: "geen" },
    ...(sample.rendererVersion === "sync-onzetrots-v9" ? { authoring: { ...sample.authoring, headerTexts: { ...sample.authoring.headerTexts, fixtures: "Vandaag op het veld" } } } : {}),
    rich: { ...sample.rich, fixtures },
  });
  return { presentation, fixtures };
}

export async function mountS302Fixture(page: Page, surface: S302Surface, tail: 1 | 2 | 3, renderer: S302Renderer, layout: S302Layout = {}) {
  const { presentation, fixtures } = s302Presentation(tail, renderer, layout);
  const assets = syncSlideRendererAssets(presentation);
  const item = {
    id: "30200000-0000-4000-8000-000000000001", kind: "video", durationSeconds: 8,
    syncStudioPresentation: presentation, syncStudioDurationMs: 8_000, syncStudioAssets: {}, fitMode: "contain",
    source: { checksumSha256: "a".repeat(64), bytes: 100, mimeType: "video/mp4", url: "/unneeded-binary.mp4" },
  };
  const errors: string[] = [], unexpectedRequests: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route(s302Origin + "/**", route => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/fixture.js") return route.fulfill({ contentType: "text/javascript", body: bundle });
    const asset = assets.find(value => value.path === path);
    if (asset) return route.fulfill({ contentType: asset.mimeType, body: readFileSync(join(process.cwd(), "apps/player/public", path)) });
    if (path === "/") return route.fulfill({ contentType: "text/html", body: `<!doctype html><html lang="nl"><head><meta charset="utf-8"><style>html,body{margin:0;width:1920px;height:1080px;overflow:hidden}</style></head><body><div id="root"></div><script>globalThis.fixture=${JSON.stringify({ surface, presentation, item, assets }).replace(/</g, "\\u003c")};</script><script src="/fixture.js"></script></body></html>` });
    unexpectedRequests.push(path);
    return route.abort();
  });
  await page.goto(s302Origin);
  if (layout.family === "matchday") await expect(page.locator(".dashboard-fixtures")).toBeVisible();
  else await expect(page.locator(".matches-grid .match-card")).toHaveCount(Math.min(fixtures.length, layout.orientation === "portrait" ? 5 : 6));
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(image => image.decode())); await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))); });
  if (surface === "player-media") {
    await expect(page.locator(".playback-sync")).toHaveAttribute("data-sync-ready", "true");
    await expect.poll(() => page.evaluate(() => Reflect.get(globalThis, "s302Ready")?.length)).toBe(1);
  }
  return { presentation: presentation as SyncSlidePresentation, fixtures, errors, unexpectedRequests };
}
