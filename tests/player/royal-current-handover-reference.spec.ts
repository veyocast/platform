import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test } from "@playwright/test";

type ReferenceCase = {
  font: string;
  height: number;
  id: string;
  mode: "glass" | "royal";
  motion: boolean;
  orientation: "landscape" | "portrait";
  path: string;
  primary: string;
  slide_id: string;
  width: number;
};

const handoverRoot = process.env.ROYAL_CURRENT_HANDOVER_ROOT;
const referenceURL = process.env.ROYAL_CURRENT_REFERENCE_URL?.replace(/\/$/u, "");

test("alle 92 aangeleverde Royal Current-referentiecases zijn renderbaar", async ({
  page
}) => {
  test.skip(
    !handoverRoot || !referenceURL,
    "Zet ROYAL_CURRENT_HANDOVER_ROOT en ROYAL_CURRENT_REFERENCE_URL om de immutable overdracht te toetsen."
  );
  test.setTimeout(360_000);

  const cases = JSON.parse(
    readFileSync(
      resolve(handoverRoot!, "referentie/REFERENTIECASES.json"),
      "utf8"
    )
  ) as ReferenceCase[];

  expect(cases).toHaveLength(92);
  expect(new Set(cases.map((entry) => entry.id)).size).toBe(92);

  for (const referenceCase of cases) {
    await test.step(referenceCase.id, async () => {
      await page.setViewportSize({
        height: referenceCase.height,
        width: referenceCase.width
      });

      const response = await page.goto(
        `${referenceURL}/${referenceCase.path}`,
        { waitUntil: "networkidle" }
      );
      expect(response?.ok()).toBe(true);
      await page.evaluate(async () => {
        await document.fonts.ready;
      });

      const slide = page.locator("#reference-slide");
      await expect(slide).toBeVisible();
      await expect(slide).toHaveClass(new RegExp(`theme-${referenceCase.mode}`, "u"));
      await expect(slide).toHaveClass(/motion-off/u);

      const evidence = await slide.evaluate((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        const images = Array.from(element.querySelectorAll("img"));
        const interactiveElements = element.querySelectorAll(
          "button, input, select, textarea, [contenteditable='true']"
        );
        const canvas = document.documentElement;

        return {
          solidAccent: style
            .getPropertyValue("--solid-accent")
            .trim()
            .toLowerCase(),
          clientHeight: element.clientHeight,
          clientWidth: element.clientWidth,
          fontFamily: style.fontFamily,
          imageFailures: images.filter(
            (image) => !image.complete || image.naturalWidth === 0
          ).length,
          interactiveElements: interactiveElements.length,
          rectHeight: rect.height,
          rectWidth: rect.width,
          viewportOverflow:
            canvas.scrollWidth > window.innerWidth ||
            canvas.scrollHeight > window.innerHeight
        };
      });

      expect(evidence.clientWidth).toBe(referenceCase.width);
      expect(evidence.clientHeight).toBe(referenceCase.height);
      expect(evidence.rectWidth).toBeCloseTo(referenceCase.width, 1);
      expect(evidence.rectHeight).toBeCloseTo(referenceCase.height, 1);
      expect(evidence.viewportOverflow).toBe(false);
      expect(evidence.interactiveElements).toBe(0);
      expect(evidence.imageFailures).toBe(0);
      expect(evidence.fontFamily.toLowerCase()).toContain(
        referenceCase.font.toLowerCase()
      );
      expect(evidence.solidAccent).toBe(referenceCase.primary.toLowerCase());

      const screenshot = await slide.screenshot({ animations: "disabled" });
      expect(screenshot.byteLength).toBeGreaterThan(10_000);
    });
  }
});
