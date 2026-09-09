import { expect, test } from "@playwright/test";

import {
  freezeThemePresentation,
  themeCatalog,
  themeToEditorialTokens
} from "@veyocast/content-templates/theme-catalog";
import {
  createFieldflowRoyalBlueAppearance,
  createFieldflowRoyalBlueSelection,
  createFieldflowRoyalBlueTheme
} from "@veyocast/content-templates";
import type {
  EditorialNewsVariant,
  EditorialThemeConfig,
  PlayerDynamicTemplatePayload
} from "@veyocast/contracts";
import { playerDynamicTemplatePayloadSchema } from "@veyocast/contracts";

const playerURL = `http://127.0.0.1:${process.env.PLAYER_PORT ?? 3106}`;
const snapshotId = "10000000-0000-4000-8000-000000000001";
const imageId = "10000000-0000-4000-8000-000000000002";
const fixtureVariants = [
  "price-with-photo",
  "price-without-photo",
  "news-hero",
  "news-fullscreen",
  "news-grid",
  "news-text-only",
  "standing-10",
  "standing-20",
  "program-5",
  "program-20",
  "results-5",
  "results-20",
  "team-roster",
  "sponsor-spotlight",
  "training-schedule",
  "volunteer-call"
] as const;

test("volledige FieldFlow-outputmatrix van 64 cellen", async ({ page }) => {
  test.setTimeout(180_000);
  await page.clock.setFixedTime(new Date("2026-09-06T13:33:00.000Z"));
  await page.emulateMedia({ reducedMotion: "reduce" });

  for (const variant of fixtureVariants) {
    for (const orientation of ["landscape", "portrait"] as const) {
      for (const themeMode of ["light", "dark"] as const) {
        await test.step(`${variant} · ${orientation} · ${themeMode}`, async () => {
          const viewport = orientation === "landscape"
            ? { height: 1080, width: 1920 }
            : { height: 1920, width: 1080 };
          await page.setViewportSize(viewport);
          const payload = buildPayload(variant, orientation, themeMode);
          const parsedPayload = playerDynamicTemplatePayloadSchema.safeParse(payload);
          if (!parsedPayload.success) throw new Error(parsedPayload.error.message);
          await page.goto("about:blank");
          await page.goto(`${playerURL}/thumbnail#payload=${encodePayload(payload)}`);
          await page.waitForFunction(
            () => document.documentElement.dataset.thumbnailReady === "true"
          );

          const slide = page.locator("[data-slide-type]");
          await expect(slide).toBeVisible();
          await expect(slide).toHaveAttribute("data-orientation", orientation);
          await expect(slide).toHaveAttribute("data-theme", themeMode);
          await expect(slide).toHaveAttribute("data-theme-id", "fieldflow");
          await expect(slide.locator("header time"))
            .toHaveText("06-09-2026 | 15:33");
          await expect(slide.locator("header")).not.toContainText("VeyoCast");
          const geometry = await slide.evaluate((element) => {
            const content = element.querySelector("main");
            const footer = element.querySelector("footer");
            const contentBox = content?.getBoundingClientRect();
            const footerBox = footer?.getBoundingClientRect();
            return {
              allImagesComplete: Array.from(element.querySelectorAll("img"))
                .every((image) => image.complete),
              clientHeight: element.clientHeight,
              clientWidth: element.clientWidth,
              footerClearsContent: !contentBox || !footerBox ||
                contentBox.bottom <= footerBox.top + 1,
              scrollHeight: element.scrollHeight,
              scrollWidth: element.scrollWidth
            };
          });
          expect(geometry.scrollWidth).toBe(geometry.clientWidth);
          expect(geometry.scrollHeight).toBe(geometry.clientHeight);
          expect(geometry.footerClearsContent).toBe(true);
          expect(geometry.allImagesComplete).toBe(true);
          if (variant.startsWith("program-") || variant.startsWith("results-")) {
            await expect(slide.locator("header")).toContainText("MATCHCENTRE");
            await expect(slide.locator("footer")).not.toContainText(/wedstrijdcentrum/iu);
            const rows = slide.locator(
              '[class*="arenaProgramRow"], [data-result-row]'
            );
            const rowsPerPage = variant.startsWith("results-")
              ? orientation === "portrait" ? 5 : 6
              : orientation === "portrait" ? 7 : 6;
            await expect(rows).toHaveCount(Math.min(
              countForVariant(variant),
              rowsPerPage
            ));
            const rowHeights = await rows.evaluateAll((elements) =>
              elements.map((element) => Number.parseFloat(
                getComputedStyle(element).height
              ))
            );
            expect(new Set(rowHeights)).toEqual(new Set([
              expectedMatchRowHeight(variant, orientation)
            ]));
            const firstRow = rows.first();
            const primary = firstRow.locator('[class*="arenaMatchPrimary"]');
            await expect(primary).toContainText("za 16 aug");
            await expect(primary).toContainText(variant.startsWith("results-") ? "FT" : "14:30");
            await expect(primary).toContainText("Thuisclub 1");
            await expect(primary).toContainText("Uitclub 1");
            if (variant.startsWith("program-")) {
              const secondary = firstRow.locator('[class*="arenaMatchSecondary"]');
              await expect(secondary).toContainText("Veld: 1");
              await expect(secondary).toContainText("Sportpark: De Arena");
              const rowGeometry = await firstRow.evaluate((element) => {
                const primaryLine = element.querySelector<HTMLElement>(
                  '[class*="arenaMatchPrimary"]'
                );
                const secondaryLine = element.querySelector<HTMLElement>(
                  '[class*="arenaMatchSecondary"]'
                );
                const primaryBox = primaryLine?.getBoundingClientRect();
                const secondaryBox = secondaryLine?.getBoundingClientRect();
                const primarySize = primaryLine
                  ? Number.parseFloat(getComputedStyle(primaryLine).fontSize)
                  : 0;
                const secondaryStyle = secondaryLine
                  ? getComputedStyle(secondaryLine)
                  : null;
                return {
                  primaryAboveSecondary: Boolean(
                    primaryBox && secondaryBox && primaryBox.bottom <= secondaryBox.top + 1
                  ),
                  secondaryFontRatio: secondaryStyle && primarySize
                    ? Number.parseFloat(secondaryStyle.fontSize) / primarySize
                    : 0,
                  secondaryJustification: secondaryStyle?.justifyContent,
                  secondaryTextAlign: secondaryStyle?.textAlign
                };
              });
              expect(rowGeometry.primaryAboveSecondary).toBe(true);
              expect(rowGeometry.secondaryFontRatio).toBeCloseTo(.52, 2);
              expect(rowGeometry.secondaryJustification).toBe("flex-end");
              expect(rowGeometry.secondaryTextAlign).toBe("right");
            } else {
              await expect(firstRow.locator('[class*="arenaMatchSecondary"]')).toHaveCount(0);
            }
          }

          if (variant.startsWith("results-")) {
            const rows = slide.locator("[data-result-row]");
            expect(await rows.first().evaluate(
              (element) => Number.parseFloat(getComputedStyle(element).fontSize)
            )).toBeCloseTo(orientation === "portrait" ? 30.24 : 33.6, 2);
            expect(await rows.first().locator(
              '[class*="arenaResultScore"]'
            ).evaluate(
              (element) => Number.parseFloat(getComputedStyle(element).fontSize)
            )).toBeCloseTo(52.08, 2);
            const scoreGeometry = await rows.first().evaluate((element) => {
              const score = element.querySelector<HTMLElement>(
                '[class*="arenaResultScore"]'
              );
              const home = element.querySelector<HTMLElement>(
                '[data-field="home-team"]'
              );
              const away = element.querySelector<HTMLElement>(
                '[data-field="away-team"]'
              );
              const scoreBox = score?.getBoundingClientRect();
              const homeBox = home?.getBoundingClientRect();
              const awayBox = away?.getBoundingClientRect();
              return {
                scoreBetweenTeams: Boolean(
                  scoreBox && homeBox && awayBox &&
                  scoreBox.left >= homeBox.right - 1 &&
                  scoreBox.right <= awayBox.left + 1
                )
              };
            });
            expect(scoreGeometry.scoreBetweenTeams).toBe(true);
          }
          if (variant === "news-hero" && orientation === "portrait") {
            const splitSpacing = await page.locator(
              '[data-news-variant="hero_split"]'
            ).evaluate((layout) => {
              const style = getComputedStyle(layout);
              return {
                columnGap: style.columnGap,
                paddingLeft: style.paddingLeft,
                paddingRight: style.paddingRight,
                rowGap: style.rowGap
              };
            });
            expect(splitSpacing).toEqual({
              columnGap: "32px",
              paddingLeft: "20px",
              paddingRight: "20px",
              rowGap: "32px"
            });
          }
          if (variant === "news-fullscreen") {
            const composition = await page.locator(
              '[data-news-variant="fullscreen_gradient"]'
            ).evaluate((layout) => {
              const layoutBox = layout.getBoundingClientRect();
              const hero = layout.querySelector<HTMLElement>(":scope > section");
              const story = layout.querySelector<HTMLElement>(":scope > article");
              const qr = layout.querySelector<HTMLElement>('[data-testid="news-qr"]');
              const qrImage = qr?.querySelector<HTMLElement>("img");
              const source = layout.querySelector<HTMLElement>(":scope > section > div");
              const intro = story?.querySelector<HTMLElement>(":scope > p");
              const qrBox = qr?.getBoundingClientRect();
              const qrImageBox = qrImage?.getBoundingClientRect();
              const sourceBox = source?.getBoundingClientRect();
              const storyBox = story?.getBoundingClientRect();
              return {
                introFontSize: intro
                  ? Number.parseFloat(getComputedStyle(intro).fontSize)
                  : 0,
                overlay: hero
                  ? getComputedStyle(hero, "::after").backgroundImage
                  : "none",
                qrBottomGap: qrBox ? layoutBox.bottom - qrBox.bottom : null,
                qrImageRightGap: qrImageBox ? layoutBox.right - qrImageBox.right : null,
                qrRightGap: qrBox ? layoutBox.right - qrBox.right : null,
                qrViewportBottomGap: qrBox ? window.innerHeight - qrBox.bottom : null,
                qrViewportRightGap: qrBox ? window.innerWidth - qrBox.right : null,
                storyHeightRatio: storyBox ? storyBox.height / layoutBox.height : 0,
                storyTopRatio: storyBox
                  ? (storyBox.top - layoutBox.top) / layoutBox.height
                  : 0,
                storyWidthRatio: storyBox ? storyBox.width / layoutBox.width : 0,
                sourceRightGap: sourceBox ? layoutBox.right - sourceBox.right : null
              };
            });
            expect(composition.overlay).not.toBe("none");
            await expect(slide.getByTestId("news-qr")).toBeVisible();
            await expect(slide.getByTestId("news-qr"))
              .toContainText("Scan voor het artikel");
            await expect(slide.getByTestId("news-qr").locator("small"))
              .toHaveCount(0);
            await expect(slide).not.toContainText("example.com/nieuws/0");
            if (orientation === "landscape") {
              expect(composition.overlay).toContain("62%");
              expect(composition.overlay).toContain("82%");
              expect(composition.introFontSize).toBeGreaterThanOrEqual(30);
              expect(composition.qrBottomGap).toBeGreaterThanOrEqual(29);
              expect(composition.qrBottomGap).toBeLessThanOrEqual(31);
              expect(composition.qrRightGap).toBeGreaterThanOrEqual(91);
              expect(composition.qrRightGap).toBeLessThanOrEqual(93);
              expect(composition.qrImageRightGap).toBeGreaterThanOrEqual(91);
              expect(composition.qrImageRightGap).toBeLessThanOrEqual(93);
              expect(composition.sourceRightGap).toBeGreaterThanOrEqual(91);
              expect(composition.sourceRightGap).toBeLessThanOrEqual(93);
              expect(composition.qrViewportBottomGap).toBeGreaterThanOrEqual(143);
              expect(composition.qrViewportBottomGap).toBeLessThanOrEqual(145);
              expect(composition.qrViewportRightGap).toBeGreaterThanOrEqual(143);
              expect(composition.qrViewportRightGap).toBeLessThanOrEqual(145);
              expect(composition.storyWidthRatio).toBeGreaterThanOrEqual(0.6);
              expect(composition.storyWidthRatio).toBeLessThanOrEqual(0.64);
              expect(composition.storyTopRatio).toBeLessThan(0.01);
            } else {
              expect(composition.overlay).toContain("28%");
              expect(composition.overlay).toContain("40%");
              expect(composition.overlay).toContain("50%");
              expect(composition.introFontSize).toBeGreaterThanOrEqual(32);
              expect(composition.qrBottomGap).toBeGreaterThanOrEqual(45);
              expect(composition.qrBottomGap).toBeLessThanOrEqual(47);
              expect(composition.qrRightGap).toBeGreaterThanOrEqual(105);
              expect(composition.qrRightGap).toBeLessThanOrEqual(107);
              expect(composition.qrViewportBottomGap).toBeGreaterThanOrEqual(143);
              expect(composition.qrViewportBottomGap).toBeLessThanOrEqual(145);
              expect(composition.qrViewportRightGap).toBeGreaterThanOrEqual(143);
              expect(composition.qrViewportRightGap).toBeLessThanOrEqual(145);
              expect(composition.storyHeightRatio).toBeGreaterThanOrEqual(0.49);
              expect(composition.storyHeightRatio).toBeLessThanOrEqual(0.51);
              expect(composition.storyTopRatio).toBeGreaterThanOrEqual(0.49);
              expect(composition.storyTopRatio).toBeLessThanOrEqual(0.51);
            }
          }
          await expect(page).toHaveScreenshot(
            `${variant}-${orientation}-${themeMode}.png`,
            { animations: "disabled", caret: "hide", maxDiffPixelRatio: 0.002 }
          );
        });
      }
    }
  }
});

