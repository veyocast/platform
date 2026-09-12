import { expect, test } from "@playwright/test";
import { incidentPayload, playerURL, playIncidentPayload } from "./celebrations-layout-fixture";

for (const legacy of [false, true]) {
  for (const orientation of ["landscape", "portrait"] as const) {
    test(`${legacy ? "LG" : "React"}: ${orientation} lists fill available height`, async ({ browser }) => {
      test.setTimeout(180_000);
      for (const count of [3, 5, 6, 7, 8, 12]) {
        await test.step(`${count} results`, async () => {
          const context = await browser.newContext({ viewport: orientation === "portrait" ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 }, reducedMotion: "reduce" });
          const page = await context.newPage();
          await page.clock.setFixedTime(new Date("2026-09-09T12:00:00Z"));
          const payload = incidentPayload("sport_results", orientation);
          const data = payload.data as any;
          const base = data.sport.items[0];
          data.sport.items = Array.from({ length: count }, (_, index) => ({ ...base, id: `result-${index}`, kickoffAt: "2026-09-09T10:00:00Z", status: "Gespeeld", date: "09-09-2026", time: "12:00", homeTeam: `Vereniging met lange naam JO19-${index + 1}`, awayTeam: `Tegenstander ${index + 1}`, homeScore: index % 5, awayScore: 2 }));
          if (legacy) await playIncidentPayload(page, payload, true);
          else await page.goto(`${playerURL}/thumbnail#payload=${Buffer.from(JSON.stringify(payload)).toString("base64url")}`);
          const slide = page.locator('[data-slide-type="sport_results"]');
          await expect(slide).toBeVisible();
          const rows = slide.locator(legacy ? ".legacy-result-row" : "[data-columns] article");
          await expect(rows.first()).toBeVisible();
          const geometry = await rows.first().evaluate((first, legacy) => {
            const list = first.parentElement!;
            const box = list.getBoundingClientRect();
            const children = Array.from(list.children).map((child) => {
              const row = child.getBoundingClientRect();
              return { top: row.top, bottom: row.bottom, height: row.height };
            });
            const root = first.closest('[data-slide-type]')!;
            const footer = root.querySelector(legacy ? ":scope > footer" : "footer[aria-label],footer:last-child")?.getBoundingClientRect();
            return { top: box.top, bottom: box.bottom, children, footerTop: footer?.top, design: root.getAttribute("data-design-revision"), rowAnimation: getComputedStyle(first).animationName, rowTransform: getComputedStyle(first).transform, listHeight: list.clientHeight, rowVariable: getComputedStyle(first).getPropertyValue("--arena-row-height"), mainHeight: root.querySelector("[data-page-count]")?.clientHeight };
          }, legacy);
          const last = geometry.children.at(-1)!;
          expect(geometry.children[0]!.top).toBeGreaterThanOrEqual(geometry.top - 2);
          expect(last.bottom).toBeLessThanOrEqual(geometry.bottom + 2);
          expect(geometry.bottom - last.bottom).toBeLessThan(20);
          expect(geometry.children.every((row) => row.height >= (orientation === "portrait" ? 175 : 85))).toBe(true);
          if (geometry.footerTop) expect(last.bottom).toBeLessThan(geometry.footerTop);
          if (count === 7 && orientation === "landscape") expect(await rows.count()).toBe(7);
          if (count === 12) expect(await rows.count()).toBeLessThan(12);
          await page.addStyleTag({ content: "nextjs-portal { display:none!important }" });
          if ([3, 5, 7, 12].includes(count)) await expect(page).toHaveScreenshot(
            `sport-height-${legacy ? "lg" : "react"}-${orientation}-${count}.png`,
            { animations: "disabled", caret: "hide", maxDiffPixelRatio: 0.002 }
          );
          await context.close();
        });
      }
    });
  }
}

for (const legacy of [false, true]) {
  for (const orientation of ["landscape", "portrait"] as const) {
    test(`${legacy ? "LG" : "React"}: ${orientation} comparable sport lists use their inner height`, async ({ browser }) => {
      test.setTimeout(120_000);
      for (const slideType of ["sport_program", "sport_cancellations", "sport_dressing_rooms", "sport_officials", "sport_standing"] as const) {
        const context = await browser.newContext({ viewport: orientation === "portrait" ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 }, reducedMotion: "reduce" });
        const page = await context.newPage();
        await page.clock.setFixedTime(new Date("2026-09-09T12:00:00Z"));
        const payload = incidentPayload(slideType, orientation);
        const data = payload.data as any;
        data.sport.items = data.sport.items.slice(0, 3);
        if (legacy) await playIncidentPayload(page, payload, true);
        else await page.goto(`${playerURL}/thumbnail#payload=${Buffer.from(JSON.stringify(payload)).toString("base64url")}`);
        const slide = page.locator(`[data-slide-type="${slideType}"]`);
        await expect(slide).toBeVisible();
        const list = slide.locator(legacy
          ? slideType === "sport_standing" ? ".legacy-royal-standing-rows" : slideType === "sport_program" ? ".legacy-fixture-list" : ".legacy-typed-list"
          : slideType === "sport_standing" ? "[data-standing-window]" : "[data-columns] > section").first();
        await expect(list).toBeVisible();
        const geometry = await list.evaluate((element) => {
          const box = element.getBoundingClientRect();
          const children = Array.from(element.children).map((child) => child.getBoundingClientRect());
          const css = getComputedStyle(element);
          return { top: box.top + parseFloat(css.paddingTop), bottom: box.bottom - parseFloat(css.paddingBottom), first: children[0]?.top, last: children.at(-1)?.bottom, count: children.length };
        });
        expect(geometry.count, slideType).toBeGreaterThan(0);
        expect(geometry.first!, slideType).toBeGreaterThanOrEqual(geometry.top - 2);
        expect(geometry.last!, slideType).toBeLessThanOrEqual(geometry.bottom + 2);
        expect(geometry.bottom - geometry.last!, slideType).toBeLessThan(32);
        await context.close();
      }
    });
  }
}
