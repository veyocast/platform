import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  createDefaultLedScoresCanvasExperience,
  ledScoresCanvasSceneSchema
} from "@veyocast/contracts";

import type {
  LedScoresCanvasScenePair,
  LedScoresOverlayAsset
} from "../_lib/ledscores-match-experience";
import {
  LedScoresCanvasSceneRenderer,
  selectLedScoresCanvasScene
} from "./ledscores-canvas-scene";
import type { FrozenPlayerTheme } from "./player-presentation-theme";

const backgroundAssetId = "11111111-1111-4111-8111-111111111111";

describe("LED Scores canvas Player-renderer", () => {
  it("kiest de expliciete liggende en staande compositie", () => {
    const pair = scenePair();
    expect(selectLedScoresCanvasScene(pair, "landscape").orientation)
      .toBe("landscape");
    expect(selectLedScoresCanvasScene(pair, "portrait").orientation)
      .toBe("portrait");

    const landscape = renderToStaticMarkup(
      <LedScoresCanvasSceneRenderer
        ariaLabel="Canvas goal"
        assets={assets}
        orientation="landscape"
        scene={pair}
        values={values}
      />
    );
    const portrait = renderToStaticMarkup(
      <LedScoresCanvasSceneRenderer
        ariaLabel="Canvas goal"
        assets={assets}
        orientation="portrait"
        scene={pair}
        values={values}
      />
    );

    expect(landscape).toContain('data-orientation="landscape"');
    expect(landscape).toContain("signed-background.mp4");
    expect(landscape).toContain("muted=\"\"");
    expect(landscape).toContain("loop=\"\"");
    expect(landscape).toContain("playsInline=\"\"");
    expect(portrait).toContain('data-orientation="portrait"');
    expect(portrait).not.toContain("signed-background.mp4");
  });

  it("bindt score en spelersfoto zonder vrije HTML of URL-laag", () => {
    const html = renderToStaticMarkup(
      <LedScoresCanvasSceneRenderer
        ariaLabel="Canvas goal"
        assets={assets}
        orientation="landscape"
        scene={scenePair()}
        values={values}
      />
    );

    expect(html).toContain("D. Jansen");
    expect(html).toContain("3 – 1");
    expect(html).toContain("signed-player.webp");
    expect(html).toContain('data-layer-id="scorer-photo"');
    expect(html).not.toContain("<script");
  });

  it("rendert een lijn als gecentreerde stroke in plaats van een gevulde balk", () => {
    const pair = createDefaultLedScoresCanvasExperience().scenes.goalOwn;
    const shape = pair.landscape.layers.find((layer) => layer.type === "shape");
    if (!shape || shape.type !== "shape") throw new Error("Expected shape layer");
    const lineScene = ledScoresCanvasSceneSchema.parse({
      ...pair.landscape,
      layers: [{
        ...shape,
        fill: "#ff5c20",
        height: 120,
        shape: "line",
        stroke: "#315cff",
        strokeWidth: 8
      }]
    });
    const html = renderToStaticMarkup(
      <LedScoresCanvasSceneRenderer
        ariaLabel="Canvas lijn"
        assets={new Map()}
        orientation="landscape"
        scene={{ landscape: lineScene, portrait: pair.portrait }}
        values={values}
      />
    );

    expect(html).toContain('data-shape="line"');
    expect(html).toContain("background-color:transparent");
    expect(html).toContain("border-width:0");
    expect(html).toContain("--canvas-line-color:#315cff");
    expect(html).toContain("--canvas-line-width:min(");
  });

  it("themet alleen de canvas-root en behoudt authored laagkleuren", () => {
    const html = renderToStaticMarkup(
      <LedScoresCanvasSceneRenderer
        ariaLabel="Canvas Royal"
        assets={assets}
        orientation="landscape"
        scene={scenePair()}
        theme={royalTheme}
        values={values}
      />
    );

    expect(html).toContain('data-design-revision="royal-current-v8"');
    expect(html).toContain('data-motion-state="off"');
    expect(html).toContain('--bg:#0a1124');
    expect(html).toContain("background-color:#0a0a0a");
  });
});

const assets = new Map<string, LedScoresOverlayAsset>([[
  backgroundAssetId,
  {
    checksum: "a".repeat(64),
    mediaAssetId: backgroundAssetId,
    mimeType: "video/mp4",
    url: "https://storage.test/signed-background.mp4"
  }
]]);

const values = {
  images: {
    scorerPhoto: "https://storage.test/signed-player.webp"
  },
  lineup: [],
  text: {
    awayScore: "1",
    awayTeam: "Bezoekers",
    eventLabel: "DOELPUNT",
    headline: "GOAAAL!",
    homeScore: "3",
    homeTeam: "Duindorp SV",
    score: "3 – 1",
    scorerName: "D. Jansen",
    scorerNumber: "#9",
    scoringTeam: "Duindorp SV"
  }
} as const;

function scenePair(): LedScoresCanvasScenePair {
  const pair = createDefaultLedScoresCanvasExperience().scenes.goalOwn;
  return {
    landscape: ledScoresCanvasSceneSchema.parse({
      ...pair.landscape,
      background: {
        focusX: 0.5,
        focusY: 0.5,
        kind: "media",
        mediaAssetId: backgroundAssetId,
        objectFit: "cover",
        overlayColor: "#0a0a0a",
        overlayOpacity: 0.3
      }
    }),
    portrait: pair.portrait
  };
}

const royalTheme: FrozenPlayerTheme = {
  designRevision: "royal-current-v8",
  mode: "dark",
  motionEnabled: false,
  snapshot: {} as FrozenPlayerTheme["snapshot"],
  style: {
    "--bg": "#0a1124",
    "--ink": "#f5f7fb"
  } as FrozenPlayerTheme["style"]
};
