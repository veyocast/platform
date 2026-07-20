import { expect, test } from "@playwright/test";

const playerURL = `http://127.0.0.1:${process.env.PLAYER_PORT ?? 3106}`;

test("player setup and playback expose accessible landmarks and diagnostics", async ({
  context,
  page
}) => {
  await page.goto(playerURL);

  await expect(
    page.getByRole("main", { name: "VeyoCast player setup" })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Koppel dit scherm aan VeyoCast" })
  ).toBeVisible();
  await expect(page.getByLabel("Pairingcode")).toContainText("VYO 482");
  await expect(page.getByLabel("Device setupstatus")).toContainText("Internet");
  await expect(page.getByLabel("Device setupstatus")).not.toContainText("Geen Supabase Auth-user");

  await page.goto(`${playerURL}/?deviceToken=demo-online&durationMs=750`);

  await expect(page.getByLabel("Release playback")).toBeVisible({
    timeout: 15_000
  });
  await expect(page.getByRole("main", { name: "VeyoCast player" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Clubhuis entree" })).toBeVisible();
  await expect(page.getByLabel("Player diagnostics")).toContainText("PLAYING");
  await expect(page.getByLabel("Player diagnostics")).toHaveAttribute("hidden", "");

  await context.setOffline(true);
  try {
    await expect(page.getByRole("status")).toHaveText("Geen internetverbinding");
  } finally {
    await context.setOffline(false);
  }
});

test("paired player without content exposes a clear ready state", async ({
  page
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("veyocast.player.deviceToken", "paired-without-content");
  });
  await page.route("**/api/player/manifest", (route) => route.fulfill({
    contentType: "application/json",
    json: {
      device: {
        activeReleaseId: null,
        desiredReleaseId: null,
        id: "55555555-5555-4555-8555-555555555555",
        screenId: "44444444-4444-4444-8444-444444444444",
        screenName: "Kantine hoofdscherm"
      },
      diagnostics: {
        lastSuccessfulSyncAt: new Date().toISOString(),
        nextSyncReason: "waiting for first release",
        syncStatus: "online"
      },
      fetchedAt: new Date().toISOString(),
      state: "READY"
    }
  }));
  await page.route("**/api/player/heartbeat", (route) => route.fulfill({
    contentType: "application/json",
    json: { ok: true }
  }));

  await page.goto(playerURL);

  await expect(page.getByRole("main", { name: "VeyoCast player gereed" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Wachten op content" })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("online en gereed");
  await expect(page.getByText("Kantine hoofdscherm", { exact: true })).toBeVisible();
});
