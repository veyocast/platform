import { expect, test } from "@playwright/test";

import type {
  PlayerDynamicTemplatePayload,
  SportlinkArrivalMotionPreset
} from "@veyocast/contracts";
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
      await expect(firstCard).toContainText("Veld: 1");
      await expect(firstCard).not.toContainText("Aankomst");
      await expect(firstCard.locator(":scope > span, :scope > b, :scope > strong"))
        .toHaveCount(0);
      const typography = await firstCard.evaluate((element) => {
        const schedule = Array.from(element.querySelectorAll<HTMLElement>(
          '[class*="arenaVisitorSchedule"] > time, [class*="arenaVisitorSchedule"] > span'
        ));
        const teamNames = Array.from(element.querySelectorAll<HTMLElement>("h2 > span"));
        const details = Array.from(element.querySelectorAll<HTMLElement>(
          '[class*="arenaVisitorDetails"] > strong, [class*="arenaVisitorDetails"] > p'
        ));
        return {
          detailSizes: details.map((detail) => parseFloat(getComputedStyle(detail).fontSize)),
          scheduleSizes: schedule.map((line) => parseFloat(getComputedStyle(line).fontSize)),
          teamSizes: teamNames.map((team) => parseFloat(getComputedStyle(team).fontSize))
        };
      });
      expect(typography.scheduleSizes).toHaveLength(2);
      expect(typography.scheduleSizes[0]).toBe(typography.scheduleSizes[1]);
      expect(typography.teamSizes).toHaveLength(2);
      expect(typography.teamSizes[0]).toBe(typography.teamSizes[1]);
      expect(typography.scheduleSizes[0]!).toBeLessThan(typography.teamSizes[0]!);
      expect(typography.detailSizes).toHaveLength(3);
      expect(typography.detailSizes.every(
        (size) => size === typography.scheduleSizes[0]
      )).toBe(true);
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
    await expect(page).toHaveScreenshot(`welkomstgrid-${count}-portrait.png`, {
      animations: "disabled",
      caret: "hide",
      maxDiffPixelRatio: 0.002
    });
  }
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

function encodePayload(value: PlayerDynamicTemplatePayload) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}
