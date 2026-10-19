import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Actual server pages, guards, form controls and CSS. Only backend transport,
// Next host APIs and background SW transport are fixtures; no Auth action runs.
const origin = "http://127.0.0.1:3397";
const require = createRequire(join(process.cwd(), "package.json"));
const esbuild = require.resolve("esbuild", { paths: [require.resolve("tsx")] });
const cssPaths = ["tokens/veyocast-design-tokens.css", "packages/ui/src/styles.css", "apps/control/app/globals.css", "apps/control/app/fieldflow.css", "apps/control/app/sync-source.css", "apps/control/app/sync-adapter.css", "apps/control/app/sync-auth.css"];
let pages: Record<string, string>;
let guards: Record<string, string>;
let pwa: { js: string; css: string };
let media: { js: string; css: string };

function build(script: string) {
  return execFileSync(process.execPath, ["-e", `(async()=>{${script}})().catch(error=>{console.error(error);process.exitCode=1})`], { encoding: "utf8", timeout: 30_000, maxBuffer: 24 * 1024 * 1024 });
}

test.beforeAll(() => {
  const entry = `import React from'react';import{renderToReadableStream}from'react-dom/server';
import Login from'./apps/control/app/login/page';import Register from'./apps/control/app/register/page';import Forgot from'./apps/control/app/forgot-password/page';import Invite from'./apps/control/app/accept-invite/page';import Callback from'./apps/control/app/auth/callback/page';import Reset from'./apps/control/app/auth/reset-password/page';import Mfa from'./apps/control/app/auth/mfa/page';import Context from'./apps/control/app/(shell)/context/page';import Onboarding from'./apps/control/app/onboarding/page';
async function run(){const cases=[['login',Login,{fout:'dienst',reden:'sessie'}],['login-unavailable',Login,{}],['register',Register,{}],['register-confirmed',Register,{status:'bevestigen'}],['forgot',Forgot,{}],['forgot-confirmed',Forgot,{status:'verwerkt'}],['invite',Invite,{}],['callback',Callback,{}],['reset',Reset,{fout:'wachtwoord'}],['mfa',Mfa,{reden:'verificatie',terug:'/dashboard'}],['context',Context,{reden:'needs_selection'}],['onboarding-claim',Onboarding,{}],['onboarding-sources',Onboarding,{}]],pages={},guards={};
for(const[name,Component,params]of cases){globalThis.authFixture=name;pages[name]=await new Response(await renderToReadableStream(await Component({searchParams:Promise.resolve(params)}))).text();}
for(const[name,Component]of[['reset',Reset],['mfa',Mfa],['context',Context],['onboarding',Onboarding]]){globalThis.authFixture='no-session';try{await Component({searchParams:Promise.resolve({})});guards[name]='RENDERED'}catch(error){guards[name]=error.message}}
process.stdout.write(JSON.stringify({pages,guards}));}run().catch(error=>{console.error(error);process.exitCode=1});`;
  const transport = `const tenantId='23900000-0000-4000-8000-000000000001';const members=[{tenant_id:tenantId,role:'tenant_owner',custom_role_id:null,tenants:{id:tenantId,name:'Eigen authentestvereniging met een lange naam',slug:'own-auth-fixture',status:'active'}},{tenant_id:'23900000-0000-4000-8000-000000000002',role:'tenant_viewer',custom_role_id:null,tenants:{id:'23900000-0000-4000-8000-000000000002',name:'Eigen gearchiveerde testvereniging',slug:'own-archived-fixture',status:'archived'}}];
const response=(table)=>({data:table==='profiles'?{display_name:'Eigen Auth Fixture'}:table==='tenant_memberships'?globalThis.authFixture==='onboarding-claim'?[]:members:table==='platform_memberships'?[]:table==='tenant_settings'?{timezone_name:'Europe/Amsterdam'}:table==='tenant_onboarding_states'?{tenant_id:tenantId,status:'in_progress',current_step:'brand_sources',organization_type:'sportclub',use_case:'club_communication',source_keys:['own-media']}:table==='tenants'?{name:'Eigen authentestvereniging'}:[],error:null});
function query(table){const q={then:(resolve,reject)=>Promise.resolve(response(table)).then(resolve,reject)};for(const name of['select','eq','neq','in','order','limit','retry','abortSignal','single','maybeSingle'])q[name]=()=>q;return q}
export async function createControlSupabaseClient(){return{auth:{getUser:async()=>({data:{user:['no-session','invite','callback'].includes(globalThis.authFixture)?null:{id:'23900000-0000-4000-8000-000000000003',email:'own-auth@example.invalid',user_metadata:{display_name:'Eigen Auth Fixture'}}},error:null}),mfa:{getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:'aal1',nextLevel:'aal2'},error:null}),listFactors:async()=>({data:{totp:[{id:'own-factor',status:'verified',friendly_name:'Eigen authenticator met een lange toegankelijke apparaatnaam'}]},error:null})}},from:query,rpc:()=>({then:(resolve,reject)=>Promise.resolve({data:[],error:null}).then(resolve,reject),retry(){return this},abortSignal(){return this}})}}`;
  const actions = `export async function signIn(){};export async function registerAccount(){};export async function requestPasswordReset(){};export async function completeInvitation(){};export async function updateRecoveredPassword(){};export async function verifyMfaFactor(){};export async function removeMfaFactor(){};export async function startMfaEnrollment(){};export async function switchTenantContext(){};export async function provisionOnboardingTenant(){};export async function refreshOnboardingProgress(){};export async function updateOnboardingPreferences(){}`;
  const adapters = {
    headers: `export async function cookies(){return{get:name=>name==='veyocast-tenant-context'?{value:'own-auth-fixture'}:undefined,getAll:()=>[]}}`,
    navigation: `export function redirect(path){throw Error('REDIRECT:'+path)};export const useRouter=()=>({replace(){},refresh(){}})`,
    link: `import React from'react';export default function Link(props){return React.createElement('a',props)}`,
    image: `import React from'react';export default function Image({priority,unoptimized,fill,...props}){return React.createElement('img',props)}`,
    config: `export const getControlRuntimeMode=()=>globalThis.authFixture==='login-unavailable'?'unavailable':'live';export const getSupabasePublicConfig=()=>null;`
  };
  const serverScript = `const result=await require(${JSON.stringify(esbuild)}).build({stdin:{contents:${JSON.stringify(entry)},resolveDir:process.cwd(),loader:'tsx'},nodePaths:[process.cwd()+'/apps/control/node_modules'],bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',loader:{'.css':'empty'},plugins:[{name:'only-host-and-backend-transport',setup(b){b.onResolve({filter:/^server-only$/},()=>({path:'empty',namespace:'fixture'}));b.onResolve({filter:/^next\\/(headers|navigation|link|image)$/},a=>({path:a.path.split('/').at(-1),namespace:'fixture'}));b.onResolve({filter:/supabase\\/server$/},()=>({path:'transport',namespace:'fixture'}));b.onResolve({filter:/supabase\\/config$/},()=>({path:'config',namespace:'fixture'}));b.onResolve({filter:/\\/actions$/},()=>({path:'actions',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:a.path==='empty'?'':a.path==='transport'?${JSON.stringify(transport)}:a.path==='actions'?${JSON.stringify(actions)}:${JSON.stringify(adapters)}[a.path],loader:'js',resolveDir:process.cwd()}))}}]});const m={exports:{}};new Function('require','module','exports',result.outputFiles[0].text)(require,m,m.exports);`;
  const rendered = JSON.parse(build(serverScript));
  pages = rendered.pages; guards = rendered.guards;
  const pwaEntry = `import React from'react';import{createRoot}from'react-dom/client';import{ControlPwaRuntime}from'./apps/control/app/_components/control-pwa-runtime';createRoot(document.getElementById('pwa')).render(<ControlPwaRuntime/>);`;
  pwa = JSON.parse(build(`const result=await require(${JSON.stringify(esbuild)}).build({stdin:{contents:${JSON.stringify(pwaEntry)},resolveDir:process.cwd(),loader:'tsx'},nodePaths:[process.cwd()+'/apps/control/node_modules'],bundle:true,write:false,outfile:'pwa.js',platform:'browser',format:'iife',jsx:'automatic',loader:{'.module.css':'local-css'}});process.stdout.write(JSON.stringify({js:result.outputFiles.find(file=>file.path.endsWith('.js')).text,css:result.outputFiles.find(file=>file.path.endsWith('.css')).text}));`));
  const mediaEntry = `import React from'react';import{createRoot}from'react-dom/client';import{SitesMediaEditor}from'./apps/control/app/(shell)/dashboard/media/sites-media-editor';const asset={id:'23900000-0000-4000-8000-000000000004',title:'Eigen behouden mediabestand',folderId:null,tagLabels:[],collectionLabels:[],isFavorite:false,updatedAt:'2026-10-19T00:00:00Z',previewUrl:null,kind:'image',status:'ready',statusLabel:'Klaar voor gebruik',draftCount:0,releaseCount:0,usage:'Nog geen gebruik',manageHref:'/dashboard/media/own-file'};function App(){const[open,setOpen]=React.useState(true);return open?<SitesMediaEditor asset={asset} canWrite={false} folders={[]} onClose={()=>setOpen(false)} addAction={()=>null} archiveAction={()=>null}/>:<button type="button">Mediavenster gesloten</button>}createRoot(document.getElementById('pwa')).render(<App/>);`;
  media = JSON.parse(build(`const result=await require(${JSON.stringify(esbuild)}).build({stdin:{contents:${JSON.stringify(mediaEntry)},resolveDir:process.cwd(),loader:'tsx'},nodePaths:[process.cwd()+'/apps/control/node_modules'],bundle:true,write:false,outfile:'media.js',platform:'browser',format:'iife',jsx:'automatic',loader:{'.module.css':'local-css'},plugins:[{name:'no-metadata-write',setup(b){b.onResolve({filter:/^next\\/navigation$/},()=>({path:'navigation',namespace:'fixture'}));b.onResolve({filter:/sites-media-metadata-actions$/},()=>({path:'actions',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:a.path==='navigation'?'export const useRouter=()=>({refresh(){}})':'export async function saveSitesMediaMetadata(){throw Error("Read-only fixture must never save")}',loader:'js'}))}}]});process.stdout.write(JSON.stringify({js:result.outputFiles.find(file=>file.path.endsWith('.js')).text,css:result.outputFiles.find(file=>file.path.endsWith('.css')).text}));`));
});

