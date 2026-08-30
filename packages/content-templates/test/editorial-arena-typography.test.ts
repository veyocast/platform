import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  fileURLToPath(new URL("../src/editorial-arena-renderer.module.css", import.meta.url)),
  "utf8"
);

describe("Editorial Arena pooltypografie", () => {
  it("vergroot uitslagtekst en scores exact 50%", () => {
    expect(css).toMatch(
      /\[data-slide-type="sport_results"\] \.arenaResultRow \{\s*font-size: 30px;/u
    );
    expect(css).toMatch(
      /\[data-slide-type="sport_results"\] \.arenaResultRow > strong \{\s*font-size: 46\.5px;/u
    );
    expect(css).toMatch(
      /\[data-orientation="portrait"\]\[data-slide-type="sport_results"\] \.arenaResultRow \{\s*font-size: 27px;/u
    );
  });

  it("vergroot poulestandkop, rijen en context exact 50%", () => {
    expect(css).toMatch(
      /\[data-slide-type="sport_standing"\] \.arenaStandingHead \{\s*font-size: 21px;/u
    );
    expect(css).toMatch(
      /\[data-slide-type="sport_standing"\] \.arenaStandingRows > article \{\s*font-size: 42px;/u
    );
    expect(css).toMatch(
      /\[data-orientation="portrait"\]\[data-slide-type="sport_standing"\] \.arenaStandingRows > article \{\s*font-size: 37\.5px;/u
    );
    expect(css).toMatch(
      /\[data-slide-type="sport_standing"\] \.arenaStandingContext \{\s*font-size: 21px;/u
    );
  });
});
