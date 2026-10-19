import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";

const origin = "http://127.0.0.1:3313";
const require = createRequire(join(process.cwd(), "package.json"));
const compiler = require.resolve("esbuild", { paths: [require.resolve("tsx")] });
const tenant = "19170000-0000-4000-8000-000000000010";
// Actual production shell and all its portal components. Only Next transport,
// session props and HTTP reads are controlled; genuine local AAL2 is separate.
const entry = `import React from'react';import{createRoot}from'react-dom/client';import{getCapabilitiesForRoles}from'@veyocast/auth';
import{ControlShell}from'./apps/control/app/(shell)/_components/control-shell';import{getNavigationGroupsForRoles}from'./apps/control/app/(shell)/_lib/control-navigation';
const params=new URLSearchParams(location.search),readonly=params.get('variant')==='readonly',capabilities=getCapabilitiesForRoles(['tenant_owner']).filter(value=>!readonly||value!=='tenant.audit.read');
const session={assuranceLevel:'aal2',nextAssuranceLevel:'aal2',capabilities,email:'sites-qa@veyocast.test',isLive:true,organization:'VeyoCast platform',roles:['tenant_owner'],tenant:'Duindorp SV',tenantContextReason:'selected',tenantId:'${tenant}',tenantMemberships:[{id:'${tenant}',name:'Duindorp SV',slug:'duindorp-sv',role:'tenant_owner',status:'active',customRoleId:null,customRoleName:null}],tenantRoleLabel:'Eigenaar',tenantSlug:'duindorp-sv',tenantStatus:'active',timezoneName:'Europe/Amsterdam',userId:'19170000-0000-4000-8000-000000000001',userName:'QA beheerder'};
createRoot(document.getElementById('root')).render(<React.StrictMode><ControlShell session={session} navigationGroups={getNavigationGroupsForRoles(capabilities)} uploadQueue={[]} visualQaEnabled={false}><h2>Clubhuis — Vandaag</h2><p>Gecontroleerde QA-01 context; daadwerkelijke API-guards zijn afzonderlijk getoetst.</p></ControlShell></React.StrictMode>);`;
let bundle: { js: string; css: string };
test.beforeAll(() => {
  const build = String.raw`const{build}=require(${JSON.stringify(compiler)});const result=await build({stdin:{contents:${JSON.stringify(entry)},resolveDir:process.cwd(),loader:'tsx'},nodePaths:[process.cwd()+'/apps/control/node_modules'],bundle:true,write:false,outfile:'/tmp/sites-shell.js',platform:'browser',format:'iife',jsx:'automatic',loader:{'.css':'css','.module.css':'local-css'},plugins:[{name:'next-transport-only',setup(b){b.onResolve({filter:/^next\/(navigation|link|image)$/},a=>({path:a.path,namespace:'next'}));b.onLoad({filter:/.*/,namespace:'next'},a=>({contents:a.path.endsWith('navigation')?'export const usePathname=()=>"/dashboard";export const useSearchParams=()=>new URLSearchParams();export const useRouter=()=>({push(path){window.__qaNavigation=path},refresh(){}});':'import React from"react";export default function View({children,priority,unoptimized,fill,...props}){return React.createElement('+JSON.stringify(a.path.endsWith('image')?'img':'a')+',props,children)}',resolveDir:process.cwd(),loader:'js'}));b.onResolve({filter:/actions$/},a=>({path:a.path,namespace:'actions'}));b.onLoad({filter:/.*/,namespace:'actions'},()=>({contents:'export async function switchTenantContext(){};export async function signOut(){}',loader:'js'}));}}]});process.stdout.write(JSON.stringify({js:result.outputFiles.find(x=>x.path.endsWith('.js')).text,css:result.outputFiles.find(x=>x.path.endsWith('.css')).text}));`;
  bundle = JSON.parse(execFileSync(process.execPath, ["-e", `(async()=>{${build}})().catch(error=>{console.error(error.message);process.exitCode=1})`], { encoding: "utf8", timeout: 30000, maxBuffer: 16 * 1024 * 1024 }));
});

