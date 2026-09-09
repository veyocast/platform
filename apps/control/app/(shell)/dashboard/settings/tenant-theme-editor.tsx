"use client";

import React, { useEffect, useRef, useState } from "react";

import {
  curatedThemeFontRefs,
  type ThemeAppearanceSettings,
  type EditorialThemeConfig,
  type ThemeSelection
} from "@veyocast/contracts";
import {
  createRoyalCurrentAppearance,
  createRoyalCurrentTheme,
  normalizeClubHex
} from "@veyocast/content-templates";

import { EditorialThemeEditor } from "../slides/new/editorial-theme-editor";

const fontLabels: Record<(typeof curatedThemeFontRefs)[number], string> = {
  "vc-anton-v1": "Anton",
  "vc-barlow-condensed-v1": "Barlow Condensed",
  "vc-cormorant-garamond-v1": "Cormorant Garamond",
  "vc-fraunces-v1": "Fraunces",
  "vc-ibm-plex-mono-v1": "IBM Plex Mono",
  "vc-inter-v1": "Inter",
  "vc-manrope-v1": "Manrope",
  "vc-newsreader-v1": "Newsreader",
  "vc-roboto-v1": "Roboto",
  "vc-source-serif-4-v1": "Source Serif 4",
  "vc-space-grotesk-v1": "Space Grotesk"
};