test("wedstrijdslides gebruiken twee kolommen alleen in landschap", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-09-06T13:33:00.000Z"));
  await page.emulateMedia({ reducedMotion: "reduce" });

  for (const variant of ["program-20", "results-20"] as const) {
    for (const orientation of ["landscape", "portrait"] as const) {
      await test.step(`${variant} · ${orientation}`, async () => {
        await page.setViewportSize(orientation === "landscape"
          ? { height: 1080, width: 1920 }
          : { height: 1920, width: 1080 });
        const payload = withSportColumns(
          buildPayload(variant, orientation, "light"),
          "two"
        );
        await page.goto("about:blank");
        await page.goto(`${playerURL}/thumbnail#payload=${encodePayload(payload)}`);
        await page.waitForFunction(
          () => document.documentElement.dataset.thumbnailReady === "true"
        );

        const columns = page.locator('[class*="arenaSportColumns"]');
        const rows = page.locator(
          '[class*="arenaProgramRow"], [data-result-row]'
        );
        await expect(columns).toHaveAttribute(
          "data-columns",
          orientation === "landscape" ? "2" : "1"
        );
        await expect(rows).toHaveCount(
          orientation === "landscape"
            ? 12
            : variant === "results-20" ? 5 : 7
        );
        expect(await rows.evaluateAll((elements) => elements.map((element) =>
          Number.parseFloat(getComputedStyle(element).height)
        ))).toEqual(Array.from(
          { length: await rows.count() },
          () => expectedMatchRowHeight(variant, orientation)
        ));
        expect(await rows.evaluateAll((elements) => elements.every((element) =>
          element.scrollWidth <= element.clientWidth
        ))).toBe(true);
        const expectedFields = variant === "program-20"
          ? ["date", "time", "home-logo", "home-team", "versus", "away-logo", "away-team"]
          : ["date", "time", "home-logo", "home-team", "score", "away-logo", "away-team"];
        expect(await rows.first().locator(
          ':scope > [class*="arenaMatchPrimary"] > [data-field]'
        ).evaluateAll((fields) => fields.map((field) => field.getAttribute("data-field"))))
          .toEqual(expectedFields);
        if (orientation === "landscape") {
          const columnSections = columns.locator(":scope > section");
          await expect(columnSections).toHaveCount(2);
          await expect(columnSections.first().locator(
            '[data-field="home-team"]'
          ).first()).toContainText("Thuisclub 1");
          await expect(columnSections.last().locator(
            '[data-field="home-team"]'
          ).first()).toContainText("Thuisclub 7");
          const columnStarts = await columnSections.evaluateAll((sections) =>
            sections.map((section) => {
              const box = section.getBoundingClientRect();
              return { left: box.left, top: box.top };
            })
          );
          expect(columnStarts[0]?.top).toBeCloseTo(columnStarts[1]!.top, 2);
          expect(columnStarts[0]!.left).toBeLessThan(columnStarts[1]!.left);
        }
        const firstRow = rows.first();
        const primary = firstRow.locator('[class*="arenaMatchPrimary"]');
        await expect(primary.locator('[data-field="date"]')).toHaveText("za 16 aug");
        await expect(primary.locator('[data-field="time"]'))
          .toHaveText(variant === "results-20" ? "FT" : "14:30");
        await expect(primary.locator('[data-field="home-team"]'))
          .toHaveText("Thuisclub 1");
        await expect(primary.locator('[data-field="away-team"]'))
          .toHaveText("Uitclub 1");
        if (variant === "results-20") {
          const score = firstRow.locator('[class*="arenaResultScore"]');
          await expect(score).toHaveAttribute("aria-label", "Uitslag 3 tegen 0");
          expect(await firstRow.evaluate((element) => {
            const result = element.querySelector<HTMLElement>(
              '[class*="arenaResultScore"]'
            )?.getBoundingClientRect();
            const home = element.querySelector<HTMLElement>(
              '[data-field="home-team"]'
            )?.getBoundingClientRect();
            const away = element.querySelector<HTMLElement>(
              '[data-field="away-team"]'
            )?.getBoundingClientRect();
            return Boolean(
              home && result && away &&
              result.left >= home.right - 1 && result.right <= away.left + 1
            );
          })).toBe(true);
        } else {
          await expect(firstRow.locator('[class*="arenaResultScore"]')).toHaveCount(0);
          const secondary = firstRow.locator('[class*="arenaMatchSecondary"]');
          await expect(secondary).toContainText("Veld: 1");
          await expect(secondary).toContainText("Sportpark: De Arena");
          expect(await firstRow.evaluate((element) => {
            const primary = element.querySelector<HTMLElement>(
              '[class*="arenaMatchPrimary"]'
            )?.getBoundingClientRect();
            const details = element.querySelector<HTMLElement>(
              '[class*="arenaMatchSecondary"]'
            )?.getBoundingClientRect();
            return Boolean(primary && details && primary.bottom <= details.top + 1);
          })).toBe(true);
        }
        if (orientation === "landscape") {
          await expect(page).toHaveScreenshot(
            `${variant}-landscape-two-columns-light.png`,
            { animations: "disabled", caret: "hide", maxDiffPixelRatio: 0.002 }
          );
        }
      });
    }
  }

  await test.step("één staande uitslag blijft een vaste rij", async () => {
    await page.setViewportSize({ height: 1920, width: 1080 });
    const payload = withSportItemCount(
      buildPayload("results-5", "portrait", "light"),
      1
    );
    await page.goto("about:blank");
    await page.goto(`${playerURL}/thumbnail#payload=${encodePayload(payload)}`);
    await page.waitForFunction(
      () => document.documentElement.dataset.thumbnailReady === "true"
    );

    const row = page.locator("[data-result-row]");
    await expect(row).toHaveCount(1);
    const geometry = await row.evaluate((element) => {
      const rowBox = element.getBoundingClientRect();
      const contentBox = element.closest("main")?.getBoundingClientRect();
      return {
        height: rowBox.height,
        ratioToContent: contentBox ? rowBox.height / contentBox.height : 1
      };
    });
    expect(geometry.height).toBe(314);
    expect(geometry.ratioToContent).toBeLessThan(0.25);
  });

  await test.step("sportpark blijft zichtbaar wanneer alleen veld is uitgeschakeld", async () => {
    await page.setViewportSize({ height: 1080, width: 1920 });
    const payload = withHiddenField(
      buildPayload("program-5", "landscape", "light")
    );
    await page.goto("about:blank");
    await page.goto(`${playerURL}/thumbnail#payload=${encodePayload(payload)}`);
    await page.waitForFunction(
      () => document.documentElement.dataset.thumbnailReady === "true"
    );

    const details = page.locator('[class*="arenaMatchSecondary"]').first();
    await expect(details).toContainText("Sportpark: Houtrust");
    await expect(details).not.toContainText("Veld:");
  });
});