async function mount(page: Page, name: string, client?: "pwa" | "media") {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const css = cssPaths.map(path => readFileSync(path, "utf8").replace(/@import[^;]+;/g, "")).join("\n");
  await page.route(`${origin}/assets/*`, route => {
    const name = new URL(route.request().url()).pathname.split("/").at(-1)!;
    if (!/^[a-zA-Z0-9_.-]+$/.test(name)) return route.abort();
    return route.fulfill({ body: readFileSync(join(process.cwd(), "apps/control/public/assets", name)), contentType: name.endsWith("woff2") ? "font/woff2" : "image/svg+xml" });
  });
  const bundle = client === "pwa" ? pwa : client === "media" ? media : null;
  await page.route(`${origin}/__auth`, route => route.fulfill({ contentType: "text/html", body: `<!doctype html><html lang="nl" data-design-system="fieldflow"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Accountcontrole · VeyoCast</title><style>${css}\n${bundle?.css ?? ""}</style></head><body>${pages[name]}${bundle ? `<div id="pwa"></div><script>${bundle.js.replace(/<\/script/gi, "<\\/script")}</script>` : ""}</body></html>` }));
  await page.goto(`${origin}/__auth`);
  await page.evaluate(() => document.fonts.ready);
  return errors;
}

test("actual account guards reject the absent backend actor before rendering protected forms", () => {
  expect(guards).toEqual({ reset: "REDIRECT:/login?fout=herstel", mfa: "REDIRECT:/login?reden=sessie", context: "REDIRECT:/login?reden=sessie", onboarding: "REDIRECT:/login?reden=sessie" });
  expect(pages["callback"]).toContain("Geen aangemelde sessie");
  expect(pages["callback"]).not.toContain('href="/dashboard"');
  expect(pages["login-unavailable"]).not.toContain('<form');
  expect(pages["invite"]).not.toContain('name="password"');
});

