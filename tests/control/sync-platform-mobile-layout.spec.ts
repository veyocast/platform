import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";

// Actual async pages, PlatformLayout and ControlShell SSR. The session,
// readmodels, Next host and command transport are controlled, not live Auth/RLS.
const origin = "http://127.0.0.1:3351";
const fixtureRequire = createRequire(join(process.cwd(), "package.json"));
const compiler = fixtureRequire.resolve("esbuild", { paths: [fixtureRequire.resolve("tsx")] });
const routes = ["/platform/tenants", "/platform/integrations/sportlink", "/platform/support/settings"] as const;
const rootStyles = ["tokens/veyocast-design-tokens.css", "packages/ui/src/styles.css", "apps/control/app/globals.css", "apps/control/app/fieldflow.css", "apps/control/app/sync-source.css", "apps/control/app/sync-adapter.css", "apps/control/app/(shell)/dashboard/studio/sync-retained-studio.css", "apps/control/app/sync-auth.css"];
const protectedHashes: Record<string, string> = {
  "apps/control/app/(shell)/platform/tenants/page.tsx": "b0cea9b54bcb51f08e1a9fb6a0c60a83c62a3dfca6f61d483ca79329dc4e6333",
  "apps/control/app/(shell)/platform/tenants/actions.ts": "d0b1d494d5e635449c29caf7570c5c5becfbde443350d40bf7358548385a65b3",
  "apps/control/app/(shell)/platform/tenants/tenant-create-submit.tsx": "c188f563f876335538ba9b61b081133e284a988bcec3a14b03e70d233108c6cf",
  "apps/control/app/(shell)/platform/integrations/sportlink/page.tsx": "5fccfbb2f702148c9672476d3240b3359cb0cf84b517498d46035e7e34dfd5eb",
  "apps/control/app/(shell)/platform/support/settings/page.tsx": "45a78393a0b1067e56dbd76e56dac219e0fb56abdbb847af85db57ff2639a2ef",
  "apps/control/app/(shell)/platform/support/actions.ts": "3b8db2b0e11df5eb327f4859d4a6e48d2297b938a286d112830a05bbc3b6f6e9",
  "apps/control/app/(shell)/platform/layout.tsx": "aeca3ede7041ffaeabc06578cb1159118ad0bd3623df3421fbc2230d93814807",
  "apps/control/app/(shell)/_components/control-shell.tsx": "28141d7a24382924f1eb46acbd95168eae59bfdaeeb0b4e89184e073bb94490f",
  "apps/control/lib/control-session.ts": "d91e3675c86090cae4caa58e4b89595342e4066203376a8af7172f13dc8ac367",
  "packages/ui/src/components/summary-strip.tsx": "9249c886cd1e8df1cd3a1d27b466dca05bc32dcec52504f865572b3018b743b2",
  "packages/ui/src/styles.css": "92f1a37f22f1f58bdedcec9bff5b65d37510e3121de629db02f6797e92ca4f15",
  "apps/control/app/globals.css": "1998a4016e57fa1eb0a38cb2c23b4c1f43f0f58d2d9a88f5e10662e85a659d11",
  "apps/control/app/fieldflow.css": "91131b1c2666d8670d953c027ab5c40938a3822778272a8f5d9eca641cbd4418",
  "apps/control/app/sync-source.css": "83cc3d45446e1f61119b1126f336e59574675cec1b4cd1617b678ad4c28e4153",
  "apps/control/app/sync-adapter.css": "fc468fcbe70e3a0949a8a08ca13b0ac542fcd075acd03f225d94dd1514fe1cad"
};
let fixture: { pages: Record<string, string>; css: string; boundaryCalls: { capability: string; options?: unknown }[] };

