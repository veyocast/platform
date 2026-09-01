import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  createDefaultLedScoresCanvasExperience,
  ledScoresCanvasExperienceSchema
} from "@veyocast/contracts";

import {
  createImageLayer,
  createLedScoresCanvasEditorState,
  createShapeLayer,
  createTextLayer,
  ledScoresCanvasPreviewText,
  ledScoresCanvasEditorReducer,
  sceneAt
} from "./canvas-experience-state";

describe("LED Scores canvaseditor state", () => {
  it("houdt iedere geaccepteerde bewerking contract-geldig", () => {
    const experience = createDefaultLedScoresCanvasExperience();
    const initial = createLedScoresCanvasEditorState(experience);
    const scene = sceneAt(experience, "goalOwn", "landscape");
    const layer = createTextLayer(scene, "scorerName");
    const added = ledScoresCanvasEditorReducer(initial, {
      layer,
      moment: "goalOwn",
      orientation: "landscape",
      type: "add-layer"
    });
    const moved = ledScoresCanvasEditorReducer(added, {
      layerId: layer.id,
      moment: "goalOwn",
      orientation: "landscape",
      patch: { height: 180, width: 700, x: 248, y: 824 },
      type: "update-layer"
    });

    expect(ledScoresCanvasExperienceSchema.safeParse(moved.experience).success).toBe(true);
    expect(sceneAt(moved.experience, "goalOwn", "landscape").layers.at(-1)).toMatchObject({
      binding: "scorerName",
      height: 180,
      width: 700,
      x: 248,
      y: 824
    });
  });

  it("weigert ongeldige patches zonder het geldige document te beschadigen", () => {
    const experience = createDefaultLedScoresCanvasExperience();
    const initial = createLedScoresCanvasEditorState(experience);
    const layer = sceneAt(experience, "goalOwn", "landscape").layers[0];
    expect(layer).toBeDefined();
    if (!layer) return;

    const result = ledScoresCanvasEditorReducer(initial, {
      layerId: layer.id,
      moment: "goalOwn",
      orientation: "landscape",
      patch: { width: -1 },
      type: "update-layer"
    });

    expect(result).toBe(initial);
    expect(ledScoresCanvasExperienceSchema.safeParse(result.experience).success).toBe(true);
  });

  it("maakt toevoegen, verwijderen, undo en redo voorspelbaar", () => {
    const initial = createLedScoresCanvasEditorState(createDefaultLedScoresCanvasExperience());
    const before = sceneAt(initial.experience, "matchStart", "portrait");
    const layer = createShapeLayer(before);
    const added = ledScoresCanvasEditorReducer(initial, {
      layer,
      moment: "matchStart",
      orientation: "portrait",
      type: "add-layer"
    });
    const removed = ledScoresCanvasEditorReducer(added, {
      layerId: layer.id,
      moment: "matchStart",
      orientation: "portrait",
      type: "remove-layer"
    });
    const undone = ledScoresCanvasEditorReducer(removed, { type: "undo" });
    const redone = ledScoresCanvasEditorReducer(undone, { type: "redo" });

    expect(sceneAt(added.experience, "matchStart", "portrait").layers).toHaveLength(before.layers.length + 1);
    expect(sceneAt(removed.experience, "matchStart", "portrait").layers).toHaveLength(before.layers.length);
    expect(sceneAt(undone.experience, "matchStart", "portrait").layers).toHaveLength(before.layers.length + 1);
    expect(sceneAt(redone.experience, "matchStart", "portrait").layers).toHaveLength(before.layers.length);
  });

  it("verplaatst de aangeklikte laag en maakt die selectie actief", () => {
    const experience = createDefaultLedScoresCanvasExperience();
    const scene = sceneAt(experience, "goalOwn", "landscape");
    const first = scene.layers[0];
    const second = scene.layers[1];
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    if (!first || !second) return;
    const initial = ledScoresCanvasEditorReducer(
      createLedScoresCanvasEditorState(experience),
      { layerId: second.id, type: "select" }
    );

    const moved = ledScoresCanvasEditorReducer(initial, {
      layerId: first.id,
      moment: "goalOwn",
      orientation: "landscape",
      toIndex: 1,
      type: "move-layer"
    });
    const reordered = [...sceneAt(moved.experience, "goalOwn", "landscape").layers]
      .sort((left, right) => left.zIndex - right.zIndex);

    expect(reordered[0]?.id).toBe(second.id);
    expect(reordered[1]?.id).toBe(first.id);
    expect(moved.selectedLayerId).toBe(first.id);
    expect(ledScoresCanvasExperienceSchema.safeParse(moved.experience).success).toBe(true);
  });

  it("kopieert en schaalt een liggend ontwerp contract-geldig naar staand", () => {
    const initial = createLedScoresCanvasEditorState(createDefaultLedScoresCanvasExperience());
    const result = ledScoresCanvasEditorReducer(initial, {
      from: "landscape",
      moment: "goalOwn",
      to: "portrait",
      type: "copy-orientation"
    });

    const source = sceneAt(result.experience, "goalOwn", "landscape");
    const target = sceneAt(result.experience, "goalOwn", "portrait");
    expect(target.orientation).toBe("portrait");
    expect(target.layers.map((layer) => layer.id)).toEqual(source.layers.map((layer) => layer.id));
    expect(target.layers[0]?.width).not.toBe(source.layers[0]?.width);
    expect(ledScoresCanvasExperienceSchema.safeParse(result.experience).success).toBe(true);
  });

  it("maakt geldige statische en dynamische beeldlagen", () => {
    const scene = sceneAt(createDefaultLedScoresCanvasExperience(), "goalOwn", "landscape");
    const bound = createImageLayer(scene, { binding: "scorerPhoto" });
    const media = createImageLayer(scene, { mediaAssetId: "0f8fad5b-d9cb-469f-a165-70867728950e" });

    expect(bound).toMatchObject({ binding: "scorerPhoto", mediaAssetId: null, type: "image" });
    expect(media).toMatchObject({ binding: null, mediaAssetId: "0f8fad5b-d9cb-469f-a165-70867728950e", type: "image" });
  });

  it("gebruikt momentspecifieke previewdata voor live tekstvelden", () => {
    expect(ledScoresCanvasPreviewText("goalOpponent")).toMatchObject({
      eventLabel: "TEGENDOELPUNT",
      headline: "Tegendoelpunt"
    });
    expect(ledScoresCanvasPreviewText("lineupAway")).toMatchObject({
      eventLabel: "UITTEAM",
      scoringTeam: "Bezoekers"
    });
    expect(ledScoresCanvasPreviewText("halfTime")).toMatchObject({
      clock: "45:00",
      eventLabel: "RUST"
    });
    expect(ledScoresCanvasPreviewText("matchEnd")).toMatchObject({
      eventLabel: "EINDSTAND",
      period: "AFGELOPEN"
    });
  });

  it("biedt desktop-canvasgereedschap en een afzonderlijke mobiele taakflow", async () => {
    const [editor, css, page, alertEditor] = await Promise.all([
      readFile(new URL("./canvas-experience-editor.tsx", import.meta.url), "utf8"),
      readFile(new URL("./canvas-experience-editor.module.css", import.meta.url), "utf8"),
      readFile(new URL("./page.tsx", import.meta.url), "utf8"),
      readFile(new URL("./alert-editor.tsx", import.meta.url), "utf8")
    ]);

    expect(editor).toContain("Veilige zone");
    expect(editor).toContain("copy-orientation");
    expect(editor).toContain("Media uploaden");
    expect(editor).toContain('role="application"');
    expect(editor).toContain('data-shape={layer.shape}');
    expect(editor).toContain('label="Focus horizontaal %"');
    expect(editor).toContain('window.matchMedia("(max-width: 60rem)")');
    expect(editor).toContain("Sleep om te verplaatsen");
    expect(editor).toContain("MobileFooter");
    expect(editor).toContain("onMoveLayer(layer.id, layer.zIndex + 1)");
    expect(editor).toContain("onMoveLayer(layer.id, layer.zIndex - 1)");
    expect(css).toMatch(/\.desktopEditor\s*\{[^}]*grid-template-columns:/s);
    expect(css).toContain('.shapeLayerPreview[data-shape="line"]::before');
    expect(css).toContain("@media (max-width: 60rem)");
    expect(css).toMatch(/@media \(max-width: 60rem\)[\s\S]*\.desktopEditor\s*\{[^}]*display:\s*none/s);
    expect(css).toMatch(/@media \(max-width: 60rem\)[\s\S]*\.mobileEditor\s*\{[^}]*display:\s*grid/s);
    expect(page).toContain('key={initial.id ?? "new"}');
    expect(alertEditor).toContain("asset.logoSelectable");
  });
});
