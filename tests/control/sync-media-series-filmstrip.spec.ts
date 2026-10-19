import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import type { MediaFrameCommand, MediaFrameSettings } from "../../packages/contracts/src/media-frames";
import type { MediaFrameEditorProps } from "../../apps/control/app/(shell)/dashboard/content/media-frames/media-frame-types";
import type { MediaFrameSeriesCommand, MediaFrameSeriesResult } from "../../apps/control/app/(shell)/dashboard/content/media-frames/media-frame-series-types";

// Real editor, Source frame, filmstrip and CSS. Only router/server transports
// are controlled: these tests claim no provider, DB transaction or release proof.
const origin = "http://127.0.0.1:3375", require = createRequire(join(process.cwd(), "package.json"));
const compiler = require.resolve("esbuild", { paths: [require.resolve("tsx")] });
let bundle: { js: string; css: string };
test.beforeAll(() => {
  const entry = `import React,{useState}from'react';import{createRoot}from'react-dom/client';import{DialogPortalProvider}from'./packages/ui/src/components/dialog';import{MediaFrameEditor}from'./apps/control/app/(shell)/dashboard/content/media-frames/media-frame-editor';function App(){const[portal,setPortal]=useState(null),[props,setProps]=useState(globalThis.fixtureProps);globalThis.replaceFixtureProps=setProps;globalThis.navigate=path=>{if(globalThis.failNavigation)throw Error('Controlled navigation failure');globalThis.visited=(globalThis.visited||[]).concat(path);fetch('/__fixture/props?href='+encodeURIComponent(path)).then(r=>r.json()).then(next=>{history.pushState({},'',path);setProps(next)});};return <div ref={setPortal} className="sync-control app-shell" style={{display:'block'}}><DialogPortalProvider container={portal}><main className="main-content" id="control-content">{props?<MediaFrameEditor {...props}/>:<a href="/dashboard/content/media/source/20000000-0000-4000-8000-000000000001" onClick={event=>{event.preventDefault();globalThis.navigate(event.currentTarget.getAttribute('href'))}}>Huidig ontwerp openen</a>}</main></DialogPortalProvider></div>}createRoot(document.getElementById('root')).render(<App/>);`;
  const transport = `async function post(path,input,actorScope){const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({input,actorScope})});if(!r.ok)throw Error('Transport unavailable');return r.json()}export const mutateMediaFrameAction=(input,actorScope)=>post('/__series/frame',input,actorScope);export const readMediaFrameSourceAction=(input,actorScope)=>post('/__series/source',input,actorScope);export const mutateMediaFrameSeriesAction=(input,actorScope)=>post('/__series/mutate',input,actorScope);export const readContentFilmstripAction=(input,actorScope)=>post('/__series/filmstrip',input,actorScope);`;
  const code = `const result=await require(${JSON.stringify(compiler)}).build({stdin:{contents:${JSON.stringify(entry)},resolveDir:process.cwd(),loader:'tsx'},nodePaths:[process.cwd()+'/apps/control/node_modules'],bundle:true,write:false,outfile:'fixture.js',platform:'browser',format:'iife',jsx:'automatic',loader:{'.module.css':'local-css','.css':'css'},plugins:[{name:'controlled-transports',setup(b){b.onResolve({filter:/media-frame-(?:series-)?actions$/},a=>({path:a.path,namespace:'actions'}));b.onLoad({filter:/.*/,namespace:'actions'},()=>({contents:${JSON.stringify(transport)},loader:'js'}));b.onResolve({filter:/^next\\/navigation$/},a=>({path:a.path,namespace:'navigation'}));b.onLoad({filter:/.*/,namespace:'navigation'},()=>({contents:'export const useRouter=()=>({push:path=>globalThis.navigate(path),replace:path=>globalThis.navigate(path),refresh:()=>{globalThis.refreshCount=(globalThis.refreshCount||0)+1}});',loader:'js'}));b.onResolve({filter:/^next\\/(link|image)$/},a=>({path:a.path,namespace:'view'}));b.onLoad({filter:/.*/,namespace:'view'},a=>({contents:a.path.endsWith('image')?'import React from"react";export default function Image({fill,unoptimized,...props}){return React.createElement("img",props)}':'import React from"react";export default function Link({onClick,...props}){return React.createElement("a",{...props,onClick:event=>{onClick?.(event);if(!event.defaultPrevented&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey){event.preventDefault();globalThis.navigate(props.href)}}})}',resolveDir:process.cwd(),loader:'js'}));}}]});process.stdout.write(JSON.stringify({js:result.outputFiles.find(f=>f.path.endsWith('.js')).text,css:result.outputFiles.find(f=>f.path.endsWith('.css')).text}));`;
  bundle = JSON.parse(execFileSync(process.execPath, ["-e", `(async()=>{${code}})().catch(e=>{console.error(e);process.exitCode=1})`], { encoding: "utf8", timeout: 30_000, maxBuffer: 16 * 1024 * 1024 }));
});
const tenant = "10000000-0000-4000-8000-000000000001", asset = "20000000-0000-4000-8000-000000000001", frame = "30000000-0000-4000-8000-000000000001", other = "30000000-0000-4000-8000-000000000002", series = "60000000-0000-4000-8000-000000000001";
const ownHref = `/dashboard/content/media/source/${asset}`, otherHref = `/dashboard/content/media/${other}`;
const settings: MediaFrameSettings = { schemaVersion: 1, name: "Eigen ontwerp", orientation: "landscape", durationSeconds: 901, fitMode: "contain", focus: "right", appearance: { themeId: "onzetrots-tv", accentColor: "#1763ed", background: { kind: "preset", preset: "light" } }, sourceMetadata: { title: "Metadata", headline: "", subtitle: "", body: "Geen overlay", footer: "", font: "Arial", scale: 150, alignment: "right", safeMargin: 12, showLogo: true, showFooter: true, motion: "geen" } };
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jf1sAAAAASUVORK5CYII=", "base64");
type Write = { input: MediaFrameSeriesCommand | MediaFrameCommand; actorScope: string; path: string };
async function mount(page: Page, options: { isNew?: boolean; bound?: boolean; dropFirst?: boolean; rejectSecond?: boolean; failPage?: boolean } = {}) {
  const errors: string[] = [], unexpected: string[] = [], writes: Write[] = [], reads: unknown[] = [], receipts = new Map<string, object>();
  const source = { mediaAssetId: asset, kind: "image" as const, title: "Eigen bron", fileName: "eigen.png", width: 1200, height: 800, durationSeconds: null, byteSize: 1024, sourceUrl: `${origin}/image.png`, posterUrl: null, expectedSource: { role: "media" as const, mediaAssetId: asset, variantId: "50000000-0000-4000-8000-000000000001", checksumSha256: "a".repeat(64), byteSize: 1024 } };
  const items = [{ key: `media:${asset}`, title: settings.name, href: ownHref, orientation: "landscape", preview: { kind: "image" as const, url: source.sourceUrl } }, { key: `media-frame:${other}`, title: "Eigen staand ontwerp", href: otherHref, orientation: "portrait", preview: { kind: "media-frame" as const, value: { settings: { ...settings, orientation: "portrait" as const }, sourceUrl: source.sourceUrl, kind: "image" as const } } }, { key: "studio:40000000-0000-4000-8000-000000000001", title: "Eigen Studio", href: "/dashboard/studio/40000000-0000-4000-8000-000000000001", orientation: "landscape", preview: { kind: "unavailable" as const, message: "Geen geverifieerd voorbeeld" } }, { key: "dynamic:40000000-0000-4000-8000-000000000002", title: "Eigen nieuws", href: "/dashboard/slides/40000000-0000-4000-8000-000000000002", orientation: "landscape", preview: { kind: "image" as const, url: source.sourceUrl } }];
  const extra = { contentKey: `media:${asset}`, membership: options.bound ? { seriesId: series, seriesRevision: 20, seriesTitle: "Eigen reeks", position: 0 } : null, series: options.bound ? { id: series, revision: 20, memberCount: 20 } : null, filmstrip: { items, offset: 0, total: 5, hasMore: true } };
  let props: MediaFrameEditorProps = { tenantId: tenant, actorScope: `${tenant}:actor-a`, frameId: frame, isPrimary: true, isNew: Boolean(options.isNew), frameRevision: options.isNew ? 0 : 1, versionId: options.isNew ? null : "70000000-0000-4000-8000-000000000001", versionNumber: options.isNew ? 0 : 1, settings: structuredClone(settings), mainSource: source, imageSources: [], versions: [], canWrite: true, mediaSeries: extra };
  const routes = new Map<string, MediaFrameEditorProps>([[otherHref, { ...structuredClone(props), frameId: other, isPrimary: false, isNew: false, frameRevision: 1, settings: { ...settings, name: "Eigen staand ontwerp", orientation: "portrait" }, mediaSeries: { ...structuredClone(extra), contentKey: `media-frame:${other}` } }]]);
  let deferredPage: Promise<void> | null = null;
  const getProps = (path: string) => path === ownHref || path === `/dashboard/content/media/${frame}` ? props : routes.get(path) ?? null;
  page.on("pageerror", error => errors.push(error.message));
  page.on("dialog", dialog => { expect(dialog.type()).toBe("beforeunload"); void dialog.accept(); });
  const css = ["tokens/veyocast-design-tokens.css", "packages/ui/src/styles.css", "apps/control/app/globals.css", "apps/control/app/fieldflow.css", "apps/control/app/sync-source.css", "apps/control/app/sync-adapter.css"].map(path => readFileSync(path, "utf8").replace(/@import[^;]+;/g, "")).join("\n");
  await page.route("**/*", async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== origin) { unexpected.push(url.origin); return route.abort(); }
    if (url.pathname.startsWith("/assets/")) {
      const name = url.pathname.split("/").at(-1)!; if (!/^[a-zA-Z0-9_.-]+$/.test(name)) return route.abort();
      return route.fulfill({ body: readFileSync(join(process.cwd(), "apps/control/public/assets", name)), contentType: name.endsWith("woff2") ? "font/woff2" : name.endsWith("ttf") ? "font/ttf" : "image/webp" });
    }
    if (url.pathname === "/image.png") return route.fulfill({ body: png, contentType: "image/png" });
    if (url.pathname === "/__fixture/props") return route.fulfill({ json: getProps(url.searchParams.get("href") ?? "") });
    if (url.pathname === "/__series/filmstrip") {
      reads.push(request.postDataJSON());
      if (deferredPage) { const pending = deferredPage; deferredPage = null; await pending; }
      if (options.failPage && reads.length === 1) return route.fulfill({ json: { ok: false, message: "Bibliotheek tijdelijk niet bereikbaar; probeer opnieuw." } });
      return route.fulfill({ json: { ok: true, page: { offset: 4, total: 5, hasMore: false, items: [{ ...items[0]!, key: "media:20000000-0000-4000-8000-000000000099", title: "Verder eigen ontwerp", href: "/dashboard/content/media/source/20000000-0000-4000-8000-000000000099" }] } } });
    }
    if (["/__series/mutate", "/__series/frame"].includes(url.pathname)) {
      const requestData = request.postDataJSON() as Omit<Write, "path">, input = requestData.input;
      writes.push({ ...requestData, path: url.pathname });
      if (options.rejectSecond && writes.length === 2) return route.fulfill({ json: { ok: false, code: "denied", uncertain: true, message: "De eerdere opdracht blijft bewaard; herstel de toegang en bevestig opnieuw." } });
      let receipt = receipts.get(input.idempotencyKey);
      if (!receipt) {
        const command = input as MediaFrameSeriesCommand;
        const revision = props.frameRevision + 1, number = props.versionNumber + 1;
        if (url.pathname === "/__series/mutate") {
          const memberCount = command.operation === "append" ? (props.mediaSeries?.series?.memberCount ?? 1) + 1 : props.mediaSeries?.series?.memberCount ?? 1;
          const membership = { seriesId: command.seriesId ?? series, seriesRevision: (command.expectedSeriesRevision ?? 0) + 1, seriesTitle: command.operation === "append" ? command.seriesTitle.trim() || command.settings.name : command.seriesTitle, position: props.mediaSeries?.membership?.position ?? 0 };
          const group = { id: membership.seriesId, revision: membership.seriesRevision, memberCount };
          const appended = command.operation === "append" ? { frameId: command.newFrameId, frameRevision: 1, versionId: "70000000-0000-4000-8000-000000000002", versionNumber: 1, contentKey: `media-frame:${command.newFrameId}`, href: `/dashboard/content/media/${command.newFrameId}`, name: `${membership.seriesTitle} · slide ${memberCount}`, membership: { ...membership, position: memberCount - 1 } } : null;
          receipt = { ok: true, current: { frameId: command.frameId, frameRevision: revision, versionId: "70000000-0000-4000-8000-000000000003", versionNumber: number }, membership, series: group, appended } satisfies Extract<MediaFrameSeriesResult, { ok: true }>;
          props = { ...props, frameId: command.frameId, frameRevision: revision, versionNumber: number, settings: structuredClone(command.settings), mediaSeries: { ...extra, membership, series: group } };
          if (appended) routes.set(appended.href, { ...structuredClone(props), frameId: appended.frameId, isNew: false, isPrimary: false, frameRevision: 1, versionNumber: 1, settings: { ...command.settings, name: appended.name }, mediaSeries: { ...extra, contentKey: appended.contentKey, membership: appended.membership, series: group } });
        } else {
          const frameCommand = input as MediaFrameCommand;
          receipt = { ok: true, frameId: input.frameId, frameRevision: revision, versionId: "70000000-0000-4000-8000-000000000003", versionNumber: number, outcome: frameCommand.operation === "create" ? "created" : "saved" };
          if ("settings" in frameCommand) props = { ...props, frameId: input.frameId, frameRevision: revision, versionNumber: number, settings: structuredClone(frameCommand.settings) };
        }
        receipts.set(input.idempotencyKey, receipt);
      }
      if (options.dropFirst && writes.length === 1) return route.abort();
      return route.fulfill({ json: receipt });
    }
    if (request.method() !== "GET") { unexpected.push(`${request.method()} ${url.pathname}`); return route.abort(); }
    const selected = getProps(url.pathname);
    if (!selected) return route.fulfill({ status: 404, body: "No fixture route" });
    return route.fulfill({ contentType: "text/html", body: `<!doctype html><html lang="nl" data-design-system="fieldflow"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mediareeksen · VeyoCast</title><style>${css}\n${bundle.css}</style></head><body><div id="root"></div><script>globalThis.fixtureProps=${JSON.stringify(selected).replace(/</g, "\\u003c")};${bundle.js.replace(/<\/script/gi, "<\\/script")}</script></body></html>` });
  });
  await page.goto(origin + ownHref); await expect(page.getByLabel("Ontwerpnaam", { exact: true })).toBeEnabled();
  return { errors, unexpected, writes, reads, receipts, deferNextPage: () => { let release!: () => void; deferredPage = new Promise<void>(resolve => { release = resolve; }); return release; }, get props() { return props; }, replace: async (change: Partial<MediaFrameEditorProps>) => { props = { ...props, ...change }; await page.evaluate(value => (globalThis as typeof globalThis & { replaceFixtureProps: (value: MediaFrameEditorProps) => void }).replaceFixtureProps(value), props); } };
}
async function openSettings(page: Page) { await page.getByRole("button", { name: "Instellingen", exact: true }).click(); }
async function journal(page: Page) { return page.evaluate(() => JSON.parse(sessionStorage.getItem(Object.keys(sessionStorage).find(key => key.startsWith("veyocast-media-frame-v1:"))!)!)); }

