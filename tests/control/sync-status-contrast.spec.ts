import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type TestInfo } from "@playwright/test";

// Actual components, pure operational model and production CSS. The shell's
// session/Next/HTTP boundary is controlled; this is not live Auth/RLS evidence.
const origin = "http://127.0.0.1:3345";
const require = createRequire(join(process.cwd(), "package.json"));
const compiler = require.resolve("esbuild", { paths: [require.resolve("tsx")] });
const cssBeforeAdapter = ["tokens/veyocast-design-tokens.css", "packages/ui/src/styles.css", "apps/control/app/globals.css", "apps/control/app/fieldflow.css", "apps/control/app/sync-source.css"];
const cssAfterAdapter = ["apps/control/app/(shell)/dashboard/studio/sync-retained-studio.css", "apps/control/app/sync-auth.css"];
let rendered: string;
let themeBootstrap: string;
let shell: { js: string; css: string };

function compile(script: string) {
  return execFileSync(process.execPath, ["-e", `(async()=>{${script}})().catch(error=>{console.error(error);process.exitCode=1})`], { encoding: "utf8", timeout: 30_000, maxBuffer: 24 * 1024 * 1024 });
}

test.beforeAll(() => {
  const entry = `import React from'react';import{renderToReadableStream}from'react-dom/server';import{SyncOverview}from'./apps/control/app/(shell)/dashboard/sync-overview';import{ControlThemeBootstrap}from'./apps/control/app/(shell)/_components/control-theme-switcher';import{deriveOperationalDashboard}from'./apps/control/lib/control-operations';import{Badge as SourceBadge}from'./docs/sync-v1-rebuild/handoff/reference/sites-sync/src/ui';import{Badge}from'./packages/ui/src/components/badge';import{StatusPill}from'./packages/ui/src/components/resource';
async function run(){const now=new Date('2026-10-19T12:00:00Z'),stamp=now.toISOString(),id=n=>'24500000-0000-4000-8000-'+String(n).padStart(12,'0');Date.now=()=>now.getTime();
const screens=[1,2,3].map(n=>({id:id(n),name:['Eigen bereikbaar scherm','Eigen offline scherm','Eigen onbekend scherm'][n-1],location:'Eigen clubruimte',status:'active',assigned_playlist_id:id(8),assigned_release_id:id(9),created_at:stamp}));
const devices=[1,2].map(n=>({id:id(10+n),screen_id:id(n),status:'paired',active_release_id:id(9),desired_release_id:id(9),last_seen_at:n===1?stamp:'2026-10-19T11:00:00Z',last_error_at:null,last_error_code:null,storage_used_bytes:100,storage_quota_bytes:10000,current_sync_detail:{publicationTrace:{releaseId:id(9),firstFrameAt:'2026-10-19T10:00:00Z'}}}));
const data={availability:{audit:true,devices:true,integrations:true,media:true,members:true,playlists:true,screens:true,telemetry:true,tenant:true},screens,devices,heartbeats:[{screen_id:id(1),active_release_id:id(9),created_at:stamp,runtime_state:'PLAYING'}],integrations:{dynamicSources:[],sportlinkConnections:[]},invitations:[],memberCount:1,mediaStorageLimitBytes:100000,media:[{id:id(7),title:'Eigen afbeelding',status:'ready',created_at:stamp,file_size_bytes:100,validation_error:null}],playlistItems:[{playlist_id:id(8),media_asset_id:id(7)}],playlists:[{id:id(8),name:'Eigen clubprogramma',status:'active',updated_at:stamp}],releases:[{id:id(9),playlist_id:id(8),version:1,published_at:stamp}],screenLimit:10,auditEvents:[],error:false,loadState:'complete',unavailable:[]};
const healthy=deriveOperationalDashboard({...data,screens:[screens[0]],devices:[devices[0]]},now).status;if(healthy.id!=='healthy')throw Error('Fixture must derive a genuinely healthy operational status: '+healthy.id);
const overview=await SyncOverview({canCreateStudio:false,canManageScreens:false,data,schedules:[],tenant:'Eigen vereniging',userName:'Eigen lezer',tenantId:id(20)});
const content=<><ControlThemeBootstrap/><main className='sites-control sync-control' style={{padding:20}}>{overview}<section aria-label='Statuscomponenten'><h2>Statuscomponenten</h2><div data-proof='concept'><SourceBadge tone='amber'>Concept</SourceBadge></div><div data-proof='shared-success'><StatusPill label={healthy.label} tone={healthy.tone}/></div><div data-proof='shared-confirmation'><Badge status='success'>AAL2 bevestigd</Badge></div>{['green','red','blue','neutral'].map(tone=><div data-proof={'source-'+tone} key={tone}><SourceBadge tone={tone}>Andere Source-status {tone}</SourceBadge></div>)}{['neutral','warning','critical','info'].map(status=><div data-proof={'shared-'+status} key={status}><Badge status={status}>Andere gedeelde status {status}</Badge></div>)}</section></main><aside className='sites-control' aria-label='Buiten Sync' data-proof='outside-success'><Badge status='success'>Buiten Sync ongewijzigd</Badge><div data-proof='outside-neutral'><Badge status='neutral'>Buiten Sync neutraal ongewijzigd</Badge></div></aside></>;
process.stdout.write(await new Response(await renderToReadableStream(content)).text());}run().catch(error=>{console.error(error);process.exitCode=1});`;
  const server = String.raw`const result=await require(${JSON.stringify(compiler)}).build({stdin:{contents:${JSON.stringify(entry)},resolveDir:process.cwd(),loader:'tsx'},nodePaths:[process.cwd()+'/apps/control/node_modules'],bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',loader:{'.css':'empty','.module.css':'empty'},plugins:[{name:'readonly-host-boundary',setup(b){b.onResolve({filter:/^next\/link$/},a=>({path:a.path,namespace:'fixture',pluginData:{contents:'import React from"react";export default function Link({children,...props}){return React.createElement("a",props,children)}'}}));b.onResolve({filter:/release-preview.server$/},a=>({path:a.path,namespace:'fixture',pluginData:{contents:'export async function loadFrozenReleasePreviews(){return new Map()}'}}));b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:a.pluginData.contents,loader:'js',resolveDir:process.cwd()}))}}]});const m={exports:{}};new Function('require','module','exports',result.outputFiles[0].text)(require,m,m.exports);`;
  rendered = compile(server);
  // React client insertion does not execute script tags. Reuse the actual SSR
  // bootstrap before the client-only shell, as the real Next document does.
  const bootstrap = rendered.match(/<script>[\s\S]*?<\/script>/)?.[0];
  if (!bootstrap) throw new Error("The actual SSR theme bootstrap is required");
  themeBootstrap = bootstrap;
  const shellEntry = `import React from'react';import{createRoot}from'react-dom/client';import{getCapabilitiesForRoles}from'@veyocast/auth';import{ControlShell}from'./apps/control/app/(shell)/_components/control-shell';import{getNavigationGroupsForRoles}from'./apps/control/app/(shell)/_lib/control-navigation';const capabilities=getCapabilitiesForRoles(['tenant_owner']),tenant='24500000-0000-4000-8000-000000000020';const session={assuranceLevel:'aal2',nextAssuranceLevel:'aal2',capabilities,email:'own-status@example.invalid',isLive:true,organization:'Eigen platform',roles:['tenant_owner'],tenant:'Eigen vereniging',tenantContextReason:'selected',tenantId:tenant,tenantMemberships:[{id:tenant,name:'Eigen vereniging',slug:'own-status',role:'tenant_owner',status:'active',customRoleId:null,customRoleName:null}],tenantRoleLabel:'Eigenaar',tenantSlug:'own-status',tenantStatus:'active',timezoneName:'Europe/Amsterdam',userId:'24500000-0000-4000-8000-000000000021',userName:'Eigen lezer'};createRoot(document.getElementById('root')).render(<ControlShell session={session} navigationGroups={getNavigationGroupsForRoles(capabilities)} uploadQueue={[]} visualQaEnabled={false}><h2>Eigen navigatiecontrole</h2></ControlShell>);`;
  const browser = String.raw`const result=await require(${JSON.stringify(compiler)}).build({stdin:{contents:${JSON.stringify(shellEntry)},resolveDir:process.cwd(),loader:'tsx'},nodePaths:[process.cwd()+'/apps/control/node_modules'],bundle:true,write:false,outfile:'shell.js',platform:'browser',format:'iife',jsx:'automatic',loader:{'.css':'css','.module.css':'local-css'},plugins:[{name:'next-and-action-transport-only',setup(b){b.onResolve({filter:/^next\/(navigation|link|image)$/},a=>({path:a.path,namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:a.path.endsWith('navigation')?'export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search);export const useRouter=()=>({push:path=>location.assign(path),refresh(){}})':'import React from"react";export default function View({children,priority,unoptimized,fill,...props}){return React.createElement('+JSON.stringify(a.path.endsWith('image')?'img':'a')+',props,children)}',loader:'js',resolveDir:process.cwd()}));b.onResolve({filter:/actions$/},a=>({path:a.path,namespace:'actions'}));b.onLoad({filter:/.*/,namespace:'actions'},()=>({contents:'export async function switchTenantContext(){throw Error("Unexpected action")};export async function signOut(){throw Error("Unexpected action")}',loader:'js'}))}}]});process.stdout.write(JSON.stringify({js:result.outputFiles.find(f=>f.path.endsWith('.js')).text,css:result.outputFiles.find(f=>f.path.endsWith('.css')).text}));`;
  shell = JSON.parse(compile(browser));
});

