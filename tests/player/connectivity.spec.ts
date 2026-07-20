import { expect, test } from "@playwright/test";

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
