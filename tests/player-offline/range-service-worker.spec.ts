import { expect, test } from "@playwright/test";

const playerURL = `http://127.0.0.1:${process.env.PLAYER_PORT ?? 3106}`;

test("serves cached media as 200, 206 and 416 through the service worker", async ({ page }) => {
  await page.goto(playerURL);
  const hasController = await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    return Boolean(navigator.serviceWorker.controller);
  });
  if (!hasController) await page.reload();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));

  const result = await page.evaluate(async () => {
    const cacheKey = "/__castivo-player-cache/range-integration";
    const payload = new TextEncoder().encode("0123456789");
    const cache = await caches.open("castivo-player-assets-v1");
    await cache.put(cacheKey, new Response(payload, {
      headers: {
        "Accept-Ranges": "bytes",
        "Content-Length": String(payload.byteLength),
        "Content-Type": "video/mp4"
      }
    }));

    const full = await fetch(cacheKey);
    const partial = await fetch(cacheKey, { headers: { Range: "bytes=3-6" } });
    const suffix = await fetch(cacheKey, { headers: { Range: "bytes=-2" } });
    const invalid = await fetch(cacheKey, { headers: { Range: "bytes=20-" } });

    return {
      full: { acceptRanges: full.headers.get("Accept-Ranges"), body: await full.text(), status: full.status },
      invalid: { contentRange: invalid.headers.get("Content-Range"), status: invalid.status },
      partial: { body: await partial.text(), contentRange: partial.headers.get("Content-Range"), status: partial.status },
      suffix: { body: await suffix.text(), contentRange: suffix.headers.get("Content-Range"), status: suffix.status }
    };
  });

  expect(result.full).toEqual({ acceptRanges: "bytes", body: "0123456789", status: 200 });
  expect(result.partial).toEqual({ body: "3456", contentRange: "bytes 3-6/10", status: 206 });
  expect(result.suffix).toEqual({ body: "89", contentRange: "bytes 8-9/10", status: 206 });
  expect(result.invalid).toEqual({ contentRange: "bytes */10", status: 416 });
});

test("reloads the cached player shell without a network connection", async ({ context, page }) => {
  await page.goto(playerURL);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });

  if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))) {
    await page.reload();
  }
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));

  await context.setOffline(true);
  try {
    await page.reload();
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Koppelcode maken" })).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
});

test("migrates a legacy cached response before serving a Range request", async ({ page }) => {
  await page.goto(playerURL);
  await page.evaluate(async () => navigator.serviceWorker.ready);
  if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))) {
    await page.reload();
  }
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));

  const result = await page.evaluate(async () => {
    const cacheKey = "/__castivo-player-cache/legacy-range-integration";
    const cache = await caches.open("castivo-player-assets-v1");
    await cache.put(
      cacheKey,
      new Response(new TextEncoder().encode("abcdefghij"), {
        headers: { "Content-Type": "video/mp4" }
      })
    );

    const partial = await fetch(cacheKey, { headers: { Range: "bytes=2-5" } });
    const migrated = await cache.match(cacheKey);
    return {
      body: await partial.text(),
      cachedLength: migrated?.headers.get("Content-Length"),
      contentRange: partial.headers.get("Content-Range"),
      status: partial.status
    };
  });

  expect(result).toEqual({
    body: "cdef",
    cachedLength: "10",
    contentRange: "bytes 2-5/10",
    status: 206
  });
});

test("removes obsolete player shell caches on service-worker activation", async ({ page }) => {
  await page.goto(playerURL);
  await page.evaluate(async () => navigator.serviceWorker.ready);
  await page.evaluate(async () => {
    const oldCache = await caches.open("castivo-player-shell-v1");
    await oldCache.put("/legacy-shell", new Response("legacy"));
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  });

  await page.reload();
  await page.evaluate(async () => navigator.serviceWorker.ready);
  await page.waitForFunction(async () => {
    const names = await caches.keys();
    return !names.includes("castivo-player-shell-v1") && names.includes("castivo-player-shell-v2");
  });

  await expect.poll(() => page.evaluate(() => caches.keys())).not.toContain(
    "castivo-player-shell-v1"
  );
});
