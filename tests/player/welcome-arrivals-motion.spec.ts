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
      await page.waitForTimeout(850);
      const geometry = await card.evaluate((element) => {
        const box = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          animationDuration: style.animationDuration,
          bottom: box.bottom,
          filter: style.filter,
          opacity: style.opacity,
          overflow: style.overflow,
          right: box.right,
          viewportHeight: window.innerHeight,
          viewportWidth: window.innerWidth
        };
      });
      expect(geometry.opacity).toBe("1");
      expect(geometry.animationDuration).toBe("0.68s");
      expect(geometry.filter).toBe("none");
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

test("welkomstraster toont maximaal twee thuiswedstrijden half om half", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ height: 1080, width: 1920 });

  for (const count of [1, 2, 3, 4]) {
    await test.step(`${count} wedstrijd${count === 1 ? "" : "en"}`, async () => {
      await page.goto("about:blank");
      await page.goto(`${playerURL}/thumbnail#payload=${encodePayload(payload("auto", count))}`);
      await page.waitForFunction(
        () => document.documentElement.dataset.thumbnailReady === "true"
      );
      const grid = page.locator("[data-cards]");
      const visibleCount = Math.min(count, 2);
      await expect(grid).toHaveAttribute("data-cards", String(visibleCount));
      await expect(page.getByRole("heading", { name: "Welkom op ons sportpark" }))
        .toBeVisible();
      const geometry = await grid.evaluate((element) => {
        const style = getComputedStyle(element);
        const gridBox = element.getBoundingClientRect();
        const cards = Array.from(element.children).map((child) => {
          const box = child.getBoundingClientRect();
          return { height: box.height, width: box.width };
        });
        return {
          cards,
          bottom: gridBox.bottom,
          columns: style.gridTemplateColumns.split(" ").filter(Boolean).length,
          rows: style.gridTemplateRows.split(" ").filter(Boolean).length,
          top: gridBox.top,
          viewportHeight: window.innerHeight
        };
      });
      expect(geometry.columns).toBe(visibleCount);
      expect(geometry.rows).toBe(1);
      expect(geometry.top).toBeGreaterThan(150);
      expect(geometry.bottom).toBeLessThan(geometry.viewportHeight - 60);
      if (count === 1) {
        expect(geometry.cards[0]?.width).toBeGreaterThan(1_500);
        expect(geometry.cards[0]?.height).toBeGreaterThan(700);
      }
      await expect(page.locator('img[aria-hidden="true"]')).toHaveCount(visibleCount);
      await expect(page.locator(`img[alt^="Logo "]`)).toHaveCount(visibleCount);
      expect(await page.locator('img[aria-hidden="true"]').first().evaluate(
        (element) => getComputedStyle(element).opacity
      )).toBe("0.3");
      const backdropGeometry = await page.locator('img[aria-hidden="true"]')
        .first()
        .evaluate((element) => {
          const backdrop = element.getBoundingClientRect();
          const card = element.parentElement!.getBoundingClientRect();
          return {
            heightDelta: Math.abs(backdrop.height - card.height),
            widthDelta: Math.abs(backdrop.width - card.width)
          };
        });
      expect(backdropGeometry.heightDelta).toBeLessThan(1);
      expect(backdropGeometry.widthDelta).toBeLessThan(1);
      expect(await page.locator(`img[alt^="Logo "]`).first().evaluate(
        (element) => getComputedStyle(element.parentElement!).backgroundColor
      )).toBe("rgb(255, 255, 255)");
      await expect(page.getByText(/Aankomst \d{2}:00/)).toHaveCount(0);
      await expect(page.getByText("Aanvang 14:30 · Kleedkamer 2", { exact: true }))
        .toBeVisible();
      await expect(page).toHaveScreenshot(`welkomstgrid-${count}-landscape.png`, {
        animations: "disabled",
        caret: "hide",
        maxDiffPixelRatio: 0.002
      });
    });
  }
});

test("staand welkomstraster blijft leesbaar zonder horizontale overflow", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ height: 1920, width: 1080 });
  for (const count of [1, 2, 3, 4]) {
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
    const visibleCount = Math.min(count, 2);
    await expect(grid).toHaveAttribute("data-cards", String(visibleCount));
    const geometry = await grid.evaluate((element) => ({
      clientWidth: element.clientWidth,
      columns: getComputedStyle(element).gridTemplateColumns
        .split(" ").filter(Boolean).length,
      rows: getComputedStyle(element).gridTemplateRows
        .split(" ").filter(Boolean).length,
      scrollWidth: element.scrollWidth
    }));
    expect(geometry.columns).toBe(1);
    expect(geometry.rows).toBe(visibleCount);
    expect(geometry.scrollWidth).toBe(geometry.clientWidth);
    if (count === 2) {
      await expect(page).toHaveScreenshot("welkomstgrid-2-portrait.png", {
        animations: "disabled",
        caret: "hide",
        maxDiffPixelRatio: 0.002
      });
    }
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
        arrivalConfig: { cardCount: 4, emptyBehavior: "skip", motionPreset },
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
