import { expect, test } from "@playwright/test";

test("screens management becomes a sequential mobile flow without horizontal overflow", async ({
  page
}) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/dashboard/screens");

  const createScreen = page.getByRole("heading", { name: "Scherm aanmaken" });
  const pairPlayer = page.getByRole("heading", { name: "Player koppelen" });
  await expect(createScreen).toBeVisible();
  await expect(pairPlayer).toBeVisible();

  const [createBox, pairBox, hasHorizontalOverflow] = await Promise.all([
    createScreen.boundingBox(),
    pairPlayer.boundingBox(),
    page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    )
  ]);

  expect(createBox).not.toBeNull();
  expect(pairBox).not.toBeNull();
  expect(pairBox?.y).toBeGreaterThan((createBox?.y ?? 0) + (createBox?.height ?? 0));
  expect(hasHorizontalOverflow).toBe(false);
});
