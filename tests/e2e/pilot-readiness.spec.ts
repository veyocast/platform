import { expect, test } from "@playwright/test";

const marketingURL = `http://127.0.0.1:${process.env.MARKETING_PORT ?? 3108}`;
const playerURL = `http://127.0.0.1:${process.env.PLAYER_PORT ?? 3106}`;

test.setTimeout(90_000);

test("keeps the documented local demo pilot traceable across product planes", async ({
  page
}) => {
  await page.goto(marketingURL);

  await expect(page.getByRole("heading", { exact: true, name: "VeyoCast" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Van organisatie naar spelend scherm." })
  ).toBeVisible();

  await page.goto("/login");
  await page.getByLabel("E-mailadres").fill("pilot@veyocast.test");
  await page.getByRole("button", { name: "Doorgaan" }).click();
  await expect(page).toHaveURL(/\/auth\/callback/);
  await expect(
    page.getByText("authprovider is nog niet aangesloten")
  ).toBeVisible();
  await page.getByRole("link", { name: "Naar dashboard" }).click();

  await page.goto("/dashboard/media");
  await expect(page.getByText("Private bucket: tenant-media")).toBeVisible();
  await expect(page.getByRole("status").filter({
    hasText: "Uploaden is niet beschikbaar in de demomodus"
  })).toBeVisible();
  await expect(page.getByRole("button", { name: "Uploaden en verifiëren" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Video uploaden" })).toBeDisabled();

  await page.goto("/dashboard/playlists");
  await expect(page.getByText("Demomodus zonder mutaties")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Playlistlijst" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Concept maken" })).toBeDisabled();

  await page.goto("/dashboard/screens");
  await expect(page.getByLabel("Koppelcode")).toBeVisible();
  await expect(page.getByRole("button", { name: "Player veilig koppelen" })).toBeDisabled();
  await expect(
    page.getByRole("status").filter({ hasText: "geen fictieve schermen" })
  ).toBeVisible();

  const manifestResponse = await page.request.get(
    `${playerURL}/api/player/manifest?deviceToken=demo-online`
  );
  expect(manifestResponse.ok()).toBe(true);
  const manifest = (await manifestResponse.json()) as { state: string };
  expect(manifest.state).toBe("PLAYING");

  await page.goto(`${playerURL}/?deviceToken=demo-online&durationMs=750`);
  await expect(page.getByLabel("Release playback")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByLabel("Player diagnostics")).toContainText("PLAYING");
  await expect(page.getByLabel("Player diagnostics")).toContainText("Zomerroute v3");
});
