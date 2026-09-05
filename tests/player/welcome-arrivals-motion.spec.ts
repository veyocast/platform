import { expect, test } from "@playwright/test";

import type {
  PlayerDynamicTemplatePayload,
  SportlinkArrivalMotionPreset
} from "@veyocast/contracts";

const playerURL = `http://127.0.0.1:${process.env.PLAYER_PORT ?? 3106}`;
const logoId = "10000000-0000-4000-8000-000000000091";
const presets = [
  "aurora-rise",
  "spotlight-bloom",
  "kinetic-split",
  "prism-swipe",
  "grand-flip"
] as const satisfies readonly SportlinkArrivalMotionPreset[];

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
      await expect(page.locator('img[aria-hidden="true"]')).toHaveCount(visibleCards);
      await expect(page.locator(`img[alt^="Logo "]`)).toHaveCount(visibleCards);
      expect(await page.locator('img[aria-hidden="true"]').first().evaluate(
        (element) => ({
          objectFit: getComputedStyle(element).objectFit,
          opacity: getComputedStyle(element).opacity
        })
      )).toEqual({ objectFit: "cover", opacity: "0.3" });
      const firstCard = grid.locator("article").first();
      await expect(firstCard).toContainText("Bezoekers FC");
      await expect(firstCard).toContainText("Aanvang: 14:30 | Veld 1");
      await expect(firstCard).toContainText("Kleedkamer: 2");
      await expect(firstCard).not.toContainText("Aankomst");
      await expect(firstCard.locator(":scope > span, :scope > b, :scope > strong"))
        .toHaveCount(0);
      const typography = await firstCard.evaluate((element) => {
        const title = element.querySelector("h2");
        const details = Array.from(element.querySelectorAll("p"));
        return {
          detailSizes: details.map((detail) => parseFloat(getComputedStyle(detail).fontSize)),
          detailWeights: details.map((detail) => getComputedStyle(detail).fontWeight),
          titleSize: title ? parseFloat(getComputedStyle(title).fontSize) : 0
        };
      });
      expect(typography.detailSizes).toHaveLength(2);
      expect(typography.detailSizes[0]! / typography.titleSize).toBeCloseTo(0.8, 3);
      expect(typography.detailSizes[1]! / typography.titleSize).toBeCloseTo(0.8, 3);
      expect(typography.detailWeights).toEqual(["400", "400"]);
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
          homeMatch: true,
          id: `visitor-${index + 1}`,
          logoMediaAssetId: logoId,
          meta: `Kleedkamer ${index + 2} · Veld ${index + 1}`,
          primary: ["Bezoekers FC", "Sporting Noord", "Olympia '28", "SV De Horizon"][index],
          secondary: `Aankomst ${13 + index}:00 · Aanvang ${14 + index}:30`,
          status: "Welkom bij {{club}}"
        })),
        pageDurationSeconds: 12,
        title: "Welkom op ons sportpark"
      },
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
