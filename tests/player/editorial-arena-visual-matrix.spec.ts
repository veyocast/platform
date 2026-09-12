import { expect, test, type Locator } from "@playwright/test";

import {
  freezeThemePresentation,
  themeCatalog,
  themeToEditorialTokens
} from "@veyocast/content-templates/theme-catalog";
import {
  createFieldflowRoyalBlueAppearance,
  createFieldflowRoyalBlueTheme,
  createRoyalCurrentSelection
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
const qrId = "10000000-0000-4000-8000-000000000004";
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

test("Royal Current-outputmatrix van 64 renderercombinaties", async ({ page }) => {
  test.setTimeout(180_000);
  await page.clock.setFixedTime(new Date("2026-09-06T13:33:00.000Z"));
  await page.emulateMedia({ reducedMotion: "reduce" });
  const requestedVariant = process.env.ROYAL_CURRENT_VARIANT;

  for (const variant of fixtureVariants) {
    if (requestedVariant && requestedVariant !== variant) continue;
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
          await expect(slide.locator(":scope > header"))
            .not.toContainText("VeyoCast");
          const geometry = await slide.evaluate((element) => {
            const content = element.querySelector(":scope > main");
            const footer = element.querySelector(":scope > footer");
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
            await expect(slide.locator("header")).toContainText(
              variant.startsWith("results-") ? /teamoverzicht/iu : /wedstrijddag/iu
            );
            await expect(slide.locator("footer")).toContainText(/\d+\s*\/\s*\d+/u);
            const rows = slide.locator(
              '[class*="arenaProgramRow"], [data-result-row]'
            );
            const geometry = await sportRowGeometry(rows, orientation);
            await expect(rows).toHaveCount(Math.min(countForVariant(variant), geometry.capacity));
            await assertSportRowsFill(rows, orientation);
            const firstRow = rows.first();
            const primary = firstRow.locator('[class*="arenaMatchPrimary"]');
            await expect(primary).toContainText("za 16 aug");
            await expect(primary).toContainText(variant.startsWith("results-") ? "FT" : "14:30");
            await expect(primary).toContainText("Thuisclub 1");
            await expect(primary).toContainText("Uitclub 1");
            if (variant.startsWith("program-")) {
              expect(await firstRow.locator('[data-field="time"]').evaluate((element) =>
                element.scrollWidth <= element.clientWidth
              )).toBe(true);
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
              expect(rowGeometry.secondaryFontRatio)
                .toBeCloseTo(orientation === "portrait" ? .48 : .52, 2);
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
            )).toBeCloseTo(orientation === "portrait" ? 24 : 28, 2);
            expect(await rows.first().locator(
              '[class*="arenaResultScore"]'
            ).evaluate(
              (element) => Number.parseFloat(getComputedStyle(element).fontSize)
            )).toBeCloseTo(46.5, 2);
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
              const rowBox = element.getBoundingClientRect();
              return {
                scoreAfterTeams: Boolean(
                  scoreBox && homeBox && awayBox &&
                  homeBox.right <= awayBox.left + 1 &&
                  scoreBox.left >= awayBox.right - 1 &&
                  scoreBox.right <= rowBox.right + 1
                )
              };
            });
            expect(scoreGeometry.scoreAfterTeams).toBe(true);
            if (orientation === "portrait") {
              expect(await rows.first().evaluate((element) => {
                const teams = Array.from(element.querySelectorAll<HTMLElement>(
                  '[data-field="home-team"], [data-field="away-team"]'
                ));
                return teams.every((team) => team.scrollWidth <= team.clientWidth);
              })).toBe(true);
            }
          }
          if (variant.startsWith("standing-") && orientation === "landscape") {
            const pinned = slide.getByTestId("standing-pinned-team").locator("article");
            await expect(slide.getByTestId("standing-summary")).toContainText(
              `Volledige stand · ${countForVariant(variant)} teams`
            );
            await expect(pinned).toBeVisible();
            const standingWindow = slide.locator('[data-standing-window]');
            const standingHeight = await standingWindow.evaluate((element) => element.clientHeight);
            await expect(standingWindow.locator(':scope > article')).toHaveCount(
              Math.min(countForVariant(variant), Math.floor((standingHeight + 6) / 76))
            );
            await expect(slide.locator('[class*="arenaStandingContext"]'))
              .toContainText("Poule A");
            const bounds = await standingWindow.evaluate((element) => ({
              last: element.lastElementChild?.getBoundingClientRect().bottom,
              context: element.closest('[data-render-family]')?.querySelector('p')?.getBoundingClientRect().top
            }));
            expect(bounds.last!).toBeLessThanOrEqual(bounds.context!);
            expect(await pinned.evaluate((element) => {
              const bounds = element.getBoundingClientRect();
              const children = Array.from(element.children).map((child) =>
                child.getBoundingClientRect()
              );
              return {
                allChildrenContained: children.every((child) =>
                  child.left >= bounds.left - 1 && child.right <= bounds.right + 1 &&
                  child.top >= bounds.top - 1 && child.bottom <= bounds.bottom + 1
                ),
                display: getComputedStyle(element).display,
                rowFits: element.scrollWidth <= element.clientWidth
              };
            })).toEqual({
              allChildrenContained: true,
              display: "grid",
              rowFits: true
            });
          }
          if (variant === "sponsor-spotlight") {
            const layout = slide.locator('[data-render-family="sponsor-spotlight"]');
            const cards = layout.locator(":scope > article");
            await expect(layout).toHaveAttribute("data-items", "1");
            await expect(cards).toHaveCount(1);
            await expect(slide.locator(":scope > footer")).toContainText("1 / 8");

            const geometry = await cards.first().evaluate((card) => {
              const cardBox = card.getBoundingClientRect();
              const plate = card.querySelector<HTMLElement>('[class*="arenaSponsorPlate"]');
              const copy = card.querySelector<HTMLElement>('[class*="arenaSponsorCopy"]');
              const image = plate?.querySelector<HTMLImageElement>("img");
              const plateBox = plate?.getBoundingClientRect();
              const copyBox = copy?.getBoundingClientRect();
              const imageBox = image?.getBoundingClientRect();
              const cardBackground = getComputedStyle(card).backgroundColor;
              const contrastRatio = (foreground: string, background: string) => {
                const channels = (value: string) => (
                  value.match(/[\d.]+/gu)?.slice(0, 3).map(Number) ?? []
                );
                const luminance = (value: string) => {
                  const [red = 0, green = 0, blue = 0] = channels(value).map(
                    (channel) => {
                      const normalized = channel / 255;
                      return normalized <= .04045
                        ? normalized / 12.92
                        : ((normalized + .055) / 1.055) ** 2.4;
                    }
                  );
                  return .2126 * red + .7152 * green + .0722 * blue;
                };
                const foregroundLuminance = luminance(foreground);
                const backgroundLuminance = luminance(background);
                return (Math.max(foregroundLuminance, backgroundLuminance) + .05) /
                  (Math.min(foregroundLuminance, backgroundLuminance) + .05);
              };
              const copyText = copy
                ? Array.from(copy.querySelectorAll<HTMLElement>("h2, p, strong"))
                : [];
              return {
                cardFits: card.scrollHeight <= card.clientHeight &&
                  card.scrollWidth <= card.clientWidth,
                copyContrasts: copyText.map((element) => contrastRatio(
                  getComputedStyle(element).color,
                  cardBackground
                )),
                copyInsideCard: Boolean(copyBox &&
                  copyBox.left >= cardBox.left - 1 && copyBox.right <= cardBox.right + 1 &&
                  copyBox.top >= cardBox.top - 1 && copyBox.bottom <= cardBox.bottom + 1),
                imageInsidePlate: Boolean(imageBox && plateBox &&
                  imageBox.left >= plateBox.left - 1 && imageBox.right <= plateBox.right + 1 &&
                  imageBox.top >= plateBox.top - 1 && imageBox.bottom <= plateBox.bottom + 1),
                imageObjectFit: image ? getComputedStyle(image).objectFit : "",
                plateInsideCard: Boolean(plateBox &&
                  plateBox.left >= cardBox.left - 1 && plateBox.right <= cardBox.right + 1 &&
                  plateBox.top >= cardBox.top - 1 && plateBox.bottom <= cardBox.bottom + 1),
                plateSeparatedFromCopy: Boolean(plateBox && copyBox && (
                  plateBox.right <= copyBox.left + 1 ||
                  plateBox.bottom <= copyBox.top + 1
                ))
              };
            });

            expect(geometry.cardFits).toBe(true);
            expect(geometry.plateInsideCard).toBe(true);
            expect(geometry.copyInsideCard).toBe(true);
            expect(geometry.imageInsidePlate).toBe(true);
            expect(geometry.imageObjectFit).toBe("contain");
            expect(geometry.plateSeparatedFromCopy).toBe(true);
            expect(geometry.copyContrasts.length).toBeGreaterThanOrEqual(3);
            expect(Math.min(...geometry.copyContrasts)).toBeGreaterThanOrEqual(4.5);
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
              columnGap: "22px",
              paddingLeft: "0px",
              paddingRight: "0px",
              rowGap: "22px"
            });
          }
          if (variant === "news-grid") {
            const newsGrid = slide.locator('[data-news-variant="news_grid"]');
            await expect(newsGrid.locator(':scope > [class*="arenaNewsGrid"] > article'))
              .toHaveCount(1);
            await expect(newsGrid).toContainText("Nieuwsbericht 2");
            await expect(slide.locator(":scope > footer")).toContainText(/1\s*\/\s*2/u);
            if (orientation === "portrait") {
              const titleAndContent = await slide.evaluate((element) => {
                const title = element.querySelector<HTMLElement>(':scope > [class*="royalTitle"]');
                const content = element.querySelector<HTMLElement>(':scope > [class*="arenaContent"]');
                const heading = title?.querySelector<HTMLElement>("h1");
                const titleBox = title?.getBoundingClientRect();
                const contentBox = content?.getBoundingClientRect();
                const headingBox = heading?.getBoundingClientRect();
                const headingLineHeight = heading
                  ? Number.parseFloat(getComputedStyle(heading).lineHeight)
                  : 0;
                return {
                  headingInsideTitle: Boolean(headingBox && titleBox &&
                    headingBox.left >= titleBox.left - 1 &&
                    headingBox.right <= titleBox.right + 1 &&
                    headingBox.top >= titleBox.top - 1 &&
                    headingBox.bottom <= titleBox.bottom + 1),
                  headingMaxTwoLines: Boolean(headingBox && headingLineHeight &&
                    headingBox.height <= headingLineHeight * 2 + 1),
                  titleBeforeContent: Boolean(titleBox && contentBox &&
                    titleBox.bottom <= contentBox.top + 1),
                  titleFits: Boolean(title &&
                    title.scrollHeight <= title.clientHeight + 1 &&
                    title.scrollWidth <= title.clientWidth + 1)
                };
              });
              expect(titleAndContent).toEqual({
                headingInsideTitle: true,
                headingMaxTwoLines: true,
                titleBeforeContent: true,
                titleFits: true
              });
            }
          }
          if (variant.startsWith("price-")) {
            const priceList = slide.locator('[data-render-family="price-list"]');
            const photoAside = priceList.locator(':scope > [class*="royalPriceAside"]');
            await expect(priceList).toBeVisible();
            await expect(slide.locator('[data-render-family="menu"]')).toHaveCount(0);
            await expect(photoAside).toHaveAttribute(
              "data-image",
              variant === "price-with-photo" ? "visible" : "missing"
            );
            await expect(photoAside.locator(":scope > img")).toHaveCount(
              variant === "price-with-photo" ? 1 : 0
            );
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
              .not.toContainText("Scan voor het artikel");
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
              // The white QR container aligns with the provider logo. Its
              // image keeps the mandatory 16 px quiet-zone inside that edge.
              expect(composition.qrImageRightGap).toBeGreaterThanOrEqual(108);
              expect(composition.qrImageRightGap).toBeLessThanOrEqual(110);
              expect(composition.sourceRightGap).toBeGreaterThanOrEqual(91);
              expect(composition.sourceRightGap).toBeLessThanOrEqual(93);
              expect(composition.qrViewportBottomGap).toBeGreaterThanOrEqual(105);
              expect(composition.qrViewportBottomGap).toBeLessThanOrEqual(107);
              expect(composition.qrViewportRightGap).toBeGreaterThanOrEqual(133);
              expect(composition.qrViewportRightGap).toBeLessThanOrEqual(135);
              expect(composition.storyWidthRatio).toBeGreaterThanOrEqual(0.48);
              expect(composition.storyWidthRatio).toBeLessThanOrEqual(0.5);
              expect(composition.storyTopRatio).toBeGreaterThanOrEqual(0.027);
              expect(composition.storyTopRatio).toBeLessThanOrEqual(0.029);
            } else {
              expect(composition.overlay).toContain("28%");
              expect(composition.overlay).toContain("40%");
              expect(composition.overlay).toContain("50%");
              expect(composition.introFontSize).toBeGreaterThanOrEqual(32);
              expect(composition.qrBottomGap).toBeGreaterThanOrEqual(60);
              expect(composition.qrBottomGap).toBeLessThanOrEqual(62);
              expect(composition.qrRightGap).toBeGreaterThanOrEqual(60);
              expect(composition.qrRightGap).toBeLessThanOrEqual(62);
              expect(composition.qrViewportBottomGap).toBeGreaterThanOrEqual(143);
              expect(composition.qrViewportBottomGap).toBeLessThanOrEqual(145);
              expect(composition.qrViewportRightGap).toBeGreaterThanOrEqual(98);
              expect(composition.qrViewportRightGap).toBeLessThanOrEqual(100);
              expect(composition.storyHeightRatio).toBeGreaterThanOrEqual(0.459);
              expect(composition.storyHeightRatio).toBeLessThanOrEqual(0.461);
              expect(composition.storyTopRatio).toBeGreaterThanOrEqual(0.524);
              expect(composition.storyTopRatio).toBeLessThanOrEqual(0.526);
            }
          }
          const screenshotExpectation = process.env.ROYAL_CURRENT_CAPTURE_ALL === "1"
            ? expect.soft(page)
            : expect(page);
          await screenshotExpectation.toHaveScreenshot(
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
        const rowLayout = await sportRowGeometry(rows, orientation);
        await expect(rows).toHaveCount(Math.min(20, rowLayout.capacity * (orientation === "landscape" ? 2 : 1)));
        await assertSportRowsFill(rows, orientation);
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
          ).first()).toContainText(`Thuisclub ${rowLayout.capacity + 1}`);
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
            const row = element.getBoundingClientRect();
            return Boolean(
              home && result && away &&
              home.right <= away.left + 1 &&
              result.left >= away.right - 1 && result.right <= row.right + 1
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

  await test.step("één staande uitslag benut de beschikbare lijsthoogte", async () => {
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
    expect(geometry.height).toBeGreaterThan(180);
    expect(geometry.ratioToContent).toBeCloseTo(1, 2);
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

  await test.step("alle optionele programmavelden blijven zichtbaar en geordend", async () => {
    for (const orientation of ["landscape", "portrait"] as const) {
      await page.setViewportSize(orientation === "landscape"
        ? { height: 1080, width: 1920 }
        : { height: 1920, width: 1080 });
      const payload = withCompleteProgramFields(
        buildPayload("program-5", orientation, "light")
      );
      await page.goto("about:blank");
      await page.goto(`${playerURL}/thumbnail#payload=${encodePayload(payload)}`);
      await page.waitForFunction(
        () => document.documentElement.dataset.thumbnailReady === "true"
      );

      const row = page.locator('[class*="arenaProgramRow"]').first();
      expect(await row.locator(
        ':scope > [class*="arenaMatchPrimary"] > [data-field]'
      ).evaluateAll((fields) => fields.map((field) => field.getAttribute("data-field"))))
        .toEqual([
          "date", "time", "home-logo", "home-team", "home-room", "versus",
          "away-logo", "away-team", "away-room"
        ]);
      await expect(row.locator('[data-field="home-room"]')).toHaveText("Kleedkamer 1A");
      await expect(row.locator('[data-field="away-room"]')).toHaveText("Kleedkamer 2B");
      const secondary = row.locator('[class*="arenaMatchSecondary"]');
      expect(await secondary.locator('[data-field]').evaluateAll((fields) =>
        fields.map((field) => field.getAttribute("data-field"))))
        .toEqual(["referee", "field", "sportpark"]);
      await expect(secondary).toContainText("Scheidsrechter: M. de Vries");
      await expect(secondary).toContainText("Veld: 1");
      await expect(secondary).toContainText("Sportpark: De Arena");
      expect(await row.evaluate((element) => (
        element.scrollHeight <= element.clientHeight &&
        element.scrollWidth <= element.clientWidth
      ))).toBe(true);
    }
  });

  await test.step("uitslagen verbergen opties onafhankelijk en verzinnen geen score", async () => {
    await page.setViewportSize({ height: 1080, width: 1920 });
    const payload = withUnknownResultAndHiddenOptions(
      buildPayload("results-5", "landscape", "light")
    );
    await page.goto("about:blank");
    await page.goto(`${playerURL}/thumbnail#payload=${encodePayload(payload)}`);
    await page.waitForFunction(
      () => document.documentElement.dataset.thumbnailReady === "true"
    );

    const row = page.locator("[data-result-row]").first();
    expect(await row.locator(
      ':scope > [class*="arenaMatchPrimary"] > [data-field]'
    ).evaluateAll((fields) => fields.map((field) => field.getAttribute("data-field"))))
      .toEqual(["home-team", "score", "away-team"]);
    const score = row.locator('[data-field="score"]');
    await expect(score).toHaveAttribute("aria-label", "Uitslag nog niet bekend");
    await expect(score).toBeEmpty();
  });
});

test("staande splitnieuwsslide volgt het v8-raster met 22 px tussenruimte", async ({ page }) => {
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
    paddingLeft: "0px",
    paddingRight: "0px",
    rowGap: "22px"
  });
});

