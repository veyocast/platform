import { expect, test } from "@playwright/test";

const playerURL = `http://127.0.0.1:${process.env.PLAYER_PORT ?? 3106}`;

test("zelfstandige recoveryroute heeft leesbare semantiek en toetsenbordacties", async ({
  page
}) => {
  await page.setViewportSize({ height: 720, width: 1280 });
  await page.goto(`${playerURL}/lg/recover`);

  await expect(page.getByRole("main")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "VeyoCast Player herstellen" })
  ).toBeVisible();
  await expect(page.getByRole("list", { name: "Herstelvoortgang" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Nu herstellen" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Volledige playerreset" })
  ).toBeVisible();

  await page.getByRole("button", { name: "Nu herstellen" }).focus();
  await expect(page.getByRole("button", { name: "Nu herstellen" })).toBeFocused();

  const overflow = await page.evaluate(() => ({
    horizontal: document.documentElement.scrollWidth > window.innerWidth,
    vertical: document.documentElement.scrollHeight > window.innerHeight
  }));
  expect(overflow).toEqual({ horizontal: false, vertical: false });
});
