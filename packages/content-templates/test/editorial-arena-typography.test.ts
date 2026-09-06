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
    expect(css).toContain(".arenaNewsQr small");
  });
});
