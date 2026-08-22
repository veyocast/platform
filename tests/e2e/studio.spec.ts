import { expect, test } from "@playwright/test";

const demoProject = "/dashboard/studio/system-matchday-landscape-hd-v1";

test.describe.configure({ mode: "serial" });

test("Studio overview and creation journey use real responsive controls", async ({
  page
}) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ height: 900, width: 1440 });
  await page.goto("/dashboard/studio");

  await expect(
    page.getByRole("heading", { exact: true, level: 1, name: "Studio" })
  ).toBeVisible();
  await expect(page.getByLabel("Studio-samenvatting")).toBeVisible();
  await expect(page.getByRole("link", { name: "Nieuwe slide" })).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Studio-ontwerpen" })
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Hoofdnavigatie" }).getByRole("link", {
      name: /Studio/
    })
  ).toHaveAttribute("aria-current", "page");

  await expect(async () => {
    if (/\/dashboard\/studio\/new$/.test(page.url())) return;
    await page.getByRole("link", { name: "Nieuwe slide" }).click();
    await expect(page).toHaveURL(/\/dashboard\/studio\/new$/);
  }).toPass({ timeout: 20_000 });
  await page.locator("article").filter({
    has: page.getByRole("heading", { name: "Vrij ontwerp" })
  }).getByRole("link", { name: "Openen" }).click();
  await expect(page).toHaveURL(/\/dashboard\/studio\/new\?family=free$/);
  await expect(
    page.getByRole("heading", { exact: true, level: 1, name: "Nieuw ontwerp" })
  ).toBeVisible();
  await page.getByText("Staand HD", { exact: true }).click();
  await expect(page.getByRole("radio", { name: /Staand HD/ })).toBeChecked();
  await expect(page.getByText("1080 × 1920 · portrait signage")).toBeVisible();
  await page.getByText("Motion", { exact: true }).click();
  await expect(page.getByRole("radio", { name: /Motion/ })).toBeChecked();
  await expect(page.getByRole("button", { name: "Ontwerp maken" })).toBeEnabled();
});

test("desktop Studio editor supports editing, preview and revision inspection", async ({
  page
}) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ height: 960, width: 1440 });
  await page.goto(demoProject);
  await expect(page.getByLabel("Studio-editor")).toBeVisible({
    timeout: 20_000
  });
  await expect(
    page.getByRole("heading", { exact: true, level: 1, name: "Wedstrijddag" })
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Ongedaan maken" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Passend in werkvlak" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Canvas verschuiven; houd ook spatie ingedrukt" })).toBeVisible();

  const layerActionTrigger = page
    .getByRole("button", { name: /Meer acties voor/ })
    .first();
  const layerRow = layerActionTrigger.locator("xpath=ancestor::li");
  await layerActionTrigger.click();
  const layerMenu = page.locator('[data-floating-panel][role="menu"]');
  await expect(layerMenu).toBeVisible();
  expect(
    await layerMenu.evaluate((element) => element.parentElement === document.body)
  ).toBe(true);
  const [layerMenuBox, layerRowBox] = await Promise.all([
    layerMenu.boundingBox(),
    layerRow.boundingBox()
  ]);
  expect(layerMenuBox).not.toBeNull();
  expect(layerRowBox).not.toBeNull();
  expect(layerMenuBox!.y + layerMenuBox!.height).toBeGreaterThan(
    layerRowBox!.y + layerRowBox!.height
  );
  expect(layerMenuBox!.x).toBeGreaterThanOrEqual(12);
  expect(layerMenuBox!.x + layerMenuBox!.width).toBeLessThanOrEqual(1428);
  await expect(layerMenu).toHaveCSS("position", "fixed");
  await expect(layerMenu).toHaveCSS("z-index", "300");
  await page.keyboard.press("Escape");
  await expect(layerMenu).not.toBeVisible();
  await expect(layerActionTrigger).toBeFocused();

  await page.getByRole("button", { exact: true, name: "Tekst" }).click();
  await expect(page.getByRole("button", { name: "Ongedaan maken" })).toBeEnabled();
  await expect(page.locator('input[value="Nieuwe tekst"]')).toBeVisible();

  await page.getByRole("button", { name: "Voorbeeld" }).click();
  await expect(
    page.getByRole("dialog").getByRole("heading", { name: "Voorbeeld" })
  ).toBeVisible();
  await expect(async () => {
    const dialog = page.getByRole("dialog");
    if (!(await dialog.isVisible())) return;
    await dialog.getByRole("button", { name: "Sluiten" }).click();
    await expect(dialog).not.toBeVisible();
  }).toPass({ timeout: 15_000 });

  await page.getByRole("button", { name: "Revisiegeschiedenis openen" }).click();
  await expect(
    page.getByRole("dialog").getByRole("heading", {
      name: "Revisiegeschiedenis"
    })
  ).toBeVisible();
  await expect(page.getByRole("dialog").getByText("Demo-gebruiker")).toBeVisible();

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
    )
  ).toBe(true);
});

test("mobile Studio is a focused quick-edit journey rather than a mini desktop", async ({
  page
}) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto(demoProject);

  await expect(page.getByLabel("Studio-editor")).toBeVisible({
    timeout: 20_000
  });
  await expect(page.getByRole("heading", { name: "Snel bewerken" })).toBeVisible({
    timeout: 15_000
  });
  await expect(page.getByText("Gebruik desktop voor vrije positionering.")).toBeVisible();
  await expect(page.getByText("Elementen", { exact: true })).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Genereren" }).last()).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
    )
  ).toBe(true);

  for (const control of await page
    .getByLabel("Studio-editor")
    .locator("button:visible, a:visible")
    .all()) {
    const box = await control.boundingBox();
    if (!box) continue;
    expect.soft(
      box.height,
      (await control.getAttribute("aria-label")) ??
        (await control.innerText()) ??
        "Naamloze control"
    ).toBeGreaterThanOrEqual(44);
  }
});
