"use client";

import type {
  EditorialThemeConfig,
  SelectableThemeId,
  ThemeMode,
  ThemeSelection
} from "@veyocast/contracts";
import {
  freezeThemePresentation,
  themeCatalog,
  themeCatalogOptions,
  themeToEditorialTokens
} from "@veyocast/content-templates/theme-catalog";
import { Button } from "@veyocast/ui";

import styles from "../../dynamic-content.module.css";

const allDays = [0, 1, 2, 3, 4, 5, 6];

export function EditorialThemeEditor({
  defaults,
  onChange,
  onSelectionChange,
  selection,
  theme
}: {
  defaults: EditorialThemeConfig;
  onChange: (theme: EditorialThemeConfig) => void;
  onSelectionChange: (selection: ThemeSelection) => void;
  selection: ThemeSelection;
  theme: EditorialThemeConfig;
}) {
  const selectedId = selection.ref.catalog === "v2"
    ? selection.ref.id
    : "editorial";
  const selected = themeCatalog[selectedId];

  function updateSelection(next: ThemeSelection) {
    onSelectionChange(next);
    onChange(legacyThemeBridge(next));
  }

  function setThemeId(id: SelectableThemeId) {
    updateSelection({
      ...selection,
      ref: { catalog: "v2", id, version: themeCatalog[id].version }
    });
  }

  function setPolicy(kind: "auto" | "fixed" | "schedule") {
    const mode = activeMode(selection, theme.mode);
    updateSelection({
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
    });
  }

  function setFixedMode(mode: ThemeMode) {
    updateSelection({ ...selection, modePolicy: { kind: "fixed", mode } });
  }

  return (
    <div className={styles.editorialThemeEditor}>
      <fieldset className={styles.editorialTokenGroup}>
        <legend>Premium thema</legend>
        <div className={styles.grid} data-testid="theme-catalog-v2">
          {themeCatalogOptions.map((option) => {
            const definition = themeCatalog[option.id];
            return (
              <label className={styles.choiceCard} key={option.id}>
                <span
                  aria-hidden="true"
                  style={{
                    background: `linear-gradient(135deg, ${definition.light.canvas} 0 49%, ${definition.dark.canvas} 50% 100%)`,
                    border: `8px solid ${definition.accentDefault}`,
                    borderRadius: 18,
                    display: "block",
                    height: 88,
                    width: 132
                  }}
                />
                <input
                  checked={selectedId === option.id}
                  name="selectableThemeId"
                  onChange={() => setThemeId(option.id)}
                  type="radio"
                  value={option.id}
                />
                <span>
                  <strong>{option.name}</strong>
                  <small>{option.id} · v{option.version}</small>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className={styles.fieldGrid}>
        <label className={styles.field}>
          <span>Licht/donker-beleid</span>
          <select
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
            <option value="fixed">Vaste modus</option>
            <option value="schedule">Volgens tijdschema</option>
            <option value="auto">Automatisch op schermvoorkeur</option>
          </select>
        </label>

        {selection.modePolicy.kind === "fixed" ? (
          <label className={styles.field}>
            <span>Vaste modus</span>
            <select
              name="themeMode"
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
                onChange={(event) => updateSchedule(selection, updateSelection, {
                  end: event.currentTarget.value
                })}
                type="time"
                value={selection.modePolicy.entries[0]?.end ?? "07:00"}
              />
            </label>
          </>
        ) : null}

        <label className={styles.field}>
          <span>Accentkleur (optioneel)</span>
          <input
            onChange={(event) => updateSelection({
              ...selection,
              accent: event.currentTarget.value || null
            })}
            pattern="#[0-9A-Fa-f]{6}"
            placeholder={selected.accentDefault}
            value={selection.accent ?? ""}
          />
        </label>
        <label className={styles.field}>
          <span>Steunkleur (optioneel)</span>
          <input
            onChange={(event) => updateSelection({
              ...selection,
              support: event.currentTarget.value || null
            })}
            pattern="#[0-9A-Fa-f]{6}"
            placeholder={selected.supportDefault}
            value={selection.support ?? ""}
          />
        </label>
      </div>

      <div className={styles.editorialThemeActions}>
        <Button
          onClick={() => {
            const reset: ThemeSelection = {
              accent: defaults.light.accent,
              categoryOverrides: [],
              modePolicy: { kind: "fixed", mode: defaults.mode },
              ref: {
                catalog: "v2",
                id: "editorial",
                version: themeCatalog.editorial.version
              },
              support: null
            };
            updateSelection(reset);
          }}
          size="sm"
          type="button"
          variant="ghost"
        >
          Terug naar tenantstandaard
        </Button>
      </div>
      <input
        name="editorialThemeJson"
        type="hidden"
        value={JSON.stringify(theme)}
      />
      <input
        name="themeSelectionJson"
        type="hidden"
        value={JSON.stringify(selection)}
      />
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
