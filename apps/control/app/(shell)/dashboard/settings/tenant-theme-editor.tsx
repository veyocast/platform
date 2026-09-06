"use client";

import { useEffect, useRef, useState } from "react";

import {
  curatedThemeFontRefs,
  type ThemeAppearanceSettings,
  type EditorialThemeConfig,
  type ThemeSelection
} from "@veyocast/contracts";

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
  const [appearance, setAppearance] = useState(initialAppearance);
  const [selection, setSelection] = useState(initialSelection);
  const [theme, setTheme] = useState(initialTheme);
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
        defaults={defaults}
        disabled={disabled}
        onChange={setTheme}
        onSelectionChange={setSelection}
        selection={selection}
        theme={theme}
      />

      <section className="settings-theme-appearance" aria-labelledby="theme-appearance-title">
        <div className="work-panel__header">
          <div>
            <p className="section-kicker">Presentatie</p>
            <h3 className="work-panel__title" id="theme-appearance-title">
              Typografie en logo-oppervlakken
            </h3>
            <p className="work-panel__meta">
              Deze waarden horen bij FieldFlow. Alleen lokaal gebundelde,
              gelicentieerde fonts kunnen worden gekozen.
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
            <span>Algemene lettergrootte (%)</span>
            <input
              disabled={disabled}
              max={125}
              min={85}
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
          <ThemeSurfaceColor
            disabled={disabled}
            label="Achtergrond clublogo"
            onChange={(clubLogoBackground) => setAppearance((current) => ({
              ...current,
              surfaces: { ...current.surfaces, clubLogoBackground }
            }))}
            value={appearance.surfaces.clubLogoBackground}
          />
          <ThemeSurfaceColor
            disabled={disabled}
            label="Achtergrond thuislogo"
            onChange={(homeLogoBackground) => setAppearance((current) => ({
              ...current,
              surfaces: { ...current.surfaces, homeLogoBackground }
            }))}
            value={appearance.surfaces.homeLogoBackground}
          />
        </div>
      </section>
      <input name="themeAppearanceJson" type="hidden" value={JSON.stringify(appearance)} />
    </div>
  );
}

function ThemeSurfaceColor({ disabled, label, onChange, value }: {
  disabled: boolean;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <span className="color-field">
        <input
          aria-label={label}
          disabled={disabled}
          onChange={(event) => onChange(event.currentTarget.value.toUpperCase())}
          type="color"
          value={value}
        />
        <output>{value}</output>
      </span>
    </label>
  );
}
