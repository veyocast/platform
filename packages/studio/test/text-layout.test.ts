import { describe, expect, it } from "vitest";

import { layoutStudioText, type StudioElement } from "../src";

const textElement: Extract<StudioElement, { type: "text" }> = {
  id: "copy-block",
  type: "text",
  name: "Tekst",
  x: 0,
  y: 0,
  width: 460,
  height: 240,
  rotation: 0,
  opacity: 1,
  visible: true,
  locked: false,
  zIndex: 0,
  text: "Samen maken we de club zichtbaar",
  fontFamily: "Inter Variable",
  fontWeight: 700,
  fontSize: 72,
  lineHeight: 1.1,
  letterSpacing: 0,
  fill: "#FAFAF7",
  align: "left",
  verticalAlign: "top",
  autoFit: true,
  cornerRadius: 0,
  padding: 20
};

describe("Studio-tekstlayout", () => {
  it("breekt tekst deterministisch af en past binnen het tekstvak", () => {
    const first = layoutStudioText(textElement);
    const second = layoutStudioText(textElement);
    expect(first).toEqual(second);
    expect(first.lines.length).toBeGreaterThan(1);
    expect(first.lines.length * first.lineHeightPx).toBeLessThanOrEqual(200);
  });

  it("splits een lang woord zonder overloop", () => {
    const layout = layoutStudioText({
      ...textElement,
      autoFit: false,
      fontSize: 40,
      text: "vrijwilligerscoördinatoren",
      width: 180
    });
    expect(layout.lines.length).toBeGreaterThan(1);
  });
});
