"use client";

import { useState } from "react";

import type {
  EditorialColorTokens,
  EditorialThemeConfig
} from "@veyocast/contracts";
import { contrastRatio } from "@veyocast/content-templates/editorial-arena-theme";
import { Button } from "@veyocast/ui";

import styles from "../../dynamic-content.module.css";

const tokenGroups = [
  { label: "Achtergrond", tokens: ["canvas"] },
  {
    label: "Oppervlakken",
    tokens: ["surface", "surfaceRaised", "panel", "row", "rowSelected"]
  },
  {
    label: "Tekst",
    tokens: ["text", "textMuted", "textFaint", "textOnAccent", "textOnSelected"]
  },
  { label: "Borders", tokens: ["border", "borderSoft", "divider"] },
  {
    label: "Accent en status",
    tokens: ["accent", "accentSoft", "success", "warning", "danger", "neutral"]
  },
  { label: "Shadows", tokens: ["shadow"] },
  {
    label: "Foto-overlay",
    tokens: ["imageOverlayStart", "imageOverlayMid", "imageOverlayEnd"]
  },
  { label: "QR", tokens: ["qrSurface", "qrInk"] }
] as const satisfies ReadonlyArray<{
  label: string;
  tokens: readonly (keyof EditorialColorTokens)[];
}>;

const tokenLabels: Record<keyof EditorialColorTokens, string> = {
  accent: "Accent",
  accentSoft: "Zacht accent",
  border: "Border",
  borderSoft: "Zachte border",
  canvas: "Canvas",
  danger: "Fout",
  divider: "Scheidingslijn",
  imageOverlayEnd: "Overlay einde",
  imageOverlayMid: "Overlay midden",
  imageOverlayStart: "Overlay start",
  neutral: "Neutraal",
  panel: "Paneel",
  qrInk: "QR-voorgrond",
  qrSurface: "QR-achtergrond",
  row: "Rij",
  rowSelected: "Geselecteerde rij",
  shadow: "Schaduw",
  success: "Succes",
  surface: "Hoofdpaneel",
  surfaceRaised: "Verhoogd paneel",
  text: "Hoofdtekst",
  textFaint: "Subtiele tekst",
  textMuted: "Gedempte tekst",
  textOnAccent: "Tekst op accent",
  textOnSelected: "Tekst op selectie",
  warning: "Waarschuwing"
};

export function EditorialThemeEditor({
  defaults,
  onChange,
  theme
}: {
  defaults: EditorialThemeConfig;
  onChange: (theme: EditorialThemeConfig) => void;
  theme: EditorialThemeConfig;
}) {
  const [advanced, setAdvanced] = useState(false);
  const active = theme[theme.mode];

  function setMode(mode: EditorialThemeConfig["mode"]) {
    onChange({ ...theme, mode });
  }

  function setToken(
    mode: EditorialThemeConfig["mode"],
    token: keyof EditorialColorTokens,
    value: string
  ) {
    onChange({
      ...theme,
      [mode]: { ...theme[mode], [token]: value }
    });
  }

  return (
    <div className={styles.editorialThemeEditor}>
      <div className={styles.fieldGrid}>
        <label className={styles.field}>
          <span>Thema</span>
          <select
            name="themeMode"
            onChange={(event) => setMode(
              event.currentTarget.value === "dark" ? "dark" : "light"
            )}
            value={theme.mode}
          >
            <option value="light">Licht</option>
            <option value="dark">Donker</option>
          </select>
        </label>
        {(["accent", "canvas", "surface", "text"] as const).map((token) => (
          <TokenInput
            key={token}
            label={tokenLabels[token]}
            name={`quick-${theme.mode}-${token}`}
            onChange={(value) => setToken(theme.mode, token, value)}
            value={active[token]}
          />
        ))}
      </div>

      <ContrastMatrix tokens={active} />

      <div className={styles.editorialThemeActions}>
        <Button
          onClick={() => setAdvanced((value) => !value)}
          size="sm"
          type="button"
          variant="secondary"
        >
          {advanced ? "Geavanceerde kleuren sluiten" : "Alle tokens bewerken"}
        </Button>
        <Button
          onClick={() => onChange(defaults)}
          size="sm"
          type="button"
          variant="ghost"
        >
          Volledige slide resetten
        </Button>
        <Button
          onClick={() => onChange({ ...theme, dark: { ...theme.light } })}
          size="sm"
          type="button"
          variant="ghost"
        >
          Licht naar donker kopiëren
        </Button>
      </div>

      {advanced ? (
        <div className={styles.editorialTokenGroups}>
          <div className={styles.editorialModeTabs} role="group" aria-label="Tokenmap kiezen">
            {(["light", "dark"] as const).map((mode) => (
              <Button
                aria-pressed={theme.mode === mode}
                key={mode}
                onClick={() => setMode(mode)}
                size="sm"
                type="button"
                variant={theme.mode === mode ? "primary" : "secondary"}
              >
                {mode === "light" ? "Light-map" : "Dark-map"}
              </Button>
            ))}
          </div>
          {tokenGroups.map((group) => (
            <fieldset className={styles.editorialTokenGroup} key={group.label}>
              <legend>{group.label}</legend>
              <div className={styles.fieldGrid}>
                {group.tokens.map((token) => (
                  <div className={styles.editorialTokenField} key={token}>
                    <TokenInput
                      label={tokenLabels[token]}
                      name={`${theme.mode}-${token}`}
                      onChange={(value) => setToken(theme.mode, token, value)}
                      value={theme[theme.mode][token]}
                    />
                    <Button
                      aria-label={`${tokenLabels[token]} resetten`}
                      onClick={() => setToken(
                        theme.mode,
                        token,
                        defaults[theme.mode][token]
                      )}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      Reset
                    </Button>
                  </div>
                ))}
              </div>
            </fieldset>
          ))}
          <ContrastMatrix tokens={theme[theme.mode]} />
        </div>
      ) : null}
      <input name="editorialThemeJson" type="hidden" value={JSON.stringify(theme)} />
    </div>
  );
}

function TokenInput({
  label,
  name,
  onChange,
  value
}: {
  label: string;
  name: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <span className={styles.editorialColorInput}>
        <i aria-hidden="true" style={{ background: value }} />
        <input
          aria-label={label}
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

function ContrastMatrix({ tokens }: { tokens: EditorialColorTokens }) {
  const combinations = [
    ["Gewone tekst", tokens.text, tokens.surface, 4.5],
    ["Tekst op accent", tokens.textOnAccent, tokens.accent, 4.5],
    ["Tekst op selectie", tokens.textOnSelected, tokens.rowSelected, 4.5],
    ["Tekst op foto", tokens.qrSurface, tokens.imageOverlayStart, 4.5],
    ["QR-code", tokens.qrInk, tokens.qrSurface, 4.5]
  ] as const;
  return (
    <div className={styles.editorialContrastGrid} aria-label="Contrastcontrole">
      {combinations.map(([label, foreground, background, minimum]) => {
        const ratio = contrastRatio(foreground, background);
        const ready = ratio !== null && ratio >= minimum;
        return (
          <div data-valid={ready} key={label} role={ready ? "status" : "alert"}>
            <strong>{label}</strong>
            <span>{ratio === null ? "Niet berekenbaar" : `${ratio.toFixed(2)}:1`}</span>
            <small>{ready ? "Voldoet" : `Minimaal ${minimum}:1`}</small>
          </div>
        );
      })}
    </div>
  );
}
