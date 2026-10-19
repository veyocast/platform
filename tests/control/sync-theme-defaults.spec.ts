import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import type { SyncThemeDefaultsCommand, SyncThemeDefaultsProfile } from "../../packages/contracts/src/sync-theme-creation-defaults";

// Product Dialog, recovery, projector and StaticView; only the Server Action
// transport is controlled. These are not hosted-service or tenant-save claims.
const origin = "http://127.0.0.1:3389", tenantId = "23500000-0000-4000-8000-000000000001";
const actor = `${tenantId}:23500000-0000-4000-8000-000000000002`;
const key = `veyocast:publisher-recovery:v1:sync-theme-defaults:${tenantId}:${actor}:fieldflow`;
const initialProfile: SyncThemeDefaultsProfile = { themeId: "fieldflow", themeVersion: "1.0.0", revision: 0, configured: false, defaults: null };
const require = createRequire(join(process.cwd(), "package.json"));
const compiler = require.resolve("esbuild", { paths: [require.resolve("tsx")] });
let bundle: { js: string; css: string };

test.beforeAll(() => {
  const entry = `import React,{useState}from'react';import{createRoot}from'react-dom/client';import{DialogPortalProvider}from'./packages/ui/src/components/dialog';import{SyncThemeDefaultsDialog}from'./apps/control/app/(shell)/dashboard/themes/sync-theme-defaults-dialog';function App(){const[portal,setPortal]=useState(null),[actor,setActor]=useState(${JSON.stringify(actor)}),[profile,setProfile]=useState(globalThis.fixtureProfile);globalThis.setThemeActor=setActor;globalThis.setThemeProfile=setProfile;return <div className="sync-control app-shell" style={{display:'block'}} ref={setPortal}><DialogPortalProvider container={portal}><main id="control-content"><h1>Thema’s</h1><SyncThemeDefaultsDialog tenantId=${JSON.stringify(tenantId)} actorScope={actor} tenantName="Eigen QA-club" themeId="fieldflow" themeName="FieldFlow" profile={profile} canWrite={globalThis.fixtureCanWrite}/></main></DialogPortalProvider></div>}createRoot(document.getElementById('root')).render(<App/>);`;
  const script = `const result=await require(${JSON.stringify(compiler)}).build({stdin:{contents:${JSON.stringify(entry)},resolveDir:process.cwd(),loader:'tsx'},nodePaths:[process.cwd()+'/apps/control/node_modules'],bundle:true,write:false,outfile:'fixture.js',platform:'browser',format:'iife',jsx:'automatic',loader:{'.module.css':'local-css','.css':'css'},plugins:[{name:'controlled-actions',setup(b){b.onResolve({filter:/sync-theme-defaults-actions$/},a=>({path:a.path,namespace:'actions'}));b.onLoad({filter:/.*/,namespace:'actions'},()=>({contents:'export async function saveSyncThemeCreationDefaultsAction(input,scope){const r=await fetch("/__theme/save",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({input,scope})});if(!r.ok)throw Error("Response unavailable");return r.json()}export async function readSyncThemeCreationDefaultsAction(scope){const r=await fetch("/__theme/read",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({scope})});if(!r.ok)throw Error("Read unavailable");return r.json()}',loader:'js'}));b.onResolve({filter:/^next[/]link$/},a=>({path:a.path,namespace:'link'}));b.onLoad({filter:/.*/,namespace:'link'},()=>({resolveDir:process.cwd(),contents:'import React from"react";export default function Link(props){return React.createElement("a",props)}',loader:'js'}));}}]});const js=result.outputFiles.find(f=>f.path.endsWith('.js'))?.text,css=result.outputFiles.find(f=>f.path.endsWith('.css'))?.text;if(!js||!css)throw Error('Missing product fixture JS/CSS');process.stdout.write(JSON.stringify({js,css}));`;
  bundle = JSON.parse(execFileSync(process.execPath, ["-e", `(async()=>{${script}})().catch(e=>{console.error(e);process.exitCode=1})`], { encoding: "utf8", timeout: 30_000, maxBuffer: 16 * 1024 * 1024 }));
});

