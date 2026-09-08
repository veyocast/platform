import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  fileURLToPath(new URL("../src/editorial-arena-renderer.module.css", import.meta.url)),
  "utf8"
);

describe("Editorial Arena pooltypografie", () => {
  it("koppelt uitslagtekst en scores aan de schaalbare thematypografie", () => {
    expect(css).toContain("font-size: var(--vc-theme-sport-result-size, 33.6px);");
    expect(css).toContain("font-size: var(--vc-theme-sport-score-size, 52.08px);");
    expect(css).toContain(
      "font-size: var(--vc-theme-sport-result-size-portrait, 30.24px);"
    );
  });

  it("koppelt ook nieuws-, menu- en bodytekst aan de algemene themeschaal", () => {
    expect(css).toMatch(
      /\.arenaNewsGrid h3 \{[^}]*font-size: var\(--vc-theme-font-34, 34px\);/u
    );
    expect(css).toMatch(
      /\.arenaPriceListCopy small \{[^}]*font-size: var\(--vc-theme-font-17, 17px\);/u
    );
    expect(css).toMatch(
      /\.arenaArrivalCard p \{[^}]*font-size: var\(--vc-theme-font-25, 25px\);/u
    );
  });

  it("vergroot poulestandkop, rijen en context exact 50%", () => {
    expect(css).toMatch(
      /\[data-slide-type="sport_standing"\] \.arenaStandingHead \{\s*font-size: var\(--vc-theme-font-21, 21px\);/u
    );
    expect(css).toMatch(
      /\[data-slide-type="sport_standing"\] \.arenaStandingRows > article \{\s*font-size: var\(--vc-theme-font-42, 42px\);/u
    );
    expect(css).toMatch(
      /\[data-orientation="portrait"\]\[data-slide-type="sport_standing"\] \.arenaStandingRows > article \{\s*font-size: var\(--vc-theme-font-37-5, 37\.5px\);/u
    );
    expect(css).toMatch(
      /\[data-slide-type="sport_standing"\] \.arenaStandingContext \{\s*font-size: var\(--vc-theme-font-21, 21px\);/u
    );
  });

  it("houdt de nieuws-QR scanbaar op minimaal 220 logische pixels", () => {
    expect(css).toMatch(
      /\.arenaNewsQr img \{\s*width: 220px;\s*height: 220px;/u
    );
    expect(css).toMatch(
      /\.arenaNewsLayout\[data-news-variant="fullscreen_gradient"\] \.arenaNewsSource \{\s*right: 92px;/u
    );
    expect(css).toMatch(
      /\.arenaNewsLayout\[data-news-variant="fullscreen_gradient"\] > \.arenaNewsQr \{\s*right: 92px;\s*bottom: 30px;\s*width: 220px;/u
    );
    expect(css).toMatch(
      /\.arenaRoot\[data-orientation="portrait"\] \.arenaNewsLayout\[data-news-variant="fullscreen_gradient"\] > \.arenaNewsQr \{\s*right: 106px;\s*bottom: 46px;/u
    );
    expect(css).not.toContain(".arenaNewsQr small");
  });

  it("geeft de staande splitnieuwsslide extra tussenruimte en zijmarges", () => {
    expect(css).toMatch(
      /\.arenaRoot\[data-orientation="portrait"\] \.arenaNewsLayout\[data-news-variant="hero_split"\] \{\s*box-sizing: border-box;\s*gap: 32px;\s*padding-right: 20px;\s*padding-left: 20px;/u
    );
  });

  it("verdubbelt bezoekdatum en aanvang en lijnt de onderste wedstrijddetails uit", () => {
    expect(css).toMatch(
      /\.arenaArrivalCard\[data-arrival-kind="visitor"\] \.arenaVisitorSchedule time,[\s\S]*?font-size: var\(--vc-theme-font-46, 46px\);/u
    );
    expect(css).toMatch(
      /\.arenaRoot\[data-orientation="portrait"\][\s\S]*?\.arenaVisitorSchedule span \{\s*font-size: var\(--vc-theme-font-52, 52px\);/u
    );
    expect(css).toMatch(
      /\.arenaVisitorDetails > div \{\s*display: grid;\s*grid-template-columns: 220px minmax\(0, 1fr\);/u
    );
    expect(css).toMatch(
      /\.arenaRoot\[data-orientation="portrait"\] \.arenaVisitorDetails > div \{\s*grid-template-columns: 245px minmax\(0, 1fr\);/u
    );
  });
});
