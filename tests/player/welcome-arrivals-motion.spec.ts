import { expect, test } from "@playwright/test";

import type {
  PlayerDynamicTemplatePayload,
  SportlinkArrivalMotionPreset
} from "@veyocast/contracts";
import { playerDynamicTemplatePayloadSchema } from "@veyocast/contracts";
import {
  createFieldflowRoyalBlueAppearance,
  createFieldflowRoyalBlueTheme,
  createRoyalCurrentSelection
} from "@veyocast/content-templates";
import {
  freezeThemePresentation,
  themeCatalog
} from "@veyocast/content-templates/theme-catalog";

const playerURL = `http://127.0.0.1:${process.env.PLAYER_PORT ?? 3106}`;
const logoId = "10000000-0000-4000-8000-000000000091";
const presets = [
  "aurora-rise",
  "spotlight-bloom",
  "kinetic-split",
  "prism-swipe",
  "grand-flip"
] as const satisfies readonly SportlinkArrivalMotionPreset[];
const themePresentation = freezeThemePresentation({
  instant: "2026-09-07T11:51:00.000Z",
  selection: {
    accent: null,
    categoryOverrides: [],
    modePolicy: { kind: "fixed", mode: "light" },
    ref: {
      catalog: "v2",
      id: "fieldflow",
      version: themeCatalog.fieldflow.version
    },
    support: null
  },
  timezone: "Europe/Amsterdam"
});

test("welkomstslides bieden vijf motionpresets met een stabiel eindbeeld", async ({ page }) => {
  for (const preset of presets) {
    await test.step(preset, async () => {
      await page.goto("about:blank");
      await page.goto(`${playerURL}/thumbnail#payload=${encodePayload(payload(preset))}`);
      await page.waitForFunction(
        () => document.documentElement.dataset.thumbnailReady === "true"
      );
      const card = page.locator("[data-motion]");
      await expect(card).toHaveAttribute("data-motion", preset);
      expect(await card.evaluate((element) => getComputedStyle(element).animationName))
        .not.toBe("none");
      await page.waitForTimeout(1_650);
      const geometry = await card.evaluate((element) => {
        const box = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          bottom: box.bottom,
          opacity: style.opacity,
          overflow: style.overflow,
          right: box.right,
          viewportHeight: window.innerHeight,
          viewportWidth: window.innerWidth
        };
      });
      expect(geometry.opacity).toBe("1");
      expect(geometry.right).toBeLessThanOrEqual(geometry.viewportWidth);
      expect(geometry.bottom).toBeLessThanOrEqual(geometry.viewportHeight);
      expect(geometry.overflow).toBe("hidden");
    });
  }
});

test("welkomstmotion respecteert verminderde beweging", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`${playerURL}/thumbnail#payload=${encodePayload(payload("auto"))}`);
  await page.waitForFunction(
    () => document.documentElement.dataset.thumbnailReady === "true"
  );
  const card = page.locator("[data-motion]");
  await expect(card).toHaveAttribute("data-motion", "aurora-rise");
  expect(await card.evaluate((element) => getComputedStyle(element).animationName))
    .toBe("none");
});

