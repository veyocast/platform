import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { literalSponsorCrmSearch, parseSponsorCrmFilter } from "../../apps/control/app/(shell)/dashboard/sponsors/sponsor-crm";

// Production component, controlled HTTP read boundary. This does not claim live RLS.
const require = createRequire(join(process.cwd(), "package.json"));
const compiler = require.resolve("esbuild", { paths: [require.resolve("tsx")] });
const origin = `http://127.0.0.1:${process.env.CONTROL_PORT ?? 3313}`;
const opportunities = [
  { id: "opportunity-a", name: "Club_50%*", stage: "proposal", estimated_value_cents: 129900, next_action_at: "2026-11-03T11:00:00Z" },
  { id: "opportunity-b", name: "Tweede kans", stage: "lead", estimated_value_cents: null, next_action_at: null }
];
const tasks = [
  { id: "task-a", title: "Club_50%* materiaal opvragen", status: "open", due_at: "2026-11-02T11:00:00Z" },
  { id: "task-b", title: "Afspraak bevestigen", status: "done", due_at: null }
];
let bundle: { js: string; css: string };
test.beforeAll(() => {
  const entry = `import React from'react';import{createRoot}from'react-dom/client';import{SponsorCrmOverview}from'./apps/control/app/(shell)/dashboard/sponsors/sponsor-crm-overview';createRoot(document.getElementById('root')).render(<main className="sync-control"><h1>Sponsorbeheer</h1><SponsorCrmOverview {...window.crmProps}/></main>);`;
  const code = `const{build}=require(${JSON.stringify(compiler)});const result=await build({stdin:{contents:${JSON.stringify(entry)},resolveDir:process.cwd(),sourcefile:'sponsor-crm-fixture.tsx',loader:'tsx'},nodePaths:[process.cwd()+'/apps/control/node_modules'],bundle:true,write:false,outfile:'/tmp/sponsor-crm-fixture.js',platform:'browser',format:'iife',jsx:'automatic',loader:{'.module.css':'local-css','.css':'css'}});process.stdout.write(JSON.stringify({js:result.outputFiles.find(file=>file.path.endsWith('.js')).text,css:result.outputFiles.find(file=>file.path.endsWith('.css')).text}));`;
  bundle = JSON.parse(execFileSync(process.execPath, ["-e", `(async()=>{${code}})().catch(error=>{console.error(error.message);process.exitCode=1;});`], { encoding: "utf8", timeout: 30000, maxBuffer: 16 * 1024 * 1024 }));
});

async function mount(page: Page, mode: "filled" | "empty" | "error" | "paged" = "filled") {
  const reads: string[] = [];
  const writes: string[] = [];
  const baseCss = ["tokens/veyocast-design-tokens.css", "packages/ui/src/styles.css", "apps/control/app/globals.css", "apps/control/app/fieldflow.css", "apps/control/app/sync-source.css", "apps/control/app/sync-adapter.css"].map(path => readFileSync(path, "utf8").replace(/@import[^;]+;/g, "")).join("\n");
  await page.route("**/dashboard/sponsors*", route => {
    if (route.request().method() !== "GET") { writes.push(route.request().method()); return route.abort(); }
    reads.push(route.request().url());
    const filter = parseSponsorCrmFilter(Object.fromEntries(new URL(route.request().url()).searchParams));
    const match = new RegExp(literalSponsorCrmSearch(filter.query), "iu");
    const filteredOpportunities = opportunities.filter(item => match.test(item.name) && (filter.stage === "all" || item.stage === filter.stage));
    const filteredTasks = tasks.filter(item => match.test(item.title) && (filter.status === "all" || item.status === filter.status));
    const data = { error: mode === "error", opportunities: mode === "empty" || mode === "error" ? [] : filteredOpportunities, opportunityCount: mode === "paged" ? 26 : mode === "empty" || mode === "error" ? 0 : filteredOpportunities.length, tasks: mode === "empty" || mode === "error" ? [] : filteredTasks, taskCount: mode === "empty" || mode === "error" ? 0 : filteredTasks.length };
    return route.fulfill({ contentType: "text/html", body: `<!doctype html><html lang="nl" data-design-system="fieldflow"><head><title>Sponsoroverzicht</title><style>${baseCss}\n${bundle.css}</style></head><body><div id="root"></div><script>window.crmProps=${JSON.stringify({ data, filter }).replace(/</g, "\\u003c")};${bundle.js.replace(/<\/script/gi, "<\\/script")}</script></body></html>` });
  });
  await page.goto(`${origin}/dashboard/sponsors`);
  await expect(page.getByRole("heading", { name: "Pipeline en taken" })).toBeVisible();
  return { reads, writes };
}