test("Royal Current vergroot wedstrijdinformatie binnen hoogteafhankelijke rijen", async ({ page }) => {
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

      const slide = page.locator('[data-slide-type][data-theme-id="fieldflow"]');
      const rows = slide.locator(
        '[class*="arenaProgramRow"], [data-result-row]'
      );
      await expect(slide).toBeVisible();
      expect(await slide.evaluate((element) => ({
        background: getComputedStyle(element).getPropertyValue("--bg").trim(),
        baseScale: getComputedStyle(element).getPropertyValue("--vc-theme-base-scale").trim(),
        color: getComputedStyle(element).color,
        sportScale: getComputedStyle(element).getPropertyValue("--vc-theme-sport-scale").trim()
      }))).toEqual({
        background: "#0a1124",
        baseScale: "1.05",
        color: "rgb(245, 247, 251)",
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
        geometry.height >= 90 &&
        geometry.scrollHeight <= geometry.clientHeight &&
        geometry.scrollWidth <= geometry.clientWidth
      ))).toBe(true);

      await assertSportRowsFill(rows, "landscape");
      const firstRow = rows.first();
      expect(await firstRow.evaluate((element) => ({
        background: getComputedStyle(element).backgroundColor,
        fontSize: Number.parseFloat(getComputedStyle(element).fontSize)
      }))).toEqual({
        background: "rgb(23, 33, 58)",
        fontSize: variant === "program-5" ? 39.2 : 29.4
      });
      if (variant === "program-5") {
        expect(await firstRow.locator('[class*="arenaMatchSecondary"]').evaluate(
          (element) => Number.parseFloat(getComputedStyle(element).fontSize)
        )).toBeCloseTo(20.384, 2);
      } else {
        expect(await firstRow.locator('[class*="arenaResultScore"]').evaluate(
          (element) => Number.parseFloat(getComputedStyle(element).fontSize)
        )).toBeCloseTo(61.74, 2);
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
    appearance: createFieldflowRoyalBlueAppearance(),
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
    ? "price_list"
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
      },
      [qrId]: {
        bytes: 2_468,
        checksumSha256: "c".repeat(64),
        mimeType: "image/svg+xml",
        url: `${playerURL}/royal-current-news-qr.svg`
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
  const selection = createRoyalCurrentSelection(
    undefined,
    themeCatalog.fieldflow.version,
    "dark"
  );
  const frozen = freezeThemePresentation({
    instant: "2026-09-09T08:00:00.000Z",
    selection,
    timezone: "Europe/Amsterdam"
  });
  const baseAppearance = createFieldflowRoyalBlueAppearance();
  const themePresentation = {
    ...frozen,
    appearance: {
      ...baseAppearance,
      typography: {
        ...baseAppearance.typography,
        baseScale: 1.05,
        sportScale: 1.4
      }
    },
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
        theme: createFieldflowRoyalBlueTheme("dark"),
        themeSelection: selection
      },
      themePresentation
    },
    templateSlug: payload.templateSlug.replace("-light-", "-dark-")
  });
}

