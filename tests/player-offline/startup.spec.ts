import { expect, test } from "@playwright/test";

const playerURL = `http://127.0.0.1:${process.env.PLAYER_PORT ?? 3106}`;

test("unpaired player startup is visible without a network-backed release", async ({
  page
}) => {
  await page.goto(playerURL);

  await expect(page.getByText("Klaar om te koppelen")).toBeVisible();
  await expect(page.getByLabel("Pairingcode")).toBeVisible();
  await expect(page.getByRole("main")).toContainText("Koppel dit scherm aan VeyoCast");
});
