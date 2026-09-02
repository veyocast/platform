import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { editorialArenaActiveSlideTypes } from "@veyocast/contracts";

import {
  fieldflowLedMomentKeys,
  fieldflowMenuBlockTypes,
  fieldflowNewsVariants,
  fieldflowSlideFamilyByType,
  fieldflowSponsorPositions
} from "../src/fieldflow-coverage";

describe("FieldFlow gesloten coveragecontract", () => {
  it("mapt ieder contracttype expliciet zonder generieke familie", () => {
    expect(Object.keys(fieldflowSlideFamilyByType).sort()).toEqual(
      [...editorialArenaActiveSlideTypes].sort()
    );
    expect(Object.values(fieldflowSlideFamilyByType)).not.toContain("generic");
    expect(Object.values(fieldflowSlideFamilyByType)).not.toContain("sport-list");
  });

  it("bevriest de vereiste variantinventarissen", () => {
    expect(fieldflowNewsVariants).toHaveLength(4);
    expect(fieldflowMenuBlockTypes).toHaveLength(7);
    expect(fieldflowLedMomentKeys).toHaveLength(8);
    expect(fieldflowSponsorPositions).toHaveLength(6);
  });

  it("weigert een ontbrekend of orphan zichtbaar editorcontrol in de trace", async () => {
    const trace = await readFile(
      new URL("../../../docs/redesign/CONFIG_TO_RENDER_TRACE.csv", import.meta.url),
      "utf8"
    );
    for (const control of [
      "sport.display.columns",
      "sport.display.showDressingRoom",
      "sport.display.showField",
      "sport.display.showHomeAway",
      "sport.display.showReferee",
      "sport.arrival.showClubLogo",
      "sport.arrival.showSponsor",
      "sport.arrival.sponsorMediaAssetId",
      "news.variant",
      "news.qr.link",
      "news.media.focalPoint",
      "birthday.presentation",
      "birthday.visibility",
      "menu.v2.appearance",
      "menu.v2.focalPoint",
      "led.live.controls",
      "led.scene.bindings"
    ]) {
      expect(trace).toContain(`"${control}"`);
    }
    expect(trace).not.toMatch(/,"ORPHAN"(?:,|\r?$)/m);
  });
});