function priceData(withPhoto: boolean, theme: EditorialThemeConfig) {
  const productNames = [
    "Koffie",
    "Cappuccino",
    "Thee",
    "Broodje gezond",
    "Broodje kroket",
    "Broodje bal gehakt"
  ] as const;
  const product = (index: number) => ({
    description: index % 2 ? "Vers bereid met lokale ingrediënten" : "",
    formattedPrice: `€ ${((225 + index * 50) / 100).toFixed(2).replace(".", ",")}`,
    id: `product-${index + 1}`,
    imageFocalPoint: { x: index % 2 ? 0.35 : 0.65, y: 0.45 },
    imageMediaAssetId: withPhoto && index === 0 ? imageId : null,
    name: productNames[index] ?? `Clubproduct ${index + 1}`,
    photoVisible: withPhoto && index === 0
  });
  return {
    brand: { clubName: "Sportvereniging FieldFlow", primaryColor: "#169B62" },
    editorial: {
      newsVariant: "hero_split",
      pricePhotoMode: withPhoto ? "show" : "reserve-empty",
      schemaVersion: 2,
      theme
    },
    priceList: {
      sections: [
        {
          column: "left",
          id: "warme-dranken",
          name: "Warme dranken",
          order: 0,
          products: Array.from({ length: 3 }, (_, index) => product(index))
        },
        {
          column: "right",
          id: "broodjes",
          name: "Broodjes",
          order: 1,
          products: Array.from({ length: 3 }, (_, index) => product(index + 3))
        }
      ],
      title: "Clubkaart"
    },
    type: "price_list"
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
        link: `https://www.veyocast.nl/clubnieuws/royal-current-${index + 1}`,
        publishedAt: `2026-08-1${3 - index}T09:00:00.000Z`,
        qrMediaAssetId: qrId,
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

function withCompleteProgramFields(
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
        displayConfig: {
          columns: "one",
          showAwayDressingRoom: true,
          showAwayLogo: true,
          showDate: true,
          showField: true,
          showHomeDressingRoom: true,
          showHomeLogo: true,
          showReferee: true,
          showSportpark: true,
          showTime: true
        },
        items: sport.items.map((item, index) => item && typeof item === "object" &&
          !Array.isArray(item) && index === 0
          ? {
              ...item,
              awayRoom: "2B",
              homeRoom: "1A",
              officials: [{ displayName: "M. de Vries", role: "Scheidsrechter" }]
            }
          : item)
      }
    }
  };
}