test("welkomstraster gebruikt maximaal twee vaste halve slots", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-09-07T11:51:00.000Z"));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ height: 1080, width: 1920 });

  for (const count of [1, 2, 4]) {
    await test.step(`${count} wedstrijd${count === 1 ? "" : "en"}`, async () => {
      await page.goto("about:blank");
      await page.goto(`${playerURL}/thumbnail#payload=${encodePayload(payload("auto", count))}`);
      await page.waitForFunction(
        () => document.documentElement.dataset.thumbnailReady === "true"
      );
      const grid = page.locator("[data-cards]");
      const visibleCards = Math.min(count, 2);
      await expect(grid).toHaveAttribute("data-arrival-kind", "visitor");
      await expect(grid).toHaveAttribute("data-cards", String(visibleCards));
      await expect(page.locator("[data-page-count]"))
        .toHaveAttribute("data-page-count", String(Math.ceil(count / 2)));
      const geometry = await grid.evaluate((element) => {
        const gridBox = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        const cards = Array.from(element.children).map((child) => {
          const box = child.getBoundingClientRect();
          return {
            height: box.height,
            left: box.left - gridBox.left,
            top: box.top - gridBox.top,
            width: box.width
          };
        });
        return {
          cards,
          columns: style.gridTemplateColumns.split(" ").filter(Boolean).length,
          height: gridBox.height,
          rows: style.gridTemplateRows.split(" ").filter(Boolean).length,
          width: gridBox.width
        };
      });
      expect(geometry.columns).toBe(2);
      expect(geometry.rows).toBe(1);
      expect(geometry.cards).toHaveLength(visibleCards);
      expect(geometry.cards[0]?.left).toBeLessThan(2);
      expect(geometry.cards[0]?.top).toBeLessThan(2);
      expect(geometry.cards[0]?.width).toBeGreaterThan(geometry.width * 0.45);
      expect(geometry.cards[0]?.width).toBeLessThan(geometry.width * 0.52);
      expect(geometry.cards[0]?.height).toBeGreaterThan(geometry.height * 0.98);
      if (count === 1) {
        expect(geometry.cards).toHaveLength(1);
      } else {
        expect(geometry.cards[1]?.left).toBeGreaterThan(geometry.width * 0.48);
      }
      await expect(page.getByRole("heading", { level: 1 }))
        .toHaveText("Welkom bezoekende teams");
      const header = page.locator("header");
      await expect(header.getByText("Welkom op Sportpark Houtrust!", { exact: true }))
        .toBeVisible();
      await expect(header.locator("time"))
        .toHaveText("07-09-2026 | 13:51");
      await expect(header).not.toContainText("VeyoCast");
      await expect(page.locator('img[aria-hidden="true"]')).toHaveCount(visibleCards);
      await expect(page.locator(`img[alt^="Logo "]`)).toHaveCount(visibleCards);
      expect(await page.locator('img[aria-hidden="true"]').first().evaluate(
        (element) => ({
          objectFit: getComputedStyle(element).objectFit,
          opacity: getComputedStyle(element).opacity
        })
      )).toEqual({ objectFit: "cover", opacity: "0.3" });
      const firstCard = grid.locator("article").first();
      await expect(firstCard).toContainText("07-09-2026");
      await expect(firstCard).toContainText("Aanvang: 14:30");
      await expect(firstCard).toContainText("Duindorp sv JO15-1");
      await expect(firstCard).toContainText("Bezoekers FC");
      await expect(firstCard).toContainText("Kleedkamers:");
      await expect(firstCard).toContainText(/Thuis:\s*1\s*\|\s*Uit:\s*2/u);
      await expect(firstCard).toContainText(/Veld:\s*1/u);
      await expect(firstCard).toContainText(/Scheidsrechter:\s*Sam Scheidsrechter/u);
      await expect(firstCard).not.toContainText("Aankomst");
      await expect(firstCard.locator(":scope > span, :scope > b, :scope > strong"))
        .toHaveCount(0);
      const typography = await firstCard.evaluate((element) => {
        const schedule = Array.from(element.querySelectorAll<HTMLElement>(
          '[class*="arenaVisitorSchedule"] > time, [class*="arenaVisitorSchedule"] > span'
        ));
        const teamNames = Array.from(element.querySelectorAll<HTMLElement>("h2 > span"));
        const details = Array.from(element.querySelectorAll<HTMLElement>(
          '[class*="arenaVisitorDetails"] dt, [class*="arenaVisitorDetails"] dd'
        ));
        const detailBlock = element.querySelector<HTMLElement>(
          '[class*="arenaVisitorDetails"]'
        );
        const detailRows = Array.from(detailBlock?.children ?? []);
        const copy = element.querySelector<HTMLElement>(
          '[class*="arenaVisitorArrivalCopy"]'
        );
        const detailBox = detailBlock?.getBoundingClientRect();
        const copyBox = copy?.getBoundingClientRect();
        return {
          detailBottomGap: detailBox && copyBox ? copyBox.bottom - detailBox.bottom : null,
          detailGridColumns: detailRows.map((row) =>
            getComputedStyle(row).gridTemplateColumns
          ),
          detailLabelLefts: detailRows.map((row) =>
            row.querySelector("dt")?.getBoundingClientRect().left
          ),
          detailLabelValueGaps: detailRows.map((row) => {
            const label = row.querySelector("dt");
            const value = row.querySelector("dd");
            if (!label || !value) {
              return null;
            }
            const labelText = document.createRange();
            labelText.selectNodeContents(label);
            return value.getBoundingClientRect().left - labelText.getBoundingClientRect().right;
          }),
          detailSizes: details.map((detail) => parseFloat(getComputedStyle(detail).fontSize)),
          detailValueLefts: detailRows.map((row) =>
            row.querySelector("dd")?.getBoundingClientRect().left
          ),
          scheduleLefts: schedule.map((line) => line.getBoundingClientRect().left),
          scheduleSizes: schedule.map((line) => parseFloat(getComputedStyle(line).fontSize)),
          teamLefts: teamNames.map((team) => team.getBoundingClientRect().left),
          teamSizes: teamNames.map((team) => parseFloat(getComputedStyle(team).fontSize))
        };
      });
      expect(typography.scheduleSizes).toEqual([46, 46]);
      expect(typography.teamSizes).toEqual([46, 46]);
      expect(typography.detailSizes).toEqual([23, 23, 23, 23, 23, 23]);
      expect(typography.scheduleLefts[0]).toBeCloseTo(typography.scheduleLefts[1]!, 2);
      expect(typography.teamLefts[0]).toBeCloseTo(typography.teamLefts[1]!, 2);
      expect(new Set(typography.detailLabelLefts).size).toBe(1);
      expect(new Set(typography.detailValueLefts).size).toBe(1);
      expect(typography.detailLabelValueGaps.every((gap) => gap !== null && gap >= 11.5))
        .toBe(true);
      expect(typography.detailGridColumns.every((columns) =>
        columns.startsWith("220px ")
      )).toBe(true);
      expect(typography.detailBottomGap).toBeCloseTo(0, 2);
      expect(await page.locator(`img[alt^="Logo "]`).first().locator("..").evaluate(
        (element) => getComputedStyle(element).backgroundColor
      )).toBe("rgb(255, 255, 255)");
      if (count <= 2) {
        await expect(page).toHaveScreenshot(`welkomstgrid-${count}-landscape.png`, {
          animations: "disabled",
          caret: "hide",
          maxDiffPixelRatio: 0.002
        });
      }
    });
  }
});

