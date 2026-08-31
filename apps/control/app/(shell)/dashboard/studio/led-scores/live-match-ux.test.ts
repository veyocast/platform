import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  enabledMomentCount,
  lineupBehaviorFromForm,
  lineupBehaviorDefaults,
  normalizeProviderTeamKey,
  overlayDesignDefaults,
  readLineupBehavior,
  readOverlayDesign,
  readOverlayTriggers
} from "./live-match-ux";

describe("LED Scores live match authoring", () => {
  it("houdt bestaande goal-only configuraties achterwaarts compatibel", () => {
    expect(readOverlayTriggers({ schemaVersion: 1 })).toEqual({
      end: false,
      halfTime: false,
      lineup: false,
      start: false
    });
    expect(readLineupBehavior({})).toEqual(lineupBehaviorDefaults);
    expect(readLineupBehavior({ lineupBehavior: { includeOpponent: true } }).includeOpponent).toBe(true);
  });

  it("behoudt geselecteerde-opstelling en fallback wanneer de lineuptrigger uit staat", () => {
    const formData = new FormData();
    formData.set("lineupSelectedOnly", "on");
    formData.set("lineupActiveFallback", "on");

    expect(lineupBehaviorFromForm(formData, 8_000)).toEqual({
      activeFallback: true,
      includeOpponent: false,
      pageDurationMs: 8_000,
      selectedOnly: true
    });
  });

  it("herkent opgeslagen eigen teams onafhankelijk van provider-hoofdletters", () => {
    expect(normalizeProviderTeamKey(" TEAM-A ")).toBe(normalizeProviderTeamKey("team-a"));
  });

  it("gebruikt per moment het vaste veilige template", () => {
    expect(readOverlayDesign({}, "lineupHome")).toEqual(overlayDesignDefaults.lineupHome);
    expect(readOverlayDesign({ overlayDesigns: { matchEnd: { headline: "Tot ziens" } } }, "matchEnd")).toMatchObject({
      headline: "Tot ziens",
      template: "final-score"
    });
  });

  it("telt een goal als één moment, ook met eigen en tegenstander ingeschakeld", () => {
    expect(enabledMomentCount(true, true, { end: true, halfTime: true, lineup: true, start: true })).toBe(5);
    expect(enabledMomentCount(false, false, { end: false, halfTime: false, lineup: false, start: false })).toBe(0);
  });

  it("scheidt tijdelijke overlays van een responsive latest-bound playlistslide", async () => {
    const [editor, liveSlide, css] = await Promise.all([
      readFile(new URL("./alert-editor.tsx", import.meta.url), "utf8"),
      readFile(new URL("./live-match-slide-editor.tsx", import.meta.url), "utf8"),
      readFile(new URL("./led-scores-studio.module.css", import.meta.url), "utf8")
    ]);

    expect(editor).toContain("Goal");
    expect(editor).toContain("Opstelling");
    expect(editor).toContain("Start wedstrijd");
    expect(editor).toContain("Rust");
    expect(editor).toContain("Einde wedstrijd");
    expect(liveSlide).toContain("Latest-bound");
    expect(liveSlide).toContain("createLedScoresLiveMatchSlide");
    expect(liveSlide).toContain("useFormStatus");
    expect(liveSlide).toContain('name="idempotencyKey"');
    expect(editor).toContain("Opstelling van de tegenstander opslaan en tonen");
    expect(editor).toContain('<input name="lineupSelectedOnly" type="hidden" value="on" />');
    expect(editor).toContain('<input name="lineupActiveFallback" type="hidden" value="on" />');
    expect(editor).not.toContain('<input name="lineupIncludeOpponent" type="hidden"');
    expect(editor).toContain('id: "lineupAway" as const, label: "Opstelling uit"');
    expect(editor).toContain("normalizeProviderTeamKey(mapping.teamKey)");
    expect(editor).toContain("Vorige stand tonen");
    expect(editor).toContain("data-show-scorer");
    expect(editor).toContain("data-typography");
    expect(editor).toContain("missingDesignHeadline");
    expect(editor).toContain("Een actief moment mist een hoofdtekst.");
    expect(editor).toContain('assets.filter((asset) => asset.kind === "image")');
    expect(css).toMatch(/\.experiencePreview\[data-orientation="portrait"\][^{]*\{[^}]*aspect-ratio:\s*9 \/ 16/s);
    expect(css).toContain("@media (max-width: 48rem)");
    expect(css).toContain('.wizardNav li:has(button[aria-current="step"])');
    expect(css).toContain('.experiencePreview[data-logo-position="center"]');
    expect(css).toContain('.experiencePreview[data-typography="body"]');
    expect(css).not.toMatch(/\.wizardNav ol\s*\{[^}]*overflow-x:\s*auto/s);
  });
});
