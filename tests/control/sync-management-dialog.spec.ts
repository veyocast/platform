import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { getCapabilitiesForRoles } from "../../packages/auth/src/index";
import { getNavigationGroupsForRoles } from "../../apps/control/app/(shell)/_lib/control-navigation";

// Actual management UI and actual shell for the restricted custom-role case.
// Only Next transport/actions are controlled. Capabilities are never unioned
// with owner privileges in the custom-role fixture; no services are mutated.
const origin = "http://127.0.0.1:3387";
const require = createRequire(join(process.cwd(), "package.json"));
const compiler = require.resolve("esbuild", { paths: [require.resolve("tsx")] });
const primary = ["Vandaag", "Content", "Playlists", "Planning", "Schermen"];
const ownerItems = getNavigationGroupsForRoles(getCapabilitiesForRoles(["tenant_owner"]))
  .flatMap(group => group.items).filter(item => item.scope === "tenant" && !primary.includes(item.label));
let bundle: { js: string; css: string };

test.beforeAll(() => {
  const entry = `import React,{useState}from'react';import{createRoot}from'react-dom/client';import{DialogPortalProvider}from'./packages/ui/src/components/dialog';import{ControlShell}from'./apps/control/app/(shell)/_components/control-shell';import{SyncManagementDialog}from'./apps/control/app/(shell)/_components/sync-management-dialog';import{getNavigationGroupsForRoles}from'./apps/control/app/(shell)/_lib/control-navigation';const custom=new URLSearchParams(location.search).get('mode')==='custom';function App(){const[portal,setPortal]=useState(null),[open,setOpen]=useState(false);if(custom){const capabilities=['tenant.media.read'];const session={assuranceLevel:'aal2',nextAssuranceLevel:'aal2',capabilities,email:'management-qa@veyocast.test',isLive:true,organization:'VeyoCast platform',roles:['tenant_viewer'],tenant:'Eigen QA-club',tenantContextReason:'selected',tenantId:'23400000-0000-4000-8000-000000000001',tenantMemberships:[],tenantRoleLabel:'Eigen mediarol',tenantSlug:'eigen-qa-club',tenantStatus:'active',timezoneName:'Europe/Amsterdam',userId:'23400000-0000-4000-8000-000000000003',userName:'QA mediarol'};return <ControlShell session={session} navigationGroups={getNavigationGroupsForRoles(capabilities)} uploadQueue={[]} visualQaEnabled={false}><h1>Eigen media</h1></ControlShell>}return <div className="sync-control app-shell" style={{display:'block'}} ref={setPortal}><DialogPortalProvider container={portal}><main><h1>Werkplekcontrole</h1><SyncManagementDialog items={globalThis.fixtureItems} open={open} onOpenChange={setOpen} onNavigate={()=>{globalThis.closedMobile=(globalThis.closedMobile||0)+1}}><button type="button" className="btn">Beheer</button></SyncManagementDialog></main></DialogPortalProvider></div>}createRoot(document.getElementById('root')).render(<App/>);`;
  const code = `const result=await require(${JSON.stringify(compiler)}).build({stdin:{contents:${JSON.stringify(entry)},resolveDir:process.cwd(),loader:'tsx'},nodePaths:[process.cwd()+'/apps/control/node_modules'],bundle:true,write:false,outfile:'fixture.js',platform:'browser',format:'iife',jsx:'automatic',loader:{'.module.css':'local-css','.css':'css'},plugins:[{name:'controlled-next-transport',setup(b){b.onResolve({filter:/^next\\/(navigation|link|image)$/},a=>({path:a.path,namespace:'next'}));b.onLoad({filter:/.*/,namespace:'next'},a=>({contents:a.path.endsWith('navigation')?'export const usePathname=()=>"/dashboard/media";export const useSearchParams=()=>new URLSearchParams();export const useRouter=()=>({push:path=>{globalThis.visited=(globalThis.visited||[]).concat(path)},refresh(){}});':a.path.endsWith('image')?'import React from"react";export default function Image({fill,unoptimized,priority,...props}){return React.createElement("img",props)}':'import React from"react";export default function Link({onClick,...props}){return React.createElement("a",{...props,onClick:event=>{onClick?.(event);if(!event.defaultPrevented){event.preventDefault();globalThis.visited=(globalThis.visited||[]).concat(props.href)}}})}',resolveDir:process.cwd(),loader:'js'}));b.onResolve({filter:/actions$/},a=>({path:a.path,namespace:'actions'}));b.onLoad({filter:/.*/,namespace:'actions'},()=>({contents:'export async function switchTenantContext(){};export async function signOut(){}',loader:'js'}));}}]});const js=result.outputFiles.find(f=>f.path.endsWith('.js'))?.text,css=result.outputFiles.find(f=>f.path.endsWith('.css'))?.text;if(!js||!css)throw Error('Missing actual fixture JS/CSS');process.stdout.write(JSON.stringify({js,css}));`;
  bundle = JSON.parse(execFileSync(process.execPath, ["-e", `(async()=>{${code}})().catch(e=>{console.error(e);process.exitCode=1})`], { encoding: "utf8", timeout: 30_000, maxBuffer: 16 * 1024 * 1024 }));
});

