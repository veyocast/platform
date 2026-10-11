import { expect, test } from "@playwright/test";

const playerURL = `http://127.0.0.1:${process.env.PLAYER_PORT ?? 3106}`;

test("staging reviewcode opens, controls and disconnects the virtual demo", async ({
  page
}) => {
  const invalid = await page.request.post(
    `${playerURL}/api/player/demo/session`,
    { data: { code: "VYO 2VZ" } }
  );
  expect(invalid.status()).toBe(401);

  const connected = await page.request.post(
    `${playerURL}/api/player/demo/session`,
    { data: { code: "VYO 2VY" } }
  );
  expect(connected.status()).toBe(200);
  expect(connected.headers()["set-cookie"]).toContain("HttpOnly");
  expect(connected.headers()["set-cookie"].toLowerCase()).toContain(
    "samesite=strict"
  );

  await page.goto(`${playerURL}/demo`);
  await expect(
    page.getByRole("main", { name: "VeyoCast reviewdemo" })
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "VeyoCast reviewintro" })
  ).toBeVisible({ timeout: 15_000 });

  await page.evaluate(() => {
    window.dispatchEvent(
      new CustomEvent("veyocast:demo-navigate", {
        detail: { direction: "next" }
      })
    );
  });
  const video = page.getByTestId("player-video");
  await expect(video).toBeVisible();
  await video.evaluate(async (element) => {
    await element.play();
    element.pause();
  });
  await expect.poll(() => video.evaluate((element) => element.paused)).toBe(
    true
  );

  await page.waitForTimeout(12_500);
  await expect(video).toBeVisible();

  await page.evaluate(() => {
    window.dispatchEvent(
      new CustomEvent("veyocast:demo-navigate", {
        detail: { direction: "next" }
      })
    );
  });
  await expect(
    page.getByRole("img", { name: "VeyoCast reviewafsluiting" })
  ).toBeVisible();

  const disconnected = await page.request.delete(
    `${playerURL}/api/player/demo/session`
  );
  expect(disconnected.status()).toBe(200);
  await page.goto(`${playerURL}/demo`);
  await expect(
    page.getByRole("main", { name: "VeyoCast player setup" })
  ).toBeVisible();
});

test("demo media requires a session and serves bounded byte ranges", async ({
  page
}) => {
  const denied = await page.request.get(`${playerURL}/api/player/demo/media`);
  expect(denied.status()).toBe(404);

  // A production Secure/HttpOnly cookie is consumed by the actual browser.
  // APIRequestContext has different Secure-cookie handling on loopback HTTP.
  await page.goto(playerURL);
  const connected = await page.evaluate(async () => {
    const response = await fetch("/api/player/demo/session", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "VYO 2VY" })
    });
    return response.ok;
  });
  expect(connected).toBe(true);
  const partial = await page.evaluate(async () => {
    const response = await fetch("/api/player/demo/media", { headers: { Range: "bytes=0-31" } });
    return { status: response.status, headers: Object.fromEntries(response.headers), bytes: (await response.arrayBuffer()).byteLength };
  });
  expect(partial.status).toBe(206);
  expect(partial.headers["accept-ranges"]).toBe("bytes");
  expect(partial.headers["content-length"]).toBe("32");
  expect(partial.headers["content-range"]).toBe("bytes 0-31/12346112");
  expect(partial.bytes).toBe(32);
  const invalid = await page.evaluate(async () => {
    const response = await fetch("/api/player/demo/media", { headers: { Range: "bytes=12346112-" } });
    return { status: response.status, contentRange: response.headers.get("content-range") };
  });
  expect(invalid.status).toBe(416);
  expect(invalid.contentRange).toBe("bytes */12346112");
});