async function mount(page: Page, variant = "ready") {
  let requestCount = 0;
  const css = ["tokens/veyocast-design-tokens.css", "packages/ui/src/styles.css", "apps/control/app/globals.css", "apps/control/app/fieldflow.css", "apps/control/app/sync-source.css", "apps/control/app/sync-adapter.css"].map(path => readFileSync(path, "utf8").replace(/@import[^;]+;/g, "")).join("\n");
  await page.route("**/__sites-test/shell?*", route => route.fulfill({ contentType: "text/html", body: `<!doctype html><html lang="nl" data-design-system="fieldflow"><head><style>${css}\n${bundle.css}</style></head><body><div id="root"></div><script>${bundle.js.replace(/<\/script/gi, "<\\/script")}</script></body></html>` }));
  await page.route("**/api/search?*", route => route.fulfill({ contentType: "application/json", body: JSON.stringify({ results: [] }) }));
  await page.route("**/api/control/notifications", async route => {
    requestCount++;
    if (variant === "network") return route.abort("connectionfailed");
    if (variant === "error") return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "NOTIFICATIONS_UNAVAILABLE" }) });
    if (variant === "loading") await new Promise(resolve => setTimeout(resolve, 800));
    return route.fulfill({ contentType: "application/json", body: JSON.stringify({ tenantId: variant === "wrong-tenant" ? "19170000-0000-4000-8000-000000000011" : tenant, notifications: variant === "empty" ? [] : [{ id: "19170000-0000-4000-8000-000000000100", title: "Playlist gepubliceerd", result: "success", createdAt: "2026-10-11T10:00:00Z", href: "/dashboard/activity" }] }) });
  });
  const assets = JSON.parse(readFileSync("docs/sites-v11-overname/system-assets.json", "utf8")) as { files: { path: string; sha256: string; bytes: number; mimeType: string }[] };
  await page.route("**/*", async route => {
    const asset = assets.files.find(asset => asset.path === new URL(route.request().url()).pathname);
    if (!asset) return route.fallback();
    const bytes = readFileSync(join(process.cwd(), "apps/control/public", asset.path)); expect(bytes.byteLength).toBe(asset.bytes); expect(createHash("sha256").update(bytes).digest("hex")).toBe(asset.sha256);
    return route.fulfill({ contentType: asset.mimeType, body: bytes });
  });
  for (const asset of ["full-dark.svg", "full-light.svg", "manrope.woff2", "inter.woff2"]) await page.route(`**/assets/${asset}`, route => route.fulfill({ contentType: asset.endsWith("svg") ? "image/svg+xml" : "font/woff2", body: readFileSync(join(process.cwd(), "apps/control/public/assets", asset)) }));
  await page.goto(`${origin}/__sites-test/shell?variant=${variant}`);
  await expect(page.locator("#control-content")).toBeVisible();
  await expect(page.locator('button[aria-label="Navigatie openen"]')).toBeEnabled();
  return () => requestCount;
}