type Wire = { input: SyncThemeDefaultsCommand; scope: string };
const ack = (command: SyncThemeDefaultsCommand) => ({ ok: true, value: { schemaVersion: 1, outcome: "applied", tenantId: command.tenantId, themeId: command.themeId, revision: command.expectedRevision + 1, defaults: command.defaults } });

async function mount(page: Page, options: { canWrite?: boolean; profile?: SyncThemeDefaultsProfile } = {}) {
  const errors: string[] = [], commands: Wire[] = [], durableAtPost: unknown[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const css = ["tokens/veyocast-design-tokens.css", "packages/ui/src/styles.css", "apps/control/app/globals.css", "apps/control/app/fieldflow.css", "apps/control/app/sync-source.css", "apps/control/app/sync-adapter.css"]
    .map(path => readFileSync(path, "utf8").replace(/@import[^;]+;/g, "")).join("\n");
  await page.route(`${origin}/assets/*`, route => {
    const name = new URL(route.request().url()).pathname.split("/").at(-1)!;
    if (!/^[a-zA-Z0-9_.-]+$/.test(name)) return route.abort();
    return route.fulfill({ body: readFileSync(join(process.cwd(), "apps/control/public/assets", name)), contentType: name.endsWith("woff2") ? "font/woff2" : name.endsWith("ttf") ? "font/ttf" : "image/svg+xml" });
  });
  let respond: (wire: Wire, index: number) => unknown = wire => ack(wire.input);
  let currentProfile = options.profile ?? initialProfile;
  await page.route(`${origin}/__theme/save`, async route => {
    const wire = route.request().postDataJSON() as Wire;
    const scopeKey = `veyocast:publisher-recovery:v1:sync-theme-defaults:${tenantId}:${wire.scope}:fieldflow`;
    durableAtPost.push(await page.evaluate(key => JSON.parse(sessionStorage.getItem(key) ?? "null"), scopeKey));
    commands.push(wire);
    const result = await respond(wire, commands.length);
    if (result === "abort") return route.abort("failed");
    return route.fulfill({ json: result });
  });
  await page.route(`${origin}/__theme/read`, route => route.fulfill({ json: { ok: true, value: { schemaVersion: 1, tenantId, defaultThemeId: "fieldflow", profiles: [currentProfile, { ...initialProfile, themeId: "onzetrots-tv", themeVersion: "11.0.0" }] } } }));
  await page.route(`${origin}/__theme-page`, route => route.fulfill({ contentType: "text/html", body: `<!doctype html><html lang="nl" data-design-system="fieldflow"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Thema’s · VeyoCast</title><style>${css}\n${bundle.css}</style></head><body><div id="root"></div><script>globalThis.fixtureCanWrite=${options.canWrite !== false};globalThis.fixtureProfile=${JSON.stringify(options.profile ?? initialProfile)};${bundle.js.replace(/<\/script/gi, "<\\/script")}</script></body></html>` }));
  await page.goto(`${origin}/__theme-page`);
  const trigger = page.getByRole("button", { name: "Instellen · FieldFlow", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "FieldFlow instellen", exact: true });
  await expect(dialog).toBeVisible(); await page.evaluate(() => document.fonts.ready);
  await expect.poll(() => dialog.evaluate(element => element.getAnimations().filter(animation => animation.playState === "running").length)).toBe(0);
  return { dialog, trigger, errors, commands, durableAtPost, respond: (next: typeof respond) => { respond = next; }, current: (profile: SyncThemeDefaultsProfile) => { currentProfile = profile; } };
}

for (const viewport of [{ width: 390, height: 740 }, { width: 1440, height: 1000 }]) {
  test(`Source Admin theme modal preserves chrome, renderer, touch and one scroller at ${viewport.width}px`, async ({ page }, info) => {
    await page.setViewportSize(viewport);
    const fixture = await mount(page);
    await expect(fixture.dialog).toHaveCSS("width", viewport.width === 390 ? "370px" : "960px");
    await expect(fixture.dialog).toHaveCSS("border-radius", viewport.width === 390 ? "18px" : "22px");
    await expect(fixture.dialog.locator("header h2")).toHaveCSS("font-size", viewport.width === 390 ? "24px" : "26px");
    await expect(fixture.dialog.getByLabel("Clubaccent", { exact: true })).toHaveValue("#006d83");
    await expect(fixture.dialog.getByText(/Nog niet ingesteld/)).toBeVisible();
    await expect(fixture.dialog.getByRole("button", { name: "Instellingen opslaan", exact: true })).toHaveCSS("background-color", "rgb(0, 109, 115)");
    await expect(fixture.dialog.getByRole("button", { name: "Instellingen opslaan", exact: true })).toHaveCSS("color", "rgb(255, 255, 255)");
    await expect(fixture.dialog.getByRole("link", { name: "Geavanceerde huisstijluitrol", exact: true })).toHaveAttribute("href", "/dashboard/themes/fieldflow?theme=fieldflow");
    const preview = fixture.dialog.locator('[data-testid="theme-preview"] .vc-slide-preview');
    await expect(preview).toHaveClass(/bg-light/); await expect(preview).toHaveCSS("font-family", "Manrope");
    const targets = await fixture.dialog.locator("button,input:not([type=checkbox]),select,a,label:has(input[type=checkbox])").evaluateAll(elements => elements.map(element => { const r = element.getBoundingClientRect(); return { name: element.textContent || element.getAttribute("type"), width: r.width, height: r.height }; }));
    for (const target of targets) { expect(target.width, target.name!).toBeGreaterThanOrEqual(44); expect(target.height, target.name!).toBeGreaterThanOrEqual(44); }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const scrollers = await fixture.dialog.evaluate(element => [element, ...element.querySelectorAll("*")].filter(el => { const css = getComputedStyle(el); return /auto|scroll/.test(css.overflowY) && el.scrollHeight > el.clientHeight; }).length);
    expect(scrollers).toBeLessThanOrEqual(1); if (viewport.width === 390) expect(scrollers).toBe(1);
    await info.attach("actual-theme-modal", { body: await page.screenshot(), contentType: "image/png" });
    expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze()).violations).toEqual([]);
    await page.keyboard.press("Escape"); await expect(fixture.dialog).not.toBeVisible(); await expect(fixture.trigger).toBeFocused();
    expect(fixture.commands).toEqual([]); expect(fixture.errors).toEqual([]);
  });
}

