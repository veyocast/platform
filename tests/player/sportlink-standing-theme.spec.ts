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
    const standingRows = slide.locator("[data-standing-row]");
    expect(await standingRows.count()).toBe(20);
    const standingHead = slide.getByTestId("standing-head").first();
    const firstRow = standingRows.first();
    const selectedRow = standingRows.filter({ hasText: "Duindorp sv" });
    expect(await standingHead.evaluate((element) =>
      getComputedStyle(element).gridTemplateColumns
    )).toBe(await firstRow.evaluate((element) =>
      getComputedStyle(element).gridTemplateColumns
    ));
    const [firstRank, selectedRank] = await Promise.all([
      firstRow.locator(":scope > strong").first().boundingBox(),
      selectedRow.locator(":scope > strong").first().boundingBox()
    ]);
    expect(firstRank).not.toBeNull();
    expect(selectedRank).not.toBeNull();
    expect(selectedRank!.x).toBeCloseTo(firstRank!.x, 1);
    expect(Number.parseFloat(await selectedRow.evaluate(
      (element) => getComputedStyle(element).fontSize
    ))).toBeGreaterThanOrEqual(orientation === "portrait" ? 25 : 28);
    if (process.env.CAPTURE_EDITORIAL_ARENA === "1") {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.screenshot({
        path: `docs/screenshots/s91-editorial-arena-standing-${orientation}.png`
      });
    }
  });
}
