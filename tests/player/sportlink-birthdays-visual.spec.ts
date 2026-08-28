import path from "node:path";

import { expect, test } from "@playwright/test";

import type { PlayerDynamicTemplatePayload } from "@veyocast/contracts";

const playerURL = `http://127.0.0.1:${process.env.PLAYER_PORT ?? 3106}`;

test("premium verjaardagsslide blijft pixelvast in 16:9 en 9:16", async ({ page }) => {
  test.setTimeout(90_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const orientation of ["landscape", "portrait"] as const) {
    for (const theme of ["dark", "light"] as const) {
      await test.step(`${orientation} · ${theme}`, async () => {
        await page.setViewportSize(orientation === "landscape"
          ? { height: 1080, width: 1920 } : { height: 1920, width: 1080 });
        await page.goto(`${playerURL}/thumbnail?case=${orientation}-${theme}#payload=${encodePayload(payload(orientation, theme))}`);
        await page.waitForFunction(() => document.documentElement.dataset.thumbnailReady === "true");
        const slide = page.locator('[data-slide-type="sport_birthdays"]');
        await expect(slide).toBeVisible();
        await expect(slide).toHaveAttribute("data-orientation", orientation);
        await expect(slide).toContainText("Aafke");
        const geometry = await slide.evaluate((element) => ({
          clientHeight: element.clientHeight, clientWidth: element.clientWidth,
          scrollHeight: element.scrollHeight, scrollWidth: element.scrollWidth
        }));
        expect(geometry.scrollWidth).toBe(geometry.clientWidth);
        expect(geometry.scrollHeight).toBe(geometry.clientHeight);
        expect(await slide.locator("article").first().evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
        await expect(page).toHaveScreenshot(
          `sportlink-birthdays-${orientation}-${theme}.png`,
          { animations: "disabled", caret: "hide", maxDiffPixelRatio: 0.002 }
        );
        if (theme === "dark") {
          await page.screenshot({
            path: path.resolve(`docs/screenshots/s128-sportlink-birthdays/${orientation}.png`)
          });
        }
      });
    }
  }
});

function payload(
  orientation: "landscape" | "portrait",
  themeMode: "dark" | "light"
): PlayerDynamicTemplatePayload {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit", month: "2-digit", timeZone: "Europe/Amsterdam", year: "numeric"
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((entry) => entry.type === type)?.value);
  const birthdays = [
    ["Aafke van der Meer-Schoonhoven", 14, "Speler", "JO15-1"],
    ["Milan de Jong", null, "Trainer", "1e elftal"],
    ["José d'Ávila", 39, "Leider", "JO11-2"],
    ["Noa Jansen", 12, null, null]
  ].map(([displayName, age, role, team], index) => ({
    age, day: part("day"), displayName, id: `birthday-${index}`,
    matchStatus: role ? "matched" : "unmatched", month: part("month"),
    photoMediaAssetId: null, role,
    teamIds: team ? [`team-${index}`] : [],
    teams: team ? [{ externalId: `team-${index}`, name: team }] : []
  }));
  return {
    assets: {}, data: {
      brand: { clubName: "VeyoCast United", primaryColor: "#2F6B55" }, editorial: {},
      sport: {
        birthdays,
        configuration: {
          emptyBehavior: "skip", period: { days: 7, mode: "next_7_days" }, schemaVersion: 1,
          presentation: { backgroundColor: themeMode === "dark" ? "#0B1713" : "#E8E3D8", backgroundMediaAssetId: null, cardStyle: "glass", confetti: true, gradientOverlay: true, layout: "auto", logoPosition: "top_left", maxPerLandscapePage: 4, maxPerPortraitPage: 3, motion: true, pageDurationSeconds: 8, radius: "xl", textAlign: "left", themeMode, useTenantTheme: false },
          selection: { emphasizeToday: true, includeUnknownRoles: true, nameMode: "full", roleFilter: "all", selectedRoles: [], selectedTeamIds: [], showAge: true, showDate: true, showDayOfWeek: true, showPhoto: true, showRole: true, showTeam: true },
          title: "Vandaag vieren we"
        }, fetchedAt: new Date().toISOString(), timezone: "Europe/Amsterdam", title: "Vandaag vieren we"
      }, type: "sport_birthdays"
    }, orientation, schemaVersion: 1, slideType: "sport_birthdays",
    snapshotHash: "a".repeat(64), snapshotId: "10000000-0000-4000-8000-000000000128",
    templateSlug: `editorial-arena-sport-birthdays-dark-${orientation}`,
    templateVersionId: "20000000-0000-4000-8000-000000000128"
  };
}

function encodePayload(value: PlayerDynamicTemplatePayload) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}