test("all seven real fields project into the canonical renderer and survive confirmed save/reload", async ({ page }) => {
  const fixture = await mount(page);
  await fixture.dialog.getByLabel("Clubaccent", { exact: true }).fill("#ab12cd");
  await fixture.dialog.getByRole("combobox", { name: "Lettertype", exact: true }).selectOption("Georgia");
  await fixture.dialog.getByRole("combobox", { name: "Weergave", exact: true }).selectOption("dark");
  await fixture.dialog.getByRole("slider", { name: /Typografie/ }).fill("118");
  await fixture.dialog.getByRole("combobox", { name: "Achtergrond", exact: true }).selectOption("stadium");
  await fixture.dialog.getByRole("combobox", { name: "Beweging", exact: true }).selectOption("dynamisch");
  await fixture.dialog.getByLabel("Clublogo tonen", { exact: true }).uncheck();
  const preview = fixture.dialog.locator('[data-testid="theme-preview"] .vc-slide-preview');
  await expect(preview).toHaveClass(/bg-stadium/); await expect(preview).toHaveCSS("font-family", "Georgia, serif");
  expect(await preview.evaluate(el => el.style.getPropertyValue("--slide-accent"))).toBe("#ab12cd");
  expect(await preview.evaluate(el => el.style.getPropertyValue("--slide-scale"))).toBe("1.18");
  await expect(preview.locator(".vc-slide-brand")).toHaveCSS("visibility", "hidden");
  await expect(fixture.dialog.locator('[data-motion="dynamisch"]')).toHaveCount(1);
  await fixture.dialog.getByRole("button", { name: "Instellingen opslaan", exact: true }).click();
  await expect(fixture.dialog.getByRole("status")).toContainText("Opgeslagen.");
  expect(fixture.commands).toHaveLength(1);
  const command = fixture.commands[0]!.input;
  expect(command.defaults).toEqual({ accent: "#ab12cd", font: "Georgia", mode: "dark", scale: 118, background: "stadium", motion: "dynamisch", showLogo: false });
  expect((fixture.durableAtPost[0] as { pending: unknown }).pending).toEqual(command);
  await page.reload(); await fixture.trigger.click();
  await expect(fixture.dialog.getByRole("combobox", { name: "Lettertype", exact: true })).toHaveValue("Georgia");
  await expect(fixture.dialog.getByText("Opgeslagen instellingen · revisie 1", { exact: true })).toBeVisible();
  await expect(fixture.dialog.getByLabel("Clublogo tonen", { exact: true })).not.toBeChecked();
  expect(fixture.errors).toEqual([]);
});

