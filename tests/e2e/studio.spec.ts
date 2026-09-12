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
  await expect(
    page.locator("article").filter({
      has: page.getByRole("heading", { name: "Nieuws & RSS" })
    })
  ).toBeVisible();
  }).toPass({ timeout: 20_000 });
  await page.locator("article").filter({
    has: page.getByRole("heading", { name: "Vrij ontwerp" })
  }).getByRole("link", { name: "Openen" }).click();
  await expect(page).toHaveURL(/\/dashboard\/studio\/new\?family=free$/);
  await expect(
    page.getByRole("heading", { exact: true, level: 1, name: "Nieuw ontwerp" })
  ).toBeVisible();

  const nameInput = page.getByLabel("Ontwerpnaam");
  const nextButton = page.getByRole("button", { name: "Volgende" });
  await expect(nameInput).toBeVisible();
  await expect(nextButton).toBeDisabled();
  await expect(page.getByText("Naam ontbreekt", { exact: true })).toBeVisible();

  await nameInput.fill("Voorjaarscampagne");
  await expect(
    page.getByText("Invoer compleet", { exact: true })
  ).toBeVisible();
  await page.getByText("Staand HD", { exact: true }).click();
  await expect(page.getByRole("radio", { name: /Staand HD/ })).toBeChecked();
  await expect(page.getByText("1080 × 1920 · portrait signage")).toBeVisible();
  await expect(nextButton).toBeEnabled();
  await nextButton.click();

  await expect(
    page.getByRole("heading", { exact: true, name: "Startpunt" })
  ).toBeVisible();
  await expect(page.getByLabel("Zoek template")).toBeVisible();
  await expect(page.getByLabel("Categorie", { exact: true })).toBeVisible();
  const startPanel = page.getByRole("region", { name: "Startpunt" });
  const actionFooter = page
    .getByText("Stap 2 van 4 · Startpunt", { exact: true })
    .locator("xpath=ancestor::footer");
  const [panelBox, footerBox] = await Promise.all([
    startPanel.boundingBox(),
    actionFooter.boundingBox()
  ]);
  expect(panelBox).not.toBeNull();
  expect(footerBox).not.toBeNull();
  expect(footerBox!.y).toBeGreaterThanOrEqual(panelBox!.y + panelBox!.height);

  await nextButton.click();
  await expect(
    page.getByRole("heading", { exact: true, name: "Uitvoer" })
  ).toBeVisible();
  await page.getByText("Motion", { exact: true }).click();
  await expect(page.getByRole("radio", { name: /Motion/ })).toBeChecked();
  await nextButton.click();

  await expect(
    page.getByRole("heading", { exact: true, name: "Controleren" })
  ).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Controleren" })
      .getByText("Voorjaarscampagne", { exact: true })
  ).toBeVisible();
  await expect(page.getByText("Motion · MP4", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Ontwerp maken" })).toBeEnabled();
  await expect(page).toHaveURL(/\/dashboard\/studio\/new\?family=free$/);

  for (const control of await page
    .locator("form")
    .locator("button:visible, input:not([type=radio]):visible, select:visible")
    .all()) {
    const box = await control.boundingBox();
    if (!box) continue;
    expect.soft(box.height).toBeGreaterThanOrEqual(44);
  }
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
    page.getByRole("heading", { exact: true, level: 1, name: "Studio" })
  ).toBeVisible();
  await expect(page.getByText("Clubhuis — Vandaag", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Slides" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Studio-weergave" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Element" })).toHaveAttribute(
    "aria-selected",
    "true"
  );
  await expect(page.getByText("16:9 · 1920 × 1080", { exact: true })).toBeVisible();
  await expect(page.getByText("74%", { exact: true })).toBeVisible();
  await expect(page.getByText("Tijdlijn", { exact: true })).toBeVisible();
  await expect(page.getByText("00:06 / 00:42", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Laag" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Afbeelding toevoegen" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Video toevoegen" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Raster tonen" })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await expect(
    page.getByRole("button", { name: "Revisiegeschiedenis openen" })
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tekst" })).toBeVisible();
  await expect(page.getByLabel("Titel")).toHaveValue("WEDSTRIJD VANDAAG");
  await expect(page.getByRole("heading", { name: "Zichtbaarheid" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Kleuren" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Beweging" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ongedaan maken" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Passend in werkvlak" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Canvas verschuiven; houd ook spatie ingedrukt" })).toBeVisible();

  const [slidePanelBox, canvasPanelBox, inspectorPanelBox] = await Promise.all([
    page.getByRole("heading", { name: "Slides" }).locator("xpath=ancestor::aside").boundingBox(),
    page
      .getByText("16:9 · 1920 × 1080", { exact: true })
      .locator("xpath=ancestor::section[1]")
      .boundingBox(),
    page.getByLabel("Instellingenpaneel").locator("xpath=ancestor::aside").boundingBox()
  ]);
  expect(slidePanelBox).not.toBeNull();
  expect(canvasPanelBox).not.toBeNull();
  expect(inspectorPanelBox).not.toBeNull();
  expect(slidePanelBox!.x + slidePanelBox!.width).toBeLessThan(canvasPanelBox!.x);
  expect(canvasPanelBox!.x + canvasPanelBox!.width).toBeLessThan(
    inspectorPanelBox!.x
  );

  await page.getByRole("button", { name: "Selectie sluiten" }).click();

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

  await page.getByRole("button", { name: "Element of media toevoegen" }).click();
  const resourcePicker = page.getByRole("dialog", {
    name: "Element of media toevoegen"
  });
  await expect(resourcePicker).toBeVisible();
  await expect(resourcePicker.getByRole("tab", { name: /Elementen/ })).toBeVisible();
  await expect(resourcePicker.getByRole("tab", { name: /Media/ })).toBeVisible();
  await resourcePicker.getByRole("button", { name: /Tekst/ }).click();
  await expect(resourcePicker).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Ongedaan maken" })).toBeEnabled();
  await expect(page.locator('input[value="Nieuwe tekst"]')).toBeVisible();

  await page.getByRole("button", { name: "Voorbeeld" }).last().click();
  const previewDialog = page.getByRole("dialog");
  await expect(previewDialog.getByRole("heading", { name: "Voorbeeld" })).toBeVisible();
  const reducedMotion = previewDialog.getByRole("checkbox", {
    name: "Beweging beperken"
  });
  await reducedMotion.check();
  await expect(reducedMotion).toBeChecked();
  await expect(previewDialog.getByRole("button", { name: "Voorbeeld afspelen" })).toBeDisabled();
  await expect(async () => {
    const dialog = page.getByRole("dialog");
    if (!(await dialog.isVisible())) return;
    await dialog.getByRole("button", { name: "Sluiten" }).click();
    await expect(dialog).not.toBeVisible();
  }).toPass({ timeout: 15_000 });

  await page.goto("/dashboard/studio/system-schedule-landscape-hd-v1");
  await expect(page.getByLabel("Studio-editor")).toBeVisible({
    timeout: 20_000
  });
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
  await expect(page.getByRole("heading", { name: "Slides" })).not.toBeVisible();
  await expect(page.getByRole("navigation", { name: "Studio-weergave" })).not.toBeVisible();
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