test("staande splitnieuwsslide houdt 32 px tussenruimte en 20 px zijmarges", async ({ page }) => {
  await page.setViewportSize({ height: 1920, width: 1080 });
  await page.clock.setFixedTime(new Date("2026-09-06T13:33:00.000Z"));
  await page.emulateMedia({ reducedMotion: "reduce" });
  const payload = buildPayload("news-hero", "portrait", "light");
  await page.goto(`${playerURL}/thumbnail#payload=${encodePayload(payload)}`);
  await page.waitForFunction(
    () => document.documentElement.dataset.thumbnailReady === "true"
  );

  expect(await page.locator('[data-news-variant="hero_split"]').evaluate((layout) => {
    const style = getComputedStyle(layout);
    return {
      paddingLeft: style.paddingLeft,
      paddingRight: style.paddingRight,
      rowGap: style.rowGap
    };
  })).toEqual({
    paddingLeft: "20px",
    paddingRight: "20px",
    rowGap: "32px"
  });
});

test("Royal blauw vergroot wedstrijdinformatie zonder vaste rijen te breken", async ({ page }) => {
  test.setTimeout(90_000);
  await page.clock.setFixedTime(new Date("2026-09-09T08:00:00.000Z"));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ height: 1080, width: 1920 });

  for (const variant of ["program-5", "results-20"] as const) {
    await test.step(variant, async () => {
      const initial = buildPayload(variant, "landscape", "dark");
      const payload = withRoyalBlueTheme(
        variant === "results-20" ? withSportColumns(initial, "two") : initial
      );
      await page.goto("about:blank");
      await page.goto(`${playerURL}/thumbnail#payload=${encodePayload(payload)}`);
      await page.waitForFunction(
        () => document.documentElement.dataset.thumbnailReady === "true"
      );

      const slide = page.locator('[data-theme-id="fieldflow"]');
      const rows = slide.locator(
        '[class*="arenaProgramRow"], [data-result-row]'
      );
      await expect(slide).toBeVisible();
      expect(await slide.evaluate((element) => ({
        background: getComputedStyle(element).backgroundColor,
        baseScale: getComputedStyle(element).getPropertyValue("--vc-theme-base-scale").trim(),
        color: getComputedStyle(element).color,
        sportScale: getComputedStyle(element).getPropertyValue("--vc-theme-sport-scale").trim()
      }))).toEqual({
        background: "rgb(7, 21, 56)",
        baseScale: "1.05",
        color: "rgb(255, 255, 255)",
        sportScale: "1.4"
      });
      const rowGeometry = await rows.evaluateAll((elements) => elements.map((element) => ({
        clientHeight: element.clientHeight,
        clientWidth: element.clientWidth,
        height: Number.parseFloat(getComputedStyle(element).height),
        scrollHeight: element.scrollHeight,
        scrollWidth: element.scrollWidth
      })));
      expect(rowGeometry.every((geometry) => (
        geometry.height === 115 &&
        geometry.scrollHeight <= geometry.clientHeight &&
        geometry.scrollWidth <= geometry.clientWidth
      ))).toBe(true);

      const firstRow = rows.first();
      expect(await firstRow.evaluate((element) => ({
        background: getComputedStyle(element).backgroundColor,
        fontSize: Number.parseFloat(getComputedStyle(element).fontSize)
      }))).toEqual({
        background: "rgb(12, 34, 87)",
        fontSize: variant === "program-5" ? 29.4 : 31.5
      });
      if (variant === "program-5") {
        expect(await firstRow.locator('[class*="arenaMatchSecondary"]').evaluate(
          (element) => Number.parseFloat(getComputedStyle(element).fontSize)
        )).toBeCloseTo(15.288, 2);
      } else {
        expect(await firstRow.locator('[class*="arenaResultScore"]').evaluate(
          (element) => Number.parseFloat(getComputedStyle(element).fontSize)
        )).toBeCloseTo(55.125, 2);
      }

      await expect(page).toHaveScreenshot(
        `royal-blue-${variant}-landscape.png`,
        { animations: "disabled", caret: "hide", maxDiffPixelRatio: 0.002 }
      );
    });
  }
});

