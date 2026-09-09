import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { sportlinkDisplayConfigSchema } from "@veyocast/contracts";

import {
  SportlinkMatchRowPreview,
  sportlinkMatchRowPreviewKind
} from "./sportlink-match-row-preview";

describe("Sportlink wedstrijdrij-preview", () => {
  it("toont de gekozen programmakolommen en tweede regel zonder providerwaarden", () => {
    const display = sportlinkDisplayConfigSchema.parse({
      columns: "two",
      showAwayDressingRoom: true,
      showAwayLogo: true,
      showDate: true,
      showField: true,
      showHomeDressingRoom: true,
      showHomeLogo: true,
      showReferee: true,
      showSportpark: true,
      showTime: true
    });
    const html = renderToStaticMarkup(
      <SportlinkMatchRowPreview
        blueprintKey="sportlink.club_schedule_next_7_days"
        display={display}
        orientation="landscape"
      />
    );

    expect(html).toContain('data-kind="program"');
    expect(html).toContain('data-columns="two"');
    for (const field of [
      "date",
      "time",
      "home-logo",
      "home-team",
      "home-dressing-room",
      "versus",
      "away-logo",
      "away-team",
      "away-dressing-room",
      "scheidsrechter",
      "veld",
      "sportpark"
    ]) {
      expect(html.match(new RegExp(`data-field="${field}"`, "gu"))).toHaveLength(2);
    }
    expect(html).toContain("Veldindeling · geen providerdata");
    expect(html).not.toMatch(/\b\d{1,2}:\d{2}\b/u);
  });

  it("laat in een uitslag alleen geactiveerde eerste-regelvelden zien", () => {
    const display = sportlinkDisplayConfigSchema.parse({
      columns: "two",
      showAwayDressingRoom: false,
      showAwayLogo: false,
      showDate: false,
      showField: true,
      showHomeDressingRoom: false,
      showHomeLogo: false,
      showReferee: true,
      showSportpark: true,
      showTime: false
    });
    const html = renderToStaticMarkup(
      <SportlinkMatchRowPreview
        blueprintKey="sportlink.pool_results_previous_7_days"
        display={display}
        orientation="portrait"
      />
    );

    expect(html).toContain('data-kind="results"');
    expect(html).toContain('data-columns="one"');
    expect(html).toContain('data-field="home-team"');
    expect(html).toContain('data-field="score"');
    expect(html).toContain('aria-label="Uitslag nog niet bekend"');
    expect(html).toContain('data-field="away-team"');
    for (const field of [
      "date",
      "time",
      "home-logo",
      "away-logo",
      "home-dressing-room",
      "away-dressing-room",
      "scheidsrechter",
      "veld",
      "sportpark"
    ]) {
      expect(html).not.toContain(`data-field="${field}"`);
    }
    expect(html).not.toContain('data-line="secondary"');
  });

  it("activeert alleen voor programma- en uitslagblueprints", () => {
    expect(sportlinkMatchRowPreviewKind("sportlink.club_schedule_today"))
      .toBe("program");
    expect(sportlinkMatchRowPreviewKind("sportlink.pool_results_today"))
      .toBe("results");
    expect(sportlinkMatchRowPreviewKind("sportlink.pool_standings")).toBeNull();
  });
});
