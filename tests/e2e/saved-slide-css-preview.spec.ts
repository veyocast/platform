import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { mountSavedPreview, prepareSavedPreviewFixture, savedPreviewFixture, savedPreviewId, savedPreviewOrigin, type SavedPreviewFixture } from "../helpers/saved-slide-css-preview-fixture";

test.beforeAll(prepareSavedPreviewFixture);

async function assertPreviewDoesNotPublish(page: Page, data: SavedPreviewFixture) {
  await expect(page.getByRole("button", { name: "Aan playlist toevoegen", exact: true })).toHaveCount(0);
  await expect(page.locator('video')).toHaveCount(0);
  await expect(page.getByAltText(/Offline fallback|Volledige offline fallback/)).toHaveCount(0);
  expect(data.tables.dynamic_slides![0]!.current_snapshot_id).toBeNull();
  expect(data.tables.dynamic_slides![0]!.current_published_version_id).toBeNull();
  expect(data.tables.dynamic_slide_snapshots![0]!.status).toBe("queued");
  expect(data.tables.dynamic_slide_snapshots![0]).not.toHaveProperty("output_media_asset_id");
  expect(data.tables.dynamic_slide_snapshots![0]).not.toHaveProperty("sync_render_result_json");
  expect(await page.evaluate(() => (globalThis as unknown as { fixtureWrites: unknown[] }).fixtureWrites)).toEqual([]);
  const reads = await page.evaluate(() => (globalThis as unknown as { fixtureReads: Array<{ table: string; filters?: Array<[string, string, unknown]> }> }).fixtureReads);
  expect(reads.some(read => read.table === "dynamic_slide_snapshots" && read.filters?.some(([, key, value]) => key === "dynamic_slide_version_id" && value === savedPreviewId(3)))).toBe(true);
}

async function assertCanonicalRss(page: Page, data: SavedPreviewFixture) {
  await expect(page.getByText("Bestaande bronkop direct zichtbaar", { exact: true })).toBeVisible({ timeout: 10_000 });
  const photo = page.locator('.rss-photo img,.rss-story-photo img'), logo = page.locator('.rss-provider img,.rss-source img');
  for (const [image, asset] of [[photo, data.media[0]!], [logo, data.media[1]!]] as const) {
    await expect(image).toBeVisible();
    await expect.poll(() => image.evaluate((node: HTMLImageElement) => {
      for (let element: HTMLElement | null = node; element; element = element.parentElement) {
        const style = getComputedStyle(element);
        if (Number(style.opacity) < .95 || style.visibility === "hidden" || style.display === "none") return false;
      }
      return true;
    }), { timeout: 10_000 }).toBe(true);
    await expect.poll(() => image.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0)).toBe(true);
    const actual = await image.evaluate(async (node: HTMLImageElement) => {
      const bytes = await (await fetch(node.currentSrc || node.src)).arrayBuffer();
      return { bytes: bytes.byteLength, sha: [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(value => value.toString(16).padStart(2, "0")).join("") };
    });
    expect(actual).toEqual({ bytes: asset.bytes, sha: asset.sha });
  }
  const qr = page.locator('.rss-qr-zone svg.ot-qr,.rss-story-qr svg.ot-qr');
  await expect(qr).toBeVisible();
  const require = createRequire(join(process.cwd(), "apps/control/package.json"));
  const { modules } = require("qrcode").create("https://example.invalid/canonical-news/1", { errorCorrectionLevel: "M" });
  let expectedPath = "";
  for (let y = 0; y < modules.size; y++) for (let x = 0; x < modules.size; x++) if (modules.get(y, x)) expectedPath += `M${x + 4},${y + 4}h1v1h-1z`;
  expect(createHash("sha256").update(await qr.locator('path').getAttribute('d') ?? "").digest("hex")).toBe(createHash("sha256").update(expectedPath).digest("hex"));
}

async function assertMenuPages(page: Page) {
  await expect(page.locator('.vm-widgets').first()).toBeVisible();
  await expect(page.locator('.vm-widgets').getByText('Clubkoffie', { exact: true })).toBeVisible();
  await expect(page.locator('.vm-widgets')).toContainText(/2[,.]50/);
  await expect(page.locator('.vm-widgets').getByText('Tweede echte widgetpagina', { exact: true })).toBeVisible({ timeout: 15_000 });
}

