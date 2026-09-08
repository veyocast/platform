"use client";

import React, { useState, type CSSProperties } from "react";

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
  contrastRatio,
  editorialThemeCssVariables
} from "@veyocast/content-templates/editorial-arena-theme";
import {
  freezeThemePresentation,
  themeCatalog,
  themeToEditorialTokens
} from "@veyocast/content-templates/theme-catalog";
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
  appearance = defaultThemeAppearanceSettings,
  defaults,
  disabled = false,
  onChange,
  onAppearanceChange = () => undefined,
  onSelectionChange,
  selection,
  theme
}: {
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
  const [previewToken, setPreviewToken] = useState<keyof EditorialColorTokens | null>(null);
  const selected = themeCatalog.fieldflow;
  const editingTokens = theme[editingMode];
  const generatedDraft = resolveThemeDraftDefaults(selection, defaults);
  const generatedDefaults = generatedDraft.theme;
  const contrastChecks = themeContrastChecks(editingTokens);
  const passingContrastChecks = contrastChecks.filter((check) => check.ready).length;
  const remainingGroups = editorialThemeTokenGroups
    .map((group) => ({
      ...group,
      tokens: group.tokens.filter((token) => (
        !quickTokens.some((quickToken) => quickToken === token)
      ))
    }))
    .filter((group) => group.tokens.length > 0);

  function updateSelection(next: ThemeSelection, synchronizeAccent = false) {
    const fieldflowSelection: ThemeSelection = {
      ...next,
      ref: {
        catalog: "v2",
        id: "fieldflow",
        version: themeCatalog.fieldflow.version
      }
    };
    const mode = activeMode(fieldflowSelection, theme.mode);
    onSelectionChange(fieldflowSelection);
    if (!synchronizeAccent) {
      onChange({ ...theme, mode });
      return;
    }
    const generatedDraft = resolveThemeDraftDefaults(fieldflowSelection, defaults);
    if (!generatedDraft.valid) {
      onChange({ ...theme, mode });
      return;
    }
    const generated = generatedDraft.theme;
    onChange({
      dark: {
        ...theme.dark,
        accent: generated.dark.accent,
        accentSoft: generated.dark.accentSoft,
        textOnAccent: generated.dark.textOnAccent
      },
      light: {
        ...theme.light,
        accent: generated.light.accent,
        accentSoft: generated.light.accentSoft,
        textOnAccent: generated.light.textOnAccent
      },
      mode
    });
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
    onChange({ ...generatedDefaults, mode: theme.mode });
  }

  return (
    <div className={styles.editorialThemeEditor}>
      <header className={styles.editorialThemeHeader}>
        <div>
          <span className={styles.editorialThemeEyebrow}>FieldFlow 1.0</span>
          <h3>Slidehuisstijl</h3>
          <p>
            Eén herkenbare lichte en donkere stijl voor alle nieuwe dynamische
            slides van deze vereniging.
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
              label="Basisaccent"
              onChange={(value) => updateSelection({
                ...selection,
                accent: value
              }, true)}
              value={selection.accent ?? defaults.light.accent}
            />
            <SelectionColorInput
              disabled={disabled}
              label="Steunkleur"
              onChange={(value) => updateSelection({
                ...selection,
                support: value
              })}
              value={selection.support ?? selected.supportDefault}
            />
          </div>
          <p className={styles.editorialThemeControlHint}>
            Basisaccent werkt Accent, Zacht accent en Tekst op accent in beide
            paletten bij. Daaronder kun je iedere kleurrol per modus verfijnen.
          </p>
        </section>

        <div className={styles.editorialThemePreviewRail}>
          <ThemePreview
            accent={selection.accent ?? selected.accentDefault}
            activeToken={previewToken}
            appearance={appearance}
            mode={editingMode}
            support={selection.support ?? selected.supportDefault}
            tokens={editingTokens}
          />
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
                  disabled={disabled}
                  label="Achtergrond clublogo"
                  onChange={(clubLogoBackground) => onAppearanceChange({
                    ...appearance,
                    surfaces: {
                      ...appearance.surfaces,
                      clubLogoBackground
                    }
                  })}
                  value={appearance.surfaces.clubLogoBackground}
                />
                <SelectionColorInput
                  disabled={disabled}
                  label="Achtergrond thuislogo"
                  onChange={(homeLogoBackground) => onAppearanceChange({
                    ...appearance,
                    surfaces: {
                      ...appearance.surfaces,
                      homeLogoBackground
                    }
                  })}
                  value={appearance.surfaces.homeLogoBackground}
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
              data-valid={passingContrastChecks === contrastChecks.length}
              role="status"
            >
              {passingContrastChecks}/{contrastChecks.length} in orde
            </span>
          </header>
          <ContrastMatrix checks={contrastChecks} />
        </section>

        <div className={styles.editorialThemeActions}>
          <Button
            disabled={disabled}
            onClick={resetTheme}
            size="sm"
            type="button"
            variant="ghost"
          >
            Kleurrollen in licht en donker herstellen
          </Button>
        </div>
      </div>
      <input
        name="themeColorOverridesJson"
        type="hidden"
        value={JSON.stringify({ fieldflow: theme })}
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
  disabled,
  label,
  onChange,
  value
}: {
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
          aria-label={`${label} kiezen`}
          disabled={disabled}
          onChange={(event) => onChange(event.currentTarget.value)}
          type="color"
          value={colorPickerValue(value)}
        />
        <input
          aria-label={`${label} als kleurwaarde`}
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
  const previewStyle = {
    ...editorialThemeCssVariables(tokens),
    "--vc-club-logo-background": appearance.surfaces.clubLogoBackground,
    "--vc-home-logo-background": appearance.surfaces.homeLogoBackground,
    "--vc-theme-accent": accent,
    "--vc-theme-support": support
  } as CSSProperties;

  return (
    <aside
      aria-label={`Live voorbeeld van het ${mode === "light" ? "lichte" : "donkere"} palet`}
      className={styles.editorialThemePreview}
      style={previewStyle}
    >
      <header>
        <span>Live voorbeeld</span>
        <span>{mode === "light" ? "Licht" : "Donker"} · 26/26 rollen</span>
      </header>
      <div
        {...previewRoles(activeToken, "canvas", "accentSoft", "borderSoft")}
        aria-hidden="true"
        className={styles.editorialThemePreviewCanvas}
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
            <span
              className={styles.editorialThemePreviewHomeLogo}
              data-theme-setting="homeLogoBackground"
            >
              D
            </span>
            <span className={styles.editorialThemePreviewMatchCopy}>
              <small {...previewRoles(activeToken, "textFaint")}>07-09-2026</small>
              <strong {...previewRoles(activeToken, "text")}>Duindorp JO13-1 · Quick JO13-2</strong>
              <i {...previewRoles(activeToken, "textMuted")}>Veld 1 A</i>
            </span>
            <b {...previewRoles(activeToken, "accent")}>14:30</b>
          </article>

          <article
            {...previewRoles(activeToken, "rowSelected", "textOnSelected")}
            className={`${styles.editorialThemePreviewMatch} ${styles.editorialThemePreviewMatchSelected}`}
            style={{
              background: "var(--vc-row-selected)",
              color: "var(--vc-text-on-selected)"
            }}
          >
            <span className={styles.editorialThemePreviewSelectedMark}>D</span>
            <span className={styles.editorialThemePreviewMatchCopy}>
              <small>Geselecteerde rij</small>
              <strong>Duindorp MO17-1 · HBS MO17-1</strong>
              <i>Veld 2</i>
            </span>
            <b>16:00</b>
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
  const combinations = [
    ["Gewone tekst", tokens.text, tokens.surface, 4.5],
    ["Tekst op accent", tokens.textOnAccent, tokens.accent, 4.5],
    ["Tekst op selectie", tokens.textOnSelected, tokens.rowSelected, 4.5],
    ["Tekst op foto", tokens.qrSurface, tokens.imageOverlayStart, 4.5],
    ["QR-code", tokens.qrInk, tokens.qrSurface, 4.5]
  ] as const;
  return combinations.map(([label, foreground, background, minimum]) => {
    const ratio = contrastRatio(foreground, background);
    return {
      background,
      foreground,
      label,
      minimum,
      ratio,
      ready: ratio !== null && ratio >= minimum
    };
  });
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

function legacyThemeBridge(selection: ThemeSelection): EditorialThemeConfig {
  const tokens = (mode: ThemeMode) => themeToEditorialTokens(
    freezeThemePresentation({
      instant: "2026-01-01T12:00:00.000Z",
      selection: { ...selection, modePolicy: { kind: "fixed", mode } },
      timezone: "Europe/Amsterdam"
    })
  );
  return {
    dark: tokens("dark"),
    light: tokens("light"),
    mode: activeMode(selection, "light")
  };
}

export function resolveThemeDraftDefaults(
  selection: unknown,
  fallback: EditorialThemeConfig
): { theme: EditorialThemeConfig; valid: boolean } {
  const parsed = themeSelectionSchema.safeParse(selection);
  return parsed.success
    ? { theme: legacyThemeBridge(parsed.data), valid: true }
    : { theme: fallback, valid: false };
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

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}
