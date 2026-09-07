import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

async function source(path: string) {
  return readFile(fileURLToPath(new URL(`../${path}`, import.meta.url)), "utf8");
}

describe("dynamic-slideversies en Sportlink-wizard", () => {
  it("houdt de Sportlink-flow bij vijf stappen met clubbrede varianten", async () => {
    const [wizard, matchLocationField] = await Promise.all([
      source("app/(shell)/dashboard/studio/sportlink/new/sportlink-bulk-wizard.tsx"),
      source("app/(shell)/dashboard/slides/_components/sportlink-match-location-field.tsx")
    ]);

    expect(wizard).toContain('"Inhoud kiezen"');
    expect(wizard).toContain('"Teams selecteren"');
    expect(wizard).toContain('"Competitie instellen"');
    expect(wizard).toContain('"Stijl en weergave"');
    expect(wizard).toContain('"Controleren"');
    expect(wizard).toContain("<strong>{drafts.length}</strong>");
    expect(wizard).toContain("<MultiSelectDropdown");
    expect(wizard).toContain("updateRegularSelection");
    expect(wizard).toContain("Alle teams (ook toekomstige)");
    expect(wizard).toContain("teamSelectionMode:");
    expect(wizard).toContain("<SportlinkMatchLocationsField");
    expect(wizard).toContain("matchLocations:");
    expect(wizard).toContain("matchLocationLabel");
    expect(matchLocationField).toContain('label: "Thuis en uit"');
    expect(matchLocationField).toContain('label: "Alleen thuis"');
    expect(matchLocationField).toContain('label: "Alleen uit"');
    expect(matchLocationField).toContain('type="radio"');
    expect(matchLocationField).toContain('type="checkbox"');
    expect(matchLocationField).toContain("Iedere gekozen richting wordt één");
    expect(matchLocationField).toContain("useId()");
    expect(wizard).toContain('columns: "one"');
    expect(wizard).toContain("showLogo: true");
    expect(wizard).toContain("Logo tonen");
    expect(wizard).not.toContain("voor ieder gekozen team één afzonderlijk onderdeel");
    expect(wizard).not.toContain("<TeamMatrix");
    expect(wizard).toContain("Actuele competitie, tenzij jij afwijkt");
    expect(wizard).toContain('label="Team aanpassen"');
  });

  it("maakt pas na expliciete bevestiging en blijft voor het echte resultaat", async () => {
    const [wizard, action] = await Promise.all([
      source("app/(shell)/dashboard/studio/sportlink/new/sportlink-bulk-wizard.tsx"),
      source("app/(shell)/dashboard/studio/sportlink/new/actions.ts")
    ]);

    expect(wizard).toContain("onSubmit={submitBatch}");
    expect(wizard).toContain('data-create-sportlink-batch="true"');
    expect(wizard).toContain("Er is nog niets aangemaakt.");
    expect(wizard).toContain("creationResult.slides.map");
    expect(wizard).toContain('href="/dashboard/slides"');
    expect(action).toContain('"create_sportlink_slide_batch_v4"');
    expect(action).toContain("parseBatchResult");
    expect(action).not.toContain("redirect(");
  });

  it("toont een sticky desktoppreview en een bruikbare mobiele kaartflow", async () => {
    const [wizard, css, multiSelect] = await Promise.all([
      source("app/(shell)/dashboard/studio/sportlink/new/sportlink-bulk-wizard.tsx"),
      source("app/(shell)/dashboard/studio/sportlink/new/sportlink-bulk-wizard.module.css"),
      readFile(new URL("../../../packages/ui/src/components/multi-select-dropdown.tsx", import.meta.url), "utf8")
    ]);

    expect(wizard).toContain("Live stijlpreview");
    expect(wizard).toContain("className={styles.preview}");
    expect(css).toMatch(/\.wizard :global\(\.vc-journey-shell__aside\)\s*\{[\s\S]*?position:\s*sticky;/u);
    expect(css).toContain("@media (max-width: 640px)");
    expect(css).toContain(".teamSelectors");
    expect(css).not.toContain(".matrixHead");
    expect(multiSelect).toContain("searchable?: boolean");
    expect(multiSelect).toContain("selectionNoun");
    expect(multiSelect).toContain('type="hidden"');
  });

  it("hergebruikt de dropdown voor compacte entiteitskeuzes", async () => {
    const paths = [
      "app/(shell)/dashboard/screen-groups/screen-group-dialogs.tsx",
      "app/(shell)/dashboard/screens/[screenId]/page.tsx",
      "app/(shell)/dashboard/slides/[slideId]/edit/sportlink-version-editor.tsx",
      "app/(shell)/dashboard/studio/led-scores/alert-editor.tsx",
      "app/(shell)/dashboard/studio/sportlink/birthdays/new/birthday-wizard.tsx",
      "app/(shell)/platform/support/settings/page.tsx"
    ];
    const implementations = await Promise.all(paths.map(source));

    for (const implementation of implementations) {
      expect(implementation).toContain("<MultiSelectDropdown");
    }
    expect(implementations.join("\n")).toContain('name="screenIds"');
    expect(implementations.join("\n")).toContain('name="groupIds"');
    expect(implementations.join("\n")).toContain('name="targetGroupIds"');
    expect(implementations.join("\n")).toContain('name="ownTeamKeys"');
    expect(implementations.join("\n")).toContain('name="roleIds"');
  });

  it("beheert FieldFlow theme-scoped en houdt algemene instellingen vrij van de huisstijleditor", async () => {
    const [
      settings,
      settingsCategories,
      themes,
      fieldflowTheme,
      fieldflowAction,
      composer,
      menu,
      wizard,
      styleStep
    ] = await Promise.all([
      source("app/(shell)/dashboard/settings/page.tsx"),
      source("app/(shell)/dashboard/settings/settings-category-workspace.tsx"),
      source("app/(shell)/dashboard/themes/page.tsx"),
      source("app/(shell)/dashboard/themes/fieldflow/page.tsx"),
      source("app/(shell)/dashboard/themes/fieldflow/actions.ts"),
      source("app/(shell)/dashboard/slides/new/slide-composer-form.tsx"),
      source("app/(shell)/dashboard/slides/menu-studio/menu-studio-editor.tsx"),
      source("app/(shell)/dashboard/studio/sportlink/new/sportlink-bulk-wizard.tsx"),
      source("app/(shell)/dashboard/slides/_components/fieldflow-style-step.tsx")
    ]);

    expect(settings).not.toContain("<TenantThemeEditor");
    expect(settings).not.toContain("tenant_theme_profiles");
    expect(settingsCategories).not.toContain('{ id: "huisstijl"');
    expect(themes).toContain('title="Thema\'s"');
    expect(themes).toContain('href="/dashboard/themes/fieldflow"');
    expect(themes).toContain("Kleuren, typografie en logo-oppervlakken horen bij het theme");
    expect(fieldflowTheme).toContain("<TenantThemeEditor");
    expect(fieldflowTheme).toContain("Veilige live-uitrol");
    expect(fieldflowTheme).toContain("last-known-good blijft");
    expect(fieldflowTheme).toContain("tenant_theme_rollouts");
    expect(fieldflowTheme).toContain("<ThemeRolloutRefresh");
    expect(fieldflowTheme).toContain("Uitrol opnieuw proberen");
    expect(fieldflowAction).toContain('"update_tenant_theme_settings_v3"');
    expect(fieldflowAction).toContain('"retry_tenant_theme_rollout_v1"');
    expect(fieldflowAction).toContain('revalidatePath("/dashboard/slides")');
    expect(fieldflowAction).toContain("Nieuwe+immutable+presentaties");
    expect(composer).not.toContain("<EditorialThemeEditor");
    expect(composer).not.toContain("editorialThemeJson");
    expect(menu).toContain("<FieldFlowStyleStep");
    expect(wizard).toContain("<FieldFlowStyleStep");
    expect(wizard).toContain("Competities per team");
    expect(wizard).toContain('aria-label="Weergavekeuzes"');
    expect(wizard).toContain('Logo {draft.display.showLogo ? "aan" : "uit"}');
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
