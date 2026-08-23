"use client";

import { CheckCircle2 } from "lucide-react";
import { useState } from "react";

import type { SelectableThemeId } from "@veyocast/contracts";
import { themeCatalog, themeCatalogOptions } from "@veyocast/content-templates/theme-catalog";

export function ThemePicker({
  defaultThemeId,
  disabled = false,
  label = "Thema",
  legacySelected = false,
  onChange,
  value
}: {
  defaultThemeId?: SelectableThemeId;
  disabled?: boolean;
  label?: string;
  legacySelected?: boolean;
  onChange: (value: SelectableThemeId) => void;
  value: SelectableThemeId;
}) {
  return (
    <fieldset className="vc-theme-picker" disabled={disabled}>
      <legend>{label}</legend>
      <div className="vc-theme-picker__grid">
        {legacySelected ? (
          <button
            aria-pressed="true"
            className="vc-theme-picker__card"
            onClick={() => undefined}
            type="button"
          >
            <span aria-hidden="true" className="vc-theme-picker__preview">
              <span>VEYOSPORT</span><strong>Bestaande stijl</strong><i /><i /><i />
            </span>
            <span className="vc-theme-picker__label">
              <strong>Editorial Arena · bestaand</strong>
              <small>Exact behouden uit de huidige versie</small>
            </span>
            <CheckCircle2 aria-label="Geselecteerd" />
          </button>
        ) : null}
        {themeCatalogOptions.map((option) => {
          const theme = themeCatalog[option.id];
          const selected = !legacySelected && value === option.id;
          return (
            <button
              aria-pressed={selected}
              className="vc-theme-picker__card"
              key={option.id}
              onClick={() => onChange(option.id)}
              style={{
                "--theme-accent": theme.accentDefault,
                "--theme-canvas": theme.light.canvas,
                "--theme-line": theme.light.line,
                "--theme-surface": theme.light.surface,
                "--theme-text": theme.light.text
              } as React.CSSProperties}
              type="button"
            >
              <span aria-hidden="true" className="vc-theme-picker__preview">
                <span>VEYOSPORT</span><strong>Nieuw menu</strong><i /><i /><i />
              </span>
              <span className="vc-theme-picker__label">
                <strong>{option.name}</strong>
                {option.id === defaultThemeId ? <small>Standaard voor deze vereniging</small> : <small>Beschikbaar thema</small>}
              </span>
              {selected ? <CheckCircle2 aria-label="Geselecteerd" /> : null}
            </button>
          );
        })}
      </div>
      <style>{`.vc-theme-picker{min-width:0;margin:0;padding:0;border:0}.vc-theme-picker legend{margin-bottom:.65rem;font-weight:750}.vc-theme-picker__grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(178px,1fr));gap:.7rem}.vc-theme-picker__card{position:relative;display:grid;grid-template-columns:58px minmax(0,1fr);align-items:center;gap:.7rem;min-height:82px;padding:.65rem;text-align:left;color:var(--foreground);background:var(--surface);border:1px solid var(--border);border-radius:10px;cursor:pointer}.vc-theme-picker__card:hover{border-color:var(--border-strong)}.vc-theme-picker__card[aria-pressed=true]{border-color:var(--signal-blue,var(--info));box-shadow:0 0 0 2px color-mix(in srgb,var(--signal-blue,var(--info)) 18%,transparent)}.vc-theme-picker__card:focus-visible{outline:2px solid var(--signal-blue,var(--info));outline-offset:2px}.vc-theme-picker__card>svg{position:absolute;right:.55rem;top:.55rem;width:18px;color:var(--success)}.vc-theme-picker__preview{display:grid;align-content:start;gap:3px;width:58px;height:58px;padding:6px;overflow:hidden;color:var(--theme-text);background:var(--theme-canvas);border:1px solid var(--theme-line);border-radius:6px}.vc-theme-picker__preview span{font-size:5px;font-weight:800;color:var(--theme-accent)}.vc-theme-picker__preview strong{font-size:7px;line-height:1}.vc-theme-picker__preview i{display:block;height:5px;background:var(--theme-surface);border-left:2px solid var(--theme-accent)}.vc-theme-picker__label{display:grid;gap:.2rem;min-width:0}.vc-theme-picker__label strong{font-size:.875rem}.vc-theme-picker__label small{color:var(--muted-foreground);font-size:.72rem;line-height:1.25}@media(max-width:520px){.vc-theme-picker__grid{grid-template-columns:1fr}}`}</style>
    </fieldset>
  );
}

export function ThemePickerField({
  defaultThemeId,
  disabled,
  initialThemeId,
  label = "Thema",
  name = "themeId"
}: {
  defaultThemeId?: SelectableThemeId;
  disabled?: boolean;
  initialThemeId: SelectableThemeId;
  label?: string;
  name?: string;
}) {
  const [themeId, setThemeId] = useState(initialThemeId);
  return (
    <>
      <input name={name} type="hidden" value={themeId} />
      <ThemePicker defaultThemeId={defaultThemeId} disabled={disabled} label={label} onChange={setThemeId} value={themeId} />
    </>
  );
}
