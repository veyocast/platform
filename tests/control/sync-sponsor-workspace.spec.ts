import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Actual server page, capability decisions, workspace, CRM and unchanged forms.
// Only session/data/action transport boundaries are controlled; no database writes.
const origin = "http://127.0.0.1:3397";
const id = (n: number) => `23700000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const sponsors = [{ id: id(1), name: "Eigen clubpartner", website_url: "https://example.org/" as string | null, status: "active" }];
const campaign = (n: number, status: string) => ({ id: id(n), sponsor_id: id(1), name: `Eigen campagne ${n}`, status, starts_at: "2026-01-01T12:00:00Z", ends_at: "2027-12-31T12:00:00Z", weight: 1, submitted_by: null, approved_by: null, updated_at: "2026-10-19T00:00:00Z" });
const hub = { error: false, sponsors, campaigns: [campaign(2, "draft"), campaign(3, "submitted"), campaign(4, "approved"), campaign(5, "published")], creatives: [], assets: [{ id: id(6), title: "Eigen toegelaten beeld", kind: "image" }], tenantAssets: [{ id: id(6), title: "Eigen toegelaten beeld", kind: "image" }], positions: [{ id: id(7), key: "footer", name: "Voetregel", mode: "weighted", enabled: true }], sponsorMedia: [], plans: [], screens: [{ id: id(8), name: "Eigen scherm", orientation: "landscape", status: "active" }], events: [{ event_id: id(9), campaign_id: id(5), played_ms: 15000, happened_at: "2026-10-19T00:00:00Z" }], audit: [{ id: id(10), action: "campaign.create", entity_type: "campaign", created_at: "2026-10-19T00:00:00Z" }], tasks: [], opportunities: [] };
const crm = { error: false, opportunityCount: 1, taskCount: 1, opportunities: [{ id: id(11), name: "Eigen kans", stage: "proposal", estimated_value_cents: 25000, next_action_at: null }], tasks: [{ id: id(12), title: "Eigen opvolging", status: "open", due_at: null }] };
const require = createRequire(join(process.cwd(), "package.json"));
const compiler = require.resolve("esbuild", { paths: [require.resolve("tsx")] });
let bundle: { js: string; css: string };
test.beforeAll(() => {
  const entry = `import React,{useState}from'react';import{createRoot}from'react-dom/client';import{DialogPortalProvider}from'./packages/ui/src/components/dialog';import SponsorHubPage from'./apps/control/app/(shell)/dashboard/sponsors/page';async function start(){const content=await SponsorHubPage({searchParams:Promise.resolve(Object.fromEntries(new URLSearchParams(location.search)))});function App(){const[portal,setPortal]=useState(null),[current,setCurrent]=useState(content);globalThis.refreshSponsorPage=async()=>setCurrent(await SponsorHubPage({searchParams:Promise.resolve(Object.fromEntries(new URLSearchParams(location.search)))}));return <div className="sync-control app-shell" style={{display:'block'}} ref={setPortal}><DialogPortalProvider container={portal}><main id="control-content">{current}</main></DialogPortalProvider></div>}createRoot(document.getElementById('root')).render(<App/>)}start();`;
  const actionNames = ["addCreative", "createCampaign", "createSponsor", "initializeSponsorHub", "placeCampaign", "publishSponsorPlan", "registerSponsorMedia", "submitCampaign"];
  const actions = actionNames.map(name => `export async function ${name}(data){globalThis.commands.push({action:${JSON.stringify(name)},body:data instanceof FormData?Object.fromEntries(data):{}})}`).join(";");
  const script = `const result=await require(${JSON.stringify(compiler)}).build({stdin:{contents:${JSON.stringify(entry)},resolveDir:process.cwd(),loader:'tsx'},nodePaths:[process.cwd()+'/apps/control/node_modules'],bundle:true,write:false,outfile:'fixture.js',platform:'browser',format:'iife',jsx:'automatic',loader:{'.module.css':'local-css','.css':'css'},plugins:[{name:'guarded-boundaries',setup(b){b.onResolve({filter:/^\\.\\/(actions|data|sponsor-crm-data)$/},a=>({path:a.path,namespace:'server'}));b.onResolve({filter:/control-session$/},a=>({path:'session',namespace:'server'}));b.onLoad({filter:/.*/,namespace:'server'},a=>({contents:a.path==='session'?'export async function requireTenantControlSession(capability){globalThis.sessionGuards.push(capability);return {tenantId:"${id(20)}",userId:"${id(21)}",isLive:true,tenantStatus:"active",capabilities:globalThis.fixtureCapabilities}}':a.path==='./data'?'export async function loadSponsorHub(tenantId){globalThis.loadedTenants.push(tenantId);return globalThis.fixtureHub}':a.path==='./sponsor-crm-data'?'export async function loadSponsorCrm(tenantId,filter){globalThis.loadedTenants.push(tenantId);return globalThis.fixtureCrm}':${JSON.stringify(actions)},loader:'js'}));}}]});const js=result.outputFiles.find(f=>f.path.endsWith('.js'))?.text,css=result.outputFiles.find(f=>f.path.endsWith('.css'))?.text;if(!js||!css)throw Error('Missing actual page fixture JS/CSS');process.stdout.write(JSON.stringify({js,css}));`;
  bundle = JSON.parse(execFileSync(process.execPath, ["-e", `(async()=>{${script}})().catch(e=>{console.error(e);process.exitCode=1})`], { encoding: "utf8", timeout: 30_000, maxBuffer: 16 * 1024 * 1024 }));
});

async function mount(page: Page, options: { mode?: "empty" | "error" | "approval" | "viewer"; suffix?: string; noPositions?: boolean } = {}) {
  const errors: string[] = [], api: { url: string; method: string; body: string | null }[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const css = ["tokens/veyocast-design-tokens.css", "packages/ui/src/styles.css", "apps/control/app/globals.css", "apps/control/app/fieldflow.css", "apps/control/app/sync-source.css", "apps/control/app/sync-adapter.css"].map(path => readFileSync(path, "utf8").replace(/@import[^;]+;/g, "")).join("\n");
  await page.route(`${origin}/assets/*`, route => { const name = new URL(route.request().url()).pathname.split("/").at(-1)!; if (!/^[a-zA-Z0-9_.-]+$/.test(name)) return route.abort(); return route.fulfill({ body: readFileSync(join(process.cwd(), "apps/control/public/assets", name)), contentType: name.endsWith("woff2") ? "font/woff2" : name.endsWith("ttf") ? "font/ttf" : "image/svg+xml" }); });
  await page.route(`${origin}/api/**`, route => { api.push({ url: new URL(route.request().url()).pathname, method: route.request().method(), body: route.request().postData() }); return route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Bevestigde transportgrens</title>" }); });
  const data = structuredClone(hub);
  if (options.mode === "empty") { data.sponsors = []; data.campaigns = []; data.events = []; }
  if (options.mode === "error") data.error = true;
  if (options.noPositions) data.positions = [];
  const capabilities = ["tenant.sponsor.read", ...(options.mode === "viewer" ? [] : options.mode === "approval" ? ["tenant.sponsor.approve"] : ["tenant.sponsor.write", "tenant.sponsor.approve", "tenant.sponsor.publish"])];
  await page.route(`${origin}/__sponsors**`, route => route.fulfill({ contentType: "text/html", body: `<!doctype html><html lang="nl" data-design-system="fieldflow"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sponsoren · VeyoCast</title><style>${css}\n${bundle.css}</style></head><body><div id="root"></div><script>globalThis.fixtureHub=${JSON.stringify(data)};globalThis.fixtureCrm=${JSON.stringify(options.mode === "error" ? { ...crm, error: true } : crm)};globalThis.fixtureCapabilities=${JSON.stringify(capabilities)};globalThis.commands=[];globalThis.sessionGuards=[];globalThis.loadedTenants=[];${bundle.js.replace(/<\/script/gi, "<\\/script")}</script></body></html>` }));
  await page.goto(`${origin}/__sponsors${options.suffix ?? ""}`);
  if (options.suffix?.includes("#sponsor-campaign-")) {
    // The actual deeplink opens a modal immediately; Radix correctly hides
    // background headings from the accessibility tree while it is open.
    await expect(page.locator("h1")).toHaveText("Geef je partners een podium.");
    await expect(page.getByRole("dialog", { name: "Eigen campagne 2", exact: true })).toBeVisible();
  } else {
    await expect(page.getByRole("heading", { name: "Geef je partners een podium.", exact: true })).toBeVisible();
  }
  await page.evaluate(() => document.fonts.ready);
  return { errors, api, commands: () => page.evaluate(() => (globalThis as typeof globalThis & { commands: { action: string; body: Record<string, string> }[] }).commands) };
}
async function open(page: Page, name: string, title: string) {
  await page.getByRole("button", { name, exact: true }).click();
  const dialog = page.getByRole("dialog", { name: title, exact: true }); await expect(dialog).toBeVisible();
  await expect.poll(() => dialog.evaluate(el => el.getAnimations().filter(a => a.playState === "running").length)).toBe(0);
  return dialog;
}

for (const width of [390, 1440]) test(`Source sponsor workspace at ${width}px preserves four tabs, compact campaigns, keyboard and accessible dialogs`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 }); const fixture = await mount(page);
  await info.attach(`workspace-${width}`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
  await expect(page.locator("h1")).toHaveCount(1); await expect(page.locator("details")).toHaveCount(0);
  const firstCard = page.locator(".ad-campaign").first();
  await expect(firstCard).toHaveCSS("padding", "0px");
  await expect(firstCard.locator(".ad-campaign-art")).toHaveCSS("overflow", "hidden");
  await expect(firstCard.locator(".ad-campaign-art")).toHaveCSS("height", "130px");
  await expect(firstCard.locator(".ad-meta-grid")).toHaveCSS("border-top-width", "0px");
  expect(await page.locator(".ad-metric").first().evaluate(el => el.getBoundingClientRect().height)).toBeLessThanOrEqual(100);
  await expect(firstCard.getByText("Concept", { exact: true })).toHaveCount(1);
  const actionButtons = firstCard.getByRole("button").filter({ hasText: /^(Indienen|Beheren)$/ });
  const actionRows = await actionButtons.evaluateAll(els => els.map(el => el.getBoundingClientRect().top));
  expect(actionRows).toHaveLength(2); expect(Math.abs(actionRows[0]! - actionRows[1]!)).toBeLessThanOrEqual(1);
  if (width === 390) expect(await page.locator(".ad-metric").first().evaluate(el => el.getBoundingClientRect().height)).toBeLessThanOrEqual(70);
  expect(await page.getByRole("tab").allTextContents()).toEqual(["Campagnes", "Partners", "Pipeline & taken", "Afspeelregistratie"]);
  await expect(page.getByRole("tabpanel", { name: "Campagnes", exact: true })).toBeVisible();
  const search = page.getByLabel("Zoek een partner of campagne", { exact: true });
  expect((await search.boundingBox())!.width).toBeGreaterThan(width === 390 ? 280 : 1000);
  await search.fill("campagne 2");
  await expect(page.getByRole("heading", { name: "Eigen campagne 3", exact: true })).not.toBeVisible();
  await page.getByRole("tab", { name: "Partners", exact: true }).click(); await expect(page.getByRole("heading", { name: "Eigen clubpartner", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Partners", exact: true }).press("Home");
  await expect(page.getByLabel("Zoek een partner of campagne", { exact: true })).toHaveValue("campagne 2");
  const dialog = await open(page, "Nieuwe campagne", "Nieuwe sponsorcampagne");
  await expect(dialog).toHaveCSS("width", width === 390 ? "370px" : "540px");
  await expect(dialog.locator("header h2")).toHaveCSS("font-size", width === 390 ? "24px" : "26px");
  const sizes = await dialog.locator("button,input:not([type=hidden]),select").evaluateAll(els => els.map(el => { const box = el.getBoundingClientRect(); return { width: box.width, height: box.height }; }));
  for (const size of sizes) { expect(size.width).toBeGreaterThanOrEqual(44); expect(size.height).toBeGreaterThanOrEqual(44); }
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze()).violations).toEqual([]);
  await info.attach("actual-source-sponsor-dialog", { body: await page.screenshot(), contentType: "image/png" });
  await page.keyboard.press("Escape"); await expect(dialog).not.toBeVisible(); await expect(page.getByRole("button", { name: "Nieuwe campagne", exact: true })).toBeFocused();
  await page.getByRole("tab", { name: "Pipeline & taken", exact: true }).click();
  const opportunityButton = page.getByRole("button", { name: "Kans Eigen kans openen", exact: true });
  await opportunityButton.click();
  const inspector = page.getByRole("dialog", { name: "Eigen kans", exact: true });
  await expect(inspector).toBeVisible(); await expect(inspector).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(inspector).toHaveCSS("font-family", /Manrope/);
  await expect(inspector.getByRole("heading", { name: "Eigen kans", exact: true })).toHaveCSS("font-size", width === 390 ? "24px" : "26px");
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze()).violations).toEqual([]);
  await info.attach(`crm-inspector-${width}`, { body: await page.screenshot(), contentType: "image/png" });
  await page.keyboard.press("Escape"); await expect(inspector).not.toBeVisible(); await expect(opportunityButton).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await fixture.commands()).toEqual([]); expect(fixture.errors).toEqual([]);
});

test("the actual server forms keep sponsor/campaign/material/placement/publish boundaries and selected draft identity", async ({ page }) => {
  const fixture = await mount(page);
  await page.evaluate(async partner => { const fixture = globalThis as typeof globalThis & { fixtureHub: typeof hub; refreshSponsorPage: () => Promise<void> }; fixture.fixtureHub.sponsors.push(partner); await fixture.refreshSponsorPage(); }, { id: id(30), name: "Tweede eigen partner", website_url: null, status: "active" });
  await page.getByRole("tab", { name: "Partners", exact: true }).click();
  const secondPartner = page.getByRole("heading", { name: "Tweede eigen partner", exact: true }).locator("..");
  await secondPartner.getByRole("button", { name: "Campagne maken", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Nieuwe sponsorcampagne", exact: true }).getByRole("combobox", { name: "Sponsor", exact: true })).toHaveValue(id(30));
  await page.keyboard.press("Escape"); await page.getByRole("tab", { name: "Campagnes", exact: true }).click();
  let dialog = await open(page, "Sponsor toevoegen", "Nieuwe clubpartner");
  await dialog.getByRole("textbox", { name: "Naam", exact: true }).fill("Eigen nieuwe sponsor");
  await dialog.getByRole("textbox", { name: "Website (optioneel)", exact: true }).fill("https://example.org/");
  await dialog.getByRole("textbox", { name: "Interne notitie", exact: true }).fill("Eigen opvolging");
  await dialog.getByRole("button", { name: "Sponsor opslaan", exact: true }).click();
  await expect.poll(async () => (await fixture.commands()).length).toBe(1); await page.keyboard.press("Escape");
  dialog = await open(page, "Nieuwe campagne", "Nieuwe sponsorcampagne");
  await dialog.getByRole("textbox", { name: "Campagnenaam", exact: true }).fill("Eigen nieuwe campagne");
  await dialog.getByLabel("Start", { exact: true }).fill("2026-10-19T12:00"); await dialog.getByLabel("Einde", { exact: true }).fill("2026-10-20T12:00");
  await dialog.getByRole("button", { name: "Campagne maken", exact: true }).click(); await expect.poll(async () => (await fixture.commands()).length).toBe(2); await page.keyboard.press("Escape");
  dialog = await open(page, "Eigen campagne 2 beheren", "Eigen campagne 2");
  await dialog.getByRole("button", { name: "Materiaal koppelen", exact: true }).click();
  const material = page.getByRole("dialog", { name: "Campagnemateriaal", exact: true });
  await expect(material.getByRole("combobox", { name: "Campagne", exact: true })).toHaveValue(id(2));
  await material.getByRole("button", { name: "Materiaal vastzetten", exact: true }).click(); await expect.poll(async () => (await fixture.commands()).length).toBe(3);
  await material.getByRole("button", { name: "Toelaten als sponsormedia", exact: true }).click(); await expect.poll(async () => (await fixture.commands()).length).toBe(4); await page.keyboard.press("Escape");
  dialog = await open(page, "Eigen campagne 2 beheren", "Eigen campagne 2"); await dialog.getByRole("button", { name: "Plaatsing instellen", exact: true }).click();
  const placement = page.getByRole("dialog", { name: "Campagne plaatsen", exact: true }); await expect(placement.getByRole("combobox", { name: "Campagne", exact: true })).toHaveValue(id(2));
  await placement.getByRole("button", { name: "Plaatsing opslaan", exact: true }).click(); await expect.poll(async () => (await fixture.commands()).length).toBe(5); await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Indienen", exact: true }).click(); await expect.poll(async () => (await fixture.commands()).length).toBe(6);
  dialog = await open(page, "Publicatie en posities", "Publicatie en posities"); await dialog.getByRole("button", { name: "Sponsorplan publiceren", exact: true }).click(); await expect.poll(async () => (await fixture.commands()).length).toBe(7);
  const commands = await fixture.commands();
  expect(commands.map(value => value.action)).toEqual(["createSponsor", "createCampaign", "addCreative", "registerSponsorMedia", "placeCampaign", "submitCampaign", "publishSponsorPlan"]);
  expect(commands[0]!.body).toEqual({ name: "Eigen nieuwe sponsor", websiteUrl: "https://example.org/", notes: "Eigen opvolging" });
  expect(commands[1]!.body).toMatchObject({ sponsorId: id(1), name: "Eigen nieuwe campagne", weight: "1" });
  expect(commands[2]!.body).toMatchObject({ campaignId: id(2), mediaAssetId: id(6), orientation: "any", durationSeconds: "8" });
  expect(commands[3]!.body).toEqual({ sponsorId: id(1), mediaAssetId: id(6) });
  expect(commands[4]!.body).toEqual({ campaignId: id(2), positionId: id(7), orientation: "any" });
  expect(commands[5]!.body).toEqual({ campaignId: id(2) });
  await page.keyboard.press("Escape");
  dialog = await open(page, "Eigen campagne 2 beheren", "Eigen campagne 2");
  await page.evaluate(async campaignId => { const fixture = globalThis as typeof globalThis & { fixtureHub: typeof hub; refreshSponsorPage: () => Promise<void> }; fixture.fixtureHub.campaigns.find(value => value.id === campaignId)!.status = "submitted"; await fixture.refreshSponsorPage(); }, id(2));
  await expect(dialog.getByRole("button", { name: "Materiaal koppelen", exact: true })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "Plaatsing instellen", exact: true })).toBeDisabled();
  expect(await fixture.commands()).toEqual(commands); expect(fixture.errors).toEqual([]);
});

test("approval-only capability retains the real POST while new writes stay disabled", async ({ page }) => {
  const fixture = await mount(page, { mode: "approval" });
  await expect(page.getByRole("button", { name: "Nieuwe campagne", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Sponsor toevoegen", exact: true })).toBeDisabled();
  // The real native POST navigates away; inspect its original document first.
  expect(await fixture.commands()).toEqual([]);
  await page.getByRole("button", { name: "Goedkeuren", exact: true }).click();
  await expect.poll(() => fixture.api.length).toBe(1);
  expect(fixture.api[0]).toEqual({ url: "/api/sponsors/campaigns/approve", method: "POST", body: `campaignId=${id(3)}` });
  expect(fixture.errors).toEqual([]);
});

test("CRM URL filters, details and old campaign hashes remain reachable without unmounting state", async ({ page }) => {
  const fixture = await mount(page, { suffix: "?crm=1&crmStage=proposal#kansen" });
  await expect(page.getByRole("tab", { name: "Pipeline & taken", exact: true })).toHaveAttribute("aria-selected", "true");
  const search = page.getByRole("search", { name: "Kansen en taken filteren", exact: true });
  await expect(search).toHaveAttribute("action", "/dashboard/sponsors#kansen"); await expect(search.locator('input[name="crm"]')).toHaveValue("1");
  await search.getByRole("searchbox", { name: "Zoeken in kansen en taken", exact: true }).fill("Eigen conceptfilter");
  await page.getByRole("tab", { name: "Partners", exact: true }).click(); await page.getByRole("tab", { name: "Pipeline & taken", exact: true }).click();
  await expect(search.getByRole("searchbox", { name: "Zoeken in kansen en taken", exact: true })).toHaveValue("Eigen conceptfilter");
  await page.getByRole("button", { name: "Kans Eigen kans openen", exact: true }).press("Enter"); await expect(page.getByRole("dialog", { name: "Eigen kans", exact: true })).toBeVisible(); await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Kans Eigen kans openen", exact: true })).toBeFocused();
  await page.evaluate(hash => { location.hash = hash; }, `sponsor-campaign-${id(2)}`); await expect(page.getByRole("dialog", { name: "Eigen campagne 2", exact: true })).toBeVisible();
  expect(await fixture.commands()).toEqual([]); expect(fixture.errors).toEqual([]);
});

test("empty/error/viewer surfaces remain honest and position setup keeps its original command", async ({ page }) => {
  let fixture = await mount(page, { mode: "empty", noPositions: true }); await expect(page.getByRole("heading", { name: "Je eerste partnerverhaal begint hier", exact: true })).toBeVisible();
  let dialog = await open(page, "Publicatie en posities", "Publicatie en posities"); await dialog.getByRole("button", { name: "Posities initialiseren", exact: true }).click(); await expect.poll(async () => (await fixture.commands()).length).toBe(1); expect((await fixture.commands())[0]!.action).toBe("initializeSponsorHub"); await page.keyboard.press("Escape");
  fixture = await mount(page, { mode: "error" }); await expect(page.getByRole("alert")).toContainText("niet volledig worden geladen"); await expect(page.getByRole("button", { name: "Nieuwe campagne", exact: true })).toBeDisabled(); expect(await fixture.commands()).toEqual([]);
  fixture = await mount(page, { mode: "viewer" }); await expect(page.getByRole("button", { name: "Goedkeuren", exact: true })).toHaveCount(0); await expect(page.getByRole("button", { name: "Indienen", exact: true })).toHaveCount(0);
  dialog = await open(page, "Eigen campagne 2 campagne bekijken", "Eigen campagne 2"); await expect(dialog.getByRole("button", { name: "Materiaal koppelen", exact: true })).toBeDisabled();
  expect(await fixture.commands()).toEqual([]); expect(fixture.errors).toEqual([]);
});


test("a campaign deeplink does not reopen management or discard material input on server refresh", async ({ page }) => {
  const fixture = await mount(page, { suffix: `#sponsor-campaign-${id(2)}` });
  await page.getByRole("dialog", { name: "Eigen campagne 2", exact: true }).getByRole("button", { name: "Materiaal koppelen", exact: true }).click();
  const material = page.getByRole("dialog", { name: "Campagnemateriaal", exact: true });
  await material.getByLabel("Duur (seconden)", { exact: true }).fill("17");
  await page.evaluate(async () => { const f = globalThis as typeof globalThis & { refreshSponsorPage: () => Promise<void> }; await f.refreshSponsorPage(); });
  await expect(material).toBeVisible();
  await expect(material.getByLabel("Duur (seconden)", { exact: true })).toHaveValue("17");
  await expect(material.getByRole("combobox", { name: "Campagne", exact: true })).toHaveValue(id(2));
  expect(await fixture.commands()).toEqual([]); expect(fixture.errors).toEqual([]);
});


test("campaign material starts with the selected campaign's own partner and records the real audit action", async ({ page }) => {
  const fixture = await mount(page);
  await page.evaluate(async input => { const f = globalThis as typeof globalThis & { fixtureHub: typeof hub; refreshSponsorPage: () => Promise<void> }; f.fixtureHub.sponsors.push({ id: input.partnerId, name: "Tweede echte partner", website_url: null, status: "active" }); f.fixtureHub.campaigns.find(value => value.id === input.campaignId)!.sponsor_id = input.partnerId; await f.refreshSponsorPage(); }, { partnerId: id(30), campaignId: id(2) });
  const management = await open(page, "Eigen campagne 2 beheren", "Eigen campagne 2");
  await management.getByRole("button", { name: "Materiaal koppelen", exact: true }).click();
  const material = page.getByRole("dialog", { name: "Campagnemateriaal", exact: true });
  await expect(material.getByRole("combobox", { name: "Sponsor", exact: true })).toHaveValue(id(30));
  await material.getByRole("button", { name: "Toelaten als sponsormedia", exact: true }).click();
  await expect.poll(async () => (await fixture.commands()).length).toBe(1);
  expect((await fixture.commands())[0]).toEqual({ action: "registerSponsorMedia", body: { sponsorId: id(30), mediaAssetId: id(6) } });
  await page.keyboard.press("Escape");
  await page.getByRole("tab", { name: "Afspeelregistratie", exact: true }).click();
  await expect(page.getByText("Campagne gemaakt", { exact: true })).toBeVisible();
  expect(fixture.errors).toEqual([]);
});
