import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

async function source(path: string) {
  return readFile(fileURLToPath(new URL(`../${path}`, import.meta.url)), "utf8");
}

describe("dynamic-slideversies en Sportlink-wizard", () => {
  it("houdt de Sportlink-flow bij vijf betekenisvolle stappen met een permanente telling", async () => {
    const wizard = await source("app/(shell)/dashboard/studio/sportlink/new/sportlink-bulk-wizard.tsx");

    expect(wizard).toContain('"Inhoud kiezen"');
    expect(wizard).toContain('"Teams selecteren"');
    expect(wizard).toContain('"Competitie instellen"');
    expect(wizard).toContain('"Stijl en weergave"');
    expect(wizard).toContain('"Controleren"');
    expect(wizard).toContain('<strong>{drafts.length}</strong>');
    expect(wizard).toContain("<TeamMultiSelect");
    expect(wizard).toContain("Alle teams");
    expect(wizard).toContain("Actuele competitie, tenzij jij afwijkt");
  });

  it("toont een sticky desktoppreview en een bruikbare mobiele kaartflow", async () => {
    const [wizard, css] = await Promise.all([
      source("app/(shell)/dashboard/studio/sportlink/new/sportlink-bulk-wizard.tsx"),
      source("app/(shell)/dashboard/studio/sportlink/new/sportlink-bulk-wizard.module.css")
    ]);

    expect(wizard).toContain("Live stijlpreview");
    expect(wizard).toContain("className={styles.preview}");
    expect(css).toMatch(/\.wizard :global\(\.vc-journey-shell__aside\)\s*\{[\s\S]*?position:\s*sticky;/u);
    expect(css).toContain("@media (max-width: 640px)");
    expect(css).toMatch(/\.matrixHead\s*\{\s*display:\s*none;/u);
    expect(css).toMatch(/\.matrixRow\s*\{[\s\S]*?display:\s*grid;[\s\S]*?min-width:\s*0;/u);
  });

  it("beheert kleuren centraal en houdt FieldFlow vast", async () => {
    const [settings, composer, menu, wizard, styleStep] = await Promise.all([
      source("app/(shell)/dashboard/settings/page.tsx"),
      source("app/(shell)/dashboard/slides/new/slide-composer-form.tsx"),
      source("app/(shell)/dashboard/slides/menu-studio/menu-studio-editor.tsx"),
      source("app/(shell)/dashboard/studio/sportlink/new/sportlink-bulk-wizard.tsx"),
      source("app/(shell)/dashboard/slides/_components/fieldflow-style-step.tsx")
    ]);

    expect(settings).toContain("één tenantbrede FieldFlow-stijl");
    expect(settings).toContain("<TenantThemeEditor");
    expect(composer).not.toContain("<EditorialThemeEditor");
    expect(composer).not.toContain("editorialThemeJson");
    expect(menu).toContain("<FieldFlowStyleStep");
    expect(wizard).toContain("<FieldFlowStyleStep");
    expect(styleStep).toContain("Vaste premium stijl voor nieuwe inhoud");
    expect(styleStep).not.toContain("themeCatalogOptions");
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