test("unknown result, reload and temporary rejection retain one original JSON body and receipt", async ({ page }) => {
  const fixture = await mount(page); let receipts = 0;
  fixture.respond((wire, index) => {
    if (index === 1) { receipts++; return "abort"; }
    if (index === 2) return { ok: false, code: "denied", uncertain: false, message: "Temporary permission interruption" };
    return ack(wire.input);
  });
  await fixture.dialog.getByRole("combobox", { name: "Lettertype", exact: true }).selectOption("Inter");
  await fixture.dialog.getByRole("button", { name: "Instellingen opslaan", exact: true }).click();
  await expect(fixture.dialog.getByRole("button", { name: "Hetzelfde ontvangstbewijs controleren", exact: true })).toBeEnabled();
  const first = JSON.stringify(fixture.commands[0]);
  await page.once("dialog", dialog => dialog.accept()); await page.reload(); await fixture.trigger.click();
  await fixture.dialog.getByRole("button", { name: "Hetzelfde ontvangstbewijs controleren", exact: true }).click();
  await expect(fixture.dialog.getByRole("alert")).toContainText("nog onzeker");
  await expect(fixture.dialog.getByRole("combobox", { name: "Lettertype", exact: true })).toBeDisabled();
  await fixture.dialog.getByRole("button", { name: "Hetzelfde ontvangstbewijs controleren", exact: true }).click();
  await expect(fixture.dialog.getByRole("status")).toContainText("Opgeslagen.");
  expect(fixture.commands.map(value => JSON.stringify(value))).toEqual([first, first, first]);
  expect(receipts).toBe(1); expect(fixture.errors).toEqual([]);
});

test("storage failure blocks POST and dirty close requires an explicit durable choice", async ({ page }) => {
  const fixture = await mount(page);
  await page.evaluate(() => { const storage = Storage.prototype; (globalThis as typeof globalThis & { originalSetItem?: typeof storage.setItem }).originalSetItem = storage.setItem; storage.setItem = () => { throw new DOMException("Blocked", "QuotaExceededError"); }; });
  await fixture.dialog.getByRole("combobox", { name: "Lettertype", exact: true }).selectOption("Arial");
  await expect(fixture.dialog.getByRole("alert")).toContainText("niets verstuurd");
  await expect(fixture.dialog.getByRole("button", { name: "Instellingen opslaan", exact: true })).toBeDisabled(); expect(fixture.commands).toEqual([]);
  await page.evaluate(() => { Storage.prototype.setItem = (globalThis as typeof globalThis & { originalSetItem: typeof Storage.prototype.setItem }).originalSetItem; });
  await fixture.dialog.getByRole("button", { name: "Lokaal bewaren opnieuw proberen", exact: true }).click();
  await page.keyboard.press("Escape"); await expect(fixture.dialog).toBeVisible();
  await fixture.dialog.getByRole("button", { name: "Bewaren en sluiten", exact: true }).click(); await expect(fixture.dialog).not.toBeVisible();
  expect(await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!).draft.font, key)).toBe("Arial");
  await fixture.trigger.click(); await expect(fixture.dialog.getByRole("combobox", { name: "Lettertype", exact: true })).toHaveValue("Arial");
  await page.keyboard.press("Escape"); await fixture.dialog.getByRole("button", { name: "Wijzigingen verwerpen en sluiten", exact: true }).click();
  expect(await page.evaluate(key => sessionStorage.getItem(key), key)).toBeNull(); expect(fixture.commands).toEqual([]); expect(fixture.errors).toEqual([]);
});

