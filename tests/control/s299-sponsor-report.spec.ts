import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import sourceReports from "../fixtures/s299-sponsor-report-source.json";
const reportFixture = sourceReports.unfiltered;

// Real page, loader, contract, report view, Source workspace and CSS. Only the
// session/Hub reads and RPC/action transport are controlled. Real 5501-event
// device ingestion + aggregation/RLS are verified independently in pgTAP.
const origin = "http://127.0.0.1:3399";
const require = createRequire(join(process.cwd(), "package.json"));
const compiler = require.resolve("esbuild", { paths: [require.resolve("tsx")] });
let bundle: { js: string; css: string };
test.beforeAll(() => {
  const entry = `import React from'react';import{createRoot}from'react-dom/client';import Page from'./apps/control/app/(shell)/dashboard/sponsors/page';async function start(){const content=await Page({searchParams:Promise.resolve(Object.fromEntries(new URLSearchParams(location.search)))});createRoot(document.getElementById('root')).render(<main className="sync-control app-shell"style={{display:'block'}}>{content}</main>)}start();`;
  const actions = ["addCreative", "createCampaign", "createSponsor", "initializeSponsorHub", "placeCampaign", "publishSponsorPlan", "registerSponsorMedia", "submitCampaign", "setSponsorReportGoal"].map(name => `export async function ${name}(data){await fetch('/__s299/command',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:${JSON.stringify(name)},body:Object.fromEntries(data)})})}`).join(";");
  const modules = {
    session: `export async function requireTenantControlSession(){return {tenantId:'29900000-0000-4000-8000-000000000020',userId:'29900000-0000-4000-8000-000000000021',isLive:true,tenantStatus:'active',timezoneName:'Europe/Amsterdam',capabilities:globalThis.s299Capabilities}}`,
    data: `export async function loadSponsorHub(){return {error:false,sponsors:[],campaigns:[],creatives:[],assets:[],tenantAssets:[],positions:[],sponsorMedia:[],plans:[],screens:[],audit:[],tasks:[],opportunities:[]}}`,
    crm: `export async function loadSponsorCrm(){return {error:false,opportunities:[],opportunityCount:0,tasks:[],taskCount:0}}`,
    client: `export async function createControlSupabaseClient(){return {async rpc(name,args){const response=await fetch('/__s299/rpc',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name,args})});return {data:response.ok?await response.json():null,error:response.ok?null:{code:'42501'}}}}}`,
    actions
  };
  const script = `const{build}=require(${JSON.stringify(compiler)});const modules=${JSON.stringify(modules)};const result=await build({stdin:{contents:${JSON.stringify(entry)},resolveDir:process.cwd(),loader:'tsx'},nodePaths:[process.cwd()+'/apps/control/node_modules'],bundle:true,write:false,outfile:'fixture.js',platform:'browser',format:'iife',jsx:'automatic',loader:{'.module.css':'local-css','.css':'css'},plugins:[{name:'controlled-report-boundaries',setup(b){b.onResolve({filter:/control-session$/},()=>({path:'session',namespace:'boundary'}));b.onResolve({filter:/supabase\\/server$/},()=>({path:'client',namespace:'boundary'}));b.onResolve({filter:/^\\.\\/data$/},()=>({path:'data',namespace:'boundary'}));b.onResolve({filter:/sponsor-crm-data$/},()=>({path:'crm',namespace:'boundary'}));b.onResolve({filter:/^\\.\\/actions$/},()=>({path:'actions',namespace:'boundary'}));b.onLoad({filter:/.*/,namespace:'boundary'},a=>({contents:modules[a.path],loader:'js'}));b.onResolve({filter:/^server-only$/},()=>({path:'empty',namespace:'empty'}));b.onLoad({filter:/.*/,namespace:'empty'},()=>({contents:'',loader:'js'}));}}]});process.stdout.write(JSON.stringify({js:result.outputFiles.find(f=>f.path.endsWith('.js')).text,css:result.outputFiles.find(f=>f.path.endsWith('.css')).text}));`;
  bundle = JSON.parse(execFileSync(process.execPath, ["-e", `(async()=>{${script}})().catch(e=>{console.error(e);process.exitCode=1})`], { encoding: "utf8", timeout: 30_000, maxBuffer: 16 * 1024 * 1024 }));
});

