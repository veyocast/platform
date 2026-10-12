import { expect, test, type Route } from "@playwright/test";

const playerURL = `http://127.0.0.1:${process.env.PLAYER_PORT ?? 3106}`;

test("shows only a compact offline status while cached playback continues", async ({
  context,
  page
}) => {
  await page.goto(`${playerURL}/?deviceToken=demo-online&durationMs=5000`);

  await expect(page.getByLabel("Release playback")).toBeVisible();
  await expect(page.getByLabel("Player diagnostics")).not.toBeVisible();
  await expect(page.getByText("Geen internetverbinding", { exact: true })).toHaveCount(0);

  await context.setOffline(true);
  try {
    await expect(page.getByRole("status")).toHaveText("Geen internetverbinding");
    await expect(page.getByLabel("Release playback")).toBeVisible();
    await expect(page.getByLabel("Player diagnostics")).toContainText(
      "OFFLINE_PLAYING"
    );
  } finally {
    await context.setOffline(false);
  }

  await expect(page.getByText("Geen internetverbinding", { exact: true })).toHaveCount(0);
});

test("detects an unreachable Player API behind an online network interface", async ({
  page
}) => {
  await page.goto(`${playerURL}/?deviceToken=demo-online&durationMs=5000`);
  await expect(page.getByLabel("Release playback")).toBeVisible();

  await page.route("**/api/player/**", (route) => route.abort("internetdisconnected"));
  await page.goto(`${playerURL}/?durationMs=5000&syncMs=250`);

  await expect(page.getByLabel("Release playback")).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("Geen internetverbinding");
  expect(await page.evaluate(() => navigator.onLine)).toBe(true);
});

for (const reachable of [false, true]) {
  test(`an offline hint cancels a held manifest and verifies the ${reachable ? "reachable" : "unreachable"} origin`, async ({ page }) => {
    await page.addInitScript(() => {
      const nativeFetch = window.fetch.bind(window);
      window.fetch = (input, init) => {
        if (input === "/api/player/manifest" && document.documentElement.dataset.testObserveManifest === "true") {
          init?.signal?.addEventListener("abort", () => {
            document.documentElement.dataset.testManifestAborts = String(
              Number(document.documentElement.dataset.testManifestAborts ?? 0) + 1
            );
          }, { once: true });
        }
        return nativeFetch(input, init);
      };
    });
    await page.goto(`${playerURL}/?deviceToken=demo-online&durationMs=5000`);
    await expect(page.getByLabel("Release playback")).toBeVisible();
    await expect(page.getByLabel("Player diagnostics")).toContainText("PLAYING");
    await expect(page.getByLabel("Player diagnostics")).not.toContainText("OFFLINE_PLAYING");

    let held: Route | undefined;
    let manifestRequests = 0;
    let originVerified = false;
    const originRoute = "**/api/player/**";
    const manifestRoute = "**/api/player/manifest";
    page.on("response", (response) => {
      if (new URL(response.url()).pathname === "/api/player/manifest" && manifestRequests >= 2 &&
          (response.ok() || response.status() === 304)) originVerified = true;
    });
    await page.route(originRoute, (route) => reachable ? route.continue() : route.abort("internetdisconnected"));
    await page.route(manifestRoute, (route) => {
      manifestRequests += 1;
      if (manifestRequests === 1) { held = route; return; }
      return reachable ? route.continue() : route.abort("internetdisconnected");
    });
    try {
      await page.evaluate(() => {
        document.documentElement.dataset.testObserveManifest = "true";
        window.dispatchEvent(new Event("online"));
      });
      await expect.poll(() => held !== undefined).toBe(true);
      expect(await page.evaluate(() => Number(document.documentElement.dataset.testManifestAborts ?? 0))).toBe(0);
      // A browser hint alone must cancel the actual held fetch. Keeping the
      // network enabled prevents Chromium itself from supplying that abort.
      await page.evaluate(() => {
        Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false });
        window.dispatchEvent(new Event("offline"));
      });
      await expect.poll(() => page.evaluate(() =>
        Number(document.documentElement.dataset.testManifestAborts ?? 0)
      )).toBeGreaterThanOrEqual(1);
      await expect.poll(() => manifestRequests).toBeGreaterThanOrEqual(2);
      await expect(page.getByLabel("Release playback")).toBeVisible();
      await expect(page.getByLabel("Player diagnostics")).toContainText("Zomerroute v3");
      if (reachable) {
        await expect.poll(() => originVerified).toBe(true);
        await expect(page.getByLabel("Player diagnostics")).not.toContainText("OFFLINE_PLAYING");
        await expect(page.getByText("Geen internetverbinding", { exact: true })).toHaveCount(0);
      } else {
        await expect(page.getByRole("status")).toHaveText("Geen internetverbinding");
        await expect(page.getByLabel("Player diagnostics")).toContainText("OFFLINE_PLAYING");
      }
      expect(await page.evaluate(() => navigator.onLine)).toBe(false);
    } finally {
      await held?.abort().catch(() => undefined);
      await page.unroute(manifestRoute);
      await page.unroute(originRoute);
    }
  });
}
