"use client";

import React, { useMemo, useState, type CSSProperties } from "react";

import {
  defaultThemeAppearanceSettings,
  themeSelectionSchema,
  type EditorialColorTokens,
  type EditorialThemeConfig,
  type ThemeAppearanceSettings,
  type ThemeMode,
  type ThemeSelection
} from "@veyocast/contracts";
import {
  editorialThemeContrastChecks,
  editorialThemeHasValidContrast,
  editorialThemeCssVariables
} from "@veyocast/content-templates/editorial-arena-theme";
import {
  createRoyalCurrentAppearance,
  createRoyalCurrentSelection,
  createRoyalCurrentTheme,
  normalizeClubHex,
  normalizeClubStyle,
  royalCurrentDefaultStyle,
  royalCurrentPalettePresets,
  themeCatalog,
  themeManifest
} from "@veyocast/content-templates";
import { Button } from "@veyocast/ui";

import styles from "../../dynamic-content.module.css";

const allDays = [0, 1, 2, 3, 4, 5, 6];

const quickTokens = [
  "canvas",
  "surface",
  "panel",
  "text",
  "textMuted"
] as const satisfies readonly (keyof EditorialColorTokens)[];

export const fieldflowPalettePresets = royalCurrentPalettePresets;

type FieldflowPaletteRecipe = "royal-current";

export const editorialThemeTokenGroups = [
  {
    description: "De basis achter alle slide-inhoud.",
    label: "Achtergrond",
    tokens: ["canvas"]
  },
  {
    description: "Kaarten, panelen en wedstrijdregels.",
    label: "Oppervlakken",
    tokens: ["surface", "surfaceRaised", "panel", "row", "rowSelected"]
  },
  {
    description: "Tekst op gewone, gekleurde en geselecteerde vlakken.",
    label: "Tekst",
    tokens: ["text", "textMuted", "textFaint", "textOnAccent", "textOnSelected"]
  },
  {
    description: "Contouren en scheidingen tussen onderdelen.",
    label: "Randen",
    tokens: ["border", "borderSoft", "divider"]
  },
  {
    description: "Acties, selecties en wedstrijdstatussen.",
    label: "Accent en status",
    tokens: ["accent", "accentSoft", "success", "warning", "danger", "neutral"]
  },
  {
    description: "Diepte onder verhoogde kaarten.",
    label: "Schaduw",
    tokens: ["shadow"]
  },
  {
    description: "De drie stappen van tekstvlak naar foto.",
    label: "Foto-overlay",
    tokens: ["imageOverlayStart", "imageOverlayMid", "imageOverlayEnd"]
  },
  {
    description: "Achtergrond en inkt van scanbare codes.",
    label: "QR-code",
    tokens: ["qrSurface", "qrInk"]
  }
] as const satisfies ReadonlyArray<{
  description: string;
  label: string;
  tokens: readonly (keyof EditorialColorTokens)[];
}>;

const tokenLabels: Record<keyof EditorialColorTokens, string> = {
  accent: "Accent",
  accentSoft: "Zacht accent",
  border: "Rand",
  borderSoft: "Zachte rand",
  canvas: "Slideachtergrond",
  danger: "Fout",
  divider: "Scheidingslijn",
  imageOverlayEnd: "Overlay aan beeldzijde",
  imageOverlayMid: "Overlay in het midden",
  imageOverlayStart: "Overlay aan tekstzijde",
  neutral: "Neutrale indicator",
  panel: "Beeld- en detailpaneel",
  qrInk: "QR-voorgrond",
  qrSurface: "Lichte fototekst en QR-achtergrond",
  row: "Wedstrijd- en lijstregel",
  rowSelected: "Uitgelichte regel",
  shadow: "Kaartschaduw",
  success: "Succes",
  surface: "Kaarten en kop",
  surfaceRaised: "Verhoogd vlak",
  text: "Hoofdtekst",
  textFaint: "Subtiele tekst",
  textMuted: "Secundaire tekst",
  textOnAccent: "Tekst op accent",
  textOnSelected: "Tekst op selectie",
  warning: "Waarschuwing"
};