function withUnknownResultAndHiddenOptions(
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
        displayConfig: {
          columns: "one",
          showAwayLogo: false,
          showDate: false,
          showHomeLogo: false,
          showTime: false
        },
        items: sport.items.map((item, index) => item && typeof item === "object" &&
          !Array.isArray(item) && index === 0
          ? { ...item, awayScore: null, homeScore: null }
          : item)
      }
    }
  };
}

function countForVariant(variant: typeof fixtureVariants[number]) {
  return variant.endsWith("-5") ? 5 : variant.endsWith("-10") ? 10 : 20;
}

async function sportRowGeometry(rows: Locator, orientation: "landscape" | "portrait") {
  const box = await rows.first().evaluate((element) => {
    const list = element.parentElement!;
    return { height: list.clientHeight, gap: parseFloat(getComputedStyle(list).rowGap) || 0 };
  });
  const minimum = orientation === "landscape" ? 90 : 180;
  return { ...box, capacity: Math.max(1, Math.floor((box.height + box.gap) / (minimum + box.gap))) };
}
async function assertSportRowsFill(rows: Locator, orientation: "landscape" | "portrait") {
  const geometry = await rows.evaluateAll((elements) => elements.map((element) => {
    const box = element.getBoundingClientRect();
    const list = element.parentElement!;
    const listBox = list.getBoundingClientRect();
    return { height: box.height, top: box.top, bottom: box.bottom, listTop: listBox.top,
      listBottom: listBox.bottom, last: element === list.lastElementChild };
  }));
  for (const row of geometry) {
    expect(row.height).toBeGreaterThanOrEqual(orientation === "landscape" ? 89 : 179);
    expect(row.top).toBeGreaterThanOrEqual(row.listTop - 2);
    expect(row.bottom).toBeLessThanOrEqual(row.listBottom + 2);
    if (row.last) expect(row.listBottom - row.bottom).toBeLessThan(20);
  }
}
