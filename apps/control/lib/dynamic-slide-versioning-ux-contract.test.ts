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

    const stepDefinitions = wizard.match(/const steps = \[([\s\S]*?)\] as const;/u)?.[1];
    expect(stepDefinitions?.match(/"[^"\n]+"/gu)).toEqual([
      '"Inhoud kiezen"', '"Teams & gegevens"', '"Vormgeving"', '"Opslaan"', '"Controleren"'
    ]);
    expect(wizard).toContain("<strong>{drafts.length} {drafts.length === 1");
    expect(wizard).toContain("step === 1 && selectedTeams.length");
    expect(wizard).toContain("<CompetitionStep");
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
    expect(wizard).toContain("sportlinkDisplayConfigSchema.parse({})");
    expect(wizard).toContain("Logo thuisclub tonen");
    expect(wizard).toContain("Logo uitclub tonen");
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
    expect(wizard).toContain('submitter.dataset.createSportlinkBatch !== "true"');
    expect(wizard).toContain("step !== 4");
    expect(wizard).toContain("isCreating ||");
    expect(wizard).toContain("const [idempotencyKey] = useState(() => crypto.randomUUID())");
    expect(action).toContain('"create_sportlink_slide_batch_v7"');
    expect(action).toContain("p_idempotency_key: parsed.data.idempotencyKey");
    expect(action).toContain("parseBatchResult");
    expect(action).not.toContain("redirect(");
  });

  it("toont een sticky desktoppreview en een bruikbare mobiele kaartflow", async () => {
    const [wizard, css, preview, previewData, multiSelect] = await Promise.all([
      source("app/(shell)/dashboard/studio/sportlink/new/sportlink-bulk-wizard.tsx"),
      source("app/(shell)/dashboard/studio/sportlink/new/sites-source-wizard.module.css"),
      source("app/(shell)/dashboard/studio/sportlink/new/sites-sportlink-preview.tsx"),
      source("app/(shell)/dashboard/studio/sportlink/new/sites-sportlink-preview-data.ts"),
      readFile(new URL("../../../packages/ui/src/components/multi-select-dropdown.tsx", import.meta.url), "utf8")
    ]);

    expect(wizard).toContain("<SitesSportlinkDraftPreview draft={previewDraft} sourceId={sourceId}");
    expect(wizard).toContain("sites.previewPanel");
    expect(wizard).toContain("Schermvoorbeeld");
    expect(wizard).toContain("sites.mobileHidden");
    expect(css).toMatch(/\.previewPanel\{[^}]*position:sticky;/u);
    expect(css).toContain("@media(max-width:800px)");
    expect(css).toContain(".mobileHidden{display:none!important}");
    expect(preview).toContain("buildSitesPresentationFromDynamicPayload(result.payload, draft.sitesConfiguration)");
    expect(previewData).toContain('supabase.rpc("preview_dynamic_slide_v1"');
    expect(previewData).toContain('requireTenantControlSession("tenant.dynamic_slide.write")');
    expect(previewData).not.toMatch(/(?:supabase|admin)\.from\([^;\n]+\.(?:insert|update|delete)\(/u);
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
      styleStep,
      sitesDesign
    ] = await Promise.all([
      source("app/(shell)/dashboard/settings/page.tsx"),
      source("app/(shell)/dashboard/settings/settings-category-workspace.tsx"),
      source("app/(shell)/dashboard/themes/page.tsx"),
      source("app/(shell)/dashboard/themes/fieldflow/page.tsx"),
      source("app/(shell)/dashboard/themes/fieldflow/actions.ts"),
      source("app/(shell)/dashboard/slides/new/slide-composer-form.tsx"),
      source("app/(shell)/dashboard/slides/menu-studio/menu-studio-editor.tsx"),
      source("app/(shell)/dashboard/studio/sportlink/new/sportlink-bulk-wizard.tsx"),
      source("app/(shell)/dashboard/slides/_components/fieldflow-style-step.tsx"),
      source("app/(shell)/dashboard/studio/sportlink/new/sites-source-design-controls.tsx")
    ]);

    expect(settings).not.toContain("<TenantThemeEditor");
    expect(settings).not.toContain("tenant_theme_profiles");
    expect(settingsCategories).toContain('{ id: "huisstijl", label: "Huisstijl"');
    expect(settings).toContain('id="huisstijl"');
    expect(settings).toContain('href="/dashboard/themes/fieldflow"');
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
    expect(menu).toContain("<TenantStyleSummary");
    expect(wizard).toContain("<SitesSourceDesignControls");
    expect(sitesDesign).toContain("<SitesSourceThemePicker value={design.themeId}");
    expect(sitesDesign).toContain('id: "fieldflow" as const');
    expect(sitesDesign).toContain('id: "onzetrots-tv" as const');
    expect(wizard).toContain("<FieldFlowStyleStep");
    expect(wizard).toContain("Competities per team");
    expect(wizard).toContain('aria-label="Weergavekeuzes"');
    expect(wizard).toContain('Thuislogo {draft.display.showHomeLogo ? "aan" : "uit"}');
    expect(wizard).toContain('Uitlogo {draft.display.showAwayLogo ? "aan" : "uit"}');
    expect(styleStep).toContain("Royal Current · Navy Glass");
    expect(styleStep).toContain("Één premium huisstijl met een lichte en donkere modus");
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
