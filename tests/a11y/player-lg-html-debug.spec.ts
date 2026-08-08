import { expect, test } from "@playwright/test";

const playerURL = `http://127.0.0.1:${process.env.PLAYER_PORT ?? 3106}`;

test("LG HTML/CSS-renderdiagnose blijft semantisch en toetsenbordbedienbaar", async ({
  page
}) => {
  await page.setViewportSize({ height: 720, width: 1280 });
  await page.goto(`${playerURL}/lg/html-debug`);

  await expect(page.getByRole("main")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "HTML/CSS-renderdiagnose" })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "TV-controles" })
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Test opnieuw" })).toHaveAttribute(
    "href",
    "/lg/html-debug"
  );
  await page.getByRole("link", { name: "Volledige LG-probe openen" }).focus();
  await expect(
    page.getByRole("link", { name: "Volledige LG-probe openen" })
  ).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    )
  ).toBe(false);
});
