import { expect, test } from "@playwright/test";

const playerURL = `http://127.0.0.1:${process.env.PLAYER_PORT ?? 3106}`;

test("fetches an online release manifest and starts playback", async ({
  page
}) => {
  const manifestResponse = await page.request.get(
    `${playerURL}/api/player/manifest?deviceToken=demo-online`
  );

  expect(manifestResponse.ok()).toBe(true);
  const manifestBody = (await manifestResponse.json()) as { state: string };
  expect(manifestBody.state).toBe("PLAYING");

  const playerResponse = await page.goto(
    `${playerURL}/?deviceToken=demo-online&durationMs=750`
  );
  expect(playerResponse?.headers()["content-security-policy"]).toContain(
    "http://127.0.0.1:54321"
  );

  await expect(page.getByLabel("Release playback")).toBeVisible();
  await expect(page.getByRole("img", { name: "Clubhuis entree" })).toBeVisible();
  await expect(page.getByLabel("Player diagnostics")).toContainText("PLAYING");
  await expect(page.getByLabel("Player diagnostics")).toContainText("Zomerroute v3");
  await expect(page.getByLabel("Pairingcode")).toHaveCount(0);
});

test("loops to the muted video slot without browser controls", async ({
  page
}) => {
  await page.goto(`${playerURL}/?deviceToken=demo-online&durationMs=300`);

  const video = page.getByTestId("player-video");
  await expect(video).toBeVisible({ timeout: 3_000 });
  await expect(video).toHaveJSProperty("muted", true);
  await expect(video).not.toHaveAttribute("controls", /.*/);
  await expect(page.getByLabel("Player diagnostics")).toContainText("Item 2 van 3");
});

test("shows a recoverable state for an unknown device token", async ({
  page
}) => {
  await page.goto(`${playerURL}/?deviceToken=unknown-device`);

  await expect(page.getByRole("heading", { name: "Playback wacht" })).toBeVisible();
  await expect(page.getByRole("status")).toContainText(
    "De device token hoort niet bij een actief scherm."
  );
  await expect(page.getByRole("status")).toContainText(
    "Zonder last-known-good release blijft de player in herstelstatus."
  );
});
