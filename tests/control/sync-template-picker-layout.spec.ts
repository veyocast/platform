import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { syncContentFamilies } from "../../packages/contracts/src/sync-content-families";
import type { StudioDocument } from "../../packages/studio/src/schema";

// Actual chooser, renderer, Radix portal and product CSS. Only the server action
// and navigation transport are controlled; this is not live publication proof.
const origin = "http://127.0.0.1:3385";
const require = createRequire(join(process.cwd(), "package.json"));
const compiler = require.resolve("esbuild", { paths: [require.resolve("tsx")] });
let bundle: { js: string; css: string };

test.beforeAll(() => {
  const entry = `import React,{useState}from'react';import{createRoot}from'react-dom/client';import{DialogPortalProvider}from'@veyocast/ui';import{SyncStudioCreateDialog}from'./apps/control/app/(shell)/dashboard/studio/sync-studio-create-dialog';function App(){const[portal,setPortal]=useState(null),[scope,setScope]=useState('23400000-0000-4000-8000-000000000001:23400000-0000-4000-8000-000000000003');globalThis.setPickerActor=setScope;return <div className="sync-control app-shell" style={{display:'block'}} ref={setPortal}><DialogPortalProvider container={portal}><main id="control-content"><h1>Templatekiezercontrole</h1><SyncStudioCreateDialog tenantId="23400000-0000-4000-8000-000000000001" tenantName="Acceptatieclub" actorScope={scope} canCreate={globalThis.fixtureCanCreate}/></main></DialogPortalProvider></div>}createRoot(document.getElementById('root')).render(<App/>);`;
  const script = `const result=await require(${JSON.stringify(compiler)}).build({stdin:{contents:${JSON.stringify(entry)},resolveDir:process.cwd(),loader:'tsx'},nodePaths:[process.cwd()+'/apps/control/node_modules'],bundle:true,write:false,outfile:'fixture.js',platform:'browser',format:'iife',jsx:'automatic',loader:{'.module.css':'local-css','.css':'css'},plugins:[{name:'controlled-boundaries',setup(b){b.onResolve({filter:/sync-create-wizard-actions$/},a=>({path:a.path,namespace:'actions'}));b.onLoad({filter:/.*/,namespace:'actions'},()=>({contents:'export async function resolveSyncCreationReceiptAction(input,scope){const r=await fetch("/__picker/receipt",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({input,scope})});if(!r.ok)throw Error("Transport unavailable");return r.json()}',loader:'js'}));b.onResolve({filter:/^next\\/navigation$/},a=>({path:a.path,namespace:'navigation'}));b.onLoad({filter:/.*/,namespace:'navigation'},()=>({contents:'export function useRouter(){return{push:path=>{globalThis.visited=(globalThis.visited||[]).concat(path)}}}',loader:'js'}));}}]});const js=result.outputFiles.find(f=>f.path.endsWith('.js'))?.text,css=result.outputFiles.find(f=>f.path.endsWith('.css'))?.text??'';if(!js)throw Error('Missing fixture JavaScript');process.stdout.write(JSON.stringify({js,css}));`;
  bundle = JSON.parse(execFileSync(process.execPath, ["-e", `(async()=>{${script}})().catch(e=>{console.error(e);process.exitCode=1})`], {
    encoding: "utf8", timeout: 30_000, maxBuffer: 16 * 1024 * 1024,
  }));
});

