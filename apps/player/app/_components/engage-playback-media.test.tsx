import { readFile } from "node:fs/promises";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { EngagePublicCampaign } from "@veyocast/contracts";

import {
  EngageCampaignSurface,
  engageOptionPercentage
} from "./engage-playback-media";
import type { FrozenPlayerTheme } from "./player-presentation-theme";

const publicId = "11111111-1111-4111-8111-111111111111";
const campaign: EngagePublicCampaign = {
  closesAt: null,
  id: "22222222-2222-4222-8222-222222222222",
  kind: "motm",
  options: [
    {
      id: "33333333-3333-4333-8333-333333333333",
      label: "Milan van der Pol",
      sortOrder: 1,
      voteCount: 32
    },
    {
      id: "44444444-4444-4444-8444-444444444444",
      label: "Jack Morauw",
      sortOrder: 0,
      voteCount: 48
    },
    {
      id: "55555555-5555-4555-8555-555555555555",
      label: "Jeremy Keus",
      sortOrder: 2,
      voteCount: 20
    }
  ],
  privacyNotice: "Alleen een anonieme stem wordt verwerkt.",
  question: "Wie is jouw speler van de wedstrijd?",
  resultVisibility: "live",
  resultsVisible: true,
  status: "live",
  tenantName: "Voorbeeldvereniging",
  title: "Speler van de wedstrijd",
  totalVotes: 100
};

describe("Royal Current Engage playback", () => {
  it("zet resultaten eerst op twee derde en de actieve QR-oproep daarna", () => {
    const html = renderToStaticMarkup(
      <EngageCampaignSurface campaign={campaign} publicId={publicId} />
    );

    expect(html).toContain('data-campaign-kind="motm"');
    expect(html).toContain('data-option-count="3"');
    expect(html).toContain('data-design-revision="player-fallback"');
    expect(html.indexOf("engage-playback__results"))
      .toBeLessThan(html.indexOf("engage-playback__callout"));
    expect(html.indexOf("Jack Morauw")).toBeLessThan(html.indexOf("Milan van der Pol"));
    expect(html).toContain("48<small>%</small>");
    expect(html).toContain("--engage-progress:0.48");
    expect(html).toContain(`/api/player/engage/${publicId}/qr`);
  });

  it("toont een expliciete gesloten toestand zonder actieve stem-QR", () => {
    const html = renderToStaticMarkup(
      <EngageCampaignSurface
        campaign={{
          ...campaign,
          resultVisibility: "after_close",
          resultsVisible: false,
          status: "closed"
        }}
        publicId={publicId}
      />
    );

    expect(html).toContain('data-status="closed"');
    expect(html).toContain("Uitslag niet openbaar.");
    expect(html).toContain("Campagne gesloten");
    expect(html).not.toContain(`/api/player/engage/${publicId}/qr`);
    expect(html).toContain("VeyoCast vult geen ontbrekende percentages in.");
  });

  it("verzint geen percentage wanneer de livebron geen optiewaarde levert", () => {
    expect(engageOptionPercentage(undefined, 12)).toBeNull();
    expect(engageOptionPercentage(0, 0)).toBe(0);
    expect(engageOptionPercentage(3, 12)).toBe(25);
    expect(engageOptionPercentage(40, 12)).toBe(100);
  });

  it("projecteert een bevroren snapshot zonder de livecampagne te muteren", () => {
    const html = renderToStaticMarkup(
      <EngageCampaignSurface
        campaign={campaign}
        publicId={publicId}
        theme={royalTheme}
      />
    );

    expect(html).toContain('data-design-revision="royal-current-v8"');
    expect(html).toContain('data-motion-state="off"');
    expect(html).toContain('--bg:#0a1124');
    expect(campaign.options[0]?.voteCount).toBe(32);
  });

  it("borgt de 2/3-compositie en de stabiele scaleX-baranimatie", async () => {
    const styles = await readFile(new URL("../globals.css", import.meta.url), "utf8");

    expect(styles).toContain("grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);");
    expect(styles).toContain("grid-template-rows: minmax(0, 2fr) minmax(0, 1fr);");
    expect(styles).toContain("transition: transform 1400ms cubic-bezier(.22, 1, .36, 1);");
    expect(styles).toContain("transition-delay: calc(180ms + var(--engage-order) * 160ms);");
    expect(styles).toContain("transform: scaleX(var(--engage-progress));");
  });
});

const royalTheme: FrozenPlayerTheme = {
  designRevision: "royal-current-v8",
  mode: "dark",
  motionEnabled: false,
  snapshot: {} as FrozenPlayerTheme["snapshot"],
  style: {
    "--accent": "#6a8ef3",
    "--bg": "#0a1124",
    "--ink": "#f5f7fb"
  } as FrozenPlayerTheme["style"]
};
