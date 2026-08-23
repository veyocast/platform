import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

async function source(path: string) {
  return readFile(fileURLToPath(new URL(`../${path}`, import.meta.url)), "utf8");
}

describe("responsive Control-grenzen", () => {
  it("houdt de dynamische livepreview binnen zijn eigen positioned paint-stage", async () => {
    const css = await source("app/(shell)/dashboard/dynamic-content.module.css");
    const stage = css.match(/\.livePreviewStage\s*\{([^}]*)\}/)?.[1] ?? "";

    expect(stage).toContain("position: relative");
    expect(stage).toContain("isolation: isolate");
    expect(stage).toContain("contain: layout paint");
    expect(stage).toContain("overflow: hidden");
  });

  it("geeft header, top, scrollnavigatie en footer ieder een expliciete rij", async () => {
    const css = await source("app/globals.css");
    const sidebar = css.match(/\.control-sidebar\s*\{([^}]*)\}/)?.[1] ?? "";

    expect(sidebar).toContain("grid-template-rows: auto auto minmax(0, 1fr) auto");
    expect(css).toContain("max-height: 100dvh");
    expect(css).toContain("env(safe-area-inset-top, 0px)");
    expect(css).toContain("env(safe-area-inset-bottom, 0px)");
    expect(css).toContain("overscroll-behavior: contain");
  });

  it("houdt de Menu Studio-preview bovenaan en verplaatst grote bibliotheken naar dialogs", async () => {
    const editor = await source("app/(shell)/dashboard/slides/menu-studio/menu-studio-editor.tsx");
    const studioCss = await source("app/(shell)/dashboard/slides/menu-studio/menu-studio.module.css");
    const sceneCss = await source("../../packages/content-templates/src/menu-scene.module.css");

    expect(editor).toContain('alignment="top"');
    expect(editor).toContain("<CategoryPickerDialog");
    expect(editor).toContain("<MediaPickerDialog");
    expect(editor).toContain("Filter op categorie");
    expect(editor).toContain("Kolommen in staande modus");
    expect(editor).toContain("2 kolommen");
    expect(studioCss).toMatch(/\.previewPanel\s*\{\s*position: sticky/);
    expect(studioCss).toMatch(/\.stage\s*\{[^}]*aspect-ratio: 16 \/ 9/s);
    expect(studioCss).toMatch(/\.stage\[data-orientation="portrait"\]\s*\{[^}]*aspect-ratio: 9 \/ 16/s);
    expect(sceneCss).toContain('.viewport[data-alignment="top"]');
  });
});
