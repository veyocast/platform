import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { chromium, expect, test, type Page } from "@playwright/test";
import { mountS302Fixture, prepareS302Fixture, type s302Presentation, type S302Renderer, type S302Surface } from "../helpers/s302-programma-top-fixture";

test.use({ viewport: { width: 1920, height: 1080 }, launchOptions: { executablePath: chromium.executablePath(), args: ["--disable-dev-shm-usage", "--no-sandbox", "--num-raster-threads=1"] } });
let compilation: ReturnType<typeof prepareS302Fixture>;
test.beforeAll(() => {
  compilation = prepareS302Fixture();
  console.info(`S302 fixture compiled ${compilation.bundleSha256}`);
});

async function geometry(page: Page) {
  return page.locator(".matches-grid").evaluate(grid => {
    const rect = (element: Element) => { const box = element.getBoundingClientRect(); return { x: box.x, y: box.y, width: box.width, height: box.height }; };
    return {
      grid: rect(grid), columns: getComputedStyle(grid).gridTemplateColumns,
      cards: [...grid.querySelectorAll(".match-card")].map(card => ({
        card: rect(card), date: rect(card.querySelector(".match-meta")!),
        teams: [...card.querySelectorAll(".team-line")].map(line => ({ line: rect(line), logo: rect(line.querySelector(".club-logo")!), name: rect(line.querySelector("span")!), text: line.textContent })),
        kickoff: rect(card.querySelector(".kickoff")!),
      })),
    };
  });
}

async function assertPageContents(page: Page, fixtures: ReturnType<typeof s302Presentation>["fixtures"]) {
  const cards = page.locator(".matches-grid .match-card");
  await expect(cards).toHaveCount(fixtures.length);
  for (const [index, fixture] of fixtures.entries()) {
    const card = cards.nth(index);
    await expect(card.locator(".team-line span")).toHaveText([fixture.home.name, fixture.away.name]);
    await expect(card.locator(".match-meta > span")).toHaveText(new Intl.DateTimeFormat("nl-NL", { timeZone: "Europe/Amsterdam", weekday: "short", day: "numeric", month: "short" }).format(new Date(fixture.kickoffAt!)).toUpperCase());
    const kickoff = new Intl.DateTimeFormat("nl-NL", { timeZone: "Europe/Amsterdam", hour: "2-digit", minute: "2-digit" }).format(new Date(fixture.kickoffAt!));
    await expect(card.locator(".kickoff")).toContainText(kickoff);
    await expect(card.locator(".kickoff small")).toHaveText("AFTRAP");
    await expect(card.locator("img.club-logo")).toHaveCount(2);
    await expect(card.getByRole("img", { name: fixture.home.name + " logo", exact: true })).toBeVisible();
    await expect(card.getByRole("img", { name: fixture.away.name + " logo", exact: true })).toBeVisible();
  }
  expect(await cards.locator("img").evaluateAll(images => images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
}

const cases: Array<{ surface: S302Surface; tail: 1 | 2 | 3; renderer: S302Renderer }> = [
  ...(["control-preview", "player-media"] as const).flatMap(surface => ([3, 2, 1] as const).map(tail => ({ surface, tail, renderer: "sync-onzetrots-v9" as const }))),
  ...(["control-preview", "player-media"] as const).map(surface => ({ surface, tail: 3 as const, renderer: "sync-onzetrots-v1" as const })),
];
for (const { surface, tail, renderer } of cases) test(`S302 ${surface}/${renderer}: natural full6 to last${tail} retains top row and content`, async ({ page }, info) => {
  const state = await mountS302Fixture(page, surface, tail, renderer);
  await expect(page.locator(".page-indicator")).toHaveText("01 / 02");
  await assertPageContents(page, state.fixtures.slice(0, 6));
  const before = await geometry(page);
  expect(before.columns.split(" ")).toHaveLength(3);
  expect(before.cards[1]!.card.x).toBeGreaterThan(before.cards[0]!.card.x);
  expect(before.cards[2]!.card.x).toBeGreaterThan(before.cards[1]!.card.x);
  expect(before.cards[3]!.card.y).toBeGreaterThan(before.cards[0]!.card.y);
  const beforePath = info.outputPath("full-six.png");
  await page.screenshot({ path: beforePath });
  const geometryPath = info.outputPath("geometry.json");
  const evidence = {
    renderer, surface, tail, compilation,
    source: Object.fromEntries(["packages/content-templates/src/sync-onzetrots-view.tsx", "packages/content-templates/src/sync-onzetrots-matchday-styles.ts"].map(path => [path, createHash("sha256").update(readFileSync(path)).digest("hex")])),
    before, after: null as null | Awaited<ReturnType<typeof geometry>>,
    timing: { beforeAt: Date.now(), afterAt: null as null | number },
    evidenceBoundary: "Actual production component clocks and verified assets. No page override, seek, fake layout, provider, full Next/manifest/LKG boot or physical hardware claim.",
  };
  writeFileSync(geometryPath, JSON.stringify(evidence, null, 2));
  await info.attach("full-six", { path: beforePath, contentType: "image/png" });
  // Both components own this page change; no test setter, timer mock or remount.
  await expect(page.locator(".page-indicator")).toHaveText("02 / 02", { timeout: 10_000 });
  await assertPageContents(page, state.fixtures.slice(6));
  await page.evaluate(async () => { await document.fonts.ready; await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))); });
  const after = await geometry(page);
  evidence.after = after; evidence.timing.afterAt = Date.now();
  writeFileSync(geometryPath, JSON.stringify(evidence, null, 2));
  const afterPath = info.outputPath("last-page.png");
  await page.screenshot({ path: afterPath });
  await info.attach("last-page", { path: afterPath, contentType: "image/png" });
  await info.attach("actual-geometry", { path: geometryPath, contentType: "application/json" });
  expect(after.grid).toEqual(before.grid);
  expect(after.columns).toBe(before.columns);
  for (const [index, card] of after.cards.entries()) {
    const original = before.cards[index]!;
    expect(card.card.x).toBeCloseTo(original.card.x, 1);
    expect(card.card.y).toBeCloseTo(original.card.y, 1);
    expect(card.card.width).toBeCloseTo(original.card.width, 1);
    expect(card.card.height).toBeCloseTo(original.card.height, 1);
    expect(card.date.y).toBeCloseTo(original.date.y, 1);
    expect(card.kickoff.y).toBeCloseTo(original.kickoff.y, 1);
    for (const [teamIndex, team] of card.teams.entries()) {
      expect(team.line.y).toBeCloseTo(original.teams[teamIndex]!.line.y, 1);
      expect(team.logo).toEqual(original.teams[teamIndex]!.logo);
      expect(team.name.y).toBeCloseTo(original.teams[teamIndex]!.name.y, 1);
    }
  }
  expect(evidence.timing.afterAt - evidence.timing.beforeAt).toBeGreaterThan(500);
  expect(await page.evaluate(() => Reflect.get(globalThis, "s302Failure") ?? null)).toBeNull();
  if (surface === "player-media") expect(await page.evaluate(() => Reflect.get(globalThis, "s302Ready").length)).toBe(1);
  expect(state.errors).toEqual([]);
  expect(state.unexpectedRequests).toEqual([]);
});