test.beforeAll(() => {
  for (const [path, digest] of Object.entries(protectedHashes)) expect(createHash("sha256").update(readFileSync(path)).digest("hex"), path).toBe(digest);
  const entry = `import React from'react';import{renderToReadableStream}from'react-dom/server';import{getCapabilitiesForRoles}from'@veyocast/auth';import{SummaryStrip}from'@veyocast/ui';import{ControlShell}from'./apps/control/app/(shell)/_components/control-shell';import{getNavigationGroupsForRoles}from'./apps/control/app/(shell)/_lib/control-navigation';import PlatformLayout from'./apps/control/app/(shell)/platform/layout';import TenantsPage from'./apps/control/app/(shell)/platform/tenants/page';import SportlinkPage from'./apps/control/app/(shell)/platform/integrations/sportlink/page';import SupportPage from'./apps/control/app/(shell)/platform/support/settings/page';
export async function render(){const capabilities=getCapabilitiesForRoles(['platform_owner']);const session={assuranceLevel:'aal2',nextAssuranceLevel:'aal2',capabilities,email:'own-layout@example.invalid',isLive:true,organization:'Eigen platform',roles:['platform_owner'],tenant:'Eigen vereniging',tenantContextReason:'selected',tenantId:'25100000-0000-4000-8000-000000000001',tenantMemberships:[],tenantRoleLabel:'Platformeigenaar',tenantSlug:'own-layout',tenantStatus:'active',timezoneName:'Europe/Amsterdam',userId:'25100000-0000-4000-8000-000000000002',userName:'Eigen lezer'};globalThis.fixtureSession=session;globalThis.fixtureBoundaryCalls=[];const pages={};for(const [path,Page]of[['/platform/tenants',TenantsPage],['/platform/integrations/sportlink',SportlinkPage],['/platform/support/settings',SupportPage]]){globalThis.fixturePath=path;const content=await Page({searchParams:Promise.resolve({})});const platform=await PlatformLayout({children:content});pages[path]=await new Response(await renderToReadableStream(<ControlShell session={session} navigationGroups={getNavigationGroupsForRoles(capabilities)} uploadQueue={[]} visualQaEnabled={false}>{platform}<aside aria-label="Buiten platform"><SummaryStrip items={[{label:'Bestaande verbindingen',value:1},{label:'Actief',value:1},{label:'Aandacht nodig',value:0},{label:'Privacyfeeds',value:'Standaard uit',detail:'Expliciete tenantopt-in vereist'}]}/></aside></ControlShell>)).text()}return{pages,boundaryCalls:globalThis.fixtureBoundaryCalls}}`;
  const linkBoundary = `import React from'react';export default function Host({children,priority,unoptimized,fill,prefetch,...props}){return React.createElement('a',props,children)}`;
  const imageBoundary = `import React from'react';export default function Host({children,priority,unoptimized,fill,prefetch,...props}){return React.createElement('img',props,children)}`;
  const sessionBoundary = `export async function requireControlCapability(capability,options){if(!['platform.system.read','platform.tenant.read','platform.ticket.admin'].includes(capability))throw Error('Unexpected capability '+capability);if(capability==='platform.ticket.admin'&&(!options?.aal2||options.returnTo!=='/platform/support/settings'))throw Error('Missing actual AAL2 request');globalThis.fixtureBoundaryCalls.push({capability,options});return globalThis.fixtureSession}`;
  const readBoundary = `export async function loadPlatformOverview(){return{error:false,tenants:[{id:'25100000-0000-4000-8000-000000000001',name:'Eigen vereniging',slug:'eigen-vereniging',status:'active',screen_limit:4}],screens:[]}}`;
  const supportBoundary = `export async function loadPlatformSupport(){return{roles:[],departments:[],platformUsers:[]}}`;
  const sportlinkBoundary = `export async function createControlSupabaseClient(){return{from(table){if(table==='sportlink_connections')return{select(){return{async order(){return{error:null,data:[{id:'25100000-0000-4000-8000-000000000003',tenant_id:'25100000-0000-4000-8000-000000000001',status:'active',detected_club_name:'Eigen QA-club',client_id_suffix:'EIGEN',last_success_at:null,next_sync_at:'2026-10-19T12:00:00Z',last_duration_ms:null,last_error_code:null}]}}}}};if(table==='tenants')return{select(){return{async in(){return{error:null,data:[{id:'25100000-0000-4000-8000-000000000001',name:'Eigen vereniging'}]}}}}};throw Error('Unexpected readonly table '+table)}}}`;
  const actions = `const deny=async()=>{throw Error('Unexpected command transport')};export const createTenant=deny,assignPlatformSupportRole=deny,createPlatformSupportRole=deny,createSupportDepartment=deny,switchTenantContext=deny,signOut=deny;`;
  const script = String.raw`(async()=>{const result=await require(${JSON.stringify(compiler)}).build({stdin:{contents:${JSON.stringify(entry)},resolveDir:process.cwd(),loader:'tsx'},nodePaths:[process.cwd()+'/apps/control/node_modules'],bundle:true,write:false,outfile:'platform.js',platform:'node',format:'cjs',jsx:'automatic',loader:{'.module.css':'local-css','.css':'css','.woff2':'dataurl'},plugins:[{name:'readonly-platform-boundary',setup(b){b.onResolve({filter:/^next\/(link|image|navigation)$/},a=>({path:a.path,namespace:'boundary'}));b.onResolve({filter:/\/lib\/control-session$/},a=>({path:'session',namespace:'boundary'}));b.onResolve({filter:/\/lib\/control-overview$/},a=>({path:'overview',namespace:'boundary'}));b.onResolve({filter:/\/support\/data$/},a=>({path:'support',namespace:'boundary'}));b.onResolve({filter:/\/lib\/supabase\/server$/},a=>({path:'sportlink',namespace:'boundary'}));b.onResolve({filter:/actions$/},a=>({path:'actions',namespace:'boundary'}));b.onLoad({filter:/.*/,namespace:'boundary'},a=>({contents:a.path==='session'?${JSON.stringify(sessionBoundary)}:a.path==='overview'?${JSON.stringify(readBoundary)}:a.path==='support'?${JSON.stringify(supportBoundary)}:a.path==='sportlink'?${JSON.stringify(sportlinkBoundary)}:a.path==='actions'?${JSON.stringify(actions)}:a.path.endsWith('navigation')?'export const usePathname=()=>globalThis.fixturePath;export const useSearchParams=()=>new URLSearchParams();export const useRouter=()=>({push(){throw Error("Unexpected navigation")},refresh(){}})':a.path.endsWith('image')?${JSON.stringify(imageBoundary)}:${JSON.stringify(linkBoundary)},loader:'js',resolveDir:process.cwd()}))}}]});const m={exports:{}};new Function('require','module','exports',result.outputFiles.find(f=>f.path.endsWith('.js')).text)(require,m,m.exports);process.stdout.write(JSON.stringify({...await m.exports.render(),css:result.outputFiles.find(f=>f.path.endsWith('.css')).text}));})().catch(error=>{console.error(error);process.exitCode=1})`;
  fixture = JSON.parse(execFileSync(process.execPath, ["-e", script], { encoding: "utf8", timeout: 30_000, maxBuffer: 24 * 1024 * 1024 }));
  expect(fixture.boundaryCalls.filter(call => call.capability === "platform.system.read")).toHaveLength(3);
  expect(fixture.boundaryCalls.filter(call => call.capability === "platform.tenant.read")).toHaveLength(2);
  expect(fixture.boundaryCalls.find(call => call.capability === "platform.ticket.admin")?.options).toEqual({ aal2: true, returnTo: "/platform/support/settings" });
});