async function containsViewport(page: Page, surface: Locator) {
  // The original drawer slides in for 220ms. Measure its settled frame while
  // keeping the final bounds strict, rather than accepting clipped geometry.
  await expect.poll(() => surface.evaluate(element => element.getBoundingClientRect().left), { timeout: 2000 }).toBeGreaterThanOrEqual(-1);
  const geometry = await surface.evaluate(element => { const box = element.getBoundingClientRect(); return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: innerWidth, height: innerHeight, overflow: document.documentElement.scrollWidth > innerWidth + 1, position: getComputedStyle(element).position }; });
  expect(geometry.left).toBeGreaterThanOrEqual(-1); expect(geometry.top).toBeGreaterThanOrEqual(-1); expect(geometry.right).toBeLessThanOrEqual(geometry.width + 1); expect(geometry.bottom).toBeLessThanOrEqual(geometry.height + 1); expect(geometry.overflow).toBe(false);
  return geometry;
}
async function trap(page: Page, surface: Locator) {
  const controls = surface.locator('a[href]:visible,button:enabled:visible,input:enabled:visible');
  await controls.last().focus(); await page.keyboard.press("Tab"); expect(await surface.evaluate(element => element.contains(document.activeElement))).toBe(true);
  await controls.first().focus(); await page.keyboard.press("Shift+Tab"); expect(await surface.evaluate(element => element.contains(document.activeElement))).toBe(true);
}
function csvRows(content: string) {
  const rows: string[][] = []; let row: string[] = [], cell = "", quoted = false;
  for (let index = 0; index < content.length; index++) { const char = content[index]!; if (char === '"') { if (quoted && content[index + 1] === '"') { cell += '"'; index++; } else quoted = !quoted; } else if (char === "," && !quoted) { row.push(cell); cell = ""; } else if (char === "\n" && !quoted) { row.push(cell.replace(/\r$/, "")); rows.push(row); row = []; cell = ""; } else cell += char; }
  const headers = rows.shift()!; return rows.filter(row => row.length === headers.length).map(row => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));
}
const cases = csvRows(readFileSync("docs/sites-v11-overname/inventory/VISUAL-CASES.csv", "utf8")).filter(row => row.case_id.startsWith("SHELL-"));
const directory = "/dev/shm/veyocast-s191-shell-case-evidence", readbacks: Record<string, unknown>[] = [];
test.afterAll(() => {
  mkdirSync(directory, { recursive: true }); const path = join(directory, "case-readback.json"), merged = new Map<string, Record<string, unknown>>();
  if (existsSync(path)) for (const row of JSON.parse(readFileSync(path, "utf8")).results as Record<string, unknown>[]) merged.set(String(row.caseId), row);
  for (const row of readbacks) merged.set(String(row.caseId), row);
  writeFileSync(path, JSON.stringify({ schemaVersion: 1, sourceRevision: "b1cae899af19fc39908217253094c5240d7359fc", fixtureVersion: "QA-01-SHELL-20261011-v1", browser: "Chromium1228 / Linux / DPR1", fixedTime: "2026-10-11T10:00:00Z", timezone: "Europe/Amsterdam", scope: "Actual Sync ControlShell/portals/shared primitives with controlled Next/read HTTP boundary. Original case IDs retained; fixed Sync sidebar and Beheer dialog replace legacy collapse/more controls. Genuine actor/tenant/capability/RLS endpoint guards separately unit-tested; actual authenticated routes separate. No sourcepixel parity or production server receipt inferred.", results: [...merged.values()].sort((a, b) => String(a.caseId).localeCompare(String(b.caseId))) }, null, 2));
});