test("a real RSS wizard create opens its actual queued detail route with canonical CSS photo, logo and QR", async ({ page }, info) => {
  const data = savedPreviewFixture("rss");
  const run = await mountSavedPreview(page, data, "/__saved/create");
  for (let step = 0; step < 3; step++) await page.getByRole("button", { name: "Verder", exact: true }).click();
  await page.getByRole("button", { name: "Bron controleren", exact: true }).click();
  await expect(page.getByRole("button", { name: "Ontwerp maken", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Ontwerp maken", exact: true }).click();
  await expect(page).toHaveURL(`${savedPreviewOrigin}/dashboard/slides/${data.slideId}`);
  await assertCanonicalRss(page, data);
  await assertPreviewDoesNotPublish(page, data);
  expect(run.commands).toHaveLength(1); expect(run.commands[0]!.kind).toBe("createSyncDesignWizardAction");
  expect(run.routes).toEqual(["/__saved/create", `/dashboard/slides/${data.slideId}`]);
  expect(run.errors).toEqual([]);
  await page.screenshot({ path: info.outputPath("queued-source-landscape.png"), fullPage: true });
});

test("the actual initial portrait Source detail renders before a worker artifact and remains accessible", async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const data = savedPreviewFixture("rss", "portrait"), run = await mountSavedPreview(page, data);
  await assertCanonicalRss(page, data);
  await assertPreviewDoesNotPublish(page, data);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(run.commands).toEqual([]); expect(run.errors).toEqual([]);
  await page.screenshot({ path: info.outputPath("queued-source-portrait.png"), fullPage: true });
});

test("the real Menu open destination shows saved two-page widgets and approved EUR2.50 while publishing is queued", async ({ page }, info) => {
  const data = savedPreviewFixture("menu"), run = await mountSavedPreview(page, data, `/dashboard/slides/menu-studio/${data.slideId}`);
  await expect(page.getByRole("heading", { name: "Opgeslagen schermvoorbeeld", exact: true })).toBeVisible();
  await assertMenuPages(page);
  await assertPreviewDoesNotPublish(page, data);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(run.commands).toEqual([]); expect(run.errors).toEqual([]);
  await page.screenshot({ path: info.outputPath("queued-menu-open-page2.png"), fullPage: true });
});

test("the actual portrait Menu detail shows both canonical pages without making the queued snapshot publishable", async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const data = savedPreviewFixture("menu", "portrait"), run = await mountSavedPreview(page, data);
  await assertMenuPages(page);
  await assertPreviewDoesNotPublish(page, data);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(run.commands).toEqual([]); expect(run.errors).toEqual([]);
  await page.screenshot({ path: info.outputPath("queued-menu-portrait-page2.png"), fullPage: true });
});


for (const kind of ["rss", "menu"] as const) test(`the real library Eye action opens queued ${kind} CSS without an artifact, write or publication`, async ({ page }, info) => {
  const data = savedPreviewFixture(kind, kind === "rss" ? "portrait" : "landscape"), run = await mountSavedPreview(page, data, "/__saved/library");
  expect(await page.evaluate(() => (globalThis as unknown as { fixtureReads: unknown[] }).fixtureReads)).toEqual([]);
  await expect(page.getByRole("button", { name: `${data.libraryRows[0]!.name} aan playlist toevoegen`, exact: true })).toBeDisabled();
  await page.getByRole("button", { name: `${data.libraryRows[0]!.name} tonen`, exact: true }).click();
  await expect(page.getByRole("dialog", { name: data.libraryRows[0]!.name, exact: true })).toBeVisible();
  if (kind === "rss") await assertCanonicalRss(page, data);
  else await assertMenuPages(page);
  const frame = page.getByRole("dialog").locator('.vc-dialog__body > [data-orientation]');
  const canvas = frame.locator(kind === "rss" ? '.vc-slide-preview .screen' : '.vm-frame').first();
  await page.screenshot({ path: info.outputPath(`queued-library-${kind}-geometry.png`), fullPage: true });
  await expect.poll(async () => {
    const [outer, inner] = await Promise.all([frame.boundingBox(), canvas.boundingBox()]);
    return { outer, inner, contained: Boolean(outer && inner && inner.width > 200 && inner.height > 100 &&
      inner.x >= outer.x - 1 && inner.y >= outer.y - 1 &&
      inner.x + inner.width <= outer.x + outer.width + 1 &&
      inner.y + inner.height <= outer.y + outer.height + 1) };
  }).toMatchObject({ contained: true });
  await assertPreviewDoesNotPublish(page, data);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(run.commands).toEqual([]); expect(run.errors).toEqual([]);
  await page.screenshot({ path: info.outputPath(`queued-library-${kind}.png`), fullPage: true });
});
