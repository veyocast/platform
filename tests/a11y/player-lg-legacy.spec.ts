import { expect, test } from "@playwright/test";

const playerURL = `http://127.0.0.1:${process.env.PLAYER_PORT ?? 3106}`;

test("LG Legacy Player heeft een leesbaar semantisch statusscherm", async ({
  page
}) => {
  await page.route("**/api/player/installation", async (route) => {
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: {
          code: "INSTALLATION_API_UNAVAILABLE"
        }
      })
    });
  });
  await page.setViewportSize({ width: 1280, height: 720 });

  await page.goto(`${playerURL}/lg/legacy`);

  await expect(page.getByRole("main")).toHaveAttribute(
    "aria-label",
    "VeyoCast afspeeloppervlak"
  );
  await expect(page.getByRole("heading", { name: /VeyoCast tijdelijk niet bereikbaar|Player starten/ })).toBeVisible();
  await expect(page.locator("#status")).toHaveAttribute("aria-live", "polite");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    )
  ).toBe(false);
});
