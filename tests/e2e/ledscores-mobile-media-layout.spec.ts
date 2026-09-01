import { readFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

const stylesheetPath = path.join(
  process.cwd(),
  "apps/control/app/(shell)/dashboard/studio/led-scores/led-scores-studio.module.css"
);

const viewports = [320, 390, 591, 768] as const;

test("houdt de LED Scores Media-stap binnen mobiele viewports", async ({ page }) => {
  const stylesheet = await readFile(stylesheetPath, "utf8");

  for (const width of viewports) {
    await page.setViewportSize({ height: 900, width });
    await page.setContent(`
      <style>* { box-sizing: border-box; } body { margin: 0; padding: 16px; } ${stylesheet}</style>
      <form class="experienceEditor">
        <nav class="wizardNav" aria-label="Stappen voor wedstrijdmomenten">
          <ol>
            <li><button type="button"><span>1</span><span><strong>Momenten</strong><small>Bron en live moment</small></span></button></li>
            <li><button type="button"><span>2</span><span><strong>Vormgeving</strong><small>Canvas en databinding</small></span></button></li>
            <li data-current="true"><button aria-current="step" type="button"><span>3</span><span><strong>Media</strong><small>Veilige fallback</small></span></button></li>
            <li><button type="button"><span>4</span><span><strong>Schermen</strong><small>Doelgroep</small></span></button></li>
            <li><button type="button"><span>5</span><span><strong>Controleren</strong><small>Opslaan</small></span></button></li>
          </ol>
        </nav>
        <main class="wizardStage">
          <section>
            <div class="fieldGrid">
              <label><span>Clublogo</span><select><option>Een uitzonderlijk lange gegenereerde wedstrijdslide die de viewport nooit mag verbreden</option></select></label>
              <label><span>Fallback eigen goal</span><select><option>Een nog langere tenantmedia-omschrijving om native min-contentgedrag af te vangen</option></select></label>
              <label><span>Volume eigen goal</span><input type="number" value="70" /></label>
            </div>
          </section>
        </main>
      </form>
    `);

    const geometry = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      controls: [...document.querySelectorAll<HTMLElement>("select, input")].map((control) => {
        const box = control.getBoundingClientRect();
        return { height: box.height, left: box.left, right: box.right };
      }),
      scrollWidth: document.documentElement.scrollWidth,
      visibleSteps: [...document.querySelectorAll<HTMLElement>(".wizardNav li")]
        .filter((step) => getComputedStyle(step).display !== "none").length
    }));

    expect(geometry.scrollWidth, `${width}px heeft geen horizontale overflow`).toBe(geometry.clientWidth);
    expect(geometry.visibleSteps, `${width}px toont alleen de actieve wizardstap`).toBe(1);
    for (const control of geometry.controls) {
      expect(control.left, `${width}px control begint binnen viewport`).toBeGreaterThanOrEqual(0);
      expect(control.right, `${width}px control eindigt binnen viewport`).toBeLessThanOrEqual(width);
      expect(control.height, `${width}px control heeft touchhoogte`).toBeGreaterThanOrEqual(44);
    }
  }
});