async function record(info: TestInfo, name: string, body: Buffer, contentType: "application/json" | "image/png") {
  const path = info.outputPath(`${name}.${contentType === "image/png" ? "png" : "json"}`);
  writeFileSync(path, body); await info.attach(name, { path, contentType });
}

async function summaryFacts(locator: Locator) {
  return locator.evaluate(element => {
    const base = element.getBoundingClientRect();
    return { width: base.width, height: base.height, items: [...element.children].map(item => {
      const box = item.getBoundingClientRect(), style = getComputedStyle(item);
      const texts = [...item.querySelectorAll("dt,dd,p")].map(node => {
        const s = getComputedStyle(node), bounds = node.getBoundingClientRect();
        const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT); const wordLines: number[] = [];
        while (walker.nextNode()) {
          const text = walker.currentNode;
          for (const match of text.textContent!.matchAll(/\S+/g)) { const range = document.createRange(); range.setStart(text, match.index!); range.setEnd(text, match.index! + match[0].length); wordLines.push(range.getClientRects().length); }
        }
        return { text: node.textContent!.trim(), display: s.display, visible: bounds.width > 0 && bounds.height > 0, clientWidth: node.clientWidth, scrollWidth: node.scrollWidth, wordLines, font: [s.fontFamily, s.fontSize, s.fontWeight, s.lineHeight], color: s.color };
      });
      return { x: box.x - base.x, y: box.y - base.y, width: box.width, height: box.height, background: style.backgroundColor, border: style.border, texts };
    }) };
  });
}

