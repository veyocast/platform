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
    await expect(page.getByText("Editorial Arena", { exact: true }))
      .toHaveCount(0);
    await expect(page.getByText("Actuele competitiestand", { exact: true }))
      .toHaveCount(0);
    await expect(page.getByText("Vierde klasse")).toBeVisible();
    await expect(page.getByText("2026/2027")).toBeVisible();
    await expect(page.getByText("Duindorp sv")).toBeVisible();
    await expect(slide.locator("header img")).toHaveCount(1);
    await expect(slide.locator("main article img").first()).toBeVisible();
    await expect(
      page.getByLabel(/Vorm Duindorp sv: winst, winst, gelijk/u)
    ).toBeVisible();
    expect(await slide.evaluate((element) =>
      getComputedStyle(element).getPropertyValue("--arena-accent").trim()
    )).toBe("#315CFF");
    await expect(slide.locator("canvas")).toHaveCount(0);
    const standingRows = slide.locator("[data-standing-row]");
    expect(await standingRows.count()).toBe(10);
    const standingHead = slide.getByTestId("standing-head").first();
    const firstRow = standingRows.first();
    const selectedRow = standingRows.filter({ hasText: "Duindorp sv" });
    await expect(selectedRow.locator("[data-standing-played]")).toHaveText("18");
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
    ))).toBe(orientation === "portrait" ? 37.5 : 42);
    expect(Number.parseFloat(await standingHead.evaluate(
      (element) => getComputedStyle(element).fontSize
    ))).toBe(21);
    expect(await slide.evaluate((element) => ({
      clientHeight: element.clientHeight,
      clientWidth: element.clientWidth,
      scrollHeight: element.scrollHeight,
      scrollWidth: element.scrollWidth
    }))).toEqual({
      clientHeight: orientation === "portrait" ? 1920 : 1080,
      clientWidth: orientation === "portrait" ? 1080 : 1920,
      scrollHeight: orientation === "portrait" ? 1920 : 1080,
      scrollWidth: orientation === "portrait" ? 1080 : 1920
    });
    if (process.env.CAPTURE_EDITORIAL_ARENA === "1") {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.screenshot({
        path: `docs/screenshots/s91-editorial-arena-standing-${orientation}.png`
      });
    }
  });
}
