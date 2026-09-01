import { describe, expect, it } from "vitest";

import {
  compileLedScoresCanvasScene,
  createDefaultLedScoresCanvasExperience,
  ledScoresCanvasAssetIds,
  ledScoresCanvasExperienceSchema,
  type LedScoresCanvasExperience,
  type LedScoresCanvasScene
} from "../src/ledscores-scene";

const mediaAssetId = "11111111-1111-4111-8111-111111111111";

describe("LED Scores canvascontract", () => {
  it("compileert alleen zichtbare allowlisted lagen en veilige bindings", () => {
    const scene = sampleScene("landscape");
    const plan = compileLedScoresCanvasScene(scene, {
      images: { scorerPhoto: "https://player.example.test/photo.jpg" },
      lineup: [{ id: "p-1", name: "D. Jansen", number: "9", photoUrl: null }],
      text: { scorerName: "D. Jansen" }
    });

    expect(plan.map((layer) => layer.type)).toEqual(["text", "image", "lineup"]);
    expect(plan[0]).toMatchObject({ resolvedText: "D. Jansen" });
    expect(plan[1]).toMatchObject({ resolvedUrl: "https://player.example.test/photo.jpg" });
    expect(plan[2]).toMatchObject({ players: [{ name: "D. Jansen" }] });
  });

  it("weigert vrije bindings, CSS en dubbele laagposities", () => {
    const scene = sampleScene("landscape");
    const invalid = {
      ...scene,
      layers: [
        { ...scene.layers[0], binding: "window.location", css: "position:fixed" },
        { ...scene.layers[1], zIndex: 0 }
      ]
    };

    const experience = experienceWith(scene);
    const candidate = {
      ...experience,
      scenes: {
        ...experience.scenes,
        goalOwn: { ...experience.scenes.goalOwn, landscape: invalid }
      }
    };
    expect(() => ledScoresCanvasExperienceSchema.parse(candidate)).toThrow();
  });

  it("vereist afzonderlijke liggende en staande composities", () => {
    const invalid = experienceWith(sampleScene("landscape"));
    invalid.scenes.goalOwn.portrait = sampleScene("landscape") as never;
    expect(() => ledScoresCanvasExperienceSchema.parse(invalid)).toThrow();
  });

  it("verzamelt uitsluitend persistente mediareferenties", () => {
    const experience = experienceWith(sampleScene("landscape"));
    expect(ledScoresCanvasAssetIds(experience)).toEqual([mediaAssetId]);
  });

  it("levert voor ieder moment twee direct geldige startcomposities", () => {
    const defaults = createDefaultLedScoresCanvasExperience();
    expect(ledScoresCanvasExperienceSchema.parse(defaults)).toEqual(defaults);
    expect(defaults.scenes.goalOwn.landscape.orientation).toBe("landscape");
    expect(defaults.scenes.goalOwn.portrait.orientation).toBe("portrait");
    expect(textFallback(defaults.scenes.goalOpponent.landscape, "headline"))
      .toBe("Tegendoelpunt");
    expect(textFallback(defaults.scenes.lineupAway.portrait, "headline"))
      .toBe("Opstelling bezoekers");
    expect(textFallback(defaults.scenes.halfTime.landscape, "headline"))
      .toBe("Rust");
    expect(textFallback(defaults.scenes.matchEnd.portrait, "secondaryText"))
      .toBe("Bedankt voor jullie support");
  });
});

function textFallback(
  scene: LedScoresCanvasScene,
  binding: "headline" | "secondaryText"
) {
  const layer = scene.layers.find((candidate) =>
    candidate.type === "text" && candidate.binding === binding
  );
  return layer?.type === "text" ? layer.text : null;
}

function experienceWith(landscape: LedScoresCanvasScene): LedScoresCanvasExperience {
  const pair = { landscape, portrait: sampleScene("portrait") };
  return {
    scenes: {
      goalOwn: structuredClone(pair),
      goalOpponent: structuredClone(pair),
      goalUnknown: structuredClone(pair),
      lineupHome: structuredClone(pair),
      lineupAway: structuredClone(pair),
      matchStart: structuredClone(pair),
      halfTime: structuredClone(pair),
      matchEnd: structuredClone(pair)
    },
    schemaVersion: 1
  };
}

function sampleScene(
  orientation: "landscape" | "portrait"
): LedScoresCanvasScene {
  return {
    background: orientation === "landscape"
      ? {
          focusX: 0.5,
          focusY: 0.5,
          kind: "media",
          mediaAssetId,
          objectFit: "cover",
          overlayColor: "#0a0a0a",
          overlayOpacity: 0.3
        }
      : { color: "#0a0a0a", kind: "solid" },
    layers: [
      {
        align: "left",
        animation: "rise",
        backgroundColor: null,
        binding: "scorerName",
        cornerRadius: 0,
        fill: "#fafaf7",
        fontFamily: "Inter Tight",
        fontSize: 120,
        fontWeight: 900,
        height: 160,
        id: "scorer-name",
        letterSpacing: -2,
        lineHeight: 1,
        locked: false,
        name: "Naam doelpuntenmaker",
        opacity: 1,
        padding: 0,
        rotation: 0,
        text: "Doelpuntenmaker",
        type: "text",
        verticalAlign: "middle",
        visible: true,
        width: 900,
        x: 120,
        y: 240,
        zIndex: 0
      },
      {
        animation: "zoom",
        binding: "scorerPhoto",
        cornerRadius: 48,
        focusX: 0.5,
        focusY: 0.3,
        height: 600,
        id: "scorer-photo",
        locked: false,
        mediaAssetId: null,
        name: "Spelersfoto",
        objectFit: "cover",
        opacity: 1,
        rotation: 0,
        type: "image",
        visible: true,
        width: 500,
        x: 1_260,
        y: 220,
        zIndex: 1
      },
      {
        accentColor: "#ff5c20",
        animation: "fade",
        cardColor: "#151719e6",
        columns: 4,
        gap: 24,
        height: 460,
        id: "lineup-grid",
        locked: false,
        name: "Opstelling",
        opacity: 1,
        rotation: 0,
        showName: true,
        showNumber: true,
        showPhoto: true,
        textColor: "#fafaf7",
        type: "lineup",
        visible: true,
        width: 1_680,
        x: 120,
        y: 520,
        zIndex: 2
      }
    ],
    orientation
  };
}
