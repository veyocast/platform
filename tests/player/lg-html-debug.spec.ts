import { expect, test } from "@playwright/test";

const playerURL = `http://127.0.0.1:${process.env.PLAYER_PORT ?? 3106}`;
const lgUserAgent =
  "Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.79 Safari/537.36 WebAppManager";

test.use({ userAgent: lgUserAgent });

test("LG HTML/CSS-diagnose rendert de echte legacy fixture zonder clientchunks", async ({
  page
}) => {
  const requestedUrls: string[] = [];
  page.on("request", (request) => requestedUrls.push(request.url()));
  await page.setViewportSize({ width: 1920, height: 1080 });

  await page.goto(`${playerURL}/lg/html-debug`);

  await expect(
    page.getByRole("heading", { name: "HTML/CSS-renderdiagnose" })
  ).toBeVisible();
  await expect(page.locator("#debug-code")).toHaveText(
    "LG-HTML-CSS-READY",
    { timeout: 12_000 }
  );
  await expect(page.locator("#production-fixture")).toBeVisible();
  await expect(page.locator("#fixture-title")).toBeVisible();
  await expect(page.locator("#check-layout .debug-mark")).toHaveText("OK");
  await expect(page.locator("#check-motion .debug-mark")).toHaveText("OK");
  await expect(page.locator("#check-asset .debug-mark")).toHaveText("OK");

  const state = await page.evaluate(() => {
    const fixture = document.getElementById("production-fixture");
    const stage = document.getElementById("debug-stage");
    const fixtureRect = fixture?.getBoundingClientRect();
    const stageRect = stage?.getBoundingClientRect();
    return {
      fixtureHeight: fixtureRect?.height ?? 0,
      fixtureWidth: fixtureRect?.width ?? 0,
      report: JSON.parse(
        localStorage.getItem("veyocast.player.lgHtmlDebug.v1") ?? "null"
      ) as { code?: string; results?: unknown[] } | null,
      stageHeight: stageRect?.height ?? 0,
      stageWidth: stageRect?.width ?? 0
    };
  });
  expect(state.fixtureWidth).toBeCloseTo(state.stageWidth, 0);
  expect(state.fixtureHeight).toBeCloseTo(state.stageHeight, 0);
  expect(state.report?.code).toBe("LG-HTML-CSS-READY");
  expect(state.report?.results?.length).toBe(8);
  expect(requestedUrls.some((url) => url.includes("/_next/"))).toBe(false);

  if (process.env.CAPTURE_LG_HTML_DEBUG === "1") {
    await page.screenshot({
      fullPage: true,
      path: "docs/screenshots/s92-lg-html-debug.png"
    });
  }
});

test("LG HTML/CSS-diagnose blijft leesbaar op een compact TV-renderoppervlak", async ({
  page
}) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await page.goto(`${playerURL}/lg/html-debug`);

  await expect(page.locator("#debug-code")).toHaveText(
    "LG-HTML-CSS-READY",
    { timeout: 12_000 }
  );
  await expect(page.locator("#production-fixture")).toBeVisible();
  const horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth
  );
  expect(horizontalOverflow).toBe(false);
});

test("de vier-randenfallback houdt de fixture fullscreen wanneer inset ontbreekt", async ({
  page
}) => {
  await page.addInitScript(() => {
    if (!window.CSS?.supports) return;
    const originalSupports = window.CSS.supports.bind(window.CSS);
    window.CSS.supports = ((property: string, value?: string) => {
      if (property === "inset") return false;
      return originalSupports(property, value ?? "");
    }) as typeof window.CSS.supports;
  });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(`${playerURL}/lg/html-debug`);

  await expect(page.locator("#debug-code")).toHaveText(
    "LG-HTML-CSS-READY",
    { timeout: 12_000 }
  );
  await expect(page.locator("#check-inset .debug-mark")).toHaveText("LET OP");
  await expect(page.locator("#check-inset")).toContainText(
    "INSET_FALLBACK_ACTIVE"
  );
  await expect(page.locator("#production-fixture")).toBeVisible();
});
