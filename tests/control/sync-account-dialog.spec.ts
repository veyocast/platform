import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Actual complete shell, account dialog and preference implementation. Only
// Next navigation/actions and background API transport are controlled.
const origin = "http://127.0.0.1:3388";
const require = createRequire(join(process.cwd(), "package.json"));
let bundle: { js: string; css: string };
test.beforeAll(() => {
  const entry = `import React from'react';import{createRoot}from'react-dom/client';import{ControlShell}from'./apps/control/app/(shell)/_components/control-shell';import{getNavigationGroupsForRoles}from'./apps/control/app/(shell)/_lib/control-navigation';const platform=new URLSearchParams(location.search).get('scope')==='platform',capabilities=platform?['platform.system.read']:['tenant.media.read'];const session={assuranceLevel:'aal2',nextAssuranceLevel:'aal2',capabilities,email:'eigen.account@veyocast.test',isLive:true,organization:'VeyoCast platform',roles:platform?['platform_owner']:['tenant_viewer'],tenant:platform?'Geen vereniging':'Eigen QA-club',tenantContextReason:'selected',tenantId:platform?null:'23400000-0000-4000-8000-000000000001',tenantMemberships:[],tenantRoleLabel:platform?null:'Clubredactie',tenantSlug:platform?null:'eigen-qa-club',tenantStatus:platform?null:'active',timezoneName:'Europe/Amsterdam',userId:'23400000-0000-4000-8000-000000000003',userName:'Eigen Account'};createRoot(document.getElementById('root')).render(<ControlShell session={session} navigationGroups={getNavigationGroupsForRoles(capabilities,!platform)} uploadQueue={[]} visualQaEnabled={false}><h1>Accountcontrole</h1></ControlShell>);`;
  const navigation = `export const usePathname=()=>new URLSearchParams(location.search).get('scope')==='platform'?'/platform':'/dashboard/media';export const useSearchParams=()=>new URLSearchParams();export const useRouter=()=>({push:path=>{globalThis.visited=(globalThis.visited||[]).concat(path)},refresh(){}});`;
  const link = `import React from'react';export default function Link({onClick,...props}){return React.createElement('a',{...props,onClick:event=>{onClick?.(event);if(!event.defaultPrevented){event.preventDefault();globalThis.visited=(globalThis.visited||[]).concat(props.href)}}})}`;
  const image = `import React from'react';export default function Image({fill,unoptimized,priority,...props}){return React.createElement('img',props)}`;
  const actions = `export async function switchTenantContext(){};export async function signOut(){globalThis.signOutCalls=(globalThis.signOutCalls||0)+1;globalThis.signOutStorageKeys=Object.keys(localStorage)}`;
  const script = `const result=await require(${JSON.stringify(require.resolve("esbuild", { paths: [require.resolve("tsx")] }))}).build({stdin:{contents:${JSON.stringify(entry)},resolveDir:process.cwd(),loader:'tsx'},nodePaths:[process.cwd()+'/apps/control/node_modules'],bundle:true,write:false,outfile:'fixture.js',platform:'browser',format:'iife',jsx:'automatic',loader:{'.module.css':'local-css','.css':'css'},plugins:[{name:'controlled-transport',setup(b){b.onResolve({filter:/^next\\/(navigation|link|image)$/},a=>({path:a.path,namespace:'next'}));b.onLoad({filter:/.*/,namespace:'next'},a=>({contents:a.path.endsWith('navigation')?${JSON.stringify(navigation)}:a.path.endsWith('image')?${JSON.stringify(image)}:${JSON.stringify(link)},resolveDir:process.cwd(),loader:'js'}));b.onResolve({filter:/actions$/},a=>({path:a.path,namespace:'actions'}));b.onLoad({filter:/.*/,namespace:'actions'},()=>({contents:${JSON.stringify(actions)},loader:'js'}));}}]});const js=result.outputFiles.find(f=>f.path.endsWith('.js'))?.text,css=result.outputFiles.find(f=>f.path.endsWith('.css'))?.text;if(!js||!css)throw Error('Missing actual account fixture');process.stdout.write(JSON.stringify({js,css}));`;
  bundle = JSON.parse(execFileSync(process.execPath, ["-e", `(async()=>{${script}})().catch(e=>{console.error(e);process.exitCode=1})`], { encoding: "utf8", timeout: 30_000, maxBuffer: 16 * 1024 * 1024 }));
});

