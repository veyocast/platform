import { expect, test } from "@playwright/test";
import { goalOverlayCss, renderGoalOverlayDom } from "../../packages/content-templates/src/goal-overlay-renderer";
import { defaultGoalOverlayConfiguration, type GoalOverlayEvent } from "../../packages/contracts/src/goal-overlay";

const event: GoalOverlayEvent = { eventId: "preview", homeTeam: "Duindorp SV JO19-1", awayTeam: "VUC JO19-1", homeScore: 2, awayScore: 1, scoreboardSide: "home", scorer: "Jack Morauw", shirtNumber: "9", minute: "67′ + 2", homeLogo: "https://goal-assets.test/logo.png", awayLogo: null, playerPhoto: "https://goal-assets.test/photo.png", competition: "Voorbeeldcompetitie", matchName: "Duindorp SV JO19-1 — VUC JO19-1", round: "Speelronde 7", venue: "Sportpark", test: true };
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
for (const [width, height] of [[1920,1080], [3840,2160], [1080,1920], [2160,3840]]) {
  for (const appearance of ["light", "dark"] as const) {
    test(`gedeelde renderer ${width}×${height} ${appearance}: foto, optionele inhoud en kleurfallback`, async ({ page }) => {
      await page.setViewportSize({ width: width!, height: height! });
      await page.route("https://goal-assets.test/**", (r) => r.fulfill({ body: png, contentType: "image/png" }));
      await page.setContent(`<style>html,body{margin:0;width:100%;height:100%}#goal{width:100%;height:100%}${goalOverlayCss}</style><div id="goal"></div>`);
      const configuration = { ...defaultGoalOverlayConfiguration, showCompetition: true, showMatchName: true, showVenue: true, showRound: true, subtitleTemplate: "ONZE TROTS", defaults: { primary: "#2459ed", darkSurface: "#18233a", modePolicy: { kind: "fixed" as const, mode: "light" as const }, timezone: "Europe/Amsterdam" } };
      const input = { renderer: renderGoalOverlayDom.toString(), configuration, event, orientation: height! > width! ? "portrait" : "landscape", appearance };
      await page.evaluate(({ renderer, configuration, event, orientation, appearance }) => {
        const render = new Function(`return (${renderer})`)();
        render(document.querySelector("#goal"), configuration, event, orientation, appearance);
      }, input);
      await expect(page.locator(".vc-goal-photo")).toBeVisible();
      await expect(page.locator(".vc-goal-logo")).toBeVisible();
      await expect(page.locator(".vc-goal-scorer")).toContainText("Jack Morauw");
      const inside = await page.locator(".vc-goal-card").evaluate((card) => {
        const outer = card.getBoundingClientRect();
        return [...card.querySelectorAll("strong,p,img,.vc-goal-team-name")].every((child) => {
          const box = child.getBoundingClientRect();
          return box.left >= outer.left - 1 && box.right <= outer.right + 1 && box.top >= outer.top - 1 && box.bottom <= outer.bottom + 1;
        });
      });
      expect(inside).toBe(true);
      await page.locator(".vc-goal-photo").evaluate((image) => image.dispatchEvent(new Event("error")));
      await expect(page.locator(".vc-goal-photo")).toHaveCount(0);
      await expect(page.locator(".vc-goal")).toHaveAttribute("data-has-photo", "false");
      await page.evaluate(({ renderer, configuration, event, orientation, appearance }) => {
        new Function(`return (${renderer})`)()(document.querySelector("#goal"), { ...configuration, lightOuterColor: "#123456", darkOuterColor: "#123456", lightTextColor: "#345678", darkTextColor: "#ffffff" }, { ...event, scorer: null, minute: null, playerPhoto: null, homeLogo: null, awayLogo: null, competition: null, matchName: null, round: null, venue: null }, orientation, appearance);
      }, input);
      await expect(page.locator(".vc-goal-scorer,.vc-goal-photo,.vc-goal-minute,.vc-goal-detail,.vc-goal-logo")).toHaveCount(0);
      expect(await page.locator(".vc-goal").evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(18, 52, 86)");
      await expect(page.locator(".vc-goal-team-name")).toHaveCount(2);
      await page.evaluate(({ renderer, configuration, event, orientation, appearance }) => {
        new Function(`return (${renderer})`)()(document.querySelector("#goal"), { ...configuration, defaults: undefined }, { ...event, playerPhoto: null, homeLogo: null }, orientation, appearance);
      }, input);
      expect(await page.locator(".vc-goal").evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(36, 89, 237)");
      await page.evaluate(({ renderer, configuration, event, orientation, appearance }) => {
        new Function(`return (${renderer})`)()(document.querySelector("#goal"), { ...configuration, showTeamNames: false }, { ...event, homeLogo: "invalid-logo", awayLogo: null }, orientation, appearance);
      }, input);
      await expect(page.locator(".vc-goal-logo")).toHaveCount(0);
      await expect(page.locator(".vc-goal-team-name")).toHaveCount(2);
    });
  }
}