function css(paths: string[]) {
  return paths.map(path => readFileSync(path, "utf8").replace(/@import[^;]+;/g, "")).join("\n");
}

async function record(info: TestInfo, name: string, attachment: { body: Buffer; contentType: string }) {
  const path = info.outputPath(`${name}.${attachment.contentType === "image/png" ? "png" : "json"}`);
  writeFileSync(path, attachment.body);
  await info.attach(name, { path, contentType: attachment.contentType });
}

async function assets(page: Page) {
  await page.route(`${origin}/assets/*`, route => {
    const name = new URL(route.request().url()).pathname.split("/").at(-1)!;
    if (!/^[a-zA-Z0-9_.-]+$/.test(name)) return route.abort();
    return route.fulfill({ body: readFileSync(join(process.cwd(), "apps/control/public/assets", name)), contentType: name.endsWith("woff2") ? "font/woff2" : name.endsWith("ttf") ? "font/ttf" : "image/svg+xml" });
  });
}

async function measurements(page: Page) {
  return page.locator(".badge,.vc-badge").evaluateAll(nodes => nodes.map(node => {
    const style = getComputedStyle(node), box = node.getBoundingClientRect(), dot = node.querySelector(".vc-badge__dot");
    const rgb = (value: string) => value.match(/[\d.]+/g)!.map(Number);
    const luminance = (value: number[]) => value.slice(0, 3).map(channel => { const v = channel / 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((sum, channel, i) => sum + channel * [.2126, .7152, .0722][i], 0);
    const background = rgb(style.backgroundColor), text = rgb(style.color);
    if (background.length === 4 && background[3] !== 1) throw Error("Badge must have an opaque measured surface");
    const a = luminance(background), b = luminance(text);
    return { key: node.closest("[data-proof]")?.getAttribute("data-proof") ?? node.textContent!.trim(), label: node.textContent!.trim(), directText: [...node.childNodes].filter(child => child.nodeType === Node.TEXT_NODE).map(child => child.textContent).join("").trim(), color: style.color, background: style.backgroundColor, border: [style.borderTopWidth, style.borderTopStyle, parseFloat(style.borderTopWidth) ? style.borderTopColor : "not-painted"], radius: style.borderRadius, padding: style.padding, gap: style.gap, font: [style.fontFamily, style.fontSize, style.fontWeight, style.lineHeight], width: box.width, height: box.height, dot: dot ? { color: getComputedStyle(dot).backgroundColor, width: dot.getBoundingClientRect().width, height: dot.getBoundingClientRect().height, hidden: dot.getAttribute("aria-hidden") } : null, contrast: (Math.max(a, b) + .05) / (Math.min(a, b) + .05), target: Boolean(node.closest(".sync-control")) && (node.classList.contains("badge-amber") || node.classList.contains("vc-badge--success")), sourceNeutral: Boolean(node.closest(".sync-control")) && node.classList.contains("vc-badge--neutral") };
  }));
}

for (const width of [390, 1440]) {
  test(`actual Sync statuses and active shell marker retain meaning and geometry at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    const errors: string[] = [], writes: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("request", request => { if (request.method() !== "GET") writes.push(`${request.method()} ${request.url()}`); });
    await assets(page);
    await page.emulateMedia({ colorScheme: "light" });
    await page.addInitScript(() => {
      const preference = new URL(location.href).searchParams.get("theme");
      if (preference === "light" || preference === "dark") localStorage.setItem("veyocast-control-theme", preference);
    });
    await page.route(`${origin}/__statuses?*`, route => route.fulfill({ contentType: "text/html", body: `<!doctype html><html lang="nl" data-design-system="fieldflow"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sync-statuscontrole</title><style>${css(cssBeforeAdapter)}</style></head><body>${rendered}</body></html>` }));
    let lightTargetPresentation: unknown[] = [];
    let lightNeutralPresentation: unknown[] = [];
    for (const theme of ["light", "dark"] as const) {
      await page.goto(`${origin}/__statuses?theme=${theme}`);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expect(page.locator("html")).toHaveAttribute("data-theme-preference", theme);
      expect(await page.evaluate(() => localStorage.getItem("veyocast-control-theme"))).toBe(theme);
      await page.evaluate(() => document.fonts.ready);
      const before = await measurements(page);
      await page.addStyleTag({ content: css(["apps/control/app/sync-adapter.css", ...cssAfterAdapter]) });
      const after = await measurements(page);
      const retained = (value: typeof after[number]) => Object.fromEntries(Object.entries(value).filter(([key]) => !["color", "contrast"].includes(key)));
      // S247 intentionally changes neutral ink and its currentColor dot only.
      const retainedNeutral = (value: typeof after[number]) => ({ ...retained(value), dot: value.dot ? Object.fromEntries(Object.entries(value.dot).filter(([key]) => key !== "color")) : null });
      const presentation = after.filter(row => row.target).map(retained);
      const neutralPresentation = after.filter(row => row.sourceNeutral);
      if (theme === "light") lightTargetPresentation = presentation;
      else expect(presentation, "Fixed Source status surfaces, borders, geometry, typography and dots survive the actual dark preference").toEqual(lightTargetPresentation);
      if (theme === "light") lightNeutralPresentation = neutralPresentation;
      else expect(neutralPresentation, "The integrated neutral Source foreground, surface, geometry and currentColor dot survive the actual dark preference").toEqual(lightNeutralPresentation);
      const resolvedRoles = await page.locator(".sites-control.sync-control").evaluate(node => {
        const style = getComputedStyle(node);
        const neutral = document.createElement("span").style;
        neutral.color = style.getPropertyValue("--text").trim();
        return { ...Object.fromEntries(["--vc-semantic-warning-text", "--vc-semantic-success-text", "--vc-vector-warning-on-surface", "--vc-vector-success-on-surface", "--text"].map(role => [role, style.getPropertyValue(role).trim()])), sourceNeutralForeground: neutral.color };
      });
      await record(info, `computed-statuses-${theme}-${width}`, { body: Buffer.from(JSON.stringify({ theme, resolvedRoles, before, after }, null, 2)), contentType: "application/json" });
      await record(info, `actual-statuses-${theme}-${width}`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
      expect(after.map(row => row.label)).toEqual(before.map(row => row.label));
      expect(after.filter(row => row.target).map(row => row.label)).toEqual(["Offline", "Concept", "Actueel", "AAL2 bevestigd"]);
      expect(neutralPresentation.map(row => row.key)).toEqual(["shared-neutral"]);
      expect(after.filter(row => row.key === "outside-neutral").map(row => row.label)).toEqual(["Buiten Sync neutraal ongewijzigd"]);
      for (const [index, row] of after.entries()) {
        const original = before[index];
        if (row.target) {
          expect(row.directText, row.label).toBe(row.label);
          expect.soft(row.contrast, `${row.label}: direct small text on its actual surface`).toBeGreaterThanOrEqual(4.5);
          expect(retained(row), `${row.label}: surface, painted border, geometry, typography, status and dot`).toEqual(retained(original));
        } else if (row.sourceNeutral) {
          expect(row.directText, row.label).toBe(row.label);
          expect(row.color, `${row.label}: the approved fixed Source foreground`).toBe(resolvedRoles.sourceNeutralForeground);
          expect.soft(row.contrast, `${row.label}: direct small text on its preserved neutral surface`).toBeGreaterThanOrEqual(4.5);
          expect(row.dot, `${row.label}: the actual shared status retains its dot`).not.toBeNull();
          expect(row.dot!.color, `${row.label}: currentColor follows the approved foreground`).toBe(row.color);
          expect(original.dot!.color, `${row.label}: the original dot also follows currentColor`).toBe(original.color);
          expect(retainedNeutral(row), `${row.label}: surface, painted border, geometry, typography, status and dot structure`).toEqual(retainedNeutral(original));
        } else expect(row, `${row.label}: outside Sync or another status remains unchanged`).toEqual(original);
      }
      const axe = await new AxeBuilder({ page }).include(".sync-control .badge-amber").include(".sync-control .vc-badge--success").include(".sync-control .vc-badge--neutral").withRules(["color-contrast"]).analyze();
      await record(info, `targeted-axe-${theme}-${width}`, { body: Buffer.from(JSON.stringify({ violations: axe.violations, incomplete: axe.incomplete }, null, 2)), contentType: "application/json" });
      expect.soft(axe.violations).toEqual([]);
      expect(axe.incomplete, "The target badge colors must be evaluated, not silently incomplete").toEqual([]);
    }
    const path = width === 1440 ? "/dashboard/sponsors" : "/dashboard";
    await page.route(`${origin}/dashboard**`, route => route.fulfill({ contentType: "text/html", body: `<!doctype html><html lang="nl" data-design-system="fieldflow"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sync-navigatiecontrole</title><style>${css([...cssBeforeAdapter, "apps/control/app/sync-adapter.css", ...cssAfterAdapter])}\n${shell.css}</style></head><body>${themeBootstrap}<div id="root"></div><script>${shell.js.replace(/<\/script/gi, "<\\/script")}</script></body></html>` }));
    await page.goto(`${origin}${path}`);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.locator("html")).toHaveAttribute("data-theme-preference", "dark");
    const trigger = page.getByRole("button", { name: "Navigatie openen", exact: true });
    if (width === 390) { await expect(trigger).toBeEnabled(); await trigger.click(); }
    const navigation = page.locator('aside[aria-label="Control navigatie"]');
    const active = navigation.locator('a.nav-link[aria-current="page"]');
    await expect(active).toHaveCount(1); await expect(active).toHaveAttribute("href", path);
    await expect(active).toHaveText(width === 1440 ? "Sponsors" : "Overzicht");
    await expect.poll(() => navigation.evaluate(node => node.getAnimations({ subtree: true }).filter(animation => animation.playState === "running").length)).toBe(0);
    await record(info, `actual-shell-${width}`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
    const marker = active.locator(":scope > i.nav-indicator");
    await expect.soft(marker).toHaveCount(1);
    if (await marker.count()) {
      await expect(marker).toBeVisible(); await expect(marker).toHaveAttribute("aria-hidden", "true");
      const shape = await marker.evaluate(node => { const s = getComputedStyle(node), r = node.getBoundingClientRect(), p = node.parentElement!.getBoundingClientRect(); return { width: r.width, height: r.height, left: r.left - p.left, top: r.top - p.top, bottom: p.bottom - r.bottom, color: s.backgroundColor, activeColor: getComputedStyle(node.parentElement!).color }; });
      expect(shape).toEqual({ width: 3, height: (await active.boundingBox())!.height - 24, left: 0, top: 12, bottom: 12, color: shape.activeColor, activeColor: shape.activeColor });
    }
    await expect(navigation.locator('a.nav-link:not([aria-current="page"]) .nav-indicator')).toHaveCount(0);
    if (width === 390) { await page.keyboard.press("Escape"); await expect(trigger).toBeFocused(); await expect(trigger).toHaveAttribute("aria-expanded", "false"); }
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(active).toHaveAttribute("aria-current", "page");
    expect(errors).toEqual([]); expect(writes).toEqual([]);
  });
}
