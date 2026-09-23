import { expect, test, type Locator, type Page } from "@playwright/test";

import { incidentPayload, playerURL, playIncidentPayload } from "./celebrations-layout-fixture";

const viewports = {
  landscape: { height: 1080, width: 1920 },
  portrait: { height: 1920, width: 1080 }
} as const;

type ListGeometry = {
  gap: number;
  listHeight: number;
  pageCount: number;
  renderedRows: number;
  rowHeight: number;
  unusedHeight: number;
};

for (const legacy of [false, true]) {
  for (const orientation of ["landscape", "portrait"] as const) {
    test(`${legacy ? "LG" : "React"}: ${orientation} sport rows stay fixed through overflow`, async ({ browser }) => {
      test.setTimeout(180_000);
      const sharedContext = legacy ? null : await browser.newContext({
        reducedMotion: "reduce",
        viewport: viewports[orientation]
      });

      const renderResults = async (count: number, screenshot = false) => {
        const context = sharedContext ?? await browser.newContext({
          reducedMotion: "reduce",
          viewport: viewports[orientation]
        });
        const page = await context.newPage();
        await page.clock.setFixedTime(new Date("2026-09-09T12:00:00Z"));
        const payload = incidentPayload("sport_results", orientation);
        const data = payload.data as {
          sport: {
            displayConfig?: Record<string, unknown>;
            items: Array<Record<string, unknown>>;
          };
        };
        const base = data.sport.items[0]!;
        data.sport.displayConfig = {
          ...(data.sport.displayConfig ?? {}),
          columns: "one"
        };
        data.sport.items = Array.from({ length: count }, (_, index) => ({
          ...base,
          awayScore: 2,
          awayTeam: `Tegenstander ${index + 1}`,
          date: "09-09-2026",
          homeScore: index % 5,
          homeTeam: `Vereniging met lange naam JO19-${index + 1}`,
          id: `result-${index}`,
          kickoffAt: "2026-09-09T10:00:00Z",
          status: "Gespeeld",
          time: "12:00"
        }));
        await renderPayload(page, payload, legacy);
        const slide = page.locator('[data-slide-type="sport_results"]');
        const rows = slide.locator(legacy
          ? ".legacy-result-list > .legacy-result-row"
          : "[data-columns] > section > article");
        await expect(rows.first()).toBeVisible();
        const geometry = await listGeometry(page, rows, legacy);
        if (screenshot) {
          await page.addStyleTag({ content: "nextjs-portal { display:none!important }" });
          await expect(page).toHaveScreenshot(
            `sport-height-${legacy ? "lg" : "react"}-landscape-${count === 1 ? "one" : "full"}.png`,
            { animations: "disabled", caret: "hide", maxDiffPixelRatio: 0.002 }
          );
        }
        if (sharedContext) await page.close();
        else await context.close();
        return geometry;
      };

      const one = await renderResults(1, orientation === "landscape");
      const referenceHeight = one.rowHeight;
      expect(one.unusedHeight).toBeGreaterThan(referenceHeight);
      const largeOverflow = await renderResults(100);
      const capacity = largeOverflow.renderedRows;
      expect(largeOverflow.pageCount).toBeGreaterThan(1);

      for (const count of [2, 3, capacity]) {
        const geometry = await renderResults(
          count,
          orientation === "landscape" && count === capacity
        );
        expect(geometry.rowHeight, `${count} records`).toBeCloseTo(referenceHeight, 1);
        expect(geometry.renderedRows, `${count} records`).toBe(Math.min(count, capacity));
        expect(geometry.pageCount, `${count} records`).toBe(1);
        if (count < capacity) {
          expect(geometry.unusedHeight, `${count} records`).toBeGreaterThan(geometry.gap);
        } else {
          expect(geometry.unusedHeight, `${count} records`).toBeLessThan(2);
        }
      }
      const overflow = await renderResults(capacity + 1);
      expect(overflow.rowHeight).toBeCloseTo(referenceHeight, 1);
      expect(overflow.renderedRows).toBe(capacity);
      expect(overflow.pageCount).toBe(2);
      await sharedContext?.close();
    });
  }
}