export function EditorialThemeEditor({
  additionalValidationReady = true,
  appearance = defaultThemeAppearanceSettings,
  defaults,
  disabled = false,
  onChange,
  onAppearanceChange = () => undefined,
  onSelectionChange,
  selection,
  theme
}: {
  additionalValidationReady?: boolean;
  appearance?: ThemeAppearanceSettings;
  defaults: EditorialThemeConfig;
  disabled?: boolean;
  onChange: (theme: EditorialThemeConfig) => void;
  onAppearanceChange?: (appearance: ThemeAppearanceSettings) => void;
  onSelectionChange: (selection: ThemeSelection) => void;
  selection: ThemeSelection;
  theme: EditorialThemeConfig;
}) {
  const [editingMode, setEditingMode] = useState<ThemeMode>(theme.mode);
  const [paletteRecipe] = useState<FieldflowPaletteRecipe>("royal-current");
  const [previewToken, setPreviewToken] = useState<keyof EditorialColorTokens | null>(null);
  const resolvedAppearance = useMemo(() => (
    appearance.schemaVersion === 2
      ? appearance
      : createRoyalCurrentAppearance({
          primary: selection.accent ?? undefined,
          secondary: selection.support
        }, appearance)
  ), [appearance, selection.accent, selection.support]);
  const currentStyle = resolvedAppearance.schemaVersion === 2
    ? resolvedAppearance.palette
    : royalCurrentDefaultStyle;
  const editingTokens = theme[editingMode];
  const generatedDraft = resolveThemeDraftDefaults(selection, defaults, paletteRecipe);
  const generatedDefaults = generatedDraft.theme;
  const themeReady = additionalValidationReady && editorialThemeHasValidContrast(theme);
  const contrastChecks = themeContrastChecks(editingTokens);
  const allContrastChecks = (["light", "dark"] as const)
    .flatMap((mode) => themeContrastChecks(theme[mode]));
  const passingContrastChecks = allContrastChecks
    .filter((check) => check.ready).length;
  const remainingGroups = editorialThemeTokenGroups
    .map((group) => ({
      ...group,
      tokens: group.tokens.filter((token) => (
        !quickTokens.some((quickToken) => quickToken === token)
      ))
    }))
    .filter((group) => group.tokens.length > 0);

  function updateSelection(next: ThemeSelection) {
    const fieldflowSelection: ThemeSelection = {
      ...next,
      ref: {
        catalog: "v2",
        id: "fieldflow",
        version: themeCatalog.fieldflow.version
      }
    };
    const mode = activeMode(fieldflowSelection, theme.mode);
    setEditingMode(mode);
    onSelectionChange(fieldflowSelection);
    onChange({ ...theme, mode });
  }

  function applyStyle(input: Partial<{
    background: "club" | "neutral";
    primary: string;
    secondary: string | null;
  }> = {}) {
    const style = normalizeClubStyle({ ...currentStyle, ...input });
    const mode = activeMode(selection, theme.mode);
    const nextSelection = createRoyalCurrentSelection(
      style,
      themeCatalog.fieldflow.version,
      mode
    );
    nextSelection.categoryOverrides = selection.categoryOverrides;
    nextSelection.modePolicy = selection.modePolicy;
    const nextTheme = createRoyalCurrentTheme(style, mode);
    onSelectionChange(nextSelection);
    onChange(nextTheme);
    onAppearanceChange(createRoyalCurrentAppearance(style, resolvedAppearance));
  }

  function applyPreset(preset: (typeof fieldflowPalettePresets)[number]) {
    applyStyle({ primary: preset.color });
  }

  function applyPrimary(value: string) {
    const normalized = normalizeClubHex(value);
    if (normalized) applyStyle({ primary: normalized });
  }

  function applySupport(value: string) {
    const normalized = normalizeClubHex(value);
    if (normalized) applyStyle({ secondary: normalized });
  }

  function setPolicy(kind: "auto" | "fixed" | "schedule") {
    const mode = activeMode(selection, theme.mode);
    const next: ThemeSelection = {
      ...selection,
      modePolicy: kind === "fixed"
        ? { kind, mode }
        : kind === "auto"
          ? { kind }
          : {
              entries: [
                { days: allDays, end: "07:00", mode: "dark", start: "18:00" }
              ],
              fallback: "light",
              kind,
              timezone: "Europe/Amsterdam"
            }
    };
    setEditingMode(activeMode(next, mode));
    updateSelection(next);
  }

  function setFixedMode(mode: ThemeMode) {
    setEditingMode(mode);
    updateSelection({ ...selection, modePolicy: { kind: "fixed", mode } });
  }

  function forceMode(mode: ThemeMode) {
    setFixedMode(mode);
  }

  function setToken(
    mode: ThemeMode,
    token: keyof EditorialColorTokens,
    value: string
  ) {
    onChange({
      ...theme,
      [mode]: { ...theme[mode], [token]: value }
    });
  }

  function resetTheme() {
    applyStyle(royalCurrentDefaultStyle);
  }

  return (
    <div className={styles.editorialThemeEditor}>
      <header className={styles.editorialThemeHeader}>
        <div>
          <span className={styles.editorialThemeEyebrow}>Royal Current v8</span>
          <h3>Slidehuisstijl</h3>
          <p>
            Primaire clubkleur en Tweede decoratieve accentkleur maken samen
            automatisch een contrastrijk Royal Current- en Navy Glass-palet
            voor alle dynamische slides van deze vereniging.
          </p>
        </div>
        <span className={styles.editorialThemeScope}>Tenantbreed</span>
      </header>

      <div className={styles.editorialThemeWorkspace}>
        <section
          aria-labelledby="theme-behaviour-title"
          className={styles.editorialThemeControlCard}
        >
          <header className={styles.editorialSectionHeader}>
            <div>
              <span className={styles.editorialSectionEyebrow}>Gedrag</span>
              <h4 id="theme-behaviour-title">Weergavemodus</h4>
              <p>Kies wanneer de lichte of donkere kleurenset actief is.</p>
            </div>
          </header>
          <div className={styles.fieldGrid}>
            <label className={styles.field}>
              <span>Omschakelen</span>
              <select
                disabled={disabled}
                name="themeModePolicyKind"
                onChange={(event) => setPolicy(
                  event.currentTarget.value === "auto"
                    ? "auto"
                    : event.currentTarget.value === "schedule"
                      ? "schedule"
                      : "fixed"
                )}
                value={selection.modePolicy.kind}
              >
                <option value="fixed">Eén vaste modus</option>
                <option value="schedule">Volgens tijdschema</option>
                <option value="auto">Automatisch overdag licht</option>
              </select>
            </label>

            {selection.modePolicy.kind === "fixed" ? (
              <label className={styles.field}>
                <span>Actieve modus</span>
                <select
                  disabled={disabled}
                  name="themeFixedMode"
                  onChange={(event) => setFixedMode(
                    event.currentTarget.value === "dark" ? "dark" : "light"
                  )}
                  value={selection.modePolicy.mode}
                >
                  <option value="light">Licht</option>
                  <option value="dark">Donker</option>
                </select>
              </label>
            ) : null}

            {selection.modePolicy.kind === "schedule" ? (
              <>
                <label className={styles.field}>
                  <span>Donker vanaf</span>
                  <input
                    disabled={disabled}
                    name="themeScheduleStart"
                    onChange={(event) => updateSchedule(selection, updateSelection, {
                      start: event.currentTarget.value
                    })}
                    type="time"
                    value={selection.modePolicy.entries[0]?.start ?? "18:00"}
                  />
                </label>
                <label className={styles.field}>
                  <span>Licht vanaf</span>
                  <input
                    disabled={disabled}
                    name="themeScheduleEnd"
                    onChange={(event) => updateSchedule(selection, updateSelection, {
                      end: event.currentTarget.value
                    })}
                    type="time"
                    value={selection.modePolicy.entries[0]?.end ?? "07:00"}
                  />
                </label>
              </>
            ) : null}

            <SelectionColorInput
              disabled={disabled}
              label="Hoofdkleur"
              onChange={applyPrimary}
              value={resolvedAppearance.palette.primary}
            />
            <SelectionColorInput
              disabled={disabled}
              label="Steunkleur"
              onChange={applySupport}
              value={resolvedAppearance.palette.secondary ?? "#2459ED"}
            />
          </div>
          <div className={styles.editorialPalettePresets}>
            <span>Standaardpaletten</span>
            <div>
              {fieldflowPalettePresets.map((preset) => (
                <button
                  aria-pressed={selection.accent?.toLowerCase() === preset.color}
                  disabled={disabled}
                  key={preset.label}
                  onClick={() => applyPreset(preset)}
                  style={{ "--theme-preset-color": preset.color } as CSSProperties}
                  type="button"
                >
                  <i aria-hidden="true" />
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.editorialGlobalMode}>
            <div>
              <span className={styles.editorialGlobalModeLabel}>Globale modus</span>
              <p>
                Forceer alle nieuwe en opnieuw uitgerolde slides naar één modus.
                Opslaan start daarna de veilige immutable uitrol naar actieve schermen.
              </p>
            </div>
            <div
              aria-label="Globale weergavemodus"
              className={styles.editorialModeTabs}
              role="group"
            >
              {(["light", "dark"] as const).map((mode) => (
                <button
                  aria-pressed={selection.modePolicy.kind === "fixed" && selection.modePolicy.mode === mode}
                  className={styles.editorialModeTab}
                  disabled={disabled}
                  key={mode}
                  onClick={() => forceMode(mode)}
                  type="button"
                >
                  {mode === "light" ? "Alles licht" : "Alles donker"}
                </button>
              ))}
            </div>
          </div>
          <p className={styles.editorialThemeControlHint}>
            Een hoofdkleur of standaardpalet bouwt direct een compleet licht en
            donker palet. Daarna kun je iedere kleurrol en beide logo-oppervlakken
            afzonderlijk verfijnen; het live voorbeeld beweegt meteen mee. Kies
            je later opnieuw een hoofdkleur, dan wordt het hele palet opnieuw
            opgebouwd.
          </p>
        </section>

        <div className={styles.editorialThemePreviewRail}>
          <div className={styles.editorialThemeDualPreview}>
            {(["light", "dark"] as const).map((mode) => (
              <ThemePreview
                key={mode}
                accent={resolvedAppearance.palette.primary}
                activeToken={previewToken}
                appearance={resolvedAppearance}
                mode={mode}
                support={resolvedAppearance.palette.secondary ?? resolvedAppearance.palette.primary}
                tokens={theme[mode]}
              />
            ))}
          </div>
          <p>
            Alle kleurrollen staan tegelijk in beeld. Selecteer een kleurveld
            om de bijbehorende onderdelen te markeren.
          </p>
        </div>

        <section
          aria-labelledby="theme-palette-title"
          className={styles.editorialPaletteCard}
        >
          <header className={styles.editorialPaletteHeader}>
            <div>
              <span className={styles.editorialSectionEyebrow}>Kleuren</span>
              <h4 id="theme-palette-title">
                {editingMode === "light" ? "Licht palet" : "Donker palet"}
              </h4>
              <p>Alle 26 semantische kleurrollen zijn direct aanpasbaar.</p>
            </div>
            <div
              aria-label="Kleurmodus bewerken"
              className={styles.editorialModeTabs}
              role="tablist"
            >
              {(["light", "dark"] as const).map((mode) => (
                <button
                  aria-controls="theme-palette"
                  aria-selected={editingMode === mode}
                  className={styles.editorialModeTab}
                  disabled={disabled}
                key={mode}
                  onClick={() => setEditingMode(mode)}
                  role="tab"
                  type="button"
                >
                  {mode === "light" ? "Licht" : "Donker"}
                </button>
              ))}
            </div>
          </header>
          <div
            aria-label={`${editingMode === "light" ? "Licht" : "Donker"} kleurenpalet`}
            className={styles.editorialPaletteContents}
            id="theme-palette"
            role="tabpanel"
          >
            <section
              aria-labelledby="theme-foundation-title"
              className={styles.editorialFoundationPalette}
            >
              <header className={styles.editorialTokenGroupHeader}>
                <div>
                  <h5 id="theme-foundation-title">Basis</h5>
                  <p>De vijf kleuren die de meeste slidevlakken bepalen.</p>
                </div>
                <span>5 rollen</span>
              </header>
              <div className={styles.editorialQuickTokenGrid}>
                {quickTokens.map((token) => (
                  <EditableTokenField
                    active={previewToken === token}
                    defaultValue={generatedDefaults[editingMode][token]}
                    disabled={disabled}
                    key={token}
                    label={tokenLabels[token]}
                    name={`${editingMode}-${token}`}
                    onChange={(value) => setToken(editingMode, token, value)}
                    onPreviewChange={setPreviewToken}
                    token={token}
                    value={editingTokens[token]}
                  />
                ))}
              </div>
            </section>

            <section
              aria-labelledby="theme-semantic-title"
              className={styles.editorialSemanticPalette}
            >
              <header className={styles.editorialTokenGroupHeader}>
                <div>
                  <h5 id="theme-semantic-title">Alle overige kleurrollen</h5>
                  <p>Rijen, tekst, statussen, randen, beeld en QR-code.</p>
                </div>
                <span>21 rollen</span>
              </header>
              <div className={styles.editorialTokenGroups}>
                {remainingGroups.map((group) => (
                  <details className={styles.editorialTokenGroup} key={group.label}>
                    <summary>
                      <span>
                        <strong>{group.label}</strong>
                        <small>{group.description}</small>
                      </span>
                      <span
                        aria-hidden="true"
                        className={styles.editorialTokenSwatches}
                      >
                        {group.tokens.map((token) => (
                          <i
                            key={token}
                            style={{
                              "--theme-token-swatch": editingTokens[token]
                            } as CSSProperties}
                          />
                        ))}
                      </span>
                      <span className={styles.editorialTokenCount}>
                        {group.tokens.length} {group.tokens.length === 1 ? "rol" : "rollen"}
                      </span>
                      <span
                        aria-hidden="true"
                        className={styles.editorialTokenDisclosureIndicator}
                        data-disclosure-indicator
                      >
                        ›
                      </span>
                    </summary>
                    <div className={styles.editorialAdvancedTokenGrid}>
                      {group.tokens.map((token) => (
                        <EditableTokenField
                          active={previewToken === token}
                          defaultValue={generatedDefaults[editingMode][token]}
                          disabled={disabled}
                          key={token}
                          label={tokenLabels[token]}
                          name={`${editingMode}-${token}`}
                          onChange={(value) => setToken(editingMode, token, value)}
                          onPreviewChange={setPreviewToken}
                          token={token}
                          value={editingTokens[token]}
                        />
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            </section>

            <section
              aria-labelledby="theme-logo-colors-title"
              className={styles.editorialBrandPalette}
            >
              <header className={styles.editorialTokenGroupHeader}>
                <div>
                  <h5 id="theme-logo-colors-title">Logo-oppervlakken</h5>
                  <p>
                    Vaste achtergronden houden lichte en donkere clublogo&apos;s
                    leesbaar op iedere slide.
                  </p>
                </div>
                <span>2 rollen</span>
              </header>
              <div className={styles.editorialBrandTokenGrid}>
                <SelectionColorInput
                  ariaLabelSuffix=" in palet"
                  disabled={disabled}
                  label="Achtergrond clublogo"
                  onChange={(clubLogoBackground) => onAppearanceChange(createRoyalCurrentAppearance(
                    resolvedAppearance.palette,
                    {
                      ...resolvedAppearance,
                      surfaces: {
                        ...resolvedAppearance.surfaces,
                        clubLogoBackground
                      }
                    }
                  ))}
                  value={resolvedAppearance.surfaces.clubLogoBackground}
                />
                <SelectionColorInput
                  ariaLabelSuffix=" in palet"
                  disabled={disabled}
                  label="Achtergrond thuislogo"
                  onChange={(homeLogoBackground) => onAppearanceChange(
                    createRoyalCurrentAppearance(
                      resolvedAppearance.palette,
                      {
                        ...resolvedAppearance,
                        surfaces: {
                          ...resolvedAppearance.surfaces,
                          homeLogoBackground
                        }
                      }
                    )
                  )}
                  value={resolvedAppearance.surfaces.homeLogoBackground}
                />
              </div>
            </section>
          </div>
        </section>

        <section
          aria-labelledby="theme-contrast-title"
          className={styles.editorialContrastCard}
        >
          <header className={styles.editorialContrastHeader}>
            <div>
              <span className={styles.editorialSectionEyebrow}>Leesbaarheid</span>
              <h4 id="theme-contrast-title">Contrastcontrole</h4>
              <p>Tekst en QR-codes moeten ook op afstand duidelijk blijven.</p>
            </div>
            <span
              className={styles.editorialContrastSummary}
              data-valid={passingContrastChecks === allContrastChecks.length}
              role="status"
            >
              {passingContrastChecks}/{allContrastChecks.length} totaal in orde
            </span>
          </header>
          <ContrastMatrix checks={contrastChecks} />
          {!themeReady ? (
            <p className={styles.editorialContrastWarning} role="alert">
              Herstel eerst alle contrastcombinaties in licht en donker voordat
              je deze theme-instellingen opslaat.
            </p>
          ) : null}
        </section>

        <div className={styles.editorialThemeActions}>
          <Button
            disabled={disabled}
            onClick={resetTheme}
            size="sm"
            type="button"
            variant="ghost"
          >
            Clubkleuren herstellen
          </Button>
        </div>
      </div>
      <input
        name="themeColorOverridesJson"
        type="hidden"
        value={JSON.stringify({ fieldflow: theme })}
      />
      <input
        name="themeSaveReadiness"
        type="hidden"
        value={themeReady ? "ready" : "blocked"}
      />
      <input
        name="themeAccent"
        type="hidden"
        value={selection.accent ?? ""}
      />
      <input name="themeId" type="hidden" value="fieldflow" />
      <input
        name="themeSupport"
        type="hidden"
        value={selection.support ?? ""}
      />
    </div>
  );
}

function EditableTokenField({
  active,
  defaultValue,
  disabled,
  label,
  name,
  onChange,
  onPreviewChange,
  token,
  value
}: {
  active: boolean;
  defaultValue: string;
  disabled: boolean;
  label: string;
  name: string;
  onChange: (value: string) => void;
  onPreviewChange: (token: keyof EditorialColorTokens | null) => void;
  token: keyof EditorialColorTokens;
  value: string;
}) {
  return (
    <div
      className={styles.editorialTokenField}
      data-active={active || undefined}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          onPreviewChange(null);
        }
      }}
      onFocus={() => onPreviewChange(token)}
      onMouseEnter={() => onPreviewChange(token)}
      onMouseLeave={(event) => {
        if (!event.currentTarget.contains(document.activeElement)) {
          onPreviewChange(null);
        }
      }}
    >
      <TokenInput
        disabled={disabled}
        label={label}
        name={name}
        onChange={onChange}
        value={value}
      />
      <Button
        aria-label={`${label} herstellen`}
        disabled={disabled || value === defaultValue}
        onClick={() => onChange(defaultValue)}
        size="sm"
        type="button"
        variant="ghost"
      >
        Herstel
      </Button>
    </div>
  );
}

function SelectionColorInput({
  ariaLabelSuffix = "",
  disabled,
  label,
  onChange,
  value
}: {
  ariaLabelSuffix?: string;
  disabled: boolean;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <span className={styles.editorialColorPicker}>
        <input
          aria-label={`${label}${ariaLabelSuffix} kiezen`}
          disabled={disabled}
          onChange={(event) => onChange(event.currentTarget.value)}
          type="color"
          value={colorPickerValue(value)}
        />
        <input
          aria-label={`${label}${ariaLabelSuffix} als kleurwaarde`}
          disabled={disabled}
          maxLength={7}
          onChange={(event) => onChange(event.currentTarget.value.toUpperCase())}
          pattern="^#[0-9A-Fa-f]{6}$"
          required
          spellCheck={false}
          type="text"
          value={value.toUpperCase()}
        />
      </span>
    </label>
  );
}

function ThemePreview({
  accent,
  activeToken,
  appearance,
  mode,
  support,
  tokens
}: {
  accent: string;
  activeToken: keyof EditorialColorTokens | null;
  appearance: ThemeAppearanceSettings;
  mode: ThemeMode;
  support: string;
  tokens: EditorialColorTokens;
}) {
  const bodyFont = themeManifest.fontAssets[appearance.typography.bodyFontRef]!.family;
  const displayFont = themeManifest.fontAssets[appearance.typography.displayFontRef]!.family;
  const previewStyle = {
    ...editorialThemeCssVariables(tokens),
    "--vc-club-logo-background": appearance.surfaces.clubLogoBackground,
    "--vc-home-logo-background": appearance.surfaces.homeLogoBackground,
    "--preview-club-logo-background": appearance.surfaces.clubLogoBackground,
    "--preview-home-logo-background": appearance.surfaces.homeLogoBackground,
    "--vc-theme-accent": accent,
    "--vc-theme-base-scale": appearance.typography.baseScale,
    "--vc-theme-body-font": quoteFont(bodyFont),
    "--vc-theme-display-font": quoteFont(displayFont),
    "--vc-theme-sport-scale": appearance.typography.sportScale,
    "--vc-theme-support": support,
    "--preview-base-scale": appearance.typography.baseScale,
    "--preview-body-font": quoteFont(bodyFont),
    "--preview-display-font": quoteFont(displayFont),
    "--preview-sport-scale": appearance.typography.sportScale
  } as CSSProperties;

  return (
    <aside
      aria-label={mode === "light"
        ? "Live voorbeeld van het lichte palet"
        : "Navy Glass live kleurvoorbeeld (donker palet)"}
      className={styles.editorialThemePreview}
      data-design-revision={appearance.schemaVersion === 2 ? appearance.designRevision : "legacy"}
      data-motion-state={appearance.schemaVersion === 2 && appearance.motionEnabled ? "on" : "off"}
      style={previewStyle}
    >
      <header>
        <span>{mode === "light" ? "Royal Current live kleurvoorbeeld" : "Navy Glass live kleurvoorbeeld"}</span>
        <span>{mode === "light" ? "Licht" : "Donker"} · 26/26 rollen</span>
      </header>
      <div
        {...previewRoles(activeToken, "canvas", "accentSoft", "borderSoft")}
        aria-hidden="true"
        className={styles.editorialThemePreviewCanvas}
        data-theme-base-scale={appearance.typography.baseScale}
        data-theme-body-font={appearance.typography.bodyFontRef}
        data-theme-display-font={appearance.typography.displayFontRef}
        data-theme-sport-scale={appearance.typography.sportScale}
        style={previewStyle}
      >
        <span
          className={styles.editorialThemePreviewAccentRail}
          data-theme-setting="baseAccent"
        />
        <section
          {...previewRoles(activeToken, "surface", "border", "shadow")}
          className={styles.editorialThemePreviewMasthead}
        >
          <span
            className={styles.editorialThemePreviewClubLogo}
            data-theme-setting="clubLogoBackground"
          >
            DS
          </span>
          <span className={styles.editorialThemePreviewTitle}>
            <small {...previewRoles(activeToken, "accent")}>Matchcentre</small>
            <strong {...previewRoles(activeToken, "text")}>Clubprogramma</strong>
            <i {...previewRoles(activeToken, "textMuted")}>Vandaag · sportpark Duindorp</i>
          </span>
          <span
            {...previewRoles(activeToken, "accent", "textOnAccent")}
            className={styles.editorialThemePreviewBadge}
          >
            Live
          </span>
        </section>

        <section
          {...previewRoles(activeToken, "panel")}
          className={styles.editorialThemePreviewMatches}
        >
          <article
            {...previewRoles(activeToken, "row", "borderSoft")}
            className={styles.editorialThemePreviewMatch}
          >
            <span className={styles.editorialThemePreviewMatchPrimary}>
              <time {...previewRoles(activeToken, "textFaint")}>07-09-2026</time>
              <b {...previewRoles(activeToken, "accent")}>14:30</b>
              <span
                className={styles.editorialThemePreviewHomeLogo}
                data-theme-setting="homeLogoBackground"
              >
                D
              </span>
              <strong {...previewRoles(activeToken, "text")}>Duindorp JO13-1</strong>
              <small {...previewRoles(activeToken, "textMuted")}>K 1</small>
              <i {...previewRoles(activeToken, "accent")}>vs.</i>
              <span className={styles.editorialThemePreviewHomeLogo}>Q</span>
              <strong {...previewRoles(activeToken, "text")}>Quick JO13-2</strong>
              <small {...previewRoles(activeToken, "textMuted")}>K 2</small>
            </span>
            <span
              {...previewRoles(activeToken, "textMuted")}
              className={styles.editorialThemePreviewMatchSecondary}
            >
              <span>Scheidsrechter: J. de Vries</span>
              <span>Veld: 1 A</span>
              <span>Sportpark: Duindorp</span>
            </span>
          </article>

          <article
            {...previewRoles(activeToken, "rowSelected", "textOnSelected")}
            className={`${styles.editorialThemePreviewMatch} ${styles.editorialThemePreviewMatchSelected}`}
            style={{
              background: "var(--vc-row-selected)",
              color: "var(--vc-text-on-selected)"
            }}
          >
            <span className={styles.editorialThemePreviewMatchPrimary}>
              <time>12-09-2026</time>
              <b>16:00</b>
              <span className={styles.editorialThemePreviewSelectedMark}>D</span>
              <strong>Duindorp MO17-1</strong>
              <small>K 3</small>
              <i>vs.</i>
              <span className={styles.editorialThemePreviewSelectedMark}>H</span>
              <strong>HBS MO17-1</strong>
              <small>K 4</small>
            </span>
            <span className={styles.editorialThemePreviewMatchSecondary}>
              <span>Scheidsrechter: S. Visser</span>
              <span>Veld: 2</span>
              <span>Sportpark: Houtrust</span>
            </span>
          </article>

          <span
            {...previewRoles(activeToken, "divider")}
            className={styles.editorialThemePreviewDivider}
          />
          <span className={styles.editorialThemePreviewStatuses}>
            <i {...previewRoles(activeToken, "success")}>Winst</i>
            <i {...previewRoles(activeToken, "warning")}>Let op</i>
            <i {...previewRoles(activeToken, "danger")}>Fout</i>
            <i {...previewRoles(activeToken, "neutral")}>Neutraal</i>
          </span>
        </section>

        <figure
          {...previewRoles(
            activeToken,
            "surfaceRaised",
            "imageOverlayStart",
            "imageOverlayMid",
            "imageOverlayEnd"
          )}
          className={styles.editorialThemePreviewMedia}
        >
          <span className={styles.editorialThemePreviewSupport} data-theme-setting="support" />
          <figcaption {...previewRoles(activeToken, "qrSurface")}>
            Clubnieuws
            <strong>Lees het hele bericht</strong>
          </figcaption>
          <span
            {...previewRoles(activeToken, "qrSurface")}
            className={styles.editorialThemePreviewQr}
          >
            <i {...previewRoles(activeToken, "qrInk")} />
          </span>
        </figure>
      </div>
    </aside>
  );
}

function previewRoles(
  activeToken: keyof EditorialColorTokens | null,
  ...tokens: (keyof EditorialColorTokens)[]
) {
  return {
    "data-highlighted": activeToken !== null && tokens.includes(activeToken)
      ? "true"
      : undefined,
    "data-theme-tokens": tokens.join(" ")
  };
}

function TokenInput({
  disabled,
  label,
  name,
  onChange,
  value
}: {
  disabled: boolean;
  label: string;
  name: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <span className={styles.editorialColorInput}>
        <input
          aria-label={`${label} kiezen`}
          disabled={disabled}
          onChange={(event) => onChange(
            replaceColorChannels(value, event.currentTarget.value)
          )}
          type="color"
          value={colorPickerValue(value)}
        />
        <input
          aria-label={`${label} als kleurwaarde`}
          disabled={disabled}
          name={name}
          onChange={(event) => onChange(event.currentTarget.value)}
          pattern="(#[0-9A-Fa-f]{6}|rgba?\([0-9.,%\s]+\)|hsla?\([0-9.,%\s]+\))"
          required
          spellCheck={false}
          value={value}
        />
      </span>
    </label>
  );
}

type ThemeContrastCheck = {
  background: string;
  foreground: string;
  label: string;
  minimum: number;
  ratio: number | null;
  ready: boolean;
};

function themeContrastChecks(tokens: EditorialColorTokens): ThemeContrastCheck[] {
  const labels = {
    accent: "Tekst op accent",
    body: "Gewone tekst",
    photo: "Tekst op foto",
    qr: "QR-code",
    selected: "Tekst op selectie"
  } as const;
  return editorialThemeContrastChecks(tokens).map((check) => ({
    ...check,
    label: labels[check.id]
  }));
}

function ContrastMatrix({ checks }: { checks: ThemeContrastCheck[] }) {
  return (
    <div className={styles.editorialContrastGrid} aria-label="Contrastcontrole">
      {checks.map((check) => (
        <div
          data-valid={check.ready}
          key={check.label}
          role={check.ready ? "status" : "alert"}
          style={{
            "--theme-contrast-background": check.background,
            "--theme-contrast-foreground": check.foreground
          } as CSSProperties}
        >
          <span className={styles.editorialContrastSwatch} aria-hidden="true">Aa</span>
          <span>
            <strong>{check.label}</strong>
            <small>
              {check.ratio === null
                ? "Niet berekenbaar"
                : `${check.ratio.toFixed(2)}:1 · ${check.ready ? "Voldoet" : `Minimaal ${check.minimum}:1`}`}
            </small>
          </span>
        </div>
      ))}
    </div>
  );
}

function updateSchedule(
  selection: ThemeSelection,
  update: (value: ThemeSelection) => void,
  value: { end?: string; start?: string }
) {
  if (selection.modePolicy.kind !== "schedule") return;
  const current = selection.modePolicy.entries[0] ?? {
    days: allDays,
    end: "07:00",
    mode: "dark" as const,
    start: "18:00"
  };
  update({
    ...selection,
    modePolicy: {
      ...selection.modePolicy,
      entries: [{ ...current, ...value }]
    }
  });
}

function activeMode(selection: ThemeSelection, fallback: ThemeMode) {
  return selection.modePolicy.kind === "fixed"
    ? selection.modePolicy.mode
    : selection.modePolicy.kind === "schedule"
      ? selection.modePolicy.fallback
      : fallback;
}

export function resolveThemeDraftDefaults(
  selection: unknown,
  fallback: EditorialThemeConfig,
  recipe: FieldflowPaletteRecipe = "royal-current"
): { theme: EditorialThemeConfig; valid: boolean } {
  const parsed = themeSelectionSchema.safeParse(selection);
  return parsed.success
    ? {
        theme: generateFieldflowPalette(
          parsed.data.accent ?? themeCatalog.fieldflow.accentDefault,
          recipe,
          activeMode(parsed.data, fallback.mode)
        ),
        valid: true
      }
    : { theme: fallback, valid: false };
}

export function generateFieldflowPalette(
  primaryHex: string,
  recipe: FieldflowPaletteRecipe = "royal-current",
  mode: ThemeMode = "light"
): EditorialThemeConfig {
  void recipe;
  return createRoyalCurrentTheme(
    normalizeClubStyle({ primary: normalizeHex(primaryHex) ?? themeCatalog.fieldflow.accentDefault }),
    mode
  );
}

export function deriveSupportColor(primaryHex: string) {
  return (normalizeClubHex(primaryHex) ?? themeCatalog.fieldflow.accentDefault)
    .toUpperCase();
}

function normalizeHex(value: string) {
  return normalizeClubHex(value);
}

export function colorPickerValue(value: string) {
  const hex = /^#[0-9a-f]{6}$/i.exec(value.trim());
  if (hex) return hex[0].toLowerCase();
  const rgb = /^rgba?\(([^)]+)\)$/i.exec(value.trim());
  if (rgb) {
    const channels = rgb[1]!.split(",").slice(0, 3).map((channel) => {
      const normalized = channel.trim();
      const number = Number.parseFloat(normalized);
      return normalized.endsWith("%") ? number * 2.55 : number;
    });
    return channelsToHex(channels);
  }
  const hsl = /^hsla?\(\s*([-0-9.]+)\s*,\s*([-0-9.]+)%\s*,\s*([-0-9.]+)%/i
    .exec(value.trim());
  if (!hsl) return "#000000";
  const hue = ((Number.parseFloat(hsl[1]!) % 360) + 360) % 360;
  const saturation = clamp(Number.parseFloat(hsl[2]!) / 100, 0, 1);
  const lightness = clamp(Number.parseFloat(hsl[3]!) / 100, 0, 1);
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const segment = hue / 60;
  const second = chroma * (1 - Math.abs(segment % 2 - 1));
  const [red, green, blue] = segment < 1
    ? [chroma, second, 0]
    : segment < 2
      ? [second, chroma, 0]
      : segment < 3
        ? [0, chroma, second]
        : segment < 4
          ? [0, second, chroma]
          : segment < 5
            ? [second, 0, chroma]
            : [chroma, 0, second];
  const offset = lightness - chroma / 2;
  return channelsToHex([
    (red + offset) * 255,
    (green + offset) * 255,
    (blue + offset) * 255
  ]);
}

export function replaceColorChannels(value: string, hex: string) {
  const alphaMatch = /^(?:rgba|hsla)\([^,]+,[^,]+,[^,]+,\s*([0-9.]+%?)\s*\)$/i
    .exec(value.trim());
  if (!alphaMatch) return hex.toUpperCase();
  const alpha = alphaMatch[1]!;
  const red = Number.parseInt(hex.slice(1, 3), 16);
  const green = Number.parseInt(hex.slice(3, 5), 16);
  const blue = Number.parseInt(hex.slice(5, 7), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function channelsToHex(channels: number[]) {
  if (channels.length !== 3 || channels.some((channel) => !Number.isFinite(channel))) {
    return "#000000";
  }
  return `#${channels.map((channel) => Math.round(clamp(channel, 0, 255))
    .toString(16)
    .padStart(2, "0")).join("")}`;
}

function quoteFont(value: string) {
  return `"${value.replaceAll('"', "")}"`;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}
