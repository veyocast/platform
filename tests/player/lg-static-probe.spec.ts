import { expect, test } from "@playwright/test";

const playerURL = `http://127.0.0.1:${process.env.PLAYER_PORT ?? 3106}`;

test("statische LG-probe draait zonder clientchunks en behoudt playeropslag", async ({
  page
}) => {
  const requestedUrls: string[] = [];
  page.on("request", (request) => requestedUrls.push(request.url()));
  await page.addInitScript(() => {
    localStorage.setItem(
      "veyocast.player.instanceId",
      "12345678-1234-4123-8123-123456789abc"
    );
    localStorage.setItem("veyocast.player.pairingCode", "BEHOUD MIJ");
  });

  await page.goto(`${playerURL}/lg/probe`);

  await expect(
    page.getByRole("heading", {
      name: "We meten wat deze televisie werkelijk kan"
    })
  ).toBeVisible();
  await expect(page.locator("#result-code")).toHaveText("LG-UNPAIRED", {
    timeout: 15_000
  });
  await expect(page.locator("#step-platform .mark")).toHaveText("OK");
  await expect(page.locator("#step-origin .mark")).toHaveText(/OK|LET OP/);

  const storage = await page.evaluate(() => ({
    installationId: localStorage.getItem("veyocast.player.instanceId"),
    pairingCode: localStorage.getItem("veyocast.player.pairingCode"),
    report: JSON.parse(
      localStorage.getItem("veyocast.player.lgProbe.v1") ?? "null"
    ) as { code?: string; results?: unknown[] } | null
  }));
  expect(storage.installationId).toBe(
    "12345678-1234-4123-8123-123456789abc"
  );
  expect(storage.pairingCode).toBe("BEHOUD MIJ");
  expect(storage.report?.code).toBe("LG-UNPAIRED");
  expect(storage.report?.results?.length).toBeGreaterThanOrEqual(7);
  expect(
    requestedUrls.some((url) =>
      url.includes("/lg-probe/h264-baseline-aac.mp4")
    )
  ).toBe(true);
  expect(requestedUrls.some((url) => url.includes("media.w3.org"))).toBe(false);
  expect(requestedUrls.some((url) => url.includes("/_next/"))).toBe(false);
});

test("statische LG-probe past zonder horizontale overflow op compacte viewport", async ({
  page
}) => {
  await page.setViewportSize({ height: 720, width: 960 });
  await page.goto(`${playerURL}/lg/probe`);

  await expect(page.getByRole("main")).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth
  );
  expect(overflow).toBe(false);
});

test("een videoreferentiefout kan een werkende afbeeldingsrelease niet als playback-ready rapporteren", async ({
  page
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("veyocast.player.deviceToken", "probe-device-token");
  });
  await page.route("**/lg-probe/h264-baseline-aac.mp4?probe=*", async (route) => {
    await route.fulfill({
      body: "bewust ongeldige videoreferentie",
      contentType: "video/mp4",
      status: 200
    });
  });
  await page.route("**/api/player/manifest?probe=*", async (route) => {
    await route.fulfill({
      body: JSON.stringify({
        device: { desiredReleaseId: "release-image" },
        manifest: {
          items: [
            {
              enabled: true,
              kind: "image",
              source: {
                bytes: 0,
                mimeType: "image/png",
                url: "/brand/veyocast-icon-maskable-512.png"
              }
            }
          ],
          releaseId: "release-image"
        }
      }),
      contentType: "application/json",
      status: 200
    });
  });
  await page.route("**/api/player/heartbeat", async (route) => {
    await route.fulfill({
      body: JSON.stringify({ ok: true }),
      contentType: "application/json",
      status: 200
    });
  });

  await page.goto(`${playerURL}/lg/probe`);

  await expect(page.locator("#step-direct .mark")).toHaveText("OK", {
    timeout: 20_000
  });
  await expect(page.locator("#result-code")).toHaveText("LG-VIDEO-REFERENCE", {
    timeout: 20_000
  });
  await expect(page.locator("#result-code")).not.toHaveText(
    /LG-(IMAGE-)?PLAYBACK-READY/
  );
});
