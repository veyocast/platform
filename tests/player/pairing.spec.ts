import { expect, test } from "@playwright/test";

const playerURL = `http://127.0.0.1:${process.env.PLAYER_PORT ?? 3106}`;

test("player starts in unpaired pairing mode", async ({ page }) => {
  await page.setViewportSize({ height: 1080, width: 1920 });
  await page.goto(playerURL);

  await expect(
    page.getByRole("heading", { name: "Koppel dit scherm aan VeyoCast" })
  ).toBeVisible();
  await expect(page.getByLabel("Pairingcode")).toContainText("VYO 482");
  await expect(page.getByLabel("Device setupstatus")).toContainText("Wachten op VeyoCast Control");
  const logo = page.getByRole("img", { name: "VeyoCast" });
  await expect(logo).toBeVisible();
  const logoBox = await logo.boundingBox();
  expect(logoBox?.height).toBeGreaterThanOrEqual(64);
  await expect(page.locator(".pairing-brand-scene img")).toBeVisible();
  await expect(page.getByLabel("Device setupstatus")).toContainText("Web Player");
  await expect(page.getByLabel("Device setupstatus")).not.toContainText("Code geldig");
  await expect(page.getByLabel("Device setupstatus")).not.toContainText("Geen Supabase Auth-user");
});

test("player pairing becomes static when reduced motion is requested", async ({
  page
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(playerURL);

  const brandIcon = page.locator(".pairing-brand-scene img");
  await expect(brandIcon).toBeVisible();
  await expect(brandIcon).toHaveCSS("animation-name", "none");
  await expect(page.locator(".pairing-brand-accent--orange")).toHaveCSS(
    "animation-name",
    "none"
  );
});

test("live pairing completes before content exists and keeps reporting readiness", async ({
  page
}) => {
  const demoManifest = await page.request
    .get(`${playerURL}/api/player/manifest?deviceToken=demo-online`)
    .then((response) => response.json());
  let heartbeatAttempts = 0;
  let manifestRequests = 0;
  await page.route("**/api/player/pairing", (route) => route.fulfill({
    contentType: "application/json",
    json: {
      deviceToken: "pending-live-device-token",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      live: true,
      pairingCode: "ABC 234"
    }
  }));
  await page.route("**/api/player/heartbeat", (route) => {
    heartbeatAttempts += 1;
    return route.fulfill({
      contentType: "application/json",
      json: { ok: heartbeatAttempts >= 2 },
      status: heartbeatAttempts >= 2 ? 200 : 403
    });
  });
  await page.route("**/api/player/manifest", (route) => {
    manifestRequests += 1;
    return route.fulfill({
      contentType: "application/json",
      json: manifestRequests === 1 ? waitingContentEnvelope() : demoManifest
    });
  });

  await page.goto(playerURL);
  await expect(page.getByLabel("Pairingcode")).toContainText("ABC 234");
  await expect(page.getByRole("heading", { name: "Wachten op content" })).toBeVisible({
    timeout: 8_000
  });
  await expect(page.getByRole("status")).toContainText("online en gereed");
  expect(heartbeatAttempts).toBeGreaterThanOrEqual(2);
  await expect(page.getByLabel("Pairingcode")).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("veyocast.player.deviceToken")))
    .toBe("pending-live-device-token");
  expect(await page.evaluate(() => localStorage.getItem("veyocast.player.pairingCode")))
    .toBeNull();
  await expect(page.getByRole("img", { name: "Clubhuis entree" })).toBeVisible({
    timeout: 10_000
  });
  expect(manifestRequests).toBeGreaterThanOrEqual(2);
});

test("expired pairing rotates automatically to a fresh live code", async ({
  page
}) => {
  let pairingRequests = 0;
  await page.route("**/api/player/pairing", (route) => {
    pairingRequests += 1;
    const firstRequest = pairingRequests === 1;
    return route.fulfill({
      contentType: "application/json",
      json: {
        deviceToken: firstRequest ? "expiring-device-token" : "fresh-device-token",
        expiresAt: new Date(Date.now() + (firstRequest ? 1_500 : 60_000)).toISOString(),
        live: true,
        pairingCode: firstRequest ? "ABC 234" : "DEF 678"
      }
    });
  });
  await page.route("**/api/player/heartbeat", (route) => route.fulfill({
    contentType: "application/json",
    json: { ok: false },
    status: 403
  }));

  await page.goto(playerURL);
  await expect(page.getByLabel("Pairingcode")).toContainText("ABC 234");
  await expect(page.getByLabel("Pairingcode")).toContainText("DEF 678", {
    timeout: 6_000
  });
  expect(pairingRequests).toBe(2);
});

test("revoked identity automatically returns to a fresh pairing session", async ({
  page
}) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("revoked-seed-applied")) {
      localStorage.setItem("veyocast.player.deviceToken", "revoked-device-token");
      sessionStorage.setItem("revoked-seed-applied", "true");
    }
  });
  await page.route("**/api/player/manifest", (route) => route.fulfill({
    contentType: "application/json",
    json: {
      error: {
        cause: "Het device is ingetrokken.",
        effect: "Online toegang is beëindigd.",
        recovery: "Koppel de Player opnieuw."
      },
      state: "UNPAIRED"
    },
    status: 401
  }));
  await page.route("**/api/player/pairing", (route) => route.fulfill({
    contentType: "application/json",
    json: {
      deviceToken: "replacement-device-token",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      live: true,
      pairingCode: "GHJ 789"
    }
  }));
  await page.route("**/api/player/heartbeat", (route) => route.fulfill({
    contentType: "application/json",
    json: { ok: false },
    status: 403
  }));

  await page.goto(playerURL);
  await expect(page.getByLabel("Pairingcode")).toContainText("GHJ 789", {
    timeout: 6_000
  });
  expect(await page.evaluate(() => localStorage.getItem("veyocast.player.deviceToken")))
    .toBe("replacement-device-token");
});

function waitingContentEnvelope() {
  const fetchedAt = new Date().toISOString();
  return {
    device: {
      activeReleaseId: null,
      desiredReleaseId: null,
      id: "55555555-5555-4555-8555-555555555555",
      screenId: "44444444-4444-4444-8444-444444444444",
      screenName: "Kantine hoofdscherm"
    },
    diagnostics: {
      lastSuccessfulSyncAt: fetchedAt,
      nextSyncReason: "waiting for first release",
      syncStatus: "online"
    },
    fetchedAt,
    state: "READY"
  };
}