async function mount(page: Page, custom = false) {
  const errors: string[] = [], writes: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const css = ["tokens/veyocast-design-tokens.css", "packages/ui/src/styles.css", "apps/control/app/globals.css", "apps/control/app/fieldflow.css", "apps/control/app/sync-source.css", "apps/control/app/sync-adapter.css"]
    .map(path => readFileSync(path, "utf8").replace(/@import[^;]+;/g, "")).join("\n");
  await page.route(`${origin}/assets/*`, route => {
    const name = new URL(route.request().url()).pathname.split("/").at(-1)!;
    if (!/^[a-zA-Z0-9_.-]+$/.test(name)) return route.abort();
    return route.fulfill({ body: readFileSync(join(process.cwd(), "apps/control/public/assets", name)), contentType: name.endsWith("woff2") ? "font/woff2" : name.endsWith("ttf") ? "font/ttf" : "image/svg+xml" });
  });
  await page.route(`${origin}/api/**`, route => {
    if (!["GET", "HEAD"].includes(route.request().method())) writes.push(route.request().method());
    return route.fulfill({ json: { ok: true, data: { results: [], notifications: [], unreadCount: 0 } } });
  });
  await page.route(`${origin}/__management*`, route => route.fulfill({ contentType: "text/html", body: `<!doctype html><html lang="nl" data-design-system="fieldflow"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Beheer · VeyoCast</title><style>${css}\n${bundle.css}</style></head><body><div id="root"></div><script>globalThis.fixtureItems=${JSON.stringify(ownerItems.map(item => ({ href: item.href, label: item.label, active: item.href === "/dashboard/media" })))};${bundle.js.replace(/<\/script/gi, "<\\/script")}</script></body></html>` }));
  await page.goto(`${origin}/__management?mode=${custom ? "custom" : "owner"}`);
  const trigger = page.getByRole("button", { name: "Beheer", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Beheer je werkplek", exact: true });
  await expect(dialog).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  return { dialog, trigger, errors, writes };
}

for (const viewport of [{ width: 390, height: 640 }, { width: 1440, height: 900 }]) {
  test(`Source cards preserve every permitted domain and responsive geometry at ${viewport.width}px`, async ({ page }, info) => {
    await page.setViewportSize(viewport);
    const fixture = await mount(page), cards = fixture.dialog.locator(".management-grid > a");
    await expect(cards).toHaveCount(ownerItems.length);
    const hrefs = await cards.evaluateAll(elements => elements.map(element => element.getAttribute("href")));
    expect([...hrefs].sort()).toEqual(ownerItems.map(item => item.href).sort());
    expect(new Set(hrefs).size).toBe(ownerItems.length);
    expect((await cards.locator("strong").allTextContents()).slice(0, 8)).toEqual(["Bronnen", "Producten", "Thema’s", "Sponsors", "Interactie", "Team & rechten", "Support", "Abonnement"]);
    await expect(fixture.dialog).toHaveCSS("width", viewport.width === 390 ? "370px" : "960px");
    await expect(fixture.dialog).toHaveCSS("border-radius", viewport.width === 390 ? "18px" : "22px");
    await expect(fixture.dialog.locator("header h2")).toHaveCSS("font-size", viewport.width === 390 ? "17px" : "19px");
    await expect(fixture.dialog.locator("header h2")).toHaveCSS("font-weight", "750");
    expect(await fixture.dialog.locator(".management-grid").evaluate(element => getComputedStyle(element).gridTemplateColumns.split(" ").length)).toBe(viewport.width === 390 ? 2 : 3);
    await expect(cards.locator('[aria-hidden="true"]').first()).toHaveAttribute("width", "24");
    await expect(cards.filter({ hasText: "Media" })).toHaveAttribute("aria-current", "page");
    const boxes = await cards.evaluateAll(elements => elements.map(element => { const r = element.getBoundingClientRect(); return { title: element.textContent, width: r.width, height: r.height, unclipped: element.scrollWidth <= element.clientWidth && element.scrollHeight <= element.clientHeight }; }));
    for (const box of boxes) { expect(box.width).toBeGreaterThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(44); expect(box.unclipped, box.title!).toBe(true); }
    await info.attach("actual-management-geometry", { body: JSON.stringify(boxes, null, 2), contentType: "application/json" });
    await info.attach("actual-management", { body: await page.screenshot(), contentType: "image/png" });
    await cards.last().scrollIntoViewIfNeeded();
    await expect(cards.last()).toBeInViewport({ ratio: 1 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const violations = (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze()).violations;
    expect(violations).toEqual([]);
    await fixture.dialog.getByRole("button", { name: "Sluiten", exact: true }).focus();
    await page.keyboard.press("Shift+Tab"); await expect(cards.last()).toBeFocused();
    await page.keyboard.press("Tab"); await expect(fixture.dialog.getByRole("button", { name: "Sluiten", exact: true })).toBeFocused();
    await page.keyboard.press("Escape"); await expect(fixture.dialog).not.toBeVisible(); await expect(fixture.trigger).toBeFocused();
    expect(fixture.errors).toEqual([]); expect(fixture.writes).toEqual([]);
  });
}

test("management card preserves the real href and both close callbacks", async ({ page }) => {
  const fixture = await mount(page);
  const sources = fixture.dialog.getByRole("link", { name: "Bronnen", exact: true });
  await expect(sources).toHaveAttribute("href", "/dashboard/sources");
  await sources.press("Enter"); await expect(fixture.dialog).not.toBeVisible();
  expect(await page.evaluate(() => (globalThis as typeof globalThis & { visited?: string[] }).visited)).toEqual(["/dashboard/sources"]);
  expect(await page.evaluate(() => (globalThis as typeof globalThis & { closedMobile?: number }).closedMobile)).toBe(1);
  expect(fixture.errors).toEqual([]); expect(fixture.writes).toEqual([]);
});

test("actual shell exposes only Media for a custom role without any eight-core capabilities", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const fixture = await mount(page, true);
  const links = fixture.dialog.getByRole("link");
  await expect(links).toHaveCount(1);
  await expect(links).toHaveAccessibleName("Media");
  await expect(links).toHaveAttribute("href", "/dashboard/media");
  await expect(fixture.dialog.getByRole("link", { name: /Bronnen|Abonnement|Team|Instellingen|Platform/ })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Beheer", exact: true })).toHaveCount(0);
  expect(fixture.errors).toEqual([]); expect(fixture.writes).toEqual([]);
});