function buildPayload(
  variant: typeof fixtureVariants[number],
  orientation: "landscape" | "portrait",
  themeMode: "dark" | "light"
): PlayerDynamicTemplatePayload {
  const selection = {
    accent: null,
    categoryOverrides: [],
    modePolicy: { kind: "fixed" as const, mode: themeMode },
    ref: {
      catalog: "v2" as const,
      id: "fieldflow" as const,
      version: themeCatalog.fieldflow.version
    },
    support: null
  };
  const themePresentation = freezeThemePresentation({
    instant: "2026-09-02T12:00:00.000Z",
    selection,
    timezone: "Europe/Amsterdam"
  });
  const theme: EditorialThemeConfig = {
    dark: themeToEditorialTokens(freezeThemePresentation({
      instant: "2026-09-02T12:00:00.000Z",
      selection: { ...selection, modePolicy: { kind: "fixed", mode: "dark" } },
      timezone: "Europe/Amsterdam"
    })),
    light: themeToEditorialTokens(freezeThemePresentation({
      instant: "2026-09-02T12:00:00.000Z",
      selection: { ...selection, modePolicy: { kind: "fixed", mode: "light" } },
      timezone: "Europe/Amsterdam"
    })),
    mode: themeMode
  };
  const data = variant.startsWith("price-")
    ? priceData(variant === "price-with-photo", theme)
    : variant.startsWith("news-")
      ? newsData(newsVariant(variant), theme)
      : sportData(variant, theme);
  const slideType = variant.startsWith("price-")
    ? "menu"
    : variant.startsWith("news-")
      ? "news"
      : variant.startsWith("standing-")
        ? "sport_standing"
        : variant.startsWith("program-")
          ? "sport_program"
          : variant === "team-roster"
            ? "sport_team"
            : variant === "sponsor-spotlight"
              ? "sport_sponsor"
              : variant === "training-schedule"
                ? "sport_trainings"
                : variant === "volunteer-call"
                  ? "sport_volunteers"
                  : "sport_results";
  return {
    assets: {
      [imageId]: {
        bytes: 481,
        checksumSha256: "a".repeat(64),
        mimeType: "image/png",
        url: `${playerURL}/editorial-arena-fixture.svg`
      }
    },
    data: {
      ...data,
      themePresentation
    },
    orientation,
    schemaVersion: 1,
    slideType,
    snapshotHash: "b".repeat(64),
    snapshotId,
    templateSlug: `editorial-arena-${slideType.replaceAll("_", "-")}-${themeMode}-${orientation}`,
    templateVersionId: "10000000-0000-4000-8000-000000000003"
  };
}