type Command = { document: StudioDocument; idempotencyKey: string };
async function mount(page: Page, options: { dropFirst?: boolean; viewer?: boolean } = {}) {
  const errors: string[] = [], commands: Command[] = [], receiptReads: unknown[] = [];
  const receipts = new Map<string, string>();
  page.on("pageerror", error => errors.push(error.message));
  const css = ["tokens/veyocast-design-tokens.css", "packages/ui/src/styles.css", "apps/control/app/globals.css", "apps/control/app/fieldflow.css", "apps/control/app/sync-source.css", "apps/control/app/sync-adapter.css"]
    .map(path => readFileSync(path, "utf8").replace(/@import[^;]+;/g, "")).join("\n");
  await page.route(`${origin}/assets/*`, route => {
    const name = new URL(route.request().url()).pathname.split("/").at(-1)!;
    if (!/^[a-zA-Z0-9_.-]+$/.test(name)) return route.abort();
    return route.fulfill({ body: readFileSync(join(process.cwd(), "apps/control/public/assets", name)), contentType: name.endsWith("woff2") ? "font/woff2" : name.endsWith("ttf") ? "font/ttf" : "image/webp" });
  });
  await page.route(`${origin}/__picker/create`, route => {
    const command = route.request().postDataJSON() as Command;
    commands.push(command);
    if (!receipts.has(command.idempotencyKey)) receipts.set(command.idempotencyKey, "23400000-0000-4000-8000-000000000002");
    if (options.dropFirst && commands.length === 1) return route.abort();
    return route.fulfill({ json: { ok: true, projectId: receipts.get(command.idempotencyKey) } });
  });
  await page.route(`${origin}/__picker/receipt`, route => { receiptReads.push(route.request().postDataJSON()); return route.fulfill({ json: { ok: true, href: "/dashboard/studio/23400000-0000-4000-8000-000000000002" } }); });
  await page.route(`${origin}/__picker/fixture`, route => route.fulfill({
    contentType: "text/html",
    body: `<!doctype html><html lang="nl" data-design-system="fieldflow"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Templatekiezer · VeyoCast</title><style>${css}\n${bundle.css}</style></head><body><div id="root"></div><script>globalThis.fixtureCanCreate=${!options.viewer};${bundle.js.replace(/<\/script/gi, "<\\/script")}</script></body></html>`,
  }));
  await page.goto(`${origin}/__picker/fixture`);
  const trigger = page.getByRole("button", { name: "Nieuw ontwerp", exact: true });
  if (!options.viewer) {
    // Recovery opens the actual dialog automatically; avoid toggling it closed.
    if (!await page.getByRole("dialog").isVisible()) await trigger.click();
    await expect(page.getByRole("dialog", { name: "Wat wil je maken?" })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
  }
  return { errors, commands, receipts, receiptReads, trigger };
}

for (const width of [390, 1440]) {
  test(`all 36 choices retain complete preview and readable names at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const fixture = await mount(page);
    const dialog = page.getByRole("dialog", { name: "Wat wil je maken?" });
    const cards = dialog.locator(".vc-template-card");
    await expect(cards).toHaveCount(36);
    const measurements = await cards.evaluateAll(elements => elements.map(element => {
      const rectangle = (node: Element) => {
        const { x, y, width, height, bottom, right } = node.getBoundingClientRect();
        return { x, y, width, height, bottom, right };
      };
      return {
        card: rectangle(element),
        preview: rectangle(element.querySelector(".vc-slide-preview")!),
        title: rectangle(element.querySelector(":scope > span > strong")!),
        description: rectangle(element.querySelector(":scope > span > small")!),
        name: element.querySelector(":scope > span > strong")!.textContent,
        copy: element.querySelector(":scope > span > small")!.textContent,
        clientHeight: element.clientHeight, scrollHeight: element.scrollHeight,
      };
    }));
    await info.attach("actual-card-geometry", { body: JSON.stringify(measurements, null, 2), contentType: "application/json" });
    await info.attach("actual-picker", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
    await expect(dialog).toHaveCSS("width", width === 390 ? "370px" : "960px");
    await expect(dialog).toHaveCSS("border-radius", width === 390 ? "18px" : "22px");
    await expect(dialog.locator(":scope > header")).toHaveCSS("padding", width === 390 ? "18px" : "22px 26px");
    await expect(dialog.locator(":scope > header > h2")).toHaveCSS("font-size", width === 390 ? "17px" : "19px");
    await expect(dialog.locator(":scope > header > h2")).toHaveCSS("font-weight", "750");
    await expect(dialog.locator(":scope > header > h2")).toHaveCSS("color", "rgb(18, 46, 50)");
    await expect(dialog.locator(".vc-dialog__body > .vc-dialog__description")).toHaveCount(1);
    await expect(dialog.getByText("Opmaakvoorbeelden. In de volgende stap kies je je eigen gegevens.", { exact: true })).toHaveCSS("font-size", "14px");
    await expect(dialog.locator(":scope > header .vc-dialog__description")).toHaveCount(0);
    await expect(dialog.locator(":scope > header").getByRole("button", { name: "Sluiten", exact: true })).toHaveCSS("width", "44px");
    await expect(dialog.locator(":scope > header").getByRole("button", { name: "Sluiten", exact: true })).toHaveCSS("height", "44px");
    expect(measurements.map(value => value.name)).toEqual(syncContentFamilies.map(family => family.name));
    expect(measurements.map(value => value.copy)).toEqual(syncContentFamilies.map(family => family.description));
    for (const value of measurements) {
      expect(value.preview.width, value.name!).toBeCloseTo(value.preview.height * 16 / 9, 1);
      expect(value.card.height, value.name!).toBeGreaterThanOrEqual(44);
      expect(value.preview.bottom, `${value.name}: complete preview`).toBeLessThanOrEqual(value.card.bottom);
      expect(value.title.y, `${value.name}: title follows preview`).toBeGreaterThanOrEqual(value.preview.bottom);
      expect(value.description.bottom, `${value.name}: unclipped description`).toBeLessThanOrEqual(value.card.bottom);
      expect(value.scrollHeight, `${value.name}: no clipped card content`).toBeLessThanOrEqual(value.clientHeight);
    }
    await cards.last().scrollIntoViewIfNeeded();
    await expect(cards.last()).toBeInViewport({ ratio: 1 });
    await expect(cards.last().locator(":scope > span > strong")).toBeInViewport({ ratio: 1 });
    await expect(cards.last().locator(":scope > span > small")).toBeInViewport({ ratio: 1 });
    const verticalScrollers = await dialog.evaluate(element => [element, element.querySelector(".vc-dialog__body")!, element.querySelector(".vc-template-grid")!]
      .filter(node => ["auto", "scroll"].includes(getComputedStyle(node).overflowY) && node.scrollHeight > node.clientHeight + 1).length);
    expect(verticalScrollers).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(fixture.commands).toEqual([]);
    expect(fixture.errors).toEqual([]);
  });

  test(`group filters, keyboard, touch targets and accessibility at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const fixture = await mount(page);
    const dialog = page.getByRole("dialog", { name: "Wat wil je maken?" });
    const tabs = dialog.locator(".vc-modal-family-tabs");
    for (const group of ["Alles", "Sport", "Kantine", "Club", "Media", "Vrij"]) {
      const tab = tabs.getByRole("button", { name: group, exact: true });
      await tab.click();
      await expect(tab).toHaveAttribute("aria-pressed", "true");
      await expect(dialog.locator(".vc-template-card > span > strong")).toHaveText(syncContentFamilies.filter(family => group === "Alles" || family.group === group).map(family => family.name));
      expect((await tab.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      expect((await tab.boundingBox())!.width).toBeGreaterThanOrEqual(44);
    }
    await tabs.getByRole("button", { name: "Alles", exact: true }).click();
    if (width === 390) {
      await expect(tabs.getByRole("button", { name: "Alles", exact: true })).toHaveCSS("width", "55px");
      expect(await tabs.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    const cards = dialog.locator(".vc-template-card");
    await cards.first().focus();
    for (let index = 1; index < 36; index++) await page.keyboard.press("Tab");
    await expect(cards.last()).toBeFocused();
    await expect(cards.last().locator(":scope > span > small")).toBeInViewport({ ratio: 1 });
    const violations = (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze()).violations;
    expect(violations).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(fixture.trigger).toBeFocused();
    expect(fixture.commands).toEqual([]);
    expect(fixture.errors).toEqual([]);
  });
}

test("choosing a family opens its real wizard without creating a project", async ({ page }) => {
  const fixture = await mount(page);
  const dialog = page.getByRole("dialog", { name: "Wat wil je maken?" });
  await dialog.locator(".vc-modal-family-tabs").getByRole("button", { name: "Vrij", exact: true }).click();
  await dialog.getByRole("button", { name: /^Vrij ontwerp / }).click();
  await expect.poll(() => page.evaluate(() => (globalThis as typeof globalThis & { visited?: string[] }).visited)).toEqual(["/dashboard/studio/new?family=free"]);
  expect(fixture.commands).toEqual([]); expect(fixture.receiptReads).toEqual([]);
  expect(fixture.errors).toEqual([]);
});

for (const width of [390, 700, 1440]) {
  test(`gallery metadata preserves the standalone slide typography at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const fixture = await mount(page);
    const cards = page.getByRole("dialog", { name: "Wat wil je maken?" }).locator(".vc-template-card");
    await expect(cards).toHaveCount(36);
    await page.getByRole("dialog", { name: "Wat wil je maken?" }).evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished)));
    const comparisons = await cards.evaluateAll(elements => elements.map(element => {
      const root = element.querySelector<HTMLElement>(".sync-slide-root")!;
      const original = root.querySelectorAll("strong, small");
      const standalone = root.cloneNode(true) as HTMLElement;
      Object.assign(standalone.style, { position: "fixed", left: "-20000px", top: "0", width: getComputedStyle(root).width, visibility: "hidden" });
      element.closest(".sync-control")!.appendChild(standalone);
      try {
        const counterparts = standalone.querySelectorAll("strong, small");
        const styles = (node: Element) => {
          const css = getComputedStyle(node);
          return { fontSize: css.fontSize, lineHeight: css.lineHeight, color: css.color, paddingRight: css.paddingRight };
        };
        return {
          family: element.querySelector(":scope > span > strong")!.textContent,
          canvasWidth: root.querySelector(".vc-slide-preview")!.getBoundingClientRect().width,
          standaloneWidth: standalone.querySelector(".vc-slide-preview")!.getBoundingClientRect().width,
          text: [...original].map((node, index) => ({ text: node.textContent, actual: styles(node), standalone: styles(counterparts[index]!) })),
        };
      } finally {
        standalone.remove();
      }
    }));
    await info.attach("native-gallery-standalone-typography", { body: JSON.stringify(comparisons, null, 2), contentType: "application/json" });
    await info.attach("native-gallery-preview", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
    for (const comparison of comparisons) {
      expect(comparison.canvasWidth, comparison.family!).toBeCloseTo(comparison.standaloneWidth, 1);
      expect(comparison.text.length, comparison.family!).toBeGreaterThan(0);
      for (const row of comparison.text) expect(row.actual, `${comparison.family}: ${row.text}`).toEqual(row.standalone);
    }
    expect(fixture.commands).toEqual([]);
    expect(fixture.receiptReads).toEqual([]);
    expect(fixture.errors).toEqual([]);
  });
}

test("an old unbound command is retained and only its current-actor receipt is inspected", async ({ page }) => {
  const fixture = await mount(page);
  const original = JSON.stringify({ tenantId: "23400000-0000-4000-8000-000000000001", idempotencyKey: "23400000-0000-4000-8000-000000000004", document: { original: "unbound command retained" } });
  const key = "veyocast-sync-create-v1:23400000-0000-4000-8000-000000000001";
  await page.evaluate(({key,original}) => sessionStorage.setItem(key, original), {key,original});
  await page.reload(); await fixture.trigger.click();
  await page.getByRole("button", { name: "Eerder ontvangstbewijs controleren" }).click();
  await expect.poll(() => fixture.receiptReads.length).toBe(1);
  expect(fixture.receiptReads[0]).toEqual({ input: { idempotencyKey: "23400000-0000-4000-8000-000000000004" }, scope: "23400000-0000-4000-8000-000000000001:23400000-0000-4000-8000-000000000003" });
  expect(await page.evaluate(key => sessionStorage.getItem(key), key)).toBe(original);
  expect(fixture.commands).toEqual([]); expect(fixture.receipts.size).toBe(0);
  await expect.poll(() => page.evaluate(() => (globalThis as typeof globalThis & { visited?: string[] }).visited)).toEqual(["/dashboard/studio/23400000-0000-4000-8000-000000000002"]);
  expect(fixture.errors).toEqual([]);
});

test("viewer cannot open creation or issue a command", async ({ page }) => {
  const fixture = await mount(page, { viewer: true });
  await expect(fixture.trigger).toBeDisabled();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(fixture.commands).toEqual([]);
  expect(fixture.errors).toEqual([]);
});


test("a changed actor unlocks its chooser and old receipt completion cannot unlock a new read", async ({ page }) => {
  const fixture = await mount(page);
  const key = "veyocast-sync-create-v1:23400000-0000-4000-8000-000000000001";
  const original = JSON.stringify({ tenantId: "23400000-0000-4000-8000-000000000001", idempotencyKey: "23400000-0000-4000-8000-000000000004" });
  await page.evaluate(({ key, original }) => sessionStorage.setItem(key, original), { key, original });
  await page.reload(); await fixture.trigger.click();
  type Held = { body: unknown; finish: () => Promise<void> };
  const held: Held[] = [];
  await page.route(`${origin}/__picker/receipt`, async route => {
    await new Promise<void>(resolve => held.push({ body: route.request().postDataJSON(), finish: async () => { await route.fulfill({ json: { ok: true, href: null } }); resolve(); } }));
  });
  const read = page.getByRole("button", { name: "Eerder ontvangstbewijs controleren", exact: true });
  await read.click(); await expect.poll(() => held.length).toBe(1);
  await page.evaluate(() => (globalThis as typeof globalThis & { setPickerActor: (scope: string) => void }).setPickerActor("23400000-0000-4000-8000-000000000001:23400000-0000-4000-8000-000000000005"));
  await expect(read).toBeEnabled();
  await read.click(); await expect.poll(() => held.length).toBe(2);
  await held[0]!.finish();
  await expect(page.getByRole("button", { name: "Ontvangstbewijs controleren…", exact: true })).toBeDisabled();
  await held[1]!.finish(); await expect(read).toBeEnabled();
  await read.click(); await expect.poll(() => held.length).toBe(3); await held[2]!.finish(); await expect(read).toBeEnabled();
  expect(held.map(value => (value.body as { scope: string }).scope)).toEqual([
    "23400000-0000-4000-8000-000000000001:23400000-0000-4000-8000-000000000003",
    "23400000-0000-4000-8000-000000000001:23400000-0000-4000-8000-000000000005",
    "23400000-0000-4000-8000-000000000001:23400000-0000-4000-8000-000000000005",
  ]);
  expect(await page.evaluate(key => sessionStorage.getItem(key), key)).toBe(original);
  expect(fixture.commands).toEqual([]); expect(fixture.errors).toEqual([]);
});
