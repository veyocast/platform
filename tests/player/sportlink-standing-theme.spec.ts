import { expect, test } from "@playwright/test";

import { routeSportlinkStandingManifest } from "./sportlink-standing-fixture";

const playerURL = `http://127.0.0.1:${process.env.PLAYER_PORT ?? 3106}`;

for (const orientation of ["landscape", "portrait"] as const) {
  test(`toont de ${orientation} stand als dynamische HTML/CSS`, async ({
    page
  }) => {
    await page.setViewportSize(
      orientation === "portrait"
        ? { height: 1920, width: 1080 }
        : { height: 1080, width: 1920 }
    );
    await routeSportlinkStandingManifest(page, playerURL, orientation);
    await page.goto(`${playerURL}/?deviceToken=demo-online`);

    const slide = page.getByLabel("Dynamische competitiestand");
    await expect(slide).toBeVisible();
    await expect(slide).toHaveAttribute(
      "data-orientation",
      orientation
    );
    await expect(page.getByRole("heading", { name: "Stand" })).toBeVisible();
    await expect(page.getByText("Vierde klasse")).toBeVisible();
    await expect(page.getByText("2026/2027")).toBeVisible();
    await expect(page.getByText("Duindorp sv")).toBeVisible();
    await expect(
      page.getByLabel(/Vorm Duindorp sv: winst, winst, gelijk/u)
    ).toBeVisible();
    expect(await slide.evaluate((element) =>
      getComputedStyle(element).getPropertyValue("--arena-accent").trim()
    )).toBe("#315CFF");
    await expect(slide.locator("canvas")).toHaveCount(0);
    expect(await slide.locator("article").count()).toBe(
      orientation === "portrait" ? 18 : 10
    );
    if (process.env.CAPTURE_EDITORIAL_ARENA === "1") {
      await page.screenshot({
        path: `docs/screenshots/s91-editorial-arena-standing-${orientation}.png`
      });
    }
  });
}
