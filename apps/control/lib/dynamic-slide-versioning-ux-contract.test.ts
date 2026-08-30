import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

async function source(path: string) {
  return readFile(fileURLToPath(new URL(`../${path}`, import.meta.url)), "utf8");
}

describe("dynamic-slideversies en Sportlink-wizard", () => {
  it("houdt de Sportlink-flow bij vijf betekenisvolle stappen met een permanente telling", async () => {
    const wizard = await source("app/(shell)/dashboard/studio/sportlink/new/sportlink-bulk-wizard.tsx");

    expect(wizard).toContain('"Wat wil je tonen?"');
    expect(wizard).toContain('"Teams & slides"');
    expect(wizard).toContain('"Competitie & poule"');
    expect(wizard).toContain('"Thema & weergave"');
    expect(wizard).toContain('"Controleren & aanmaken"');
    expect(wizard).toContain("slides geselecteerd");
    expect(wizard).toContain("slw-matrix");
    expect(wizard).toContain("Individueel aanpassen");
  });

  it("toont een sticky desktoppreview en een bruikbare mobiele kaartflow", async () => {
    const wizard = await source("app/(shell)/dashboard/studio/sportlink/new/sportlink-bulk-wizard.tsx");

    expect(wizard).toContain("Live stijlpreview");
    expect(wizard).toMatch(/\.slw-preview\{position:sticky/);
    expect(wizard).toContain("@media(max-width:640px)");
    expect(wizard).toContain(".slw-matrix__head{display:none}");
    expect(wizard).toContain(".slw-matrix__row{display:grid;min-width:0");
  });

  it("gebruikt dezelfde visuele themakiezer voor instellingen, menu en Sportlink", async () => {
    const [settings, menu, wizard, picker] = await Promise.all([
      source("app/(shell)/dashboard/settings/page.tsx"),
      source("app/(shell)/dashboard/slides/menu-studio/menu-studio-editor.tsx"),
      source("app/(shell)/dashboard/studio/sportlink/new/sportlink-bulk-wizard.tsx"),
      source("app/(shell)/dashboard/slides/_components/theme-picker.tsx")
    ]);

    expect(settings).toContain("Standaard slidethema");
    expect(settings).toContain("Bestaande gepubliceerde versies veranderen niet");
    expect(menu).toContain("<ThemePicker");
    expect(wizard).toContain("<ThemePicker");
    expect(picker).toContain("Standaard voor deze vereniging");
  });

  it("laat een aankomstperiode als minuten, uren of dagen invoeren", async () => {
    const [fields, action] = await Promise.all([
      source("app/(shell)/dashboard/slides/_components/sportlink-arrival-fields.tsx"),
      source("app/(shell)/dashboard/studio/sportlink/new/actions.ts")
    ]);

    expect(fields).toContain("Vooruitkijken vóór aanvang");
    expect(fields).toContain('label: "Minuten"');
    expect(fields).toContain('label: "Uren"');
    expect(fields).toContain('label: "Dagen"');
    expect(fields).toContain("sportlinkArrivalWindowMaxMinutes");
    expect(action).toContain("Kies een waarde van 0 minuten tot en met 42 dagen");
  });

  it("maakt versioning en menunaam expliciet zonder historische libraryduplicaten", async () => {
    const [menu, detail, history, library] = await Promise.all([
      source("app/(shell)/dashboard/slides/menu-studio/menu-studio-editor.tsx"),
      source("app/(shell)/dashboard/slides/[slideId]/page.tsx"),
      source("app/(shell)/dashboard/slides/version-history.tsx"),
      source("app/(shell)/dashboard/slides/page.tsx")
    ]);

    expect(menu).toContain("Menunaam");
    expect(menu).toContain("Naam op de slide en in Slides");
    expect(detail).toContain("Nieuwe versie maken");
    expect(history).toContain("Versiegeschiedenis");
    expect(history).toContain("Gebruik als basis");
    expect(library).toContain("current_published_version_id");
    expect(library).not.toContain('.eq("dynamic_slide_id"');
  });
});