async function mount(page: Page, scope: "tenant" | "platform" = "tenant") {
  const errors: string[] = [], writes: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const css = ["tokens/veyocast-design-tokens.css", "packages/ui/src/styles.css", "apps/control/app/globals.css", "apps/control/app/fieldflow.css", "apps/control/app/sync-source.css", "apps/control/app/sync-adapter.css"].map(path => readFileSync(path, "utf8").replace(/@import[^;]+;/g, "")).join("\n");
  await page.route(`${origin}/assets/*`, route => {
    const name = new URL(route.request().url()).pathname.split("/").at(-1)!;
    if (!/^[a-zA-Z0-9_.-]+$/.test(name)) return route.abort();
    return route.fulfill({ body: readFileSync(join(process.cwd(), "apps/control/public/assets", name)), contentType: name.endsWith("woff2") ? "font/woff2" : name.endsWith("ttf") ? "font/ttf" : "image/svg+xml" });
  });
  await page.route(`${origin}/api/**`, route => {
    if (!["GET", "HEAD"].includes(route.request().method())) writes.push(route.request().method());
    return route.fulfill({ json: { ok: true, data: { results: [], notifications: [], unreadCount: 0 } } });
  });
  await page.route(`${origin}/__account*`, route => route.fulfill({ contentType: "text/html", body: `<!doctype html><html lang="nl" data-design-system="fieldflow"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mijn werkplek · VeyoCast</title><style>${css}\n${bundle.css}</style></head><body><div id="root"></div><script>${bundle.js.replace(/<\/script/gi, "<\\/script")}</script></body></html>` }));
  await page.goto(`${origin}/__account?scope=${scope}`);
  const trigger = page.getByRole("button", { name: "Accountmenu openen", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Mijn werkplek", exact: true });
  await expect(dialog).toBeVisible(); await page.evaluate(() => document.fonts.ready);
  await expect.poll(() => dialog.evaluate(element => element.getAnimations().filter(animation => animation.playState === "running").length)).toBe(0);
  return { dialog, trigger, errors, writes };
}

for (const width of [390, 1440]) {
  test(`Source profile preserves real identity, links, 55px avatar and accessible chrome at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: width === 390 ? 640 : 900 }); const state = await mount(page);
    await expect(state.dialog).toHaveCSS("width", width === 390 ? "370px" : "540px");
    await expect(state.dialog).toHaveCSS("border-radius", width === 390 ? "18px" : "22px");
    await expect(state.dialog.locator(":scope > header h2")).toHaveCSS("font-size", width === 390 ? "17px" : "19px");
    await expect(state.dialog.locator(":scope > header h2")).toHaveCSS("font-weight", "750");
    await expect(state.dialog.locator(".avatar-large")).toHaveCSS("width", "55px"); await expect(state.dialog.locator(".avatar-large")).toHaveCSS("height", "55px");
    await expect(state.dialog.getByRole("heading", { name: "Eigen Account", exact: true })).toBeVisible();
    await expect(state.dialog.getByText("eigen.account@veyocast.test", { exact: true })).toBeVisible(); await expect(state.dialog.getByText("Clubredactie", { exact: true })).toBeVisible();
    const links = state.dialog.getByRole("navigation", { name: "Accountinstellingen", exact: true });
    expect(await links.locator("a").evaluateAll(nodes => nodes.map(node => node.getAttribute("href")))).toEqual(["/dashboard/account", "/dashboard/settings", "/auth/mfa", "https://veyocast.nl/privacy"]);
    await expect(state.dialog.getByRole("link", { name: "Privacyverklaring", exact: true })).toHaveAttribute("rel", "noreferrer");
    await expect(state.dialog.getByRole("combobox")).toHaveCount(0); await expect(state.dialog.getByText(/Rol uitproberen|Herstel demo-inhoud/)).toHaveCount(0);
    const targets = await state.dialog.locator("button,a").evaluateAll(nodes => nodes.map(node => { const rect = node.getBoundingClientRect(); return { name: node.textContent || node.getAttribute("aria-label"), width: rect.width, height: rect.height }; }));
    for (const target of targets) { expect(target.width, target.name ?? "action").toBeGreaterThanOrEqual(44); expect(target.height, target.name ?? "action").toBeGreaterThanOrEqual(44); }
    await state.dialog.getByRole("button", { name: "Uitloggen", exact: true }).scrollIntoViewIfNeeded();
    await expect(state.dialog.getByRole("button", { name: "Uitloggen", exact: true })).toBeInViewport({ ratio: 1 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await new AxeBuilder({ page }).include('[role="dialog"]').withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze()).violations).toEqual([]);
    await info.attach("actual-source-account-dialog", { body: await page.screenshot(), contentType: "image/png" });
    await state.dialog.getByRole("button", { name: "Sluiten", exact: true }).focus(); await page.keyboard.press("Shift+Tab"); await expect(state.dialog.getByRole("button", { name: "Uitloggen", exact: true })).toBeFocused();
    await page.keyboard.press("Tab"); await expect(state.dialog.getByRole("button", { name: "Sluiten", exact: true })).toBeFocused();
    await page.keyboard.press("Escape"); await expect(state.dialog).not.toBeVisible(); await expect(state.trigger).toBeFocused();
    expect(state.errors).toEqual([]); expect(state.writes).toEqual([]);
  });
}

test("nested Source preference dialog retains focus, persisted theme/density, system changes and native cross-tab storage events", async ({ page, context }) => {
  await page.emulateMedia({ colorScheme: "light" }); const state = await mount(page);
  const open = () => page.getByRole("button", { name: /^Thema en dichtheid:/ }).click();
  await open(); const display = page.getByRole("dialog", { name: "Weergave aanpassen", exact: true });
  await expect(display).toHaveCSS("width", "540px");
  const radios = display.getByRole("radio"); await expect(radios).toHaveCount(5);
  for (const radio of await radios.all()) expect((await radio.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect((await new AxeBuilder({ page }).include('[role="dialog"]').withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze()).violations).toEqual([]);
  await display.getByRole("radio", { name: "Donker", exact: true }).click(); await expect(display).not.toBeVisible(); await expect(state.dialog).toBeVisible();
  await expect(page.getByRole("button", { name: "Thema en dichtheid: Donker", exact: true })).toBeFocused();
  expect(await page.evaluate(() => [document.documentElement.dataset.theme, localStorage.getItem("veyocast-control-theme")])).toEqual(["dark", "dark"]);
  await open(); await display.getByRole("radio", { name: "Compact", exact: true }).click();
  expect(await page.evaluate(() => [document.documentElement.dataset.density, localStorage.getItem("veyocast-control-density")])).toEqual(["compact", "compact"]);
  await page.reload(); await state.trigger.click(); await open(); await expect(display.getByRole("radio", { name: "Donker", exact: true })).toHaveAttribute("aria-checked", "true"); await expect(display.getByRole("radio", { name: "Compact", exact: true })).toHaveAttribute("aria-checked", "true");
  await display.getByRole("radio", { name: "Systeem", exact: true }).click(); await page.emulateMedia({ colorScheme: "dark" }); await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.emulateMedia({ colorScheme: "light" }); await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  const sibling = await context.newPage(); await sibling.route("**/*", route => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Voorkeurwijziging</title>" })); await sibling.goto(`${origin}/preference-sibling`);
  await sibling.evaluate(() => { localStorage.setItem("veyocast-control-theme", "dark"); localStorage.setItem("veyocast-control-density", "comfortable"); });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark"); await expect(page.locator("html")).toHaveAttribute("data-density", "comfortable"); await sibling.close();
  await open(); await expect(display).toBeVisible(); await expect(display.getByRole("button", { name: "Sluiten", exact: true })).toBeFocused();
  await page.keyboard.press("Escape"); await expect(display).not.toBeVisible(); await expect(state.dialog).toBeVisible(); await expect(page.getByRole("button", { name: "Thema en dichtheid: Donker", exact: true })).toBeFocused();
  await page.keyboard.press("Escape"); await expect(state.dialog).not.toBeVisible(); await expect(state.trigger).toBeFocused();
  expect(state.errors).toEqual([]); expect(state.writes).toEqual([]);
});

test("sign out preserves the real action and removes tenant recovery before submission without deleting preferences", async ({ page }) => {
  const state = await mount(page);
  await page.evaluate(() => { localStorage.setItem("veyocast:publisher-recovery:v1:own", "private draft"); localStorage.setItem("veyocast:media-upload:pending:v1", "own upload"); localStorage.setItem("unrelated-preference", "keep"); localStorage.setItem("veyocast-control-theme", "light"); localStorage.setItem("veyocast-control-density", "compact"); });
  await state.dialog.getByRole("button", { name: "Uitloggen", exact: true }).click();
  await expect.poll(() => page.evaluate(() => (globalThis as typeof globalThis & { signOutCalls?: number }).signOutCalls)).toBe(1);
  const keys = await page.evaluate(() => (globalThis as typeof globalThis & { signOutStorageKeys: string[] }).signOutStorageKeys);
  expect(keys).not.toContain("veyocast:publisher-recovery:v1:own"); expect(keys).not.toContain("veyocast:media-upload:pending:v1"); expect(keys).toEqual(expect.arrayContaining(["unrelated-preference", "veyocast-control-theme", "veyocast-control-density"]));
  expect(state.errors).toEqual([]); expect(state.writes).toEqual([]);
});

test("platform context preserves real security/preferences without linking tenant-only profile or club settings", async ({ page }) => {
  const state = await mount(page, "platform");
  await expect(state.dialog.getByRole("link", { name: "Mijn profiel", exact: true })).toHaveCount(0); await expect(state.dialog.getByRole("link", { name: "Verenigingsinstellingen", exact: true })).toHaveCount(0);
  await expect(state.dialog.getByRole("link", { name: "Accountbeveiliging en MFA", exact: true })).toHaveAttribute("href", "/auth/mfa"); await expect(state.dialog.getByText("VeyoCast platform", { exact: true })).toBeVisible();
  await expect(state.dialog.getByRole("button", { name: /^Thema en dichtheid:/ })).toBeVisible(); await expect(state.dialog.getByRole("button", { name: "Uitloggen", exact: true })).toBeVisible();
  expect(state.errors).toEqual([]); expect(state.writes).toEqual([]);
});

test("a blocked preference store still applies the session choice and keeps account controls usable", async ({ page }) => {
  const state = await mount(page);
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException("Blocked", "SecurityError"); }; });
  await page.getByRole("button", { name: /^Thema en dichtheid:/ }).click();
  await page.getByRole("dialog", { name: "Weergave aanpassen", exact: true }).getByRole("radio", { name: "Donker", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark"); await expect(state.dialog).toBeVisible();
  await expect(state.dialog.getByRole("button", { name: "Thema en dichtheid: Donker", exact: true })).toBeFocused(); expect(state.errors).toEqual([]); expect(state.writes).toEqual([]);
});
