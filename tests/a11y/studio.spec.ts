import { expect, test } from "@playwright/test";

test("Studio exposes named controls, status and keyboard alternatives", async ({
  page
}) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ height: 960, width: 1440 });
  await page.goto("/dashboard/studio/system-matchday-landscape-hd-v1");

  await expect(page.getByLabel("Studio-editor")).toBeVisible({
    timeout: 20_000
  });
  await expect(page.getByRole("status").filter({ hasText: "Opgeslagen" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ongedaan maken" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Opnieuw uitvoeren" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Revisiegeschiedenis openen" })).toBeVisible();

  await page.getByRole("button", { name: "Element of media toevoegen" }).click();
  const picker = page.getByRole("dialog", { name: "Element of media toevoegen" });
  const textButton = picker.getByRole("button", { exact: true, name: /Tekst/ });
  await textButton.focus();
  await expect(textButton).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(picker).not.toBeVisible();
  await expect(page.locator('input[value="Nieuwe tekst"]')).toBeVisible({
    timeout: 10_000
  });
  await expect(page.getByRole("button", { name: "Laag omhoog" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Laag omlaag" })).toBeVisible();

  await page.keyboard.press("Control+z");
  await expect(page.locator('input[value="Nieuwe tekst"]')).toHaveCount(0);
  await page.keyboard.press("Control+Shift+z");
  await expect(page.locator('input[value="Nieuwe tekst"]')).toBeVisible();
});