for (const row of cases) test(`original ${row.case_id} ${row.viewport} ${row.state}`, async ({ page }) => {
  const [width, height] = row.viewport.split("x").map(Number); await page.setViewportSize({ width: width!, height: height! }); await page.clock.install({ time: new Date("2026-10-11T10:00:00Z") });
  if (row.state === "reduced-motion") await page.emulateMedia({ reducedMotion: "reduce" });
  await mount(page); const mobile = width! < 768, sidebar = page.getByLabel("Control navigatie"), main = page.getByRole("main");
  await expect(page.locator(".vx-header")).toHaveCount(1); await expect(page.getByRole("button", { name: "Accountmenu openen" })).toHaveCount(1); await expect(page.locator(".vx-account .vx-avatar")).toHaveText("Qb");
  if (mobile) { await expect(page.getByRole("navigation", { name: "Mobiele hoofdnavigatie" }).locator("a,button")).toHaveText(["Overzicht", "Content", "Playlists", "Planning", "Schermen"]); await expect(page.getByRole("navigation", { name: "Mobiele hoofdnavigatie" }).getByRole("link", { name: "Overzicht", exact: true })).toHaveAttribute("aria-current", "page"); }
  else { await expect(sidebar.getByRole("link", { name: "Overzicht", exact: true })).toHaveAttribute("aria-current", "page"); await expect(page.getByRole("navigation", { name: "Mobiele hoofdnavigatie" })).not.toBeVisible(); }
  let surface = main;
  if (row.state === "search" || row.state === "keyboard-focus") {
    const trigger = mobile ? page.getByRole("button", { name: "Accountmenu openen" }) : page.getByRole("button", { name: "Snel naar een onderdeel" }); await trigger.focus();
    if (row.state === "keyboard-focus") { await page.keyboard.press("Tab"); expect(await page.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle)).not.toBe("none"); }
    await page.keyboard.press("Control+k"); surface = page.getByRole("dialog", { name: "Snel naar een onderdeel" }); await expect(surface).toBeVisible(); await surface.getByRole("searchbox").fill("Studio"); await expect(surface.getByRole("link", { name: /Studio/ }).first()).toBeVisible(); await trap(page, surface);
  } else if (row.state === "account") {
    await page.getByRole("button", { name: "Accountmenu openen" }).click(); surface = page.getByRole("dialog", { name: "Mijn werkplek" }); await expect(surface).toBeVisible(); await expect(surface.getByRole("heading", { name: "QA beheerder", exact: true })).toBeVisible(); await expect(surface.getByText("sites-qa@veyocast.test", { exact: true })).toBeVisible(); await expect(surface.getByText("Eigenaar", { exact: true })).toBeVisible(); await expect(surface.getByRole("link", { name: "Accountbeveiliging en MFA" })).toBeVisible(); await trap(page, surface);
  } else if (row.state === "tenant") {
    if (mobile) await page.getByRole("button", { name: "Navigatie openen", exact: true }).click(); const trigger = page.getByRole("button", { name: "Actieve context: Duindorp SV" }); await trigger.scrollIntoViewIfNeeded(); await trigger.click(); surface = page.getByRole("group", { name: "Werkcontext wisselen" }); await expect(surface).toBeVisible(); await expect(surface.locator('button[aria-current="true"]')).toContainText("Duindorp SV"); await expect(surface.locator('button[aria-current="true"]')).toContainText("Actief"); expect(await surface.evaluate(element => element.parentElement === document.body)).toBe(true);
  } else if (row.state === "notifications") {
    if (mobile) { await page.getByRole("button", { name: "Accountmenu openen" }).focus(); await page.keyboard.press("Control+Shift+n"); } else await page.getByRole("button", { name: "Meldingen openen" }).click();
    surface = page.getByRole("dialog", { name: "Meldingen", exact: true }); await expect(surface.getByRole("button", { name: /Playlist gepubliceerd/ })).toBeVisible(); await expect(surface).toContainText("Duindorp SV"); await expect(surface.locator("time")).toHaveText("11 okt, 12:00"); await trap(page, surface);
  } else if (row.state === "navigation-more") {
    if (mobile) { await page.getByRole("button", { name: "Navigatie openen", exact: true }).click(); await sidebar.getByRole("button", { name: "Beheer", exact: true }).click(); surface = page.getByRole("dialog", { name: "Beheer je werkplek", exact: true }); await expect(surface.getByRole("link", { name: "Studio", exact: true })).toBeVisible(); await expect(surface.getByRole("link", { name: "Instellingen", exact: true })).toBeVisible(); await trap(page, surface); } else { surface = sidebar; await expect(sidebar.getByRole("navigation", { name: "Beheer", exact: true }).getByRole("link")).toHaveText(["Bronnen", "Producten", "Thema’s", "Sponsors", "Interactie", "Team & rechten", "Support", "Abonnement"]); await expect(sidebar.getByRole("link", { name: "Instellingen", exact: true })).toBeVisible(); }
  } else if (row.state === "sidebar-collapsed") {
    if (mobile) { await page.getByRole("button", { name: "Navigatie openen" }).click(); await expect(sidebar).toHaveClass(/\bopen\b/); await page.keyboard.press("Escape"); await expect(sidebar).not.toHaveClass(/\bopen\b/); await expect(page.getByRole("button", { name: "Navigatie openen" })).toBeFocused(); await page.getByRole("button", { name: "Navigatie openen" }).click(); }
    else { await expect(page.getByRole("button", { name: /Navigatie (in|uit)klappen/ })).toHaveCount(0); await expect(page.locator(".vx-shell")).not.toHaveClass(/\bcollapsed\b/); await expect(sidebar).toHaveCSS("width", width! <= 1200 ? "205px" : "228px"); } surface = sidebar;
  } else if (row.state === "reduced-motion") {
    expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
    if (mobile) await page.getByRole("button", { name: "Navigatie openen" }).click(); surface = sidebar; expect(await surface.evaluate(element => Number.parseFloat(getComputedStyle(element).transitionDuration))).toBeLessThanOrEqual(0.00001);
  }
  const geometry = await containsViewport(page, surface); await page.evaluate(async () => { await Promise.all([document.fonts.load('14px "Inter Variable"'), document.fonts.load('14px "Manrope Variable"')]); await document.fonts.ready; await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))); });
  mkdirSync(directory, { recursive: true }); const screenshot = join(directory, `${row.case_id}.png`); await page.screenshot({ path: screenshot, fullPage: true });
  if (["search", "account", "notifications", "keyboard-focus"].includes(row.state)) { await page.keyboard.press("Escape"); await expect(surface).not.toBeVisible(); if (row.state === "account") await expect(page.getByRole("button", { name: "Accountmenu openen" })).toBeFocused(); if (row.state === "notifications") await expect(page.getByRole("button", { name: mobile ? "Accountmenu openen" : "Meldingen openen" })).toBeFocused(); }
  readbacks.push({ caseId: row.case_id, viewport: row.viewport, state: row.state, setup: row.setup, expected: row.assertions, status: "PASS", actual: "Correct QA actor/role/context and active navigation, original setup controls, portal/focus/keyboard or reduced-motion lifecycle, viewport bounds and no duplicate chrome. Sourcepixel equality separate.", geometry, componentSha256: createHash("sha256").update(readFileSync("apps/control/app/(shell)/_components/control-shell.tsx")).digest("hex"), screenshot, screenshotSha256: createHash("sha256").update(readFileSync(screenshot)).digest("hex") });
});