for (const width of [320, 390, 1440]) {
  test(`Sponsors CRM ${width}: echte componentfilters, inspectie en toetsenbord zonder schrijfopdracht`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const { reads, writes } = await mount(page);
    const open = page.getByRole("button", { name: "Kans Club_50%* openen", exact: true });
    await open.focus(); await page.keyboard.press("Enter");
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByRole("heading", { name: "Club_50%*", exact: true })).toBeVisible();
    await expect(sheet.getByText("€ 1.299,00", { exact: true })).toBeVisible();
    await expect(sheet.getByText("Vastgelegde kans · Alleen bekijken")).toBeVisible();
    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(axe.violations).toEqual([]);
    await page.keyboard.press("Escape"); await expect(open).toBeFocused();
    await page.getByRole("button", { name: "Taak Afspraak bevestigen openen", exact: true }).click();
    await expect(sheet.getByText("Niet vastgelegd", { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(page.getByRole("button", { name: "Taak Afspraak bevestigen openen", exact: true })).toBeFocused();
    const filterToggle = page.getByRole("button", { name: "Kansen- en taakfilters", exact: true });
    if (width < 1440) { await filterToggle.click(); await expect(filterToggle).toHaveAttribute("aria-expanded", "true"); }
    await page.getByRole("searchbox", { name: "Zoeken in kansen en taken" }).fill("Club_50%*");
    await page.getByRole("combobox", { name: "Kansfase", exact: true }).selectOption("proposal");
    await page.getByRole("combobox", { name: "Taakstatus", exact: true }).selectOption("open");
    await page.getByRole("button", { name: "Filters toepassen", exact: true }).click();
    await expect(page.getByRole("button", { name: "Kans Tweede kans openen", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Taak Afspraak bevestigen openen", exact: true })).toHaveCount(0);
    await expect(page.getByRole("searchbox", { name: "Zoeken in kansen en taken" })).toHaveValue("Club_50%*");
    await expect(page.getByRole("combobox", { name: "Kansfase", exact: true })).toHaveValue("proposal");
    expect(new URL(reads.at(-1)!).searchParams.get("crmQuery")).toBe("Club_50%*");
    expect(writes).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    const openButton = page.getByRole("button", { name: "Kans Club_50%* openen", exact: true });
    expect((await openButton.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    const filteredAxe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(filteredAxe.violations).toEqual([]);
    await page.screenshot({ path: test.info().outputPath(`sponsor-crm-${width}.png`), fullPage: true });
  });
}

test("Sponsors CRM: lege data en onbeschikbaarheid maken geen success-/CRM-claim", async ({ page }) => {
  await mount(page, "empty");
  await expect(page.getByText("Nog geen kansen vastgelegd.")).toBeVisible();
  await expect(page.getByText("Nog geen taken vastgelegd.")).toBeVisible();
  await mount(page, "error");
  await expect(page.getByRole("alert")).toContainText("konden niet worden geladen");
  await expect(page.getByRole("button", { name: /openen/ })).toHaveCount(0);
});

test("Sponsors CRM: paginering opent volgende serverpagina en houdt filters behouden", async ({ page }) => {
  const { reads, writes } = await mount(page, "paged");
  const navigation = page.getByRole("navigation", { name: "Kansenpagina's" });
  await navigation.getByRole("link", { name: "Volgende" }).click();
  await expect(navigation).toContainText("Pagina 2 van 2");
  expect(new URL(reads.at(-1)!).searchParams.get("opportunityPage")).toBe("2");
  expect(writes).toEqual([]);
});
