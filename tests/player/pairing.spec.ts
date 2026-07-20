import { expect, test } from "@playwright/test";

const playerURL = `http://127.0.0.1:${process.env.PLAYER_PORT ?? 3106}`;

test("player starts in unpaired pairing mode", async ({ page }) => {
  await page.goto(playerURL);

  await expect(
    page.getByRole("heading", { name: "Koppel dit scherm aan VeyoCast" })
  ).toBeVisible();
  await expect(page.getByLabel("Pairingcode")).toContainText("VYO 482");
  await expect(page.getByLabel("Device setupstatus")).toContainText("Wachten op VeyoCast Control");
  await expect(page.getByRole("img", { name: "VeyoCast" })).toBeVisible();
  await expect(page.getByLabel("Device setupstatus")).toContainText("Web Player");
  await expect(page.getByLabel("Device setupstatus")).toContainText(
    "Geen Supabase Auth-user"
  );
});