test("a definite conflict retains input and only an explicit current revision can create the next command", async ({ page }) => {
  const fixture = await mount(page);
  fixture.respond((wire, index) => index === 1 ? { ok: false, code: "conflict", uncertain: false, message: "Intussen gewijzigd. Haal de actuele instellingen op." } : ack(wire.input));
  await fixture.dialog.getByRole("combobox", { name: "Lettertype", exact: true }).selectOption("Georgia");
  await fixture.dialog.getByRole("button", { name: "Instellingen opslaan", exact: true }).click();
  await expect(fixture.dialog.getByRole("button", { name: "Actuele instellingen ophalen", exact: true })).toBeEnabled();
  const fresh = { ...initialProfile, configured: true, revision: 7, defaults: { ...fixture.commands[0]!.input.defaults, font: "Arial" as const } };
  fixture.current(fresh);
  await fixture.dialog.getByRole("button", { name: "Actuele instellingen ophalen", exact: true }).click();
  await expect(fixture.dialog.getByText(/Actueel: revisie 7/)).toBeVisible();
  expect(fixture.commands).toHaveLength(1);
  await fixture.dialog.getByRole("button", { name: "Mijn concept behouden op actuele revisie", exact: true }).click();
  await expect(fixture.dialog.getByRole("combobox", { name: "Lettertype", exact: true })).toHaveValue("Georgia");
  await fixture.dialog.getByRole("button", { name: "Instellingen opslaan", exact: true }).click();
  await expect(fixture.dialog.getByRole("status")).toContainText("Opgeslagen.");
  expect(fixture.commands[1]!.input.expectedRevision).toBe(7); expect(fixture.commands[1]!.input.idempotencyKey).not.toBe(fixture.commands[0]!.input.idempotencyKey);
  expect(fixture.commands[1]!.input.defaults.font).toBe("Georgia"); expect(fixture.errors).toEqual([]);
});

test("actor remount fences a late receipt and a read-only settings viewer cannot write", async ({ page }) => {
  const fixture = await mount(page); let finish!: () => void;
  fixture.respond(wire => new Promise(resolve => { finish = () => resolve(ack(wire.input)); }));
  await fixture.dialog.getByRole("combobox", { name: "Lettertype", exact: true }).selectOption("Inter");
  await fixture.dialog.getByRole("button", { name: "Instellingen opslaan", exact: true }).click();
  await expect.poll(() => fixture.commands.length).toBe(1);
  const nextActor = `${tenantId}:23500000-0000-4000-8000-000000000009`;
  await page.evaluate(actor => (globalThis as typeof globalThis & { setThemeActor: (actor: string) => void }).setThemeActor(actor), nextActor);
  await fixture.trigger.click(); finish();
  await expect(fixture.dialog.getByRole("combobox", { name: "Lettertype", exact: true })).toHaveValue("Manrope");
  await expect(fixture.dialog.getByRole("button", { name: "Instellingen opslaan", exact: true })).toBeEnabled();
  const old = await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!), key);
  expect(old.pending).toEqual(fixture.commands[0]!.input); expect(fixture.commands).toHaveLength(1); expect(fixture.errors).toEqual([]);
  await page.keyboard.press("Escape");
  const viewer = await mount(page, { canWrite: false });
  await expect(viewer.dialog.getByRole("combobox", { name: "Lettertype", exact: true })).toBeDisabled();
  await expect(viewer.dialog.getByRole("button", { name: /^(Instellingen opslaan|Hetzelfde ontvangstbewijs controleren)$/ })).toBeDisabled();
  expect(viewer.commands).toEqual([]); expect(viewer.errors).toEqual([]);
});