async function mount(page: Page, role: "manager" | "reporter" | "reader" = "manager", mode: "ready" | "empty" | "failed" | "gap" = "ready") {
  const requests: { name: string; args: Record<string, unknown> }[] = [];
  const commands: { name: string; body: Record<string, string> }[] = [];
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const css = ["tokens/veyocast-design-tokens.css", "packages/ui/src/styles.css", "apps/control/app/globals.css", "apps/control/app/fieldflow.css", "apps/control/app/sync-source.css", "apps/control/app/sync-adapter.css"].map(path => readFileSync(path, "utf8").replace(/@import[^;]+;/g, "")).join("\n");
  await page.route(`${origin}/assets/*`, route => { const name = new URL(route.request().url()).pathname.split("/").at(-1)!; if (!/^[a-zA-Z0-9_.-]+$/u.test(name)) return route.abort(); return route.fulfill({ body: readFileSync(join(process.cwd(), "apps/control/public/assets", name)), contentType: name.endsWith("woff2") ? "font/woff2" : name.endsWith("ttf") ? "font/ttf" : "image/svg+xml" }); });
  await page.route(`${origin}/__s299/rpc`, async route => {
    const body = route.request().postDataJSON() as typeof requests[number]; requests.push(body);
    if (mode === "failed") return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ code: "unavailable" }) });
    const args = body.args;
    const selected = args.p_campaign_id && args.p_screen_id ? sourceReports.intersection : args.p_campaign_id ? sourceReports.campaignOnly : args.p_screen_id ? sourceReports.screenOnly : args.p_before_event_id ? sourceReports.page2 : sourceReports.unfiltered;
    const report = structuredClone(selected);
    if (mode === "empty") { report.groups = []; report.details = []; report.goals = []; report.totals = { acceptedEvents: "0", playedMs: "0" }; report.hasMore = false; }
    const result = mode === "gap" ? { ...report, coverage: { ...report.coverage, status: "partial", gaps: [{ from: report.period.from, until: report.period.until, reason: "registration_gap" }] } } : report;
    return route.fulfill({ contentType: "application/json", body: JSON.stringify(result) });
  });
  await page.route(`${origin}/__s299/command`, async route => { commands.push(route.request().postDataJSON()); return route.fulfill({ contentType: "application/json", body: "{}" }); });
  const caps = ["tenant.sponsor.read", ...(role === "reader" ? [] : ["tenant.sponsor.report"]), ...(role === "manager" ? ["tenant.sponsor.write"] : [])];
  await page.route(`${origin}/dashboard/sponsors**`, route => route.fulfill({ contentType: "text/html", body: `<!doctype html><html lang="nl"data-design-system="fieldflow"><head><meta charset="utf-8"><meta name="viewport"content="width=device-width,initial-scale=1"><title>Sponsorrapport</title><style>${css}\n${bundle.css}</style></head><body><div id="root"></div><script>globalThis.s299Capabilities=${JSON.stringify(caps)};${bundle.js.replace(/<\/script/gi, "<\\/script")}</script></body></html>` }));
  await page.goto(`${origin}/dashboard/sponsors?report=1&reportFrom=${reportFixture.period.fromDate}&reportUntil=${reportFixture.period.untilDate}#rapporten`);
  await expect(page.getByRole("tab", { name: "Afspeelregistratie", exact: true })).toHaveAttribute("aria-selected", "true");
  return { requests, commands, errors };
}
for (const width of [390, 1440]) test(`S299 report ${width}px shows full totals, bounded details, safe export filters and accessible mobile rows`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 1100 });
  const proof = await mount(page);
  await expect(page.getByTestId("sponsor-report-count")).toHaveText("5.501");
  await expect(page.getByTestId("sponsor-report-duration")).toHaveText("91 min 49 sec 251 ms");
  await expect(page.getByRole("table").locator("tbody tr")).toHaveCount(50);
  await expect(page.getByText("Volledigheid niet bevestigd", { exact: true })).toBeVisible();
  await expect(page.getByText("Niet beschikbaar", { exact: true })).toBeVisible();
  const download = new URL(await page.getByRole("link", { name: "CSV downloaden" }).getAttribute("href") ?? "", origin);
  expect(Object.fromEntries(download.searchParams)).toMatchObject({ reportFrom: reportFixture.period.fromDate, reportUntil: reportFixture.period.untilDate, reportAsOf: reportFixture.asOf });
  expect(proof.requests[0]).toMatchObject({ name: "get_sponsor_report_v1", args: { p_tenant_id: "29900000-0000-4000-8000-000000000020", p_detail_limit: 50 } });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  if (width < 768) expect(await page.getByRole("table").locator("tbody tr").first().evaluate(row => getComputedStyle(row).display)).toBe("grid");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await info.attach(`s299-report-${width}`, { body: await page.screenshot(), contentType: "image/png" });
  await page.getByRole("link", { name: "Oudere afspeelbeurten" }).click();
  await expect(page.getByTestId("sponsor-report-count")).toHaveText("5.501");
  await expect(page.getByRole("link", { name: "Nieuwste afspeelbeurten" })).toBeVisible();
  expect(proof.requests.at(-1)?.args).toMatchObject({ p_as_of: reportFixture.asOf, p_before_event_id: reportFixture.details[49]!.eventId, p_before_happened_at: reportFixture.details[49]!.happenedAt });
  await page.getByRole("combobox", { name: "Campagne", exact: true }).selectOption(reportFixture.filterOptions.campaigns[0]!.id);
  await page.getByRole("button", { name: "Rapport tonen", exact: true }).click();
  await expect(page.getByTestId("sponsor-report-count")).toHaveText("2.751");
  expect(proof.requests.at(-1)?.args).toMatchObject({ p_campaign_id: reportFixture.filterOptions.campaigns[0]!.id, p_as_of: null, p_before_event_id: null });
  expect(proof.errors).toEqual([]);
});
test("S299 role boundaries keep report-only reads separate from explicit goal writes", async ({ page }) => {
  const proof = await mount(page, "reporter");
  await expect(page.getByTestId("sponsor-report-count")).toHaveText("5.501");
  await expect(page.getByRole("link", { name: "CSV downloaden" })).toBeVisible();
  await expect(page.getByText("Afspraak vastleggen of verwijderen", { exact: true })).toHaveCount(0);
  expect(proof.commands).toEqual([]);
  await page.unrouteAll({ behavior: "wait" });
  await page.goto("about:blank");
  const reader = await mount(page, "reader");
  await expect(page.getByText("Je rol heeft geen toegang tot sponsorrapportage of export.", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "CSV downloaden" })).toHaveCount(0);
  expect(reader.requests).toEqual([]);
});
test("S299 explicit goal form sends campaign, exact period and count independently of rotation", async ({ page }) => {
  const proof = await mount(page);
  await page.getByText("Afspraak vastleggen of verwijderen", { exact: true }).click();
  await page.getByRole("spinbutton", { name: "Afgesproken afspeelbeurten (leeg verwijdert de afspraak)" }).fill("6500");
  await page.getByRole("button", { name: "Afspraak opslaan", exact: true }).click();
  await expect.poll(() => proof.commands.length).toBe(1);
  expect(proof.commands[0]).toEqual({ name: "setSponsorReportGoal", body: { reportFrom: reportFixture.period.fromDate, reportUntil: reportFixture.period.untilDate, reportScreen: "", reportCampaign: reportFixture.filterOptions.campaigns[0]!.id, targetPlays: "6500" } });
});
for (const mode of ["empty", "failed", "gap"] as const) test(`S299 ${mode} registration remains explicit`, async ({ page }) => {
  await mount(page, "reporter", mode);
  if (mode === "empty") { await expect(page.getByTestId("sponsor-report-count")).toHaveText("0"); await expect(page.getByText("Geen afspraak vastgelegd.", { exact: true })).toBeVisible(); await expect(page.getByRole("table")).toHaveCount(0); }
  if (mode === "failed") { await expect(page.getByRole("alert")).toContainText("De rapportage kon niet worden geladen"); await expect(page.getByRole("link", { name: "CSV downloaden" })).toHaveCount(0); }
  if (mode === "gap") { await expect(page.getByText("Onvolledige registratie", { exact: true })).toBeVisible(); await expect(page.getByText(/^Bekend registratiegat:/u)).toBeVisible(); }
});
