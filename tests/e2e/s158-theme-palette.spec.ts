import { expect, test, type Page } from "@playwright/test";

type ThemePayload = {
  fieldflow: {
    dark: Record<string, string>;
    light: Record<string, string>;
    mode: "dark" | "light";
  };
};

const concreteColor = /^(#[0-9A-F]{6}|rgba?\([0-9.,%\s]+\))$/i;

test("bouwt een volledig tenantpalet en blokkeert onveilig opslaan", async ({
  page
}) => {
  test.setTimeout(90_000);

  const unlockedProps = await unlockDemoThemeEditor(page);
  await page.goto("/dashboard/themes/fieldflow", {
    waitUntil: "networkidle"
  });

  await expect(
    page.getByRole("heading", { level: 1, name: "Royal Current · Navy Glass" })
  ).toBeVisible();
  await expect(page.getByText("Standaardpaletten")).toBeVisible();
  expect(unlockedProps.count).toBeGreaterThanOrEqual(2);

  // The HTML was rendered read-only before the intercepted RSC props hydrate.
  // Removing those stale attributes lets this browser test drive the real
  // client component and its normal React state/event handlers.
  await page.locator("form.settings-theme-form [disabled]").evaluateAll(
    (elements) => elements.forEach((element) => element.removeAttribute("disabled"))
  );

  const payloadField = page.locator(
    'input[name="themeColorOverridesJson"]'
  );
  const readinessField = page.locator('input[name="themeSaveReadiness"]');
  const preview = page.getByLabel("Live voorbeeld van het lichte palet");
  const saveButton = page.getByRole("button", {
    name: "Instellingen opslaan"
  });

  const initialPayload = await readThemePayload(payloadField);
  assertCompleteConcretePalette(initialPayload);
  const initialPreviewAccent = await preview.evaluate((element) =>
    element.style.getPropertyValue("--vc-accent")
  );
  await expect(page.locator(".settings-savebar")).toHaveAttribute(
    "aria-hidden",
    "true"
  );

  await page.getByRole("button", { name: "Rood", exact: true }).click();

  await expect(page.locator('input[name="themeAccent"]')).toHaveValue(
    "#BF263B"
  );
  await expect.poll(async () => readThemePayload(payloadField)).toMatchObject({
    fieldflow: {
      dark: { accent: expect.any(String) },
      light: { accent: "#bf263b" },
      mode: "light"
    }
  });

  const generatedPayload = await readThemePayload(payloadField);
  assertCompleteConcretePalette(generatedPayload);
  expect(generatedPayload.fieldflow.dark).not.toEqual(
    initialPayload.fieldflow.dark
  );
  expect(generatedPayload.fieldflow.light).not.toEqual(
    initialPayload.fieldflow.light
  );
  await expect.poll(async () => preview.evaluate((element) =>
    element.style.getPropertyValue("--vc-accent")
  )).toBe("#bf263b");
  expect(initialPreviewAccent).not.toBe("#bf263b");

  await expect(page.locator(".settings-savebar")).toHaveAttribute(
    "aria-hidden",
    "false"
  );
  await expect(saveButton).toBeEnabled();

  await page.getByLabel("Hoofdtekst als kleurwaarde").fill(
    generatedPayload.fieldflow.light.surface
  );

  await expect(readinessField).toHaveValue("blocked");
  await expect(
    page.getByRole("alert").filter({
      hasText: "Herstel eerst alle contrastcombinaties"
    })
  ).toBeVisible();
  await expect(saveButton).toBeDisabled();
  await expect(page.locator(".settings-savebar")).toContainText(
    "Herstel eerst de gemarkeerde kleurwaarde of contrastcombinatie."
  );
});

test("mobiele stijlwijzigingen en globale modus blijven foutvrij", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 390, height: 844 });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && /TypeError|currentTarget|Cannot read/.test(message.text())) {
      errors.push(message.text());
    }
  });
  await unlockDemoThemeEditor(page);
  await page.goto("/dashboard/themes/fieldflow", { waitUntil: "networkidle" });
  await page.locator("form.settings-theme-form [disabled]").evaluateAll(
    (elements) => elements.forEach((element) => element.removeAttribute("disabled"))
  );
  const colors = page.locator('input[name="themeColorOverridesJson"]');
  const appearance = page.locator('input[name="themeAppearanceJson"]');
  for (const mode of ["dark", "light"] as const) {
    await page.getByRole("button", { name: mode === "dark" ? "Alles donker" : "Alles licht", exact: true }).click();
    await expect.poll(async () => (await readThemePayload(colors)).fieldflow.mode).toBe(mode);
    await page.getByRole("combobox", { name: "Koppen en wedstrijdnamen", exact: true }).selectOption("vc-anton-v1");
    await page.getByRole("combobox", { name: "Lopende tekst en metadata", exact: true }).selectOption("vc-inter-v1");
    await page.getByLabel("Tekstschaal (%)", { exact: true }).fill("110");
    await page.getByLabel("Programma en uitslagen (%)", { exact: true }).fill("120");
    await page.getByRole("checkbox", { name: /Rustige bewegingen/ }).uncheck();
    await expect.poll(async () => JSON.parse(await appearance.inputValue())).toMatchObject({
      motionEnabled: false,
      typography: { displayFontRef: "vc-anton-v1", bodyFontRef: "vc-inter-v1", baseScale: 1.1, sportScale: 1.2 }
    });
    await page.getByRole("button", { name: "Lettertype en schaal herstellen", exact: true }).click();
    await expect.poll(async () => JSON.parse(await appearance.inputValue())).toMatchObject({
      typography: { displayFontRef: "vc-roboto-v1", bodyFontRef: "vc-roboto-v1", baseScale: 1, sportScale: 1 }
    });
    await expect(page.getByRole("button", { name: "Instellingen opslaan", exact: true })).toBeEnabled();
    expect(errors).toEqual([]);
  }
});

async function unlockDemoThemeEditor(page: Page) {
  const result = { count: 0 };
  await page.route("**/dashboard/themes/fieldflow*", async (route) => {
    const response = await route.fetch();
    const original = await response.text();
    const matches = original.match(/disabled\\\":true/g) ?? [];
    result.count += matches.length;
    await route.fulfill({
      body: original.replaceAll('disabled\\":true', 'disabled\\":false'),
      response
    });
  });
  return result;
}

async function readThemePayload(
  field: ReturnType<Page["locator"]>
): Promise<ThemePayload> {
  return JSON.parse(await field.inputValue()) as ThemePayload;
}

function assertCompleteConcretePalette(payload: ThemePayload) {
  for (const palette of [
    payload.fieldflow.light,
    payload.fieldflow.dark
  ]) {
    expect(Object.keys(palette)).toHaveLength(26);
    for (const value of Object.values(palette)) {
      expect(value).toMatch(concreteColor);
      expect(value).not.toContain("color-mix(");
    }
  }
}