test("staand welkomstraster gebruikt boven en onder", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-09-07T11:51:00.000Z"));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ height: 1920, width: 1080 });
  for (const count of [1, 2]) {
    await page.goto("about:blank");
    await page.goto(`${playerURL}/thumbnail#payload=${encodePayload({
      ...payload("auto", count),
      orientation: "portrait",
      templateSlug: "editorial-arena-bezoekers-aankomst-light-portrait"
    })}`);
    await page.waitForFunction(
      () => document.documentElement.dataset.thumbnailReady === "true"
    );
    const title = page.getByRole("heading", { level: 1 });
    await expect(title).toHaveText("Welkom bezoekende teams");
    await expect(title).toBeVisible();
    await expect(page.locator("header").getByText(
      "Welkom op Sportpark Houtrust!",
      { exact: true }
    )).toBeVisible();
    await expect(page.locator("header time"))
      .toHaveText("07-09-2026 | 13:51");
    const titleGeometry = await title.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      text: element.textContent?.trim()
    }));
    expect(titleGeometry.text).toBe("Welkom bezoekende teams");
    expect(titleGeometry.scrollWidth).toBeLessThanOrEqual(titleGeometry.clientWidth + 1);
    const grid = page.locator("[data-cards]");
    const geometry = await grid.evaluate((element) => {
      const gridBox = element.getBoundingClientRect();
      const cards = Array.from(element.children).map((child) => {
        const box = child.getBoundingClientRect();
        return { height: box.height, top: box.top - gridBox.top };
      });
      return {
        cards,
        clientWidth: element.clientWidth,
        columns: getComputedStyle(element).gridTemplateColumns
          .split(" ").filter(Boolean).length,
        height: gridBox.height,
        rows: getComputedStyle(element).gridTemplateRows
          .split(" ").filter(Boolean).length,
        scrollWidth: element.scrollWidth
      };
    });
    expect(geometry.columns).toBe(1);
    expect(geometry.rows).toBe(2);
    expect(geometry.scrollWidth).toBe(geometry.clientWidth);
    expect(geometry.cards[0]?.top).toBeLessThan(2);
    expect(geometry.cards[0]?.height).toBeGreaterThan(geometry.height * 0.45);
    expect(geometry.cards[0]?.height).toBeLessThan(geometry.height * 0.52);
    if (count === 1) {
      expect(geometry.cards).toHaveLength(1);
    } else {
      expect(geometry.cards[1]?.top).toBeGreaterThan(geometry.height * 0.48);
    }
    const firstCard = grid.locator("article").first();
    await expect(firstCard).toContainText("Duindorp sv JO15-1");
    await expect(firstCard).toContainText("Bezoekers FC");
    await expect(firstCard).toContainText(/Scheidsrechter:\s*Sam Scheidsrechter/u);
    const typography = await firstCard.evaluate((element) => {
      const schedule = Array.from(element.querySelectorAll<HTMLElement>(
        '[class*="arenaVisitorSchedule"] > time, [class*="arenaVisitorSchedule"] > span'
      ));
      const details = Array.from(element.querySelectorAll<HTMLElement>(
        '[class*="arenaVisitorDetails"] dt, [class*="arenaVisitorDetails"] dd'
      ));
      const detailBlock = element.querySelector<HTMLElement>(
        '[class*="arenaVisitorDetails"]'
      );
      const firstDetailRow = detailBlock?.firstElementChild;
      const detailRows = Array.from(detailBlock?.children ?? []);
      const copy = element.querySelector<HTMLElement>(
        '[class*="arenaVisitorArrivalCopy"]'
      );
      const detailBox = detailBlock?.getBoundingClientRect();
      const copyBox = copy?.getBoundingClientRect();
      return {
        detailBottomGap: detailBox && copyBox ? copyBox.bottom - detailBox.bottom : null,
        detailGridColumns: firstDetailRow
          ? getComputedStyle(firstDetailRow).gridTemplateColumns
          : "",
        detailLabelValueGaps: detailRows.map((row) => {
          const label = row.querySelector("dt");
          const value = row.querySelector("dd");
          if (!label || !value) {
            return null;
          }
          const labelText = document.createRange();
          labelText.selectNodeContents(label);
          return value.getBoundingClientRect().left - labelText.getBoundingClientRect().right;
        }),
        detailSizes: details.map((detail) =>
          Number.parseFloat(getComputedStyle(detail).fontSize)
        ),
        scheduleLefts: schedule.map((line) => line.getBoundingClientRect().left),
        scheduleSizes: schedule.map((line) =>
          Number.parseFloat(getComputedStyle(line).fontSize)
        )
      };
    });
    expect(typography.scheduleSizes).toEqual([52, 52]);
    expect(typography.scheduleLefts[0]).toBeCloseTo(typography.scheduleLefts[1]!, 2);
    expect(typography.detailSizes).toEqual([26, 26, 26, 26, 26, 26]);
    expect(typography.detailLabelValueGaps.every((gap) => gap !== null && gap >= 11.5))
      .toBe(true);
    expect(typography.detailGridColumns).toMatch(/^245px /u);
    expect(typography.detailBottomGap).toBeCloseTo(0, 2);
    await expect(page).toHaveScreenshot(`welkomstgrid-${count}-portrait.png`, {
      animations: "disabled",
      caret: "hide",
      maxDiffPixelRatio: 0.002
    });
  }
});