for (const legacy of [false, true]) {
  for (const orientation of ["landscape", "portrait"] as const) {
    test(`${legacy ? "LG" : "React"}: ${orientation} Royal Current sport families keep normal row height`, async ({ browser }) => {
      test.setTimeout(180_000);
      const sharedContext = legacy ? null : await browser.newContext({
        reducedMotion: "reduce",
        viewport: viewports[orientation]
      });
      for (const slideType of [
        "sport_program",
        "sport_cancellations",
        "sport_dressing_rooms",
        "sport_officials",
        "sport_standing"
      ] as const) {
        const heights: number[] = [];
        for (const count of [1, 2, 3]) {
          const context = sharedContext ?? await browser.newContext({
            reducedMotion: "reduce",
            viewport: viewports[orientation]
          });
          const page = await context.newPage();
          await page.clock.setFixedTime(new Date("2026-09-09T12:00:00Z"));
          const payload = incidentPayload(slideType, orientation);
          const data = payload.data as {
            sport: {
              displayConfig?: Record<string, unknown>;
              items: Array<Record<string, unknown>>;
            };
          };
          const sourceItems = data.sport.items;
          data.sport.displayConfig = {
            ...(data.sport.displayConfig ?? {}),
            columns: "one"
          };
          data.sport.items = Array.from({ length: count }, (_, index) => ({
            ...sourceItems[index % sourceItems.length],
            id: `${slideType}-${index}`,
            position: index + 1,
            selected: false
          }));
          await renderPayload(page, payload, legacy);
          const slide = page.locator(`[data-slide-type="${slideType}"]`);
          const list = slide.locator(legacy
            ? slideType === "sport_standing"
              ? ".legacy-royal-standing-rows"
              : slideType === "sport_program"
                ? ".legacy-fixture-list"
                : ".legacy-typed-list"
            : slideType === "sport_standing"
              ? "[data-standing-window]"
              : "[data-columns] > section").first();
          await expect(list).toBeVisible();
          const geometry = await list.evaluate((element) => {
            const row = element.firstElementChild?.getBoundingClientRect();
            const listBox = element.getBoundingClientRect();
            return {
              rowHeight: row?.height ?? 0,
              unusedHeight: row ? listBox.bottom - row.bottom : 0
            };
          });
          expect(geometry.rowHeight, `${slideType} ${count}`).toBeGreaterThan(0);
          if (count === 1 && slideType !== "sport_standing") {
            expect(geometry.unusedHeight, slideType).toBeGreaterThan(geometry.rowHeight / 2);
          }
          heights.push(geometry.rowHeight);
          if (sharedContext) await page.close();
          else await context.close();
        }
        expect(Math.max(...heights) - Math.min(...heights), `${slideType}: ${heights.join(", ")}`)
          .toBeLessThan(2);
      }
      await sharedContext?.close();
    });
  }
}

async function renderPayload(page: Page, payload: ReturnType<typeof incidentPayload>, legacy: boolean) {
  if (legacy) {
    await playIncidentPayload(page, payload, true);
  } else {
    await page.goto(
      `${playerURL}/thumbnail#payload=${Buffer.from(JSON.stringify(payload)).toString("base64url")}`
    );
  }
  await expect(page.locator(`[data-slide-type="${payload.slideType}"]`)).toBeVisible();
}

async function listGeometry(
  page: Page,
  rows: Locator,
  legacy: boolean
): Promise<ListGeometry> {
  const geometry = await rows.evaluateAll((elements) => {
    const list = elements[0]!.parentElement!;
    const listBox = list.getBoundingClientRect();
    const rowBoxes = elements.map((element) => element.getBoundingClientRect());
    return {
      gap: parseFloat(getComputedStyle(list).rowGap) || 0,
      listHeight: listBox.height,
      renderedRows: elements.length,
      rowHeight: rowBoxes[0]!.height,
      unusedHeight: listBox.bottom - rowBoxes.at(-1)!.bottom
    };
  });
  const pageCount = legacy
    ? parseInt((await page.locator(".dynamic-page-number").innerText()).split("/").at(-1) ?? "1", 10)
    : Number(await page.locator("[data-page-count]").getAttribute("data-page-count"));
  return { ...geometry, pageCount };
}
