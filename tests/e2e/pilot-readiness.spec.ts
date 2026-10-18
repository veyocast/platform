import { expect, test } from "@playwright/test";

const marketingURL = `http://127.0.0.1:${process.env.MARKETING_PORT ?? 3108}`;
const playerURL = `http://127.0.0.1:${process.env.PLAYER_PORT ?? 3106}`;

test.setTimeout(90_000);

test("keeps the documented local demo pilot traceable across product planes", async ({
  page
}) => {
  await page.goto(marketingURL);

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Maak van iederscherm eenverhaal.");
  await expect(
    page.getByRole("heading", { name: "Mooi op het scherm. Rustig achter de schermen." })
  ).toBeVisible();

  await page.goto("/login");
  await expect(async () => {
    if (/\/auth\/callback/.test(page.url())) return;
    await page.getByLabel("E-mailadres").fill("pilot@veyocast.test");
    await page.getByRole("button", { name: "Doorgaan" }).click();
    await expect(page).toHaveURL(/\/auth\/callback/);
  }).toPass({ timeout: 20_000 });
  await expect(
    page.getByText("authprovider is nog niet aangesloten")
  ).toBeVisible();
  await page.getByRole("link", { name: "Naar dashboard" }).click();

  await page.goto("/dashboard/media");
  await expect(page.getByRole("heading", { name: "Mediabibliotheek" })).toBeVisible();
  await expect(page.getByRole("status").filter({
    hasText: "Uploaden is niet beschikbaar in de demomodus"
  })).toBeVisible();
  await page.goto("/dashboard/media?upload=1");
  const uploadDialog = page.getByRole("dialog", { name: "Media uploaden" });
  await expect(uploadDialog.getByRole("button", { name: "Uploaden en verifiëren" })).toBeDisabled();
  await uploadDialog.getByRole("tab", { name: "Video" }).click();
  await expect(uploadDialog.getByRole("button", { name: "Video uploaden" })).toBeDisabled();

  await page.goto("/dashboard/playlists");
  await expect(
    page.getByRole("status").filter({ hasText: "Configureer Supabase en log in om echte playlists te maken en bewerken." })
  ).toBeVisible();
  await expect(page.locator("#control-content").getByRole("heading", { name: "Je playlists", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Nieuwe playlist", exact: true })).toBeDisabled();

  await page.goto("/dashboard/screens");
  await expect(page.getByRole("heading", { level: 1, name: "Jouw club. Overal in beeld." })).toBeVisible();
  await expect(page.locator(".px-screen-card")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Scherm koppelen", exact: true })).toBeDisabled();
  await expect(page.getByRole("link", { name: "Scherm toevoegen" })).toHaveCount(0);
  await page.goto("/dashboard/screens/new");
  const setup = page.getByRole("dialog", { name: "Nieuw scherm instellen" });
  await expect(setup).toBeVisible();
  await expect(setup.getByLabel("Schermnaam", { exact: true })).toBeDisabled();
  await expect(setup.getByRole("button", { name: "Volgende", exact: true })).toBeDisabled();
  await expect(setup.getByRole("status")).toContainText("Er wordt niets aangemaakt");

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