function withRoyalBlueTheme(
  payload: PlayerDynamicTemplatePayload
): PlayerDynamicTemplatePayload {
  const selection = createFieldflowRoyalBlueSelection(
    themeCatalog.fieldflow.version
  );
  const frozen = freezeThemePresentation({
    instant: "2026-09-09T08:00:00.000Z",
    selection,
    timezone: "Europe/Amsterdam"
  });
  const themePresentation = {
    ...frozen,
    appearance: createFieldflowRoyalBlueAppearance(),
    settingsRevision: 159,
    snapshotVersion: 2 as const
  };
  const editorial = payload.data.editorial as Record<string, unknown> | undefined;
  return playerDynamicTemplatePayloadSchema.parse({
    ...payload,
    data: {
      ...payload.data,
      _veyocastThemeRuntime: { version: 2 },
      editorial: {
        ...editorial,
        theme: createFieldflowRoyalBlueTheme(),
        themeSelection: selection
      },
      themePresentation
    },
    templateSlug: payload.templateSlug.replace("-light-", "-dark-")
  });
}

function priceData(withPhoto: boolean, theme: EditorialThemeConfig) {
  const products = Array.from({ length: 12 }, (_, index) => ({
    active: true,
    available: true,
    category: index < 6 ? "Warme dranken" : "Broodjes",
    currency: "EUR",
    description: index % 3 ? "Vers bereid met lokale ingrediënten" : null,
    externalId: `product-${index}`,
    id: `20000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    imageMediaAssetId: withPhoto && index % 2 === 0 ? imageId : null,
    name: index === 4
      ? "Tosti met extra lange Nederlandse productnaam"
      : `Clubproduct ${index + 1}`,
    priceMinor: 225 + index * 35,
    sortOrder: index,
    sourceUpdatedAt: "2026-08-13T09:00:00.000Z"
  }));
  const entries = (start: number, end: number) => [
    { category: start === 0 ? "Warme dranken" : "Broodjes", kind: "category" as const },
    ...products.slice(start, end).map((product) => ({
      kind: "product" as const,
      productId: product.id
    }))
  ];
  return {
    brand: { clubName: "Sportvereniging FieldFlow", primaryColor: "#169B62" },
    editorial: {
      newsVariant: "hero_split",
      priceList: {
        categoryPhotoModes: { Broodjes: withPhoto ? "show" : "reserve-empty" },
        columns: { left: entries(0, 6), right: entries(6, 12) },
        productFocalPoints: Object.fromEntries(products.map((product, index) => [
          product.id,
          { x: index % 2 ? 0.35 : 0.65, y: 0.45 }
        ]))
      },
      pricePhotoMode: withPhoto ? "show" : "reserve-empty",
      schemaVersion: 2,
      theme
    },
    menu: { products, title: "Clubkaart" },
    type: "menu"
  };
}

function newsData(variant: EditorialNewsVariant, theme: EditorialThemeConfig) {
  return {
    brand: { clubName: "Sportvereniging FieldFlow", primaryColor: "#169B62" },
    editorial: {
      newsFocalPoint: { x: 0.68, y: 0.36 },
      newsVariant: variant,
      pricePhotoMode: "show",
      schemaVersion: 2,
      theme
    },
    news: {
      articles: Array.from({ length: 4 }, (_, index) => ({
        author: "Redactie",
        externalId: `news-${index}`,
        heroMediaAssetId: variant === "text_only" ? null : imageId,
        intro: "Een compact bericht met alle relevante informatie voor leden en bezoekers van de vereniging.",
        link: `https://example.com/nieuws/${index}`,
        publishedAt: `2026-08-1${3 - index}T09:00:00.000Z`,
        qrMediaAssetId: imageId,
        sourceName: "Clubnieuws",
        title: index === 0
          ? "Een lange nieuwstitel die de Editorial Arena-clamp aantoonbaar beproeft"
          : `Nieuwsbericht ${index + 1}`
      })),
      secondsPerSlide: 10,
      sourceName: "Clubnieuws",
      title: "Laatste nieuws"
    },
    type: "news"
  };
}