for (const width of [390, 1440]) {
  test(`real auth surfaces preserve Source metrics, form boundaries, mobile layout and axe at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    for (const name of ["login", "register", "register-confirmed", "forgot", "forgot-confirmed", "invite", "callback", "login-unavailable", "reset", "mfa", "context", "onboarding-claim", "onboarding-sources"]) {
      const errors = await mount(page, name);
      const root = page.locator(".sync-control.sync-auth"); await expect(root).toHaveCount(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), name).toBe(true);
      const panel = root.locator(".auth-panel");
      if (await panel.count()) {
        await expect(panel).toHaveCSS("width", `${width === 390 ? 350 : name === "mfa" ? 960 : 540}px`);
        await expect(panel).toHaveCSS("border-radius", "22px");
        await expect(panel).toHaveCSS("padding", width === 390 ? "18px" : "26px");
        await expect(panel).toHaveCSS("gap", "18px");
        await expect(panel.locator(".auth-brand")).toHaveCSS("width", "210px");
        await expect(panel.locator("h1")).toHaveCSS("font-size", "21px");
      }
      for (const button of await root.locator(".auth-button,.button-link").all()) {
        expect((await button.boundingBox())!.height, `${name}: ${await button.textContent()}`).toBeGreaterThanOrEqual(44);
      }
      for (const primary of await root.locator(".auth-button,.button-link--primary").all()) {
        await expect(primary).toHaveCSS("background-color", "rgb(0, 109, 115)");
        await expect(primary).toHaveCSS("color", "rgb(255, 255, 255)");
      }
      const sizes = await root.locator(".auth-copy,.auth-kicker,.auth-footnote,.field label,.field p,.notice,.onboarding-choice-grid small").evaluateAll(nodes => nodes.map(node => parseFloat(getComputedStyle(node).fontSize)));
      expect(sizes.every(size => size >= 14), name).toBe(true);
      expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze()).violations, name).toEqual([]);
      expect(errors, name).toEqual([]);
      if (["login", "mfa", "context", "onboarding-claim"].includes(name)) await info.attach(`${name}-${width}`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
    }
    await mount(page, "login");
    const email = page.getByLabel("E-mailadres", { exact: true }); await email.focus();
    await expect(email).toHaveCSS("outline-color", "rgb(0, 109, 115)");
    await page.keyboard.press("Tab"); await expect(page.getByLabel("Wachtwoord", { exact: true })).toBeFocused();
    await page.keyboard.press("Tab"); await expect(page.getByRole("button", { name: "Doorgaan", exact: true })).toBeFocused();
    await expect(email).toHaveAttribute("name", "email"); await expect(page.getByLabel("Wachtwoord", { exact: true })).toHaveAttribute("autocomplete", "current-password");
    await mount(page, "mfa"); await expect(page.locator('input[name="returnTo"]').first()).toHaveValue("/dashboard");
    await expect(page.getByLabel("Code voor Eigen authenticator met een lange toegankelijke apparaatnaam")).toHaveAttribute("pattern", "[0-9]{6}");
    await mount(page, "context"); await expect(page.getByRole("button", { name: "Open vereniging" })).toHaveCount(1); await expect(page.getByText("Niet beschikbaar", { exact: true })).toBeVisible();
  });

  test(`actual PWA offline/update/dismiss and activation handshake remain usable at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await page.addInitScript(() => {
      const worker = new EventTarget();
      Object.assign(worker, { controller: {}, register: async () => ({ waiting: { postMessage: (message: unknown) => { (window as unknown as { updateMessages: unknown[] }).updateMessages.push(message); } }, update: async () => undefined, addEventListener: () => undefined }) });
      Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: worker });
      (window as unknown as { updateMessages: unknown[] }).updateMessages = [];
    });
    const errors = await mount(page, "login", "pwa");
    const update = page.locator('[data-kind="update"]'); await expect(update).toBeVisible();
    await expect(update).toContainText("Nieuwe versie beschikbaar");
    const reload = update.getByRole("button", { name: "Nu herladen", exact: true });
    const dismiss = update.getByRole("button", { name: "Updatemelding sluiten", exact: true });
    for (const action of [reload, dismiss]) expect((await action.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await expect(update.locator("small")).toHaveCSS("font-size", "14px"); await expect(reload).toHaveCSS("background-color", "rgb(89, 228, 176)");
    await reload.focus(); await expect(reload).toHaveCSS("outline-style", "solid");
    await reload.click(); expect(await page.evaluate(() => (window as unknown as { updateMessages: unknown[] }).updateMessages)).toEqual([{ type: "VEYOCAST_CONTROL_SKIP_WAITING" }]);
    expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze()).violations).toEqual([]);
    await info.attach(`pwa-update-${width}`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
    await dismiss.click(); await expect(update).toHaveCount(0);
    await page.evaluate(() => { Object.defineProperty(navigator, "onLine", { configurable: true, value: false }); dispatchEvent(new Event("offline")); });
    const offline = page.locator('[data-kind="offline"]'); await expect(offline).toContainText("Geen internetverbinding"); await expect(offline.getByRole("button")).toHaveCount(0);
    expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze()).violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.evaluate(() => { Object.defineProperty(navigator, "onLine", { configurable: true, value: true }); dispatchEvent(new Event("online")); });
    await expect(offline).toHaveCount(0); await expect(update).toHaveCount(0); expect(errors).toEqual([]);
  });

  test(`retained media portal keeps the semantic primary green and read-only at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    const errors = await mount(page, "login", "media");
    const dialog = page.getByRole("dialog", { name: "Eigen behouden mediabestand", exact: true }); await expect(dialog).toBeVisible();
    await expect.poll(() => dialog.evaluate(node => node.getAnimations({ subtree: true }).filter(animation => animation.playState === "running").length)).toBe(0);
    const save = dialog.getByRole("button", { name: "Wijzigingen opslaan", exact: true });
    await expect(save).toHaveClass(/vc-button--primary/); await expect(save).toBeDisabled(); await expect(save).toHaveCSS("background-color", "rgb(0, 109, 115)");
    expect((await save.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await expect(save).toHaveCSS("font-size", "14px");
    for (const label of await dialog.locator(".demo-field").all()) await expect(label).toHaveCSS("font-size", "14px");
    await expect(dialog.locator(".demo-button.primary")).toHaveCount(0); await expect(dialog.getByText("Alleen lezen. Je hebt geen rechten om deze media te wijzigen.", { exact: true })).toBeVisible();
    expect((await new AxeBuilder({ page }).include('[role="dialog"]').withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze()).violations).toEqual([]);
    await info.attach(`retained-media-${width}`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
    await dialog.getByRole("button", { name: "Mediavenster sluiten", exact: true }).focus(); await page.keyboard.press("Escape"); await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Mediavenster gesloten", exact: true })).toBeVisible(); expect(errors).toEqual([]);
  });
}
