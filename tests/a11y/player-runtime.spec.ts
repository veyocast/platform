import { expect, test } from "@playwright/test";

const playerURL = `http://127.0.0.1:${process.env.PLAYER_PORT ?? 3106}`;

test("player setup and playback expose accessible landmarks and diagnostics", async ({
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
});