function sportData(
  variant: typeof fixtureVariants[number],
  theme: EditorialThemeConfig
) {
  const special = [
    "team-roster",
    "sponsor-spotlight",
    "training-schedule",
    "volunteer-call"
  ].includes(variant);
  const count = special
    ? 8
    : variant.endsWith("-5") ? 5 : variant.endsWith("-10") ? 10 : 20;
  const standing = variant.startsWith("standing-");
  const results = variant.startsWith("results-");
  const slideType = variant === "team-roster"
    ? "sport_team"
    : variant === "sponsor-spotlight"
      ? "sport_sponsor"
      : variant === "training-schedule"
        ? "sport_trainings"
        : variant === "volunteer-call"
          ? "sport_volunteers"
          : standing
            ? "sport_standing"
            : results ? "sport_results" : "sport_program";
  const items = Array.from({ length: count }, (_, index) => standing ? ({
    drawn: index % 4,
    form: ["win", index % 2 ? "draw" : "loss", "win"],
    goalDifference: 22 - index,
    goalsAgainst: 10 + index,
    goalsFor: 32,
    id: `team-${index}`,
    lost: index % 3,
    played: 12,
    points: 34 - index,
    position: index + 1,
    selected: index === 6,
    teamName: index === 6 ? "Sportvereniging Editorial Lange Clubnaam" : `Vereniging ${index + 1}`,
    won: 10 - (index % 4),
    zone: index < 2 ? "promotion" : index >= count - 2 ? "relegation" : ""
  }) : special ? ({
    id: `${slideType}-${index}`,
    logoMediaAssetId: variant === "sponsor-spotlight" ? imageId : null,
    photoMediaAssetId: variant === "team-roster" ? imageId : null,
    primary: variant === "team-roster"
      ? `Selectiespeler met lange naam ${index + 1}`
      : variant === "sponsor-spotlight"
        ? `Clubpartner ${index + 1}`
        : variant === "training-schedule"
          ? `Team onder ${11 + index}`
          : `Vrijwilligersrol ${index + 1}`,
    secondary: variant === "training-schedule"
      ? "Dinsdag en donderdag · 19:30"
      : variant === "volunteer-call"
        ? "Gastheer of gastvrouw op wedstrijddagen"
        : "Eerste selectie",
    status: variant === "volunteer-call" ? "Open rol" : "Gepubliceerd",
    meta: variant === "sponsor-spotlight"
      ? "Samen sterk voor de vereniging"
      : "Sportpark FieldFlow"
  }) : ({
    awayScore: results ? index % 3 : null,
    awayTeam: `Uitclub ${index + 1}`,
    date: `za ${16 + index} aug`,
    field: `Veld ${index + 1}`,
    homeScore: results ? 3 - (index % 3) : null,
    homeTeam: index === 2 ? "Sportvereniging Editorial Lange Clubnaam" : `Thuisclub ${index + 1}`,
    id: `match-${index}`,
    meta: results ? "Definitief" : "Competitie",
    primary: `Thuisclub ${index + 1} – Uitclub ${index + 1}`,
    selected: index === 2,
    secondary: "Vierde klasse · Poule A",
    status: results ? "Gespeeld" : "Gepland",
    time: results ? "FT" : `${14 + (index % 5)}:30`,
    venue: `Veld ${index + 1}`,
    venueName: "Sportpark De Arena"
  }));
  return {
    brand: { clubName: "Sportvereniging FieldFlow", primaryColor: "#169B62" },
    editorial: {
      newsVariant: "hero_split",
      pricePhotoMode: "show",
      schemaVersion: 2,
      theme
    },
    sport: {
      competition: { name: "Vierde klasse" },
      items,
      pool: { name: "Poule A" },
      season: "2026/2027",
      title: standing
        ? "Stand"
        : results
          ? "Uitslagen"
          : variant === "team-roster"
            ? "Ons team"
            : variant === "sponsor-spotlight"
              ? "Clubpartners"
              : variant === "training-schedule"
                ? "Trainingen"
                : variant === "volunteer-call"
                  ? "Vrijwilligers"
                  : "Programma"
    },
    type: slideType
  };
}