for (const variant of ["loading", "empty", "error", "network", "readonly", "wrong-tenant"]) test(`Meldingen ${variant} preserves privacy and keyboard recovery`, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); const count = await mount(page, variant); await page.getByRole("button", { name: "Accountmenu openen" }).focus(); await page.keyboard.press("Control+Shift+n"); const dialog = page.getByRole("dialog", { name: "Meldingen", exact: true }); await expect(dialog).toBeVisible();
  if (variant === "loading") await expect(dialog.getByRole("status")).toContainText("worden geladen");
  else if (variant === "empty") await expect(dialog.getByRole("heading", { name: "Geen meldingen" })).toBeVisible();
  else if (variant === "readonly") { await expect(dialog.getByRole("status")).toContainText("Er worden geen gegevens opgehaald"); expect(count()).toBe(0); }
  else { await expect(dialog.getByRole("alert")).toContainText("De activiteit blijft opgeslagen"); await expect(dialog.getByRole("button", { name: "Opnieuw proberen" })).toBeEnabled(); await expect(dialog.getByText("Playlist gepubliceerd", { exact: true })).toHaveCount(0); const before = count(); await dialog.getByRole("button", { name: "Opnieuw proberen" }).click(); await expect.poll(count).toBeGreaterThan(before); await expect(dialog.getByRole("alert")).toBeVisible(); }
  await containsViewport(page, dialog); await trap(page, dialog); await page.keyboard.press("Escape"); await expect(dialog).not.toBeVisible(); await expect(page.getByRole("button", { name: "Accountmenu openen" })).toBeFocused();
});