test("Royal blauwe welkomstslide vergroot alle bezoekinformatie zonder overflow", async ({
  page
}) => {
  await page.clock.setFixedTime(new Date("2026-09-09T08:00:00.000Z"));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ height: 1080, width: 1920 });
  await page.goto(
    `${playerURL}/thumbnail#payload=${encodePayload(royalBluePayload())}`
  );
  await page.waitForFunction(
    () => document.documentElement.dataset.thumbnailReady === "true"
  );

  const slide = page.locator('[data-theme-id="fieldflow"]');
  const masthead = slide.locator("header");
  const firstCard = slide.locator('article[data-arrival-kind="visitor"]').first();
  const schedule = firstCard.locator(
    '[class*="royalArrivalSchedule"] dd'
  );
  const teams = firstCard.locator('[class*="royalArrivalIdentity"] h2');
  const details = firstCard.locator(
    '[class*="royalArrivalInfo"] dt, [class*="royalArrivalInfo"] dd'
  );

  await expect(slide).toBeVisible();
  expect(await slide.evaluate((element) => ({
    background: getComputedStyle(element).backgroundColor,
    backgroundImage: getComputedStyle(element).backgroundImage,
    baseScale: getComputedStyle(element)
      .getPropertyValue("--vc-theme-base-scale").trim(),
    color: getComputedStyle(element).color,
    sportScale: getComputedStyle(element)
      .getPropertyValue("--vc-theme-sport-scale").trim()
  }))).toEqual({
    background: "rgba(0, 0, 0, 0)",
    backgroundImage: expect.stringContaining("linear-gradient"),
    baseScale: "1.05",
    color: "rgb(245, 247, 251)",
    sportScale: "1.4"
  });
  expect(await masthead.evaluate(
    (element) => getComputedStyle(element).backgroundColor
  )).toContain("0.0901961");
  expect(await teams.first().evaluate(
    (element) => getComputedStyle(element).color
  )).toBe("rgb(245, 247, 251)");

  const scheduleSizes = await schedule.evaluateAll((elements) => elements.map((element) =>
    Number.parseFloat(getComputedStyle(element).fontSize)
  ));
  expect(scheduleSizes).toHaveLength(3);
  expect(scheduleSizes[0]).toBeGreaterThan(40);
  expect(scheduleSizes[1]).toBeGreaterThan(28);
  expect(scheduleSizes[2]).toBeGreaterThan(40);
  const teamSizes = await teams.evaluateAll((elements) => elements.map((element) =>
    Number.parseFloat(getComputedStyle(element).fontSize)
  ));
  expect(teamSizes).toEqual([67.2]);
  const detailSizes = await details.evaluateAll((elements) => elements.map((element) =>
    Number.parseFloat(getComputedStyle(element).fontSize)
  ));
  expect(detailSizes.length).toBeGreaterThanOrEqual(6);
  expect(detailSizes.filter((_, index) => index % 2 === 0).every((size) => size > 16))
    .toBe(true);
  expect(detailSizes.filter((_, index) => index % 2 === 1).every((size) => size > 28))
    .toBe(true);

  expect(await slide.evaluate((element) => {
    const card = element.querySelector<HTMLElement>(
      'article[data-arrival-kind="visitor"]'
    );
      const copy = card?.querySelector<HTMLElement>(
      '[class*="royalArrivalBody"]'
      );
    return {
      cardFits: Boolean(card &&
        card.scrollHeight <= card.clientHeight &&
        card.scrollWidth <= card.clientWidth),
      copyFits: Boolean(copy &&
        copy.scrollHeight <= copy.clientHeight &&
        copy.scrollWidth <= copy.clientWidth),
      slideFits: element.scrollHeight <= element.clientHeight &&
        element.scrollWidth <= element.clientWidth
    };
  })).toEqual({ cardFits: true, copyFits: true, slideFits: true });

  await expect(page).toHaveScreenshot(
    "welkomstgrid-royal-blue-landscape.png",
    { animations: "disabled", caret: "hide", maxDiffPixelRatio: 0.002 }
  );
});