function newsVariant(variant: typeof fixtureVariants[number]): EditorialNewsVariant {
  if (variant === "news-fullscreen") return "fullscreen_gradient";
  if (variant === "news-grid") return "news_grid";
  if (variant === "news-text-only") return "text_only";
  return "hero_split";
}

function encodePayload(payload: PlayerDynamicTemplatePayload) {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function withSportColumns(
  payload: PlayerDynamicTemplatePayload,
  columns: "one" | "two"
): PlayerDynamicTemplatePayload {
  const sport = payload.data.sport;
  if (!sport || typeof sport !== "object" || Array.isArray(sport)) {
    throw new Error("Sportfixture ontbreekt.");
  }
  return {
    ...payload,
    data: {
      ...payload.data,
      sport: {
        ...sport,
        displayConfig: { columns }
      }
    }
  };
}

function withSportItemCount(
  payload: PlayerDynamicTemplatePayload,
  count: number
): PlayerDynamicTemplatePayload {
  const sport = payload.data.sport;
  if (!sport || typeof sport !== "object" || Array.isArray(sport) ||
    !("items" in sport) || !Array.isArray(sport.items)) {
    throw new Error("Sportfixture-items ontbreken.");
  }
  return {
    ...payload,
    data: {
      ...payload.data,
      sport: {
        ...sport,
        items: sport.items.slice(0, count)
      }
    }
  };
}

function withHiddenField(
  payload: PlayerDynamicTemplatePayload
): PlayerDynamicTemplatePayload {
  const sport = payload.data.sport;
  if (!sport || typeof sport !== "object" || Array.isArray(sport) ||
    !("items" in sport) || !Array.isArray(sport.items)) {
    throw new Error("Sportfixture-items ontbreken.");
  }
  return {
    ...payload,
    data: {
      ...payload.data,
      sport: {
        ...sport,
        displayConfig: { columns: "one", showField: false },
        items: sport.items.map((item, index) => item && typeof item === "object" &&
          !Array.isArray(item) && index === 0
          ? {
              ...item,
              field: "Veld 7",
              venue: "Veld 7",
              venueName: "Sportpark Houtrust"
            }
          : item)
      }
    }
  };
}

function countForVariant(variant: typeof fixtureVariants[number]) {
  return variant.endsWith("-5") ? 5 : variant.endsWith("-10") ? 10 : 20;
}

function expectedMatchRowHeight(
  variant: typeof fixtureVariants[number],
  orientation: "landscape" | "portrait"
) {
  if (orientation === "landscape") return 115;
  return variant.startsWith("results-") ? 314 : 221;
}
