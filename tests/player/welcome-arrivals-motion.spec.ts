import { expect, test } from "@playwright/test";

import type {
  PlayerDynamicTemplatePayload,
  SportlinkArrivalMotionPreset
} from "@veyocast/contracts";

const playerURL = `http://127.0.0.1:${process.env.PLAYER_PORT ?? 3106}`;
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

function payload(motionPreset: SportlinkArrivalMotionPreset): PlayerDynamicTemplatePayload {
  return {
    assets: {},
    data: {
      brand: { clubName: "VeyoCast United", primaryColor: "#FF5C20" },
      sport: {
        arrivalConfig: { cardCount: 1, motionPreset },
        items: [{
          id: "visitor-1",
          meta: "Kleedkamer 4 · Veld 2",
          primary: "Bezoekers FC",
          secondary: "Aankomst 13:00 · Aanvang 14:30",
          status: "Welkom bij {{club}}"
        }],
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
