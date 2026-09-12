import { expect, test } from "@playwright/test";
import { incidentPayload, playIncidentPayload } from "./celebrations-layout-fixture";

for (const legacy of [false, true]) {
  for (const orientation of ["landscape", "portrait"] as const) {
    test(`${legacy ? "LG" : "React"} birthday: ${orientation}, one moving canvas and cleanup`, async ({ page }) => {
      await page.clock.install({ time: new Date("2026-09-09T12:00:00Z") });
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await page.setViewportSize(orientation === "portrait" ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 });
      const payload = incidentPayload("sport_birthdays", orientation);
      const data = payload.data as any;
      data.themePresentation.appearance.motionEnabled = true;
      data.sport.configuration.presentation.motion = true;
      data.sport.configuration.presentation.themeMode = "dark";
      data.sport.birthdays[1].day = 9;
      data.sport.birthdays[1].displayDate = "2026-09-09";
      const errors: string[] = []; page.on("pageerror", (error) => errors.push(error.message));
      await playIncidentPayload(page, payload, legacy, 8);
      const canvas = page.locator("canvas[data-birthday-confetti]");
      await expect(canvas).toHaveCount(1);
      const slide = page.locator('[data-slide-type="sport_birthdays"]');
      if (legacy) expect(await slide.evaluate((element) => element.classList.contains("dark"))).toBe(false);
      else await expect(slide).toHaveAttribute("data-theme", "light");
      await expect(slide.getByText("Vandaag jarig", { exact: false })).toHaveCount(2);
      await expect(slide.getByText("Noa van Dijk", { exact: true })).toHaveCount(1);
      await expect(slide).not.toContainText("2026-09-09");
      const before = await canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL());
      await page.clock.runFor(800);
      const after = await canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL());
      expect(after).not.toBe(before);
      await expect(slide.locator('[data-emphasize-today="true"]')).toHaveCount(2);
      await page.clock.fastForward(12_000);
      await expect(canvas).toHaveCount(0);
      await expect(slide).toHaveCount(0);
      expect(errors).toEqual([]);
    });
  }
  for (const scenario of ["disabled", "tomorrow", "motion-off"] as const) {
    test(`${legacy ? "LG" : "React"} birthday: no confetti when ${scenario}`, async ({ page }) => {
      await page.clock.setFixedTime(new Date("2026-09-09T12:00:00Z"));
      await page.emulateMedia({ reducedMotion: "no-preference" });
      const payload = incidentPayload("sport_birthdays", "landscape");
      const data = payload.data as any;
      data.themePresentation.appearance.motionEnabled = true;
      data.sport.configuration.presentation.motion = scenario !== "motion-off";
      data.sport.configuration.presentation.confetti = scenario !== "disabled";
      if (scenario === "tomorrow") for (const person of data.sport.birthdays) { person.day = 10; person.isToday = true; }
      await playIncidentPayload(page, payload, legacy);
      await expect(page.locator('[data-slide-type="sport_birthdays"]')).toBeVisible();
      await expect(page.locator("canvas[data-birthday-confetti]")).toHaveCount(0);
    });
  }
  test(`${legacy ? "LG" : "React"} birthday crosses Amsterdam midnight during playback`, async ({ page }) => {
    await page.clock.install({ time: new Date("2026-09-09T21:59:57Z") });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    const payload = incidentPayload("sport_birthdays", "portrait");
    const data = payload.data as any;
    data.themePresentation.appearance.motionEnabled = true;
    data.sport.configuration.presentation.motion = true;
    data.sport.birthdays = [data.sport.birthdays[1]];
    await playIncidentPayload(page, payload, legacy);
    await expect(page.locator('[data-slide-type="sport_birthdays"]')).toBeVisible();
    await page.clock.fastForward(5000);
    await expect(page.locator("canvas[data-birthday-confetti]")).toHaveCount(1);
    await expect(page.getByText("Vandaag jarig", { exact: false })).toHaveCount(1);
  });
}
