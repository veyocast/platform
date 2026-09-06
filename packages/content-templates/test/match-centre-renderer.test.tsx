import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import type { PlayerDynamicTemplatePayload } from "@veyocast/contracts";

import {
  createDynamicTemplateView,
  formatMatchCentreClock,
  formatMatchCentrePageCounter
} from "../src/dynamic-template-view";

const css = readFileSync(
  fileURLToPath(new URL("../src/editorial-arena-renderer.module.css", import.meta.url)),
  "utf8"
);
const renderer = readFileSync(
  fileURLToPath(new URL("../src/editorial-arena-renderer.tsx", import.meta.url)),
  "utf8"
);

const themePresentation = {
  appearance: {
    schemaVersion: 1,
    surfaces: {
      clubLogoBackground: "#E7F5EE",
      homeLogoBackground: "#FFFFFF"
    },
    typography: {
      baseScale: 1,
      bodyFontRef: "vc-inter-v1",
      displayFontRef: "vc-manrope-v1",
      sportScale: 1.12
    }
  },
  catalogVersion: "1.0.0",
  resolvedMode: {
    mode: "light",
    policy: { kind: "fixed", mode: "light" },
    resolvedAt: "2026-09-06T13:33:00.000Z",
    timezone: "Europe/Amsterdam"
  },
  selection: {
    accent: null,
    categoryOverrides: [],
    modePolicy: { kind: "fixed", mode: "light" },
    ref: { catalog: "v2", id: "fieldflow", version: "1.0.0" },
    support: null
  },
  settingsRevision: 7,
  snapshotVersion: 2
} as const;

function programPayload(
  itemCount: number,
  slideType: "sport_program" | "sport_team" = "sport_program"
): PlayerDynamicTemplatePayload {
  return {
    data: {
      brand: { clubName: "Duindorp SV", primaryColor: "#315CFF" },
      sport: {
        items: Array.from({ length: itemCount }, (_, index) => ({
          awayTeam: `Uit ${index + 1}`,
          date: "12-09-2026",
          field: `Veld ${index + 1}`,
          homeTeam: `Thuis ${index + 1}`,
          id: `wedstrijd-${index + 1}`,
          primary: `Thuis ${index + 1} – Uit ${index + 1}`,
          time: "08:30"
        })),
        title: "Clubprogramma komende 7 dagen"
      },
      themePresentation,
      type: slideType
    },
    orientation: "landscape",
    schemaVersion: 1,
    slideType,
    snapshotHash: "a".repeat(64),
    snapshotId: "11111111-1111-4111-8111-111111111111",
    templateSlug: "editorial-arena-programma-light-landscape",
    templateVersionId: "22222222-2222-4222-8222-222222222222"
  };
}

describe("Match Centre renderer", () => {
  it("formatteert de tenanttijd deterministisch als dd-mm-yyyy | HH:mm", () => {
    expect(formatMatchCentreClock(
      "2026-09-06T13:33:00.000Z",
      "Europe/Amsterdam"
    )).toBe("06-09-2026 | 15:33");
    expect(formatMatchCentreClock(
      "2026-09-06T13:33:00.000Z",
      "Geen/Geldige-Zone"
    )).toBe("06-09-2026 | 13:33");
    expect(formatMatchCentreClock("geen-datum", "Europe/Amsterdam")).toBe("—");
  });

  it("houdt item 100 bereikbaar via clubpaginering en verruimt andere sporten niet", () => {
    const view = createDynamicTemplateView(programPayload(101));
    const items = view?.pages.flatMap((page) =>
      page.kind === "sport-list" ? page.items : []
    );
    const teamView = createDynamicTemplateView(programPayload(101, "sport_team"));
    const teamItemCount = teamView?.pages.reduce(
      (count, page) => count + ("items" in page ? page.items.length : 0),
      0
    );

    expect(view?.sportDisplay).toMatchObject({
      columns: "one",
      showLogo: true
    });
    expect(view?.pages).toHaveLength(13);
    expect(items).toHaveLength(100);
    expect(items?.at(-1)?.id).toBe("wedstrijd-100");
    expect(teamItemCount).toBe(40);
  });

  it("zet MATCHCENTRE, paginanummer en bevroren previewtijd in de header", () => {
    const view = createDynamicTemplateView(programPayload(17));
    const firstPage = view?.pages[0];

    expect(formatMatchCentrePageCounter(
      0,
      view?.pages.length ?? 0
    )).toBe("01 / 03");
    expect(formatMatchCentreClock(
      themePresentation.resolvedMode.resolvedAt,
      themePresentation.resolvedMode.timezone
    )).toBe("06-09-2026 | 15:33");
    expect(
      firstPage?.kind === "sport-list" ? firstPage.items : []
    ).toHaveLength(8);
    expect(renderer).toContain("<strong>MATCHCENTRE</strong>");
    expect(renderer).toContain(
      "<time dateTime={clock.instant}>{clock.label}</time>"
    );
    expect(renderer).toContain(
      "{!matchCentre ? <span>{view.sourceLabel}</span> : null}"
    );
    expect(renderer).not.toContain("VerticalSlideIndex");
  });

  it("ankert het zichtbare frame aan gelijke vierzijdige safe-area en staggered cards", () => {
    expect(css).toContain(
      "top: calc(52px + var(--arena-viewport-inset-y, 0px));"
    );
    expect(css).toContain(
      "bottom: calc(52px + var(--arena-viewport-inset-y, 0px));"
    );
    expect(css).toContain(
      "left: calc(52px + var(--arena-viewport-inset-x, 0px));"
    );
    expect(css).toContain("@keyframes matchRowIn");
    expect(css).toContain("var(--arena-row-delay) both");
    expect(css).not.toContain(".arenaVerticalIndex");
  });
});
