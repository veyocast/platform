import { describe, expect, it } from "vitest";

import {
  createEmptyStudioDocument,
  evaluateStudioReducedMotionFrame,
  interpolateStudioElement,
  parseStudioDocument,
  type StudioElement
} from "../src";

const element: StudioElement = {
  id: "headline",
  type: "text",
  name: "Koptekst",
  x: 100,
  y: 200,
  width: 800,
  height: 200,
  rotation: 0,
  opacity: 1,
  visible: true,
  locked: false,
  zIndex: 0,
  text: "Wedstrijddag",
  fontFamily: "Inter Tight Variable",
  fontWeight: 800,
  fontSize: 96,
  lineHeight: 1,
  letterSpacing: 0,
  fill: "#FAFAF7",
  align: "left",
  verticalAlign: "top",
  autoFit: false,
  cornerRadius: 0,
  padding: 0,
  timing: {
    startMs: 0,
    endMs: 10_000,
    entry: {
      preset: "slide-up",
      durationMs: 1_000,
      delayMs: 0,
      easing: "linear",
      distance: 100,
      intensity: 0.16
    }
  }
};

describe("Studio-motionmath", () => {
  it("is deterministisch op golden frames", () => {
    expect(interpolateStudioElement(element, 0, 10_000)).toEqual({
      clipProgress: 1,
      opacity: 0,
      scaleX: 1,
      scaleY: 1,
      textProgress: 1,
      x: 100,
      y: 300
    });
    expect(interpolateStudioElement(element, 500, 10_000)).toEqual({
      clipProgress: 1,
      opacity: 0.5,
      scaleX: 1,
      scaleY: 1,
      textProgress: 1,
      x: 100,
      y: 250
    });
    expect(interpolateStudioElement(element, 1_000, 10_000)).toEqual({
      clipProgress: 1,
      opacity: 1,
      scaleX: 1,
      scaleY: 1,
      textProgress: 1,
      x: 100,
      y: 200
    });
  });

  it("verbergt een laag buiten de eigen tijdspanne", () => {
    expect(interpolateStudioElement(element, 10_001, 12_000).opacity).toBe(0);
  });

  it("toont de volledige compositie zonder entry-, exit- of continue motion", () => {
    const empty = createEmptyStudioDocument("landscape-hd", {
      motionEnabled: true
    });
    const document = parseStudioDocument({ ...empty, elements: [element] });

    expect(evaluateStudioReducedMotionFrame(document)).toEqual([
      expect.objectContaining({
        element,
        transform: {
          clipProgress: 1,
          opacity: 1,
          scaleX: 1,
          scaleY: 1,
          textProgress: 1,
          x: 100,
          y: 200
        },
        visibleText: "Wedstrijddag"
      })
    ]);
  });
});
