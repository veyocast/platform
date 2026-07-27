import { parseStudioDocument } from "@veyocast/studio";
import { describe, expect, it } from "vitest";

import { renderStudioSvg } from "../src/studio-render-svg";

const document = parseStudioDocument({
  artboard: {
    background: {
      angle: 90,
      from: "#0A0A0A",
      kind: "linear-gradient",
      to: "#FF4A0A"
    },
    height: 1080,
    orientation: "landscape",
    safeArea: { bottom: 64, left: 64, right: 64, top: 64 },
    width: 1920
  },
  elements: [
    {
      childIds: ["title", "panel"],
      height: 1,
      id: "group-main",
      locked: false,
      name: "Groep",
      opacity: 1,
      rotation: 0,
      type: "group",
      visible: true,
      width: 1,
      x: 0,
      y: 0,
      zIndex: 0
    },
    {
      align: "center",
      autoFit: false,
      cornerRadius: 0,
      fill: "#FAFAF7",
      fontFamily: "Inter Tight Variable",
      fontSize: 96,
      fontWeight: 700,
      groupId: "group-main",
      height: 140,
      id: "title",
      letterSpacing: -1,
      lineHeight: 1,
      locked: false,
      name: "Titel",
      opacity: 1,
      padding: 0,
      rotation: 0,
      text: "Veyo & <Studio>",
      timing: {
        endMs: 10_000,
        entry: {
          delayMs: 0,
          distance: 80,
          durationMs: 1_000,
          easing: "linear",
          intensity: 0,
          preset: "wipe"
        },
        startMs: 0
      },
      type: "text",
      verticalAlign: "middle",
      visible: true,
      width: 900,
      x: 510,
      y: 260,
      zIndex: 2
    },
    {
      cornerRadius: 24,
      fill: { color: "#141414", kind: "solid" },
      groupId: "group-main",
      height: 300,
      id: "panel",
      locked: false,
      name: "Vlak",
      opacity: 0.9,
      rotation: 0,
      shape: "rectangle",
      type: "shape",
      visible: true,
      width: 1100,
      x: 410,
      y: 180,
      zIndex: 1
    }
  ],
  metadata: {
    fontRegistryVersion: "2026-07-24.1",
    tenantBrandApplied: false
  },
  motion: { durationMs: 10_000, enabled: true, fps: 30 },
  schemaVersion: 1
});

describe("deterministic Studio SVG scene", () => {
  it("renders the same revision and timestamp byte-for-byte", () => {
    const first = renderStudioSvg({ document, timeMs: 500 });
    const second = renderStudioSvg({ document, timeMs: 500 });

    expect(second).toBe(first);
    expect(first).toContain('font-family="Inter Tight"');
    expect(first).toContain("Veyo &amp; &lt;Studio&gt;");
    expect(first).toContain('width="450"');
    expect(first).not.toContain("Groep");
  });

  it("changes only frame-derived output for another timestamp", () => {
    expect(renderStudioSvg({ document, timeMs: 1_000 }))
      .not.toBe(renderStudioSvg({ document, timeMs: 500 }));
  });
});