async function widths(page: Page) {
  return page.locator("html,.vx-main,#control-content").evaluateAll(nodes => nodes.map(node => ({ selector: node.id || node.className || node.nodeName, client: node.clientWidth, scroll: node.scrollWidth })));
}

async function hitFact(locator: Locator) {
  await locator.scrollIntoViewIfNeeded();
  return locator.evaluate(element => {
    const box = element.getBoundingClientRect(), x = box.x + box.width / 2, y = box.y + box.height / 2, hit = document.elementFromPoint(x, y);
    return { name: element.getAttribute("id") || element.textContent!.trim(), hit: hit === element || element.contains(hit), box: { x: box.x, y: box.y, width: box.width, height: box.height }, mainScrollTop: document.querySelector(".vx-main")!.scrollTop, documentScrollTop: document.scrollingElement!.scrollTop };
  });
}

for (const width of [390, 1440]) {
  test(`platform forms, summaries and support cards remain readable at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    const errors: string[] = [], writes: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("request", request => { if (request.method() !== "GET") writes.push(`${request.method()} ${new URL(request.url()).pathname}`); });
    await page.route(`${origin}/assets/*`, route => {
      const name = new URL(route.request().url()).pathname.split("/").at(-1)!;
      if (!/^[a-zA-Z0-9_.-]+$/.test(name)) return route.abort();
      return route.fulfill({ body: readFileSync(join(process.cwd(), "apps/control/public/assets", name)), contentType: name.endsWith("woff2") ? "font/woff2" : "image/svg+xml" });
    });
    const css = rootStyles.map(path => readFileSync(path, "utf8").replace(/@import[^;]+;/g, "")).join("\n");
    for (const [index, routePath] of routes.entries()) {
      await page.route(`${origin}${routePath}`, route => route.fulfill({ contentType: "text/html", body: `<!doctype html><html lang="nl" data-design-system="fieldflow"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Platformlayoutcontrole</title><style>${css}</style></head><body>${fixture.pages[routePath]}</body></html>` }));
      await page.goto(`${origin}${routePath}`);
      await page.evaluate(() => document.fonts.ready);
      const outside = page.getByRole("complementary", { name: "Buiten platform", exact: true }).locator(".vc-summary-strip");
      const outsideBefore = await summaryFacts(outside);
      await page.addStyleTag({ content: fixture.css });
      await page.evaluate(() => document.fonts.ready);
      expect.soft(await summaryFacts(outside), "The actual shared SummaryStrip outside PlatformLayout retains every measured style and relative geometry").toEqual(outsideBefore);
      const facts = await widths(page);
      for (const row of facts) expect.soft(row.scroll, `${routePath}: ${row.selector} has no horizontal overflow`).toBeLessThanOrEqual(row.client);
      await record(info, `page-${index}-${width}-widths`, Buffer.from(JSON.stringify(facts, null, 2)), "application/json");
      await record(info, `page-${index}-${width}-initial`, await page.screenshot(), "image/png");

      if (routePath === "/platform/tenants") {
        const form = page.locator("#nieuwe-tenant"), actions = form.locator(".sticky-form-actions"), submit = form.getByRole("button", { name: "Vereniging aanmaken", exact: true });
        await expect(submit).toBeEnabled();
        const formBefore = await form.evaluate(node => [...new FormData(node as HTMLFormElement)]);
        const flow = await actions.evaluate(node => { const a = node.getBoundingClientRect(), fields = [...node.closest("form")!.querySelectorAll(".field,.check-row")].map(field => field.getBoundingClientRect().bottom); return { position: getComputedStyle(node).position, actionTop: a.top, fieldsBottom: Math.max(...fields) }; });
        expect.soft(flow.position).toBe(width === 390 ? "static" : "sticky");
        if (width === 390) expect.soft(flow.actionTop, "Tenant actions follow every field, including ownership choice").toBeGreaterThanOrEqual(flow.fieldsBottom);
        const hits = [];
        for (const selector of ["#tenant-name", "#tenant-slug", "#tenant-slug-help", "#tenant-owner-email", "#tenant-screen-limit", "#tenant-locale", "#tenant-timezone", "#tenant-actor-owner"]) {
          const hit = await hitFact(page.locator(selector)); hits.push(hit); expect.soft(hit.hit, `${selector} is reachable under native scroll without the action bar covering its center`).toBe(true);
        }
        const submitHit = await hitFact(submit); hits.push(submitHit); expect.soft(submitHit.hit, "The real submit control remains reachable after all fields").toBe(true);
        await page.locator("#tenant-actor-owner").focus(); await page.keyboard.press("Tab"); await expect(submit).toBeFocused();
        expect(await form.evaluate(node => [...new FormData(node as HTMLFormElement)])).toEqual(formBefore);
        await record(info, `tenant-flow-${width}`, Buffer.from(JSON.stringify({ flow, hits, formBefore }, null, 2)), "application/json");
        await record(info, `tenant-actions-${width}`, await page.screenshot(), "image/png");
      } else if (routePath === "/platform/integrations/sportlink") {
        const strip = page.locator("#control-content .vc-summary-strip").first();
        const summary = await summaryFacts(strip); expect(summary.items).toHaveLength(4);
        expect(summary.items.flatMap(row => row.texts.map(text => text.text))).toEqual(["Verbindingen", "1", "Actief", "1", "Aandacht nodig", "0", "Privacyfeeds", "Standaard uit", "Expliciete tenantopt-in vereist"]);
        for (const row of summary.items) for (const text of row.texts) {
          expect.soft(text.visible, `${text.text}: complete label, value and privacy detail remain visible`).toBe(true);
          expect.soft(text.scrollWidth, `${text.text}: no ellipsis or clipped content`).toBeLessThanOrEqual(text.clientWidth);
          for (const lines of text.wordLines) expect.soft(lines, `${text.text}: no word breaks across lines`).toBe(1);
        }
        if (width === 390) { expect.soft(summary.items[0].y).toBe(summary.items[1].y); expect.soft(summary.items[2].y).toBe(summary.items[3].y); expect.soft(summary.items[2].y).toBeGreaterThanOrEqual(summary.items[0].y + summary.items[0].height); expect.soft(summary.items[2].x).toBe(summary.items[0].x); expect.soft(summary.items[3].x).toBe(summary.items[1].x); }
        else expect(summary.items.map(row => row.y)).toEqual([summary.items[0].y, summary.items[0].y, summary.items[0].y, summary.items[0].y]);
        await strip.scrollIntoViewIfNeeded(); await record(info, `sportlink-summary-${width}`, Buffer.from(JSON.stringify(summary, null, 2)), "application/json"); await record(info, `sportlink-summary-${width}`, await page.screenshot(), "image/png");
      } else {
        const roles = page.locator("section.workspace-section").filter({ has: page.getByRole("heading", { name: "Werkrollen", exact: true }) });
        const departments = page.locator("section.workspace-section").filter({ has: page.getByRole("heading", { name: "Afdelingen", exact: true }) });
        const a = (await roles.boundingBox())!, b = (await departments.boundingBox())!;
        expect.soft(b.y - a.y - a.height, "The real role and department cards have at least 24px separation").toBeGreaterThanOrEqual(24);
        expect.soft(b.x, "The existing vertical card order is retained on both viewports").toBe(a.x); expect.soft(b.width).toBe(a.width);
        await expect(page.getByRole("button", { name: "Werkrol maken", exact: true })).toBeEnabled(); await expect(page.getByRole("button", { name: "Afdeling toevoegen", exact: true })).toBeEnabled();
        await departments.scrollIntoViewIfNeeded();
        await record(info, `support-cards-${width}`, Buffer.from(JSON.stringify({ roles: a, departments: b, gap: b.y - a.y - a.height }, null, 2)), "application/json"); await record(info, `support-cards-${width}`, await page.screenshot(), "image/png");
      }
    }
    expect(errors).toEqual([]); expect(writes).toEqual([]);
  });
}
