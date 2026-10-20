import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

// Actual Source component and styles, controlled read/command transport.
// The separate pgTAP suite proves the real >1000-row query and RLS boundary.
const require = createRequire(join(process.cwd(), "package.json"));
const compiler = require.resolve("esbuild", {
  paths: [require.resolve("tsx")],
});
const origin = `http://127.0.0.1:${process.env.CONTROL_PORT ?? 3313}`;
const product = (n: number) => ({
  id: `19170000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  name: `Catalog ${String(n).padStart(4, "0")}`,
  active: n !== 1005,
  category: n === 1005 ? "Late category" : "Drinks",
  priceCents: 200,
  revision: 1,
  slug: `catalog-${n}`,
  dataSourceId: null,
  description: null,
  barcode: null,
  externalId: null,
  customFields: {},
  logoAssetId: null,
  logoUrl: null,
  unit: "stuk",
  updatedAt: "2026-10-17T20:00:00Z",
  vatRate: 9,
});
const catalog = (offset = 0, query = "") => ({
  products: query
    ? [product(1005)]
    : Array.from({ length: 50 }, (_, i) => product(offset + i + 1)),
  count: query ? 1 : 1005,
  total: 1005,
  active: 1004,
  categories: ["Drinks", "Late category"],
  categoriesComplete: true,
  offset,
  pageSize: 50,
});
const entry = `import React from'react';import{createRoot}from'react-dom/client';import{SitesProductsWorkspace}from'./apps/control/app/(shell)/dashboard/integrations/twelve-products/sites-products-workspace';createRoot(document.getElementById('root')).render(<main className="sync-control"><SitesProductsWorkspace catalog={${JSON.stringify(catalog())}} canRead canWrite canUploadLogo={false} manualSources={[]}/></main>);`;
let bundle: { js: string; css: string };
test.beforeAll(() => {
  const code = `const{build}=require(${JSON.stringify(compiler)});const result=await build({stdin:{contents:${JSON.stringify(entry)},resolveDir:process.cwd(),loader:'tsx'},nodePaths:[process.cwd()+'/apps/control/node_modules'],bundle:true,write:false,outfile:'/tmp/sync-products.js',platform:'browser',format:'iife',jsx:'automatic',loader:{'.module.css':'local-css','.css':'css'},plugins:[{name:'controlled-boundaries',setup(b){b.onResolve({filter:/menu-price-actions$/},a=>({path:a.path,namespace:'price-commands'}));b.onLoad({filter:/.*/,namespace:'price-commands'},()=>({contents:'const deny=async()=>{throw Error("No menu price command in this catalog fixture")};export const prepareMenuPriceCandidatesAction=deny,publishMenuPriceCandidatesAction=deny,readMenuPriceCandidatesAction=deny,readMenuPriceImpactAction=deny;',loader:'js'}));b.onResolve({filter:/actions$/},a=>({path:a.path,namespace:'commands'}));b.onLoad({filter:/.*/,namespace:'commands'},()=>({contents:'async function post(path,input){const r=await fetch(path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)});if(!r.ok)throw Error("Transport failed");return r.json()};export const listProductsPage=input=>post("/__sync-catalog/read",input);export const setProductAvailability=input=>post("/__sync-catalog/availability",input);export async function manageProduct(){throw Error("No form command in this fixture")}',loader:'js'}));b.onResolve({filter:/product-(import-dialog|logo-control)$/},a=>({path:a.path,namespace:'other-commands'}));b.onLoad({filter:/.*/,namespace:'other-commands'},()=>({contents:'export function ProductImportDialog(){return null};export function ProductLogoControl(){return null}',loader:'js'}));b.onResolve({filter:/^next\\/link$/},a=>({path:a.path,namespace:'next'}));b.onLoad({filter:/.*/,namespace:'next'},()=>({contents:'import React from"react";export default function Link(props){return React.createElement("a",props)}',resolveDir:process.cwd(),loader:'js'}));}}]});process.stdout.write(JSON.stringify({js:result.outputFiles.find(f=>f.path.endsWith('.js')).text,css:result.outputFiles.find(f=>f.path.endsWith('.css')).text}));`;
  bundle = JSON.parse(
    execFileSync(
      process.execPath,
      [
        "-e",
        `(async()=>{${code}})().catch(error=>{console.error(error.message);process.exitCode=1})`,
      ],
      { encoding: "utf8", timeout: 30000, maxBuffer: 16 * 1024 * 1024 },
    ),
  );
});
async function mount(
  page: Page,
  handler?: (
    input: Record<string, unknown>,
    sequence: number,
  ) => Promise<unknown>,
) {
  const requests: Record<string, unknown>[] = [];
  const css = [
    "tokens/veyocast-design-tokens.css",
    "packages/ui/src/styles.css",
    "apps/control/app/globals.css",
    "apps/control/app/fieldflow.css",
    "apps/control/app/sync-source.css",
    "apps/control/app/sync-adapter.css",
  ]
    .map((path) => readFileSync(path, "utf8").replace(/@import[^;]+;/g, ""))
    .join("\n");
  await page.route("**/__sync-catalog/read", async (route) => {
    const input = route.request().postDataJSON() as Record<string, unknown>;
    requests.push(input);
    const result = handler
      ? await handler(input, requests.length)
      : { ok: true, page: catalog(Number(input.offset), String(input.query)) };
    if (result === null)
      return route.fulfill({ status: 503, body: "Unavailable" });
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(result),
    });
  });
  await page.route("**/__sync-catalog/fixture", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html lang="nl" data-design-system="fieldflow"><head><style>${css}\n${bundle.css}</style></head><body><div id="root"></div><script>${bundle.js.replace(/<\/script/gi, "<\\/script")}</script></body></html>`,
    }),
  );
  await page.goto(`${origin}/__sync-catalog/fixture`);
  await expect(
    page.getByRole("heading", { name: "Een frisse kaart voor je club." }),
  ).toBeVisible();
  return requests;
}
test("search and category options reach products outside the first thousand rows", async ({
  page,
}) => {
  const calls = await mount(page);
  await expect(
    page.getByRole("cell", { name: "Catalog 0001", exact: false }).first(),
  ).toBeVisible();
  await expect(
    page.getByLabel("Categorie").getByRole("option", { name: "Late category" }),
  ).toHaveCount(1);
  await page.getByRole("searchbox", { name: "Producten zoeken" }).fill("1005");
  await expect(page.getByText("Catalog 1005", { exact: true })).toBeVisible();
  await expect(page.getByText("Catalog 0001", { exact: true })).toHaveCount(0);
  expect(calls.at(-1)).toMatchObject({ query: "1005", offset: 0 });
  await expect(page.locator(".ad-metric").nth(0).locator("strong")).toHaveText(
    "1005",
  );
  await expect(page.locator(".ad-metric").nth(1).locator("strong")).toHaveText(
    "1004",
  );
});
test("pagination remains bounded and a changed search returns to the first page", async ({
  page,
}) => {
  const calls = await mount(page);
  await page.getByRole("button", { name: "Volgende producten" }).click();
  await expect(page.getByText("Catalog 0051", { exact: true })).toBeVisible();
  expect(calls.at(-1)).toMatchObject({ offset: 50 });
  await page.getByRole("searchbox", { name: "Producten zoeken" }).fill("1005");
  await expect(page.getByText("Catalog 1005", { exact: true })).toBeVisible();
  expect(calls.at(-1)).toMatchObject({ query: "1005", offset: 0 });
  await expect(
    page.getByRole("navigation", { name: "Productpagina’s" }),
  ).toHaveCount(0);
});
test("failed reads retain prior rows and input and allow a deliberate retry", async ({
  page,
}) => {
  await mount(page, async (input, sequence) =>
    sequence === 1 ? null : { ok: true, page: catalog(0, String(input.query)) },
  );
  const search = page.getByRole("searchbox", { name: "Producten zoeken" });
  await search.fill("1005");
  await expect(page.getByRole("alert")).toContainText(
    "vorige resultaten blijven zichtbaar",
  );
  await expect(search).toHaveValue("1005");
  await expect(page.getByText("Catalog 0001", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Geen producten gevonden" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Opnieuw laden", exact: true })
    .click();
  await expect(page.getByText("Catalog 1005", { exact: true })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});
test("returning to the loaded filter discards a late response and clears pending state", async ({
  page,
}) => {
  let releaseRead: () => void = () => undefined;
  const hold = new Promise<void>((resolve) => {
    releaseRead = resolve;
  });
  const calls = await mount(page, async (input) => {
    await hold;
    return { ok: true, page: catalog(0, String(input.query)) };
  });
  const search = page.getByRole("searchbox", { name: "Producten zoeken" });
  await search.fill("1005");
  await expect.poll(() => calls.length).toBe(1);
  await search.fill("");
  await expect(
    page.getByRole("status").filter({ hasText: "Producten laden" }),
  ).toHaveCount(0);
  const response = page.waitForResponse("**/__sync-catalog/read");
  releaseRead();
  await response;
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await expect(page.getByText("Catalog 0001", { exact: true })).toBeVisible();
  await expect(page.getByText("Catalog 1005", { exact: true })).toHaveCount(0);
  expect(calls).toHaveLength(1);
});
test("an uncertain availability command survives filtering with the same original payload", async ({
  page,
}) => {
  const commands: unknown[] = [];
  await page.route("**/__sync-catalog/availability", async (route) => {
    commands.push(route.request().postDataJSON());
    return route.fulfill({ status: 503, body: "Lost response" });
  });
  await mount(page);
  const toggle = page.getByRole("button", {
    name: "Catalog 0001: beschikbaar, klik om uit te zetten",
    exact: true,
  });
  await toggle.click();
  await expect(page.getByRole("alert")).toContainText(
    "catalogus kan al zijn bijgewerkt",
  );
  const search = page.getByRole("searchbox", { name: "Producten zoeken" });
  await search.fill("1005");
  await expect(page.getByText("Catalog 1005", { exact: true })).toBeVisible();
  await search.fill("");
  await expect(toggle).toBeVisible();
  await expect(toggle).toBeDisabled();
  await page
    .getByRole("button", {
      name: "Catalog 0001: wijziging opnieuw bevestigen",
      exact: true,
    })
    .click();
  await expect.poll(() => commands.length).toBe(2);
  expect(commands[1]).toEqual(commands[0]);
});

test("product fields keep concise accessible names with category options and explanatory text", async ({
  page,
}) => {
  await mount(page);
  await page
    .getByRole("button", { name: "Product toevoegen", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Product toevoegen" });
  await dialog
    .getByLabel("Categorie", { exact: true })
    .fill("Nieuwe categorie");
  await dialog.getByLabel("Artikelnummer", { exact: true }).fill("ART-1005");
  await expect(dialog.getByLabel("Categorie", { exact: true })).toHaveValue(
    "Nieuwe categorie",
  );
  await expect(dialog.getByLabel("Artikelnummer", { exact: true })).toHaveValue(
    "ART-1005",
  );
  await expect(
    dialog.getByLabel("Artikelnummer", { exact: true }),
  ).toHaveAccessibleDescription(
    /Een volgende import gebruikt het artikelnummer/,
  );
});

test("receipt confirmation does not replace a newer canonical product after a lost response", async ({
  page,
}) => {
  const commands: unknown[] = [];
  await page.route("**/__sync-catalog/availability", async (route) => {
    commands.push(route.request().postDataJSON());
    return route.fulfill(
      commands.length === 1
        ? { status: 503, body: "Lost committed response" }
        : {
            contentType: "application/json",
            body: JSON.stringify({ ok: true, active: false, revision: 2 }),
          },
    );
  });
  await mount(page, async (input) => {
    const next = catalog(Number(input.offset), String(input.query));
    next.active = 1003;
    if (!input.query)
      next.products[0] = {
        ...product(1),
        name: "Latere catalogusnaam",
        priceCents: 275,
        revision: 3,
        active: false,
      };
    return { ok: true, page: next };
  });
  await page
    .getByRole("button", {
      name: "Catalog 0001: beschikbaar, klik om uit te zetten",
      exact: true,
    })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "catalogus kan al zijn bijgewerkt",
  );
  const search = page.getByRole("searchbox", { name: "Producten zoeken" });
  await search.fill("1005");
  await expect(page.getByText("Catalog 1005", { exact: true })).toBeVisible();
  await search.fill("");
  await expect(
    page.getByText("Latere catalogusnaam", { exact: true }),
  ).toBeVisible();
  const current = page.getByRole("button", {
    name: "Latere catalogusnaam: niet beschikbaar, klik om aan te zetten",
    exact: true,
  });
  await expect(current).toBeDisabled();
  await page
    .getByRole("button", {
      name: "Catalog 0001: wijziging opnieuw bevestigen",
      exact: true,
    })
    .click();
  await expect.poll(() => commands.length).toBe(2);
  expect(commands[1]).toEqual(commands[0]);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(current).toBeEnabled();
  const row = page
    .getByRole("row")
    .filter({ has: page.getByText("Latere catalogusnaam", { exact: true }) });
  await expect(row).toContainText("€ 2,75");
});