for (const width of [390, 1440]) test(`Source filmstrip/reeks controls, actual links and accessibility at ${width}`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 960 }); const fixture = await mount(page);
  await openSettings(page); const field = page.getByLabel("Onderdeel van een reeks", { exact: true });
  await expect(field).toBeVisible(); expect((await field.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  const append = page.getByRole("button", { name: "Slide aan deze reeks toevoegen", exact: true }); expect((await append.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  const strip = page.locator(".vc-studio-filmstrip");
  if (width === 390) await expect(strip).not.toBeVisible();
  else {
    await expect(strip).toBeVisible(); await expect(strip.getByRole("button", { name: "Huidig ontwerp: Eigen ontwerp", exact: true })).toHaveCount(1);
    await expect(strip.getByRole("link", { name: "Ontwerp openen: Eigen Studio", exact: true })).toHaveAttribute("href", /\/dashboard\/studio\//);
    await expect(strip.getByRole("link", { name: "Ontwerp openen: Eigen nieuws", exact: true })).toHaveAttribute("href", /\/dashboard\/slides\//);
    const portrait = strip.getByRole("link", { name: "Ontwerp openen: Eigen staand ontwerp", exact: true }).locator("span").first();
    expect((await portrait.boundingBox())!.width).toBe(35); expect((await portrait.boundingBox())!.height).toBe(62);
    await strip.getByRole("button", { name: /Meer ontwerpen laden/ }).click(); await expect(strip.getByRole("link", { name: "Ontwerp openen: Verder eigen ontwerp", exact: true })).toBeVisible();
    expect(fixture.reads).toEqual([{ input: { tenantId: tenant, offset: 4 }, actorScope: `${tenant}:actor-a` }]);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze()).violations).toEqual([]);
  await info.attach(`media-series-${width}`, { body: await page.screenshot(), contentType: "image/png" });
  expect(fixture.writes).toHaveLength(0); expect(fixture.errors).toEqual([]); expect(fixture.unexpected).toEqual([]);
});

test("filmstrip navigation durably keeps unsaved frame and member label, with undo/redo and no server save", async ({ page }) => {
  const fixture = await mount(page); await page.getByLabel("Ontwerpnaam", { exact: true }).fill("Mijn vuile ontwerp"); await openSettings(page);
  const title = page.getByLabel("Onderdeel van een reeks", { exact: true }); await title.fill("Mijn reeks");
  await page.getByRole("button", { name: "Ongedaan maken", exact: true }).click(); await expect(title).toHaveValue("");
  await page.getByRole("button", { name: "Opnieuw uitvoeren", exact: true }).click(); await expect(title).toHaveValue("Mijn reeks");
  await page.getByRole("link", { name: "Ontwerp openen: Eigen staand ontwerp", exact: true }).click(); await expect(page.getByLabel("Ontwerpnaam", { exact: true })).toHaveValue("Eigen staand ontwerp");
  await page.getByRole("link", { name: "Ontwerp openen: Eigen ontwerp", exact: true }).click(); await expect(page.getByLabel("Ontwerpnaam", { exact: true })).toHaveValue("Mijn vuile ontwerp"); await openSettings(page); await expect(title).toHaveValue("Mijn reeks");
  expect(fixture.writes).toHaveLength(0); expect(fixture.errors).toEqual([]);
});

test("failed durable navigation blocks filmstrip, Back and Alles bekijken without losing input", async ({ page }) => {
  const fixture = await mount(page); await page.getByLabel("Ontwerpnaam", { exact: true }).fill("Blijft hier");
  await page.evaluate(() => { const original = Storage.prototype.setItem; (globalThis as typeof globalThis & { restoreStorage: () => void }).restoreStorage = () => { Storage.prototype.setItem = original; }; Storage.prototype.setItem = function(key, value) { if (key.startsWith("veyocast-media-frame-v1:")) throw Error("Controlled storage failure"); return original.call(this, key, value); }; });
  for (const name of ["Ontwerp openen: Eigen staand ontwerp", "Terug naar bibliotheek", "Alles bekijken"]) await page.getByRole("link", { name, exact: true }).click();
  expect(await page.evaluate(() => (globalThis as typeof globalThis & { visited?: string[] }).visited ?? [])).toEqual([]);
  await expect(page.getByRole("alert")).toContainText("herstelgegevens niet bewaren"); await expect(page.getByLabel("Ontwerpnaam", { exact: true })).toHaveValue("Blijft hier");
  await page.evaluate(() => (globalThis as typeof globalThis & { restoreStorage: () => void }).restoreStorage()); expect(fixture.writes).toHaveLength(0);
});

test("bound member blank title saves atomically and twenty existing members do not disable append", async ({ page }) => {
  const fixture = await mount(page, { bound: true }); await openSettings(page); const title = page.getByLabel("Onderdeel van een reeks", { exact: true }); await title.fill("");
  await page.getByRole("button", { name: "Opslaan", exact: true }).click(); await expect.poll(() => fixture.writes.length).toBe(1);
  expect(fixture.writes[0]!.input).toMatchObject({ kind: "media-series", operation: "save", seriesTitle: "", seriesId: series, expectedSeriesRevision: 20, expectedFrameRevision: 1, expectedSources: [fixture.props.mainSource.expectedSource] });
  await expect(page.getByRole("button", { name: "Slide aan deze reeks toevoegen", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Slide aan deze reeks toevoegen", exact: true }).click(); await expect.poll(() => fixture.writes.length).toBe(2);
  expect(fixture.writes[1]!.input).toMatchObject({ operation: "append", seriesId: series, expectedSeriesRevision: 21, seriesTitle: "" });
  await expect(page.getByLabel("Ontwerpnaam", { exact: true })).toHaveValue("Eigen ontwerp · slide 21"); expect(fixture.receipts.size).toBe(2); expect(fixture.errors).toEqual([]);
});

test("first append lost response reload and temporary rejection keep exact request and one confirmed destination", async ({ page }) => {
  const fixture = await mount(page, { isNew: true, dropFirst: true, rejectSecond: true }); await openSettings(page); await page.getByLabel("Onderdeel van een reeks", { exact: true }).fill("  Zondag  "); await page.getByRole("button", { name: "Slide aan deze reeks toevoegen", exact: true }).click();
  await expect(page.getByRole("button", { name: "Oorspronkelijke opdracht opnieuw bevestigen", exact: true })).toBeVisible();
  const first = structuredClone(fixture.writes[0]!); expect((await journal(page)).pending).toMatchObject({ kind: "series", command: first.input });
  await page.reload(); await expect(page.getByLabel("Ontwerpnaam", { exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Oorspronkelijke opdracht opnieuw bevestigen", exact: true }).click(); await expect.poll(() => fixture.writes.length).toBe(2); expect(fixture.writes[1]).toEqual(first);
  await page.evaluate(() => { (globalThis as typeof globalThis & { failNavigation: boolean }).failNavigation = true; });
  await page.getByRole("button", { name: "Oorspronkelijke opdracht opnieuw bevestigen", exact: true }).click(); await expect.poll(() => fixture.writes.length).toBe(3); expect(fixture.writes[2]).toEqual(first); expect(fixture.receipts.size).toBe(1);
  const confirmed = await journal(page); expect(confirmed.pending).toBeNull(); expect(confirmed.confirmedAppend.frameId).toBe((first.input as MediaFrameSeriesCommand & { operation: "append" }).newFrameId); expect(confirmed.seriesDraft.seriesTitle).toBe("Zondag");
  await expect(page.getByRole("link", { name: "Toegevoegde slide openen: Zondag · slide 2", exact: true })).toBeVisible();
  await page.evaluate(() => { (globalThis as typeof globalThis & { failNavigation: boolean }).failNavigation = false; });
  await page.getByRole("link", { name: "Toegevoegde slide openen: Zondag · slide 2", exact: true }).click(); await expect(page.getByLabel("Ontwerpnaam", { exact: true })).toHaveValue("Zondag · slide 2"); expect(fixture.errors).toEqual([]);
});

test("fresh group read cannot pair stale local title with the new CAS; explicit rebase retains input", async ({ page }) => {
  const fixture = await mount(page, { bound: true }); await openSettings(page); await page.getByLabel("Onderdeel van een reeks", { exact: true }).fill("Mijn lokale reeksnaam");
  await fixture.replace({ mediaSeries: { ...fixture.props.mediaSeries!, membership: { ...fixture.props.mediaSeries!.membership!, seriesRevision: 22, seriesTitle: "Door ander aangepast" }, series: { id: series, revision: 22, memberCount: 21 } } });
  await expect(page.getByRole("button", { name: "Opslaan", exact: true })).toBeDisabled(); await expect(page.getByLabel("Onderdeel van een reeks", { exact: true })).toHaveValue("Mijn lokale reeksnaam");
  await page.getByRole("button", { name: "Mijn invoer op actuele revisie gebruiken", exact: true }).click(); await page.getByRole("button", { name: "Opslaan", exact: true }).click(); await expect.poll(() => fixture.writes.length).toBe(1);
  expect(fixture.writes[0]!.input).toMatchObject({ expectedSeriesRevision: 22, seriesTitle: "Mijn lokale reeksnaam" }); expect(fixture.errors).toEqual([]);
});

test("legacy v1 uncertain frame command remains a frame command even when fresh props now offer series", async ({ page }) => {
  const fixture = await mount(page, { isNew: true }); await page.getByLabel("Ontwerpnaam", { exact: true }).fill("Legacy invoer");
  await page.evaluate(() => { const key = Object.keys(sessionStorage).find(key => key.startsWith("veyocast-media-frame-v1:"))!, value = JSON.parse(sessionStorage.getItem(key)!); const pending = { operation: "create", tenantId: value.tenantId, frameId: value.frameId, sourceAssetId: value.assetId, expectedRevision: 0, settings: { ...value.draft.settings, durationSeconds: 901 }, expectedSources: value.sources, idempotencyKey: "90000000-0000-4000-8000-000000000001" }; const { seriesDraft, confirmedAppend, ...base } = value; void seriesDraft; void confirmedAppend; sessionStorage.setItem(key, JSON.stringify({ ...base, schemaVersion: 1, pending })); });
  await page.reload(); await page.getByRole("button", { name: "Oorspronkelijke opdracht opnieuw bevestigen", exact: true }).click(); await expect.poll(() => fixture.writes.length).toBe(1);
  expect(fixture.writes[0]!.path).toBe("/__series/frame"); expect(fixture.writes[0]!.input).toMatchObject({ operation: "create", frameId: frame, idempotencyKey: "90000000-0000-4000-8000-000000000001", settings: { name: "Legacy invoer" } }); expect(fixture.errors).toEqual([]);
});

test("filmstrip page failure preserves existing cards and actor-bound read retry makes no mutation", async ({ page }) => {
  const fixture = await mount(page, { failPage: true }); await page.getByRole("button", { name: /Meer ontwerpen laden/ }).click(); await expect(page.getByRole("alert")).toContainText("tijdelijk niet bereikbaar");
  await expect(page.getByRole("link", { name: "Ontwerp openen: Eigen staand ontwerp", exact: true })).toBeVisible(); await page.getByRole("button", { name: "Opnieuw proberen", exact: true }).click(); await expect(page.getByRole("link", { name: "Ontwerp openen: Verder eigen ontwerp", exact: true })).toBeVisible(); expect(fixture.reads).toHaveLength(2);
  const moved = { ...fixture.props.mediaSeries!.filmstrip.items[0]!, key: "media:20000000-0000-4000-8000-000000000099", title: "Vers bijgewerkt ontwerp", href: "/dashboard/content/media/source/20000000-0000-4000-8000-000000000099" };
  await fixture.replace({ mediaSeries: { ...fixture.props.mediaSeries!, filmstrip: { ...fixture.props.mediaSeries!.filmstrip, items: [...fixture.props.mediaSeries!.filmstrip.items, moved], hasMore: false } } });
  await expect(page.getByRole("link", { name: "Ontwerp openen: Vers bijgewerkt ontwerp", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ontwerp openen: Verder eigen ontwerp", exact: true })).toHaveCount(0);
  await fixture.replace({ mediaSeries: { ...fixture.props.mediaSeries!, filmstrip: { ...fixture.props.mediaSeries!.filmstrip, items: fixture.props.mediaSeries!.filmstrip.items.filter(item => item.key !== moved.key), total: 4 } } });
  await expect(page.getByRole("link", { name: "Ontwerp openen: Vers bijgewerkt ontwerp", exact: true })).toHaveCount(0);
  await fixture.replace({ mediaSeries: { ...fixture.props.mediaSeries!, filmstrip: { ...fixture.props.mediaSeries!.filmstrip, hasMore: true } } });
  const release = fixture.deferNextPage(); await page.getByRole("button", { name: /Meer ontwerpen laden/ }).click(); await expect.poll(() => fixture.reads.length).toBe(3);
  await fixture.replace({ mediaSeries: { ...fixture.props.mediaSeries!, filmstrip: { ...fixture.props.mediaSeries!.filmstrip, hasMore: false } } });
  release(); await expect(page.getByRole("button", { name: /Ontwerpen laden/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Ontwerp openen: Verder eigen ontwerp", exact: true })).toHaveCount(0);
  expect(fixture.writes).toHaveLength(0); expect(fixture.errors).toEqual([]);
});
