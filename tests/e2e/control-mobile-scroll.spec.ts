import { mkdirSync } from "node:fs";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

test.use({
  deviceScaleFactor: 3,
  hasTouch: true,
  isMobile: true,
  userAgent:
    "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) SamsungBrowser/28.0 Chrome/130.0.0.0 Mobile Safari/537.36"
});

const routes = [
  "/dashboard",
  "/dashboard/screens",
  "/dashboard/playlists",
  "/dashboard/media",
  "/dashboard/planning",
  "/dashboard/studio",
  "/dashboard/screens/groups",
  "/dashboard/publications",
  "/dashboard/playlist-templates",
  "/dashboard/sources",
  "/dashboard/settings",
  "/dashboard/team",
  "/dashboard/support",
  "/dashboard/activity",
  "/platform"
] as const;

const viewports = [
  { height: 640, width: 390 },
  { height: 844, width: 430 }
] as const;

async function assertPageEndIsReachable(page: Page, pathname: string) {
  await expect(async () => {
    try {
      await page.goto(pathname, { waitUntil: "domcontentloaded" });
    } catch (error) {
      if (!String(error).includes("ERR_ABORTED")) throw error;
    }
    await expect(page).toHaveURL(
      new RegExp(`${pathname.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`)
    );
    await expect(page.locator("#control-content")).toBeVisible();
    // Broadcast previews are images inside the workspace, not page landmarks.
    await expect(page.getByRole("main")).toHaveCount(1);
    await expect(
      page.getByRole("main").getByRole("heading", { level: 1 }).first()
    ).toBeVisible();
  }).toPass({ timeout: 120_000 });

  const metrics = await page.getByRole("main").evaluate((element) => {
    const content = element.querySelector<HTMLElement>("#control-content");
    // RSC streaming can append a script after the final workspace. Measure
    // actual visible content, so a zero-height transport node cannot make this
    // reachability assertion pass without reaching the page itself.
    const pageContent = content ? Array.from(content.children).filter(
      (child): child is HTMLElement => child instanceof HTMLElement &&
        !["SCRIPT", "STYLE"].includes(child.tagName) &&
        child.getBoundingClientRect().height > 0 &&
        getComputedStyle(child).visibility !== "hidden"
    ).at(-1) ?? null : null;
    const mobileNavigation = document.querySelector<HTMLElement>(
      ".vx-bottomnav"
    );
    if (!content || !pageContent) return null;

    element.scrollTop = element.scrollHeight;

    const mainBox = element.getBoundingClientRect();
    const pageBox = pageContent.getBoundingClientRect();
    const navigationBox = mobileNavigation?.getBoundingClientRect();
    return {
      pageBottom: Math.round(pageBox.bottom),
      visibleBottom: Math.round(navigationBox?.top ?? mainBox.bottom)
    };
  });

  expect(metrics, `${pathname} heeft meetbare mobiele inhoud`).not.toBeNull();
  expect(
    metrics!.pageBottom,
    `${pathname} kan volledig boven de vaste navigatie worden gescrold`
  ).toBeLessThanOrEqual(metrics!.visibleBottom);
}

test("keeps every Control workspace reachable on mobile viewports", async ({
  page
}) => {
  test.setTimeout(900_000);
  const evidenceDirectory = process.env.MOBILE_SCROLL_EVIDENCE_DIR
    ? path.resolve(process.env.MOBILE_SCROLL_EVIDENCE_DIR)
    : null;
  if (evidenceDirectory) mkdirSync(evidenceDirectory, { recursive: true });

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    for (const pathname of routes) {
      await assertPageEndIsReachable(page, pathname);
      if (evidenceDirectory) {
        const routeName = pathname.replace(/^\/+|\/+$/g, "").replaceAll("/", "-");
        await page.screenshot({
          path: path.join(
            evidenceDirectory,
            `${routeName}-${viewport.width}x${viewport.height}-bottom.png`
          )
        });
      }
    }
  }
});
