import { expect, test } from "@playwright/test";

const playerURL = `http://127.0.0.1:${process.env.PLAYER_PORT ?? 3106}`;

test("zelfstandige LG-probe blijft semantisch en toetsenbordbedienbaar", async ({
  page
}) => {
  await page.setViewportSize({ height: 720, width: 1280 });
  await page.goto(`${playerURL}/lg/probe`);

  await expect(page.getByRole("main")).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "We meten wat deze televisie werkelijk kan"
    })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Diagnose wordt uitgevoerd" })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Probe opnieuw uitvoeren" })
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Player herstellen" })).toHaveAttribute(
    "href",
    "/lg/recover"
  );

  await page.getByRole("button", { name: "Probe opnieuw uitvoeren" }).focus();
  await expect(
    page.getByRole("button", { name: "Probe opnieuw uitvoeren" })
  ).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    )
  ).toBe(false);
});
