import { mkdirSync } from "node:fs";
import path from "node:path";

import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const evidenceEnabled = process.env.S146_VISUAL_EVIDENCE === "1";
const playlistId = process.env.S146_VISUAL_PLAYLIST_ID;
const releaseId = process.env.S146_VISUAL_RELEASE_ID;
const outputRoot = path.resolve(
  process.env.S146_VISUAL_OUTPUT_ROOT ??
    path.join("docs", "screenshots", "s146")
);

const viewports = [
  { height: 900, name: "1440x900", width: 1440 },
  { height: 844, name: "390x844", width: 390 }
] as const;

const themes = ["light", "dark"] as const;

async function authenticate(context: BrowserContext) {
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("E-mailadres").fill("pilot-admin@veyocast.test");
  await page.getByLabel("Wachtwoord").fill("veyocast-local");
  await page.getByRole("button", { name: "Doorgaan" }).click();
  await expect(page).toHaveURL(/\/context/);
  await page.getByRole("button", { name: "Open vereniging" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.close();
}

async function preparePage(
  context: BrowserContext,
  theme: (typeof themes)[number],
  viewport: (typeof viewports)[number]
) {
  const page = await context.newPage();
  await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
  await page.addInitScript((selectedTheme) => {
    window.localStorage.setItem("veyocast-control-theme", selectedTheme);
    window.localStorage.setItem("veyocast-control-density", "comfortable");
  }, theme);
  await page.setViewportSize(viewport);
  return page;
}

async function settle(page: Page) {
  await page.waitForLoadState("domcontentloaded");
  await page.addStyleTag({
    content:
      "nextjs-portal{display:none!important}*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition:none!important;caret-color:transparent!important}"
  });
  await page.evaluate(async () => {
    await document.fonts.ready;
    document.querySelector<HTMLElement>(".control-main")?.scrollTo(0, 0);
  });
  await expect(page.locator("html")).toHaveAttribute("data-theme", /light|dark/);
}

async function capture(page: Page, name: string) {
  await settle(page);
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations, `${name} heeft geen accessibility-overtredingen`).toEqual([]);
  const journeySteps = page.locator(".vc-journey-shell__steps");
  const currentStep = journeySteps.locator('[aria-current="step"]');
  if (await currentStep.count()) {
    const [stepsBox, currentBox] = await Promise.all([
      journeySteps.boundingBox(),
      currentStep.boundingBox()
    ]);
    expect(stepsBox, `${name} toont de voortgangsnavigatie`).not.toBeNull();
    expect(currentBox, `${name} toont de actuele stap`).not.toBeNull();
    if (stepsBox && currentBox) {
      expect(currentBox.x, `${name} houdt de actuele stap links in beeld`).toBeGreaterThanOrEqual(
        stepsBox.x - 1
      );
      expect(
        currentBox.x + currentBox.width,
        `${name} houdt de actuele stap rechts in beeld`
      ).toBeLessThanOrEqual(stepsBox.x + stepsBox.width + 1);
    }
  }
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  expect(dimensions.scrollWidth, `${name} blijft binnen de viewport`).toBeLessThanOrEqual(
    dimensions.clientWidth
  );
  await page.screenshot({
    animations: "disabled",
    fullPage: true,
    path: path.join(outputRoot, `${name}.png`)
  });
}

test.describe("S146 Studio and Publisher visual evidence", () => {
  test.skip(!evidenceEnabled, "requires explicit local S146 evidence opt-in");
  test.use({ actionTimeout: 15_000 });
  test.setTimeout(900_000);

  test("captures aggregate teams, targets, preflight and release detail", async ({
    browser
  }) => {
    if (!playlistId || !releaseId) {
      throw new Error("S146 visual evidence requires playlist and release fixture IDs.");
    }
    mkdirSync(outputRoot, { recursive: true });
    const context = await browser.newContext();
    await authenticate(context);

    for (const theme of themes) {
      for (const viewport of viewports) {
        const suffix = `${viewport.name}-${theme}`;

        const studio = await preparePage(context, theme, viewport);
        await studio.goto("/dashboard/studio/sportlink/new");
        await expect(
          studio.getByRole("heading", { level: 1, name: "Inhoud kiezen" })
        ).toBeVisible();
        await studio.getByRole("button", { name: "Bezoekers welkom" }).click();
        await studio.getByRole("button", { name: "Scheidsrechters welkom" }).click();
        await studio.getByRole("button", { exact: true, name: "Volgende" }).click();
        await expect(
          studio.getByRole("heading", { name: "Welke teams horen erbij?" })
        ).toBeVisible();
        const teamPickers = studio.locator(".vc-multi-select");
        await expect(teamPickers).toHaveCount(2);
        for (let index = 0; index < 2; index += 1) {
          await teamPickers.nth(index).locator(".vc-multi-select__trigger").click();
          await teamPickers.nth(index).getByRole("button", { name: "Alle teams selecteren" }).click();
          await teamPickers.nth(index).locator(".vc-multi-select__trigger").click();
        }
        await expect(studio.getByText("22 teams geselecteerd")).toHaveCount(2);
        await capture(studio, `sportlink-teams-${suffix}`);
        await studio.close();

        const targets = await preparePage(context, theme, viewport);
        await targets.goto(`/dashboard/playlists/${playlistId}/publish`);
        await expect(targets.getByRole("heading", { name: /publiceren$/ })).toBeVisible();
        const next = targets.locator(".vc-sticky-action-bar").getByRole("button", { name: "Volgende" });
        await next.click();
        await next.click();
        await expect(
          targets.getByRole("heading", { name: "Doelschermen kiezen" })
        ).toBeVisible();
        await capture(targets, `playlist-targets-${suffix}`);
        await targets.getByRole("checkbox").first().check();
        await next.click();
        await expect(
          targets.getByRole("heading", { name: "Preflight per scherm" })
        ).toBeVisible();
        await capture(targets, `playlist-preflight-${suffix}`);
        await targets.close();

        const detail = await preparePage(context, theme, viewport);
        await detail.goto(`/dashboard/publications/${releaseId}`);
        await expect(detail.getByRole("heading", { level: 1 })).toBeVisible();
        await expect(detail.getByText("Beschikbare doelschermen")).toBeVisible();
        await capture(detail, `publication-detail-${suffix}`);
        await detail.close();
      }
    }

    await context.close();
  });
});
