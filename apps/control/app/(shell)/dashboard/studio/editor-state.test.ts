import { describe, expect, it } from "vitest";

import {
  createEmptyStudioDocument,
  parseStudioDocument,
  type StudioElement
} from "@veyocast/studio";

import {
  createStudioEditorState,
  studioEditorReducer
} from "./editor-state";

const headline: StudioElement = {
  align: "left",
  autoFit: false,
  cornerRadius: 0,
  fill: "#0A0A0A",
  fontFamily: "Inter Variable",
  fontSize: 80,
  fontWeight: 700,
  height: 120,
  id: "headline",
  letterSpacing: 0,
  lineHeight: 1.1,
  locked: false,
  name: "Koptekst",
  opacity: 1,
  padding: 0,
  rotation: 0,
  text: "Welkom",
  type: "text",
  verticalAlign: "top",
  visible: true,
  width: 800,
  x: 100,
  y: 100,
  zIndex: 0
};

describe("studioEditorReducer", () => {
  it("bewaart bewerkingen in begrensde undo/redo-history", () => {
    let state = createStudioEditorState(
      parseStudioDocument({
        ...createEmptyStudioDocument(),
        elements: [headline]
      }),
      4
    );
    state = studioEditorReducer(state, {
      elementId: "headline",
      patch: { text: "Wedstrijddag" },
      type: "element/update"
    });
    expect(state.document.elements[0]).toMatchObject({
      text: "Wedstrijddag"
    });
    expect(state.saveState).toBe("dirty");

    state = studioEditorReducer(state, { type: "history/undo" });
    expect(state.document.elements[0]).toMatchObject({ text: "Welkom" });

    state = studioEditorReducer(state, { type: "history/redo" });
    expect(state.document.elements[0]).toMatchObject({
      text: "Wedstrijddag"
    });
  });

  it("registreert transform slechts als één documentmutatie", () => {
    const state = createStudioEditorState(
      parseStudioDocument({
        ...createEmptyStudioDocument(),
        elements: [headline]
      }),
      0
    );
    const transformed = studioEditorReducer(state, {
      elementId: "headline",
      patch: { height: 180, width: 920, x: 220, y: 160 },
      type: "element/update"
    });
    expect(transformed.past).toHaveLength(1);
    expect(transformed.document.elements[0]).toMatchObject({
      height: 180,
      width: 920,
      x: 220,
      y: 160
    });
  });

  it("weigert nudge op vergrendelde lagen", () => {
    const state = createStudioEditorState(
      parseStudioDocument({
        ...createEmptyStudioDocument(),
        elements: [{ ...headline, locked: true }]
      }),
      0
    );
    const nudged = studioEditorReducer(
      { ...state, selectedIds: ["headline"] },
      { deltaX: 10, deltaY: 10, type: "element/nudge" }
    );
    expect(nudged.document.elements[0]).toMatchObject({ x: 100, y: 100 });
  });

  it("groepeert en ontgroepeert geselecteerde lagen zonder inhoudsverlies", () => {
    const subtitle = {
      ...headline,
      id: "subtitle",
      name: "Subtekst",
      text: "Samen voor de club",
      y: 280,
      zIndex: 1
    } satisfies StudioElement;
    let state = createStudioEditorState(
      parseStudioDocument({
        ...createEmptyStudioDocument(),
        elements: [headline, subtitle]
      }),
      0
    );
    state = studioEditorReducer(
      { ...state, selectedIds: ["headline", "subtitle"] },
      { type: "selection/group" }
    );
    const group = state.document.elements.find(
      (element) => element.type === "group"
    );
    expect(group).toMatchObject({
      childIds: ["headline", "subtitle"],
      type: "group"
    });
    expect(
      state.document.elements.filter((element) => element.groupId === group?.id)
    ).toHaveLength(2);

    state = studioEditorReducer(state, {
      groupId: group?.id ?? "",
      type: "selection/ungroup"
    });
    expect(
      state.document.elements.some((element) => element.type === "group")
    ).toBe(false);
    expect(state.document.elements.every((element) => !element.groupId)).toBe(
      true
    );
  });

  it("lijnt een multiselectie als één undo-stap uit", () => {
    const subtitle = {
      ...headline,
      id: "subtitle",
      name: "Subtekst",
      text: "Samen voor de club",
      x: 420,
      y: 280,
      zIndex: 1
    } satisfies StudioElement;
    const state = createStudioEditorState(
      parseStudioDocument({
        ...createEmptyStudioDocument(),
        elements: [headline, subtitle]
      }),
      0
    );
    const aligned = studioEditorReducer(
      { ...state, selectedIds: ["headline", "subtitle"] },
      { alignment: "left", type: "selection/align" }
    );
    expect(aligned.document.elements.map((element) => element.x)).toEqual([
      100,
      100
    ]);
    expect(aligned.past).toHaveLength(1);
  });

  it("snapt documentduur op halve seconden en begrenst laagtiming", () => {
    const timedHeadline = {
      ...headline,
      timing: {
        endMs: 10_000,
        entry: {
          delayMs: 0,
          distance: 96,
          durationMs: 700,
          easing: "ease-out" as const,
          intensity: 0.16,
          preset: "fade" as const
        },
        startMs: 8_000
      }
    } satisfies StudioElement;
    const state = createStudioEditorState(
      parseStudioDocument({
        ...createEmptyStudioDocument(),
        elements: [timedHeadline]
      }),
      0
    );
    const shortened = studioEditorReducer(state, {
      durationMs: 5_240,
      type: "document/duration"
    });
    expect(shortened.document.motion.durationMs).toBe(5_000);
    expect(shortened.document.elements[0]?.timing).toMatchObject({
      endMs: 5_000,
      startMs: 4_500
    });
    expect(shortened.past).toHaveLength(1);
  });

  it("vervangt marquee-selectie atomair en negeert onbekende lagen", () => {
    const state = createStudioEditorState(
      parseStudioDocument({
        ...createEmptyStudioDocument(),
        elements: [headline]
      }),
      0
    );
    const selected = studioEditorReducer(state, {
      elementIds: ["headline", "bestaat-niet"],
      type: "selection/replace"
    });
    expect(selected.selectedIds).toEqual(["headline"]);
    expect(selected.past).toHaveLength(0);
  });

  it("plaatst en vervangt een bronvideo atomair als canvasachtergrond", () => {
    const document = parseStudioDocument({
      ...createEmptyStudioDocument(),
      elements: [headline]
    });
    const state = createStudioEditorState(document, 0);
    const withVideo = studioEditorReducer(state, {
      element: {
        alt: "Publiek op de tribune",
        focusX: 0.5,
        focusY: 0.5,
        height: 1080,
        id: "venue-video",
        locked: true,
        loop: true,
        mediaAssetId: "10000000-0000-4000-8000-000000000001",
        muted: true,
        name: "Sfeer · achtergrond",
        objectFit: "cover",
        opacity: 1,
        rotation: 0,
        startOffsetMs: 0,
        type: "video",
        variant: "player_1080p",
        visible: true,
        width: 1920,
        x: 0,
        y: 0,
        zIndex: 0
      },
      type: "document/background-video"
    });
    expect(withVideo.document.artboard.background).toEqual({
      kind: "transparent"
    });
    expect(withVideo.document.elements.map((element) => element.type)).toEqual([
      "video",
      "text"
    ]);
    expect(withVideo.past).toHaveLength(1);

    const withColor = studioEditorReducer(withVideo, {
      background: { color: "#0A0A0A", kind: "solid" },
      type: "document/background"
    });
    expect(withColor.document.elements.some((element) => element.type === "video"))
      .toBe(false);
    expect(withColor.document.artboard.background).toEqual({
      color: "#0A0A0A",
      kind: "solid"
    });
  });
});