export function TenantThemeEditor({
  defaults,
  disabled,
  initialAppearance,
  initialSelection,
  initialTheme
}: {
  defaults: EditorialThemeConfig;
  disabled: boolean;
  initialAppearance: ThemeAppearanceSettings;
  initialSelection: ThemeSelection;
  initialTheme: EditorialThemeConfig;
}) {
  const resolvedInitialAppearance = (
    initialAppearance.schemaVersion === 2
      ? initialAppearance
      : createRoyalCurrentAppearance({
          primary: initialSelection.accent ?? undefined,
          secondary: initialSelection.support
        }, initialAppearance)
  );
  const resolvedInitialSelection = resolvedInitialAppearance.schemaVersion === 2
    ? {
        ...initialSelection,
        accent: resolvedInitialAppearance.palette.primary.toUpperCase(),
        support: resolvedInitialAppearance.palette.secondary?.toUpperCase() ?? null
      }
    : initialSelection;
  const resolvedInitialMode = resolvedInitialSelection.modePolicy.kind === "fixed"
    ? resolvedInitialSelection.modePolicy.mode
    : resolvedInitialSelection.modePolicy.kind === "schedule"
      ? resolvedInitialSelection.modePolicy.fallback
      : initialTheme.mode;
  const resolvedInitialTheme = resolvedInitialAppearance.schemaVersion === 2
    ? createRoyalCurrentTheme(resolvedInitialAppearance.palette, resolvedInitialMode)
    : initialTheme;
  const [appearance, setAppearance] = useState<ThemeAppearanceSettings>(resolvedInitialAppearance);
  const [selection, setSelection] = useState(resolvedInitialSelection);
  const [theme, setTheme] = useState(resolvedInitialTheme);
  const [clubLogoSurfaceValid, setClubLogoSurfaceValid] = useState(true);
  const [homeLogoSurfaceValid, setHomeLogoSurfaceValid] = useState(true);
  const editorRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      return;
    }
    editorRef.current?.closest("form")?.dispatchEvent(
      new Event("input", { bubbles: true })
    );
  }, [appearance, selection, theme]);

  return (
    <div className="settings-theme-studio" ref={editorRef}>
      <EditorialThemeEditor
        additionalValidationReady={clubLogoSurfaceValid && homeLogoSurfaceValid}
        appearance={appearance}
        defaults={defaults}
        disabled={disabled}
        onChange={setTheme}
        onAppearanceChange={setAppearance}
        onSelectionChange={setSelection}
        selection={selection}
        theme={theme}
      />

      <section className="settings-theme-appearance" aria-labelledby="theme-appearance-title">
        <div className="work-panel__header">
          <div>
            <p className="section-kicker">Presentatie</p>
            <h3 className="work-panel__title" id="theme-appearance-title">
              Typografie
            </h3>
            <p className="work-panel__meta">
              Roboto en 100% zijn de nieuwe standaard. Bestaande opgeslagen
              fontkeuzes blijven bij bewerken behouden totdat je ze herstelt.
            </p>
          </div>
        </div>
        <div className="form-grid">
          <label className="field">
            <span>Koppen en wedstrijdnamen</span>
            <select
              disabled={disabled}
              onChange={(event) => setAppearance((current) => ({
                ...current,
                typography: {
                  ...current.typography,
                  displayFontRef: event.currentTarget.value as ThemeAppearanceSettings["typography"]["displayFontRef"]
                }
              }))}
              value={appearance.typography.displayFontRef}
            >
              {curatedThemeFontRefs.map((fontRef) => (
                <option key={fontRef} value={fontRef}>{fontLabels[fontRef]}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Lopende tekst en metadata</span>
            <select
              disabled={disabled}
              onChange={(event) => setAppearance((current) => ({
                ...current,
                typography: {
                  ...current.typography,
                  bodyFontRef: event.currentTarget.value as ThemeAppearanceSettings["typography"]["bodyFontRef"]
                }
              }))}
              value={appearance.typography.bodyFontRef}
            >
              {curatedThemeFontRefs.map((fontRef) => (
                <option key={fontRef} value={fontRef}>{fontLabels[fontRef]}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Tekstschaal (%)</span>
            <input
              disabled={disabled}
              max={120}
              min={90}
              onChange={(event) => setAppearance((current) => ({
                ...current,
                typography: {
                  ...current.typography,
                  baseScale: Number(event.currentTarget.value) / 100
                }
              }))}
              type="number"
              value={Math.round(appearance.typography.baseScale * 100)}
            />
          </label>
          <label className="field">
            <span>Programma en uitslagen (%)</span>
            <input
              disabled={disabled}
              max={140}
              min={90}
              onChange={(event) => setAppearance((current) => ({
                ...current,
                typography: {
                  ...current.typography,
                  sportScale: Number(event.currentTarget.value) / 100
                }
              }))}
              type="number"
              value={Math.round(appearance.typography.sportScale * 100)}
            />
          </label>
          {appearance.schemaVersion === 2 ? (
            <label className="settings-check-card">
              <input
                checked={appearance.motionEnabled}
                data-motion-label={appearance.motionEnabled ? "beweging aan" : "beweging uit"}
                disabled={disabled}
                onChange={(event) => setAppearance((current) => current.schemaVersion === 2
                  ? { ...current, motionEnabled: event.currentTarget.checked }
                  : current)}
                type="checkbox"
              />
              <span>
                <strong>Rustige bewegingen</strong>
                <small>Respecteert ook de verminderde-beweginginstelling van het scherm.</small>
              </span>
            </label>
          ) : null}
        </div>
        {appearance.schemaVersion === 2 ? (
          <fieldset className="settings-theme-surface-fields">
            <legend>Logo-oppervlakken</legend>
            <p className="work-panel__meta">
              Deze vlakken blijven onderdeel van de tenantstijl en zijn direct
              zichtbaar in beide previews hierboven.
            </p>
            <div className="form-grid">
              <AppearanceSurfaceControl
                disabled={disabled}
                id="theme-club-logo-background"
                label="Achtergrond clublogo"
                onChange={(clubLogoBackground) => setAppearance((current) =>
                  current.schemaVersion === 2
                    ? {
                        ...current,
                        surfaces: { ...current.surfaces, clubLogoBackground }
                      }
                    : current)}
                onValidityChange={setClubLogoSurfaceValid}
                value={appearance.surfaces.clubLogoBackground}
              />
              <AppearanceSurfaceControl
                disabled={disabled}
                id="theme-home-logo-background"
                label="Achtergrond thuislogo"
                onChange={(homeLogoBackground) => setAppearance((current) =>
                  current.schemaVersion === 2
                    ? {
                        ...current,
                        surfaces: { ...current.surfaces, homeLogoBackground }
                      }
                    : current)}
                onValidityChange={setHomeLogoSurfaceValid}
                value={appearance.surfaces.homeLogoBackground}
              />
            </div>
          </fieldset>
        ) : null}
        <div className="form-actions form-actions--compact">
          <button
            className="button button--ghost"
            disabled={disabled}
            onClick={() => setAppearance((current) => ({
              ...createRoyalCurrentAppearance(
                current.schemaVersion === 2 ? current.palette : undefined,
                current
              ),
              typography: {
                baseScale: 1,
                bodyFontRef: "vc-roboto-v1",
                displayFontRef: "vc-roboto-v1",
                sportScale: 1
              }
            }))}
            type="button"
          >
            Lettertype en schaal herstellen
          </button>
        </div>
      </section>
      <input name="themeAppearanceJson" type="hidden" value={JSON.stringify(appearance)} />
    </div>
  );
}

function AppearanceSurfaceControl({
  disabled,
  id,
  label,
  onChange,
  onValidityChange,
  value
}: {
  disabled: boolean;
  id: string;
  label: string;
  onChange: (value: string) => void;
  onValidityChange: (valid: boolean) => void;
  value: string;
}) {
  const [draft, setDraft] = useState(value.toUpperCase());
  const [error, setError] = useState("");
  const errorId = `${id}-error`;

  useEffect(() => setDraft(value.toUpperCase()), [value]);

  function update(next: string) {
    setDraft(next.toUpperCase());
    const normalized = normalizeClubHex(next);
    if (!normalized) {
      setError("Gebruik een geldige HEX-kleur, bijvoorbeeld #FFFFFF.");
      onValidityChange(false);
      return;
    }
    setError("");
    onValidityChange(true);
    onChange(normalized.toUpperCase());
  }

  return (
    <label className="field" htmlFor={id}>
      <span>{label}</span>
      <span className="settings-theme-color-control">
        <input
          aria-label={`${label} kiezen`}
          disabled={disabled}
          onChange={(event) => update(event.currentTarget.value)}
          type="color"
          value={normalizeClubHex(value) ?? "#ffffff"}
        />
        <input
          aria-label={`${label} als kleurwaarde`}
          aria-describedby={error ? errorId : undefined}
          aria-invalid={Boolean(error)}
          disabled={disabled}
          id={id}
          maxLength={7}
          onChange={(event) => update(event.currentTarget.value)}
          pattern="^#(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$"
          spellCheck={false}
          type="text"
          value={draft}
        />
      </span>
      <small className="settings-theme-color-error" id={errorId} role={error ? "alert" : undefined}>
        {error}
      </small>
    </label>
  );
}