for (const renderer of ["sync-onzetrots-v9", "sync-onzetrots-v1"] as const) test(`S302 ${renderer}: portrait, results, matchday and empty retain their own layout`, async ({ page }) => {
  const portrait = await mountS302Fixture(page, "control-preview", 3, renderer, { orientation: "portrait", count: 5 });
  const portraitRows = await page.locator(".matches-grid").evaluate(grid => ({
    columns: getComputedStyle(grid).gridTemplateColumns.split(" "),
    rows: getComputedStyle(grid).gridTemplateRows.split(" "),
    tops: [...grid.querySelectorAll(".match-card")].map(card => card.getBoundingClientRect().top),
    matchesLandscapeRule: grid.matches(".screen:not(.portrait) .program-panel .matches-grid"),
  }));
  expect(portraitRows.columns).toHaveLength(1);
  expect(portraitRows.rows).toHaveLength(5);
  expect(portraitRows.matchesLandscapeRule).toBe(false);
  expect(portraitRows.tops.every((top, index) => index === 0 || top > portraitRows.tops[index - 1]!)).toBe(true);
  expect(portrait.errors).toEqual([]);
  expect(portrait.unexpectedRequests).toEqual([]);

  const results = await mountS302Fixture(page, "control-preview", 3, renderer, { family: "results", count: 3 });
  await expect(page.locator(".program-panel")).toHaveCount(0);
  await expect(page.locator(".matches-grid .match-card")).toHaveCount(3);
  expect(await page.locator(".matches-grid").evaluate(grid => getComputedStyle(grid).gridTemplateRows.split(" ").length)).toBe(1);
  await expect(page.locator(".team-line b")).toHaveText(["0", "0", "1", "0", "2", "0"]);
  expect(results.errors).toEqual([]);
  expect(results.unexpectedRequests).toEqual([]);

  const matchday = await mountS302Fixture(page, "control-preview", 3, renderer, { family: "matchday" });
  await expect(page.locator(".dashboard-fixtures")).toBeVisible();
  await expect(page.locator(".dashboard-results")).toBeVisible();
  await expect(page.locator(".program-panel")).toHaveCount(0);
  await expect(page.locator(".matches-grid")).toHaveCount(0);
  expect(matchday.errors).toEqual([]);
  expect(matchday.unexpectedRequests).toEqual([]);

  const empty = await mountS302Fixture(page, "control-preview", 3, renderer, { count: 0 });
  await expect(page.locator(".program-panel")).toHaveCount(0);
  await expect(page.getByText("Er zijn nog geen wedstrijden beschikbaar.", { exact: true })).toBeVisible();
  expect(empty.errors).toEqual([]);
  expect(empty.unexpectedRequests).toEqual([]);
});
