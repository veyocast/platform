import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID, createHash } from "node:crypto";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { Buffer } from "node:buffer";
import process from "node:process";
import { URL } from "node:url";
import { chromium, expect as browserExpect } from "@playwright/test";
const expect = browserExpect.configure({ timeout: 30_000 });

assert.equal(process.env.VEYOCAST_S226_LOCAL_ACCEPTANCE, "1");
assert.equal(process.cwd(), "/home/codex/repos/castivo-s226");
const configuration = "/home/codex/.local/state/veyocast-s226/local-status.json";
const state = "/tmp/veyocast-s226-qa-auth-state.json";
for (const file of [configuration, state]) assert.equal(statSync(file).mode & 0o777, 0o600);
const cfg = JSON.parse(readFileSync(configuration, "utf8"));
assert.equal(new URL(cfg.API_URL).origin, "http://127.0.0.1:57621");
assert.equal(new URL(cfg.DB_URL).port, "57622");
const container = "supabase_db_veyocast-s226", tenant = "19170000-0000-4000-8000-000000000010";
assert.equal(execFileSync("docker", ["inspect", "--format", '{{.Name}} {{ index .Config.Labels "com.supabase.cli.project" }}', container], { encoding: "utf8" }).trim(), "/supabase_db_veyocast-s226 veyocast-s226");
const checkpoint = "/tmp/veyocast-s226-import-journey-checkpoint.json";
const prior = existsSync(checkpoint) ? JSON.parse(readFileSync(checkpoint, "utf8")) : null;
assert.ok(!prior || process.env.VEYOCAST_S226_RESUME_IMPORT === "1", "Explicit resume required; inspect staged/applied import checkpoint first.");
if (prior) { assert.equal(prior.tenant, tenant); assert.match(prior.run, /^[a-f0-9-]{36}$/u); }
const require = createRequire(process.cwd() + "/packages/integrations/package.json");
const ExcelJS = require("exceljs");
const run = prior?.run ?? randomUUID(), prefix = "S226-import-" + run.slice(0, 8), codes = [prefix + "-1", prefix + "-2"];
// Keep the loopback hostname stable across Next's canonical alias redirects.
const base = "http://localhost:3240";
function sql(query) {
  return execFileSync("docker", ["exec", "-i", container, "psql", "-U", "postgres", "-At", "-v", "ON_ERROR_STOP=1"], { input: query, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
}
function products() { return JSON.parse(sql(`select coalesce(json_agg(p order by source_external_id),'[]') from (select id,source_external_id,name,price_cents,category,revision from public.tenant_products where tenant_id='${tenant}' and source_external_id in ('${codes[0]}','${codes[1]}'))p;`)); }
function history() { return createHash("sha256").update(sql(`select coalesce(json_agg(r order by id),'[]') from public.playlist_releases r where tenant_id='${tenant}';`)).digest("hex"); }
const report = prior ?? { schemaVersion: 1, startedAt: new Date().toISOString(), scope: "Actual built Next Control, existing AAL2 user, authenticated upload/remap/apply, real PostgreSQL readback. Explicit generated CSV/XLSX fixtures, no claim of a live Twelve API or external customer export.", run, tenant, imports: [], beforeProductCount: Number(sql(`select count(*) from public.tenant_products where tenant_id='${tenant}';`)), beforeReleaseHistory: history() };
if (!prior) assert.deepEqual(products(), []);
const browser = await chromium.launch();
const storageState = JSON.parse(readFileSync(state, "utf8"));
assert.ok(storageState.cookies.every(cookie => cookie.domain === "127.0.0.1"));
storageState.cookies = storageState.cookies.map(cookie => ({ ...cookie, domain: "localhost" }));
const context = await browser.newContext({ storageState, viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
await context.addCookies([{ name: "veyocast-tenant-context", value: "duindorp-sites-local-qa", url: base, httpOnly: true, sameSite: "Lax" }]);
context.setDefaultTimeout(30_000);
const page = await context.newPage();
const step = (phase, extension) => process.stdout.write(JSON.stringify({ phase, extension, at: new Date().toISOString() }) + "\n");
let browserErrorCount = 0;
let actionApplyFailureCount = 0;
page.on("pageerror", () => { browserErrorCount++; });
page.on("console", message => { if (message.text().includes("SERVER ACTION APPLY FAILED")) actionApplyFailureCount++; });
const navigations = [];
page.on("request", request => {
  const url = new URL(request.url());
  if (url.pathname.startsWith("/dashboard/")) navigations.push({ host: url.hostname, path: url.pathname, mappingSuccessQuery: url.searchParams.get("succes") === "mapping", method: request.method(), navigation: request.isNavigationRequest() });
});
try {
  let firstIds = report.imports.find(row => row.extension === "csv" && row.status === "PASS")?.rows?.map(row => row.id);
  for (const extension of ["csv", "xlsx"]) {
    step("begin", extension);
    const saved = report.imports.find(row => row.extension === extension);
    if (saved?.status === "PASS") continue;
    const headers = ["Artikelcode", "Nieuwe titel", "Bedrag", "Rubriek"];
    let bytes, mimeType;
    if (extension === "csv") {
      bytes = Buffer.from(headers.join(";") + "\n" + `${codes[0]};${prefix} koffie;2,35;Importproef\n${codes[1]};${prefix} thee;4,50;Importproef\n`);
      mimeType = "text/csv";
    } else {
      const workbook = new ExcelJS.Workbook(), sheet = workbook.addWorksheet("Twelve export");
      sheet.addRow(headers); sheet.addRow([codes[0], prefix + " koffie bijgewerkt", 2.75, "Importproef"]); sheet.addRow([codes[1], prefix + " thee bijgewerkt", 4.75, "Importproef"]);
      bytes = Buffer.from(await workbook.xlsx.writeBuffer()); mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    }
    let receipt = saved;
    if (!receipt) {
    await page.goto(base + "/dashboard/sources/twelve/products");
    await page.getByRole("button", { name: "Twelve importeren", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Producten uit Twelve importeren" });
    await dialog.getByLabel("CSV- of Excel-bestand").setInputFiles({ name: prefix + "." + extension, mimeType, buffer: bytes });
    const received = page.waitForResponse(response => response.url() === base + "/api/products/import" && response.request().method() === "POST");
    await dialog.getByRole("button", { name: "Bestand controleren", exact: true }).click();
    const response = await received; assert.equal(response.status(), 200); receipt = await response.json();
    assert.match(receipt.importId, /^[a-f0-9-]{36}$/u); assert.equal(receipt.rowCount, 2);
    report.imports.push({ extension, importId: receipt.importId, checksumSha256: createHash("sha256").update(bytes).digest("hex"), uploadStatus: response.status() });
    writeFileSync(checkpoint, JSON.stringify(report), { mode: 0o600 });
    } else {
      assert.equal(sql(`select file_sha256 from public.product_catalog_imports where id='${receipt.importId}' and tenant_id='${tenant}';`), receipt.checksumSha256, "Resume the exact previously received file, not a newly generated workbook ZIP.");
      await page.goto(base + "/dashboard/sources/twelve/imports/" + receipt.importId);
    }
    const persistedStatus = sql(`select status from public.product_catalog_imports where id='${receipt.importId}' and tenant_id='${tenant}';`);
    if (persistedStatus === "draft") {
    await expect(page.getByRole("heading", { level: 1, name: extension === "csv" ? "CSV-import controleren" : "Excel-import controleren" })).toBeVisible();
    const mapping = page.getByRole("region", { name: "Kolommen koppelen", exact: true });
    for (const [index, field] of ["external_id", "name", "price", "category"].entries()) await mapping.locator(`select[name="target-${index}"]`).selectOption(field);
    step("remap", extension);
    const remapped = page.waitForResponse(response => response.request().method() === "POST" && new URL(response.url()).pathname === `/api/products/import/${receipt.importId}`);
    await mapping.getByRole("button", { name: "Mapping opnieuw verwerken", exact: true }).click();
    const remapResponse = await remapped;
    const body = await remapResponse.text().catch(() => "");
    const transition = { phase: "remap-response", extension, status: remapResponse.status(), navigation: remapResponse.request().isNavigationRequest(), location: await remapResponse.headerValue("location"), redirect: await remapResponse.headerValue("x-action-redirect"), contentType: await remapResponse.headerValue("content-type"), bodyBytes: Buffer.byteLength(body), bodyHasSuccess: body.includes("De kolommen zijn opnieuw verwerkt"), bodyHasLogin: body.includes("Inloggen bij VeyoCast"), path: new URL(page.url()).pathname, host: new URL(page.url()).hostname, browserErrorCount, actionApplyFailureCount };
    process.stdout.write(JSON.stringify(transition) + "\n");
    try {
      await expect(page.getByRole("status").filter({ hasText: "De kolommen zijn opnieuw verwerkt" })).toBeVisible();
    } catch (error) {
      process.stdout.write(JSON.stringify({ phase: "remap-final", navigations, browserErrorCount, actionApplyFailureCount, mappingSuccessQuery: new URL(page.url()).searchParams.get("succes") === "mapping", path: new URL(page.url()).pathname, host: new URL(page.url()).hostname }) + "\n");
      throw error;
    }
    await expect(page.getByRole("region", { name: "Voorbeeld", exact: true }).getByText("Klaar voor import", { exact: true })).toBeVisible();
    await page.getByRole("combobox", { name: /^Importmethode/u }).selectOption("merge");
    step("apply", extension);
    await page.getByRole("button", { name: "2 producten toepassen", exact: true }).click();
    } else {
      assert.equal(persistedStatus, "applied");
      await page.goto(base + "/dashboard/sources/twelve/products");
    }
    await expect(page.getByRole("heading", { level: 1, name: "Een frisse kaart voor je club." })).toBeVisible();
    await page.reload();
    await page.getByRole("searchbox", { name: "Producten zoeken" }).fill(prefix);
    await expect(page.getByRole("table").locator("tbody tr")).toHaveCount(2);
    const rows = products(); assert.equal(rows.length, 2); assert.deepEqual(rows.map(row => row.price_cents), extension === "csv" ? [235, 450] : [275, 475]);
    if (extension === "csv") firstIds = rows.map(row => row.id); else assert.deepEqual(rows.map(row => row.id), firstIds, "XLSX merge preserves the imported product identities");
    assert.equal(sql(`select status from public.product_catalog_imports where id='${receipt.importId}' and tenant_id='${tenant}';`), "applied");
    Object.assign(report.imports.find(row => row.extension === extension), { status: "PASS", rows, persistedAfterReload: true });
    step("persisted", extension);
    writeFileSync(checkpoint, JSON.stringify(report), { mode: 0o600 });
  }
  report.afterProductCount = Number(sql(`select count(*) from public.tenant_products where tenant_id='${tenant}';`));
  assert.equal(report.afterProductCount, report.beforeProductCount + 2);
  report.afterReleaseHistory = history(); assert.equal(report.afterReleaseHistory, report.beforeReleaseHistory);
  await page.screenshot({ path: "execution/evidence/product-import-real-services.png", fullPage: true });
  report.status = "PASS";
} catch (error) {
  report.status = "FAIL"; report.error = error instanceof Error ? error.message.slice(0, 700) : "Import journey failed";
  await page.screenshot({ path: "/tmp/veyocast-s226-product-import-failure.png", fullPage: true }).catch(() => undefined);
  throw error;
} finally {
  writeFileSync("execution/evidence/product-import-real-services.json", JSON.stringify(report, null, 2) + "\n");
  await browser.close();
}
process.stdout.write(JSON.stringify({ status: report.status, formats: report.imports.map(row => row.extension), newProducts: 2, stableIds: true, publicationHistoryUnchanged: true }) + "\n");
