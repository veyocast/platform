import { readFile } from "node:fs/promises";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { SponsorPositionKey } from "@veyocast/contracts";

import type { SponsorPlaybackSelection } from "../_lib/player-sponsor";
import {
  SponsorPlacement,
  sponsorPositions
} from "./player-runtime";
import type { FrozenPlayerTheme } from "./player-presentation-theme";

const creativeUrl = "https://assets.example.test/sponsor-original.png";
const creative = {
  bytes: 1_024,
  campaignId: "11111111-1111-4111-8111-111111111111",
  checksumSha256: "a".repeat(64),
  creativeFamilyId: "22222222-2222-4222-8222-222222222222",
  creativeId: "33333333-3333-4333-8333-333333333333",
  durationSeconds: 8,
  height: 400,
  mimeType: "image/png",
  sponsorId: "44444444-4444-4444-8444-444444444444",
  sponsorName: "Originele sponsor",
  url: creativeUrl,
  width: 800
};

function selection(positionKey: SponsorPositionKey): SponsorPlaybackSelection {
  return {
    creative,
    placement: {
      campaignId: creative.campaignId,
      context: {},
      cooldownSeconds: 0,
      creatives: [creative],
      dailyCap: null,
      orientation: "any",
      positionId: "55555555-5555-4555-8555-555555555555",
      positionKey,
      priority: 0,
      sponsorId: creative.sponsorId,
      weight: 1
    }
  };
}

const frozenTheme: FrozenPlayerTheme = {
  designRevision: "royal-current-v8",
  mode: "dark",
  motionEnabled: false,
  snapshot: {} as FrozenPlayerTheme["snapshot"],
  style: {
    "--player-bg": "#0a1124",
    "--player-ink": "#f5f7fb",
    "--player-line": "#434c61"
  } as FrozenPlayerTheme["style"]
};

describe("frozen sponsorlaag-theme", () => {
  it("bevat exact de zes product-owned sponsorposities", () => {
    expect(sponsorPositions).toEqual([
      "fullscreen",
      "presented_by",
      "footer",
      "corner",
      "match_sponsor",
      "match_ball_sponsor"
    ]);
  });

  it.each(sponsorPositions)("projecteert frozen theme op %s zonder de creative te wijzigen", (positionKey) => {
    const selected = selection(positionKey);
    const html = renderToStaticMarkup(
      <SponsorPlacement
        planRevisionId="66666666-6666-4666-8666-666666666666"
        positionKey={positionKey}
        selection={selected}
        theme={frozenTheme}
      />
    );

    expect(html).toContain(`sponsor-placement--${positionKey}`);
    expect(html).toContain(`data-position="${positionKey}"`);
    expect(html).toContain('data-design-revision="royal-current-v8"');
    expect(html).toContain('data-motion-state="off"');
    expect(html).toContain('data-theme-authority="frozen-release"');
    expect(html).toContain('data-theme-mode="dark"');
    expect(html).toContain("--player-bg:#0a1124");
    expect(html).toContain(`src="${creativeUrl}"`);
    expect(selected.creative.url).toBe(creativeUrl);
  });

  it("thematisert alleen de product-surround en laat img-creatives ongemoeid", async () => {
    const css = await readFile(new URL("../globals.css", import.meta.url), "utf8");
    const imageRule = css.match(/\.sponsor-placement img \{[^}]+\}/u)?.[0] ?? "";

    expect(css).toContain("var(--player-bg, var(--player-system-bg))");
    expect(css).toContain("var(--player-ink, var(--player-system-ink))");
    expect(css).toContain("var(--player-line, var(--player-system-line))");
    expect(imageRule).toContain("object-fit: contain");
    expect(imageRule).not.toContain("filter");
    expect(imageRule).not.toContain("opacity");
    expect(imageRule).not.toContain("mix-blend-mode");
  });
});