function payload(
  motionPreset: SportlinkArrivalMotionPreset,
  count = 1
): PlayerDynamicTemplatePayload {
  return {
    assets: {
      [logoId]: {
        bytes: 481,
        checksumSha256: "b".repeat(64),
        mimeType: "image/svg+xml",
        url: `${playerURL}/away-team-logo-fixture.svg`
      }
    },
    data: {
      brand: { clubName: "VeyoCast United", primaryColor: "#FF5C20" },
      sport: {
        arrivalConfig: { cardCount: count, emptyBehavior: "skip", motionPreset },
        items: Array.from({ length: count }, (_, index) => ({
          awayRoom: String(index + 2),
          awayTeam: ["Bezoekers FC", "Sporting Noord", "Olympia '28", "SV De Horizon"][index],
          date: "07-09-2026",
          field: String(index + 1),
          homeMatch: true,
          homeRoom: String(index + 1),
          homeTeam: `Duindorp sv JO15-${index + 1}`,
          id: `visitor-${index + 1}`,
          kickoffAt: `2026-09-07T${String(12 + index).padStart(2, "0")}:30:00.000Z`,
          kickoffTime: `${14 + index}:30`,
          logoMediaAssetId: logoId,
          meta: `Kleedkamer ${index + 2} · Veld ${index + 1}`,
          officials: [{
            displayName: "Sam Scheidsrechter",
            externalId: null,
            role: "Scheidsrechter"
          }],
          primary: ["Bezoekers FC", "Sporting Noord", "Olympia '28", "SV De Horizon"][index],
          secondary: `Aankomst ${13 + index}:00 · Aanvang ${14 + index}:30`,
          status: "Welkom bij {{club}}",
          venueName: "Sportpark Houtrust"
        })),
        pageDurationSeconds: 12,
        title: "Welkom op ons sportpark"
      },
      themePresentation,
      type: "sport_visitor_arrivals"
    },
    orientation: "landscape",
    schemaVersion: 1,
    slideType: "sport_visitor_arrivals",
    snapshotHash: "a".repeat(64),
    snapshotId: "10000000-0000-4000-8000-000000000001",
    templateSlug: "editorial-arena-bezoekers-aankomst-light-landscape",
    templateVersionId: "10000000-0000-4000-8000-000000000002"
  };
}

function royalBluePayload(): PlayerDynamicTemplatePayload {
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
  const base = payload("auto", 2);
  return playerDynamicTemplatePayloadSchema.parse({
    ...base,
    data: {
      ...base.data,
      _veyocastThemeRuntime: { version: 2 },
      editorial: {
        schemaVersion: 2,
        theme: createFieldflowRoyalBlueTheme(),
        themeSelection: selection
      },
      themePresentation: {
        ...frozen,
        appearance: {
          ...createFieldflowRoyalBlueAppearance(),
          typography: {
            ...createFieldflowRoyalBlueAppearance().typography,
            baseScale: 1.05,
            sportScale: 1.4
          }
        },
        settingsRevision: 159,
        snapshotVersion: 2
      }
    },
    templateSlug: "editorial-arena-bezoekers-aankomst-dark-landscape"
  });
}

function encodePayload(value: PlayerDynamicTemplatePayload) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}
