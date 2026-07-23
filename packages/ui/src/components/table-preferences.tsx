"use client";

import type { ReactElement, ReactNode } from "react";
import { useEffect, useId, useMemo, useState } from "react";

import { Button } from "./button";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from "./sheet";

export type TableDensity = "comfortable" | "compact";

export type TablePreferenceColumn = Readonly<{
  defaultVisible?: boolean;
  id: string;
  label: string;
  required?: boolean;
}>;

export type TablePreferencesValue = Readonly<{
  density: TableDensity;
  knownColumns: readonly string[];
  version: 1;
  visibleColumns: readonly string[];
}>;

export type TablePreferencesProps = Readonly<{
  columns: readonly TablePreferenceColumn[];
  defaultDensity?: TableDensity;
  description?: ReactNode;
  tableKey: string;
  title?: string;
  trigger?: ReactElement;
  triggerLabel?: string;
}>;

export function getTablePreferencesStorageKey(tableKey: string) {
  return `veyocast:table:${tableKey}:preferences`;
}

function getDefaultVisibleColumns(columns: readonly TablePreferenceColumn[]) {
  return columns
    .filter((column) => column.required || column.defaultVisible !== false)
    .map((column) => column.id);
}

function getDefaultPreferences(
  columns: readonly TablePreferenceColumn[],
  density: TableDensity
): TablePreferencesValue {
  return {
    density,
    knownColumns: columns.map((column) => column.id),
    version: 1,
    visibleColumns: getDefaultVisibleColumns(columns)
  };
}

export function parseTablePreferences(
  value: string | null,
  columns: readonly TablePreferenceColumn[],
  defaultDensity: TableDensity = "comfortable"
): TablePreferencesValue {
  const defaults = getDefaultPreferences(columns, defaultDensity);
  if (!value) return defaults;

  try {
    const stored = JSON.parse(value) as Partial<TablePreferencesValue>;
    if (
      stored.version !== 1 ||
      !Array.isArray(stored.visibleColumns) ||
      !Array.isArray(stored.knownColumns)
    ) {
      return defaults;
    }

    const knownBefore = new Set(
      stored.knownColumns.filter((id): id is string => typeof id === "string")
    );
    const visibleBefore = new Set(
      stored.visibleColumns.filter((id): id is string => typeof id === "string")
    );
    const visibleColumns = columns
      .filter((column) => {
        if (column.required) return true;
        if (!knownBefore.has(column.id)) return column.defaultVisible !== false;
        return visibleBefore.has(column.id);
      })
      .map((column) => column.id);

    return {
      density:
        stored.density === "compact" || stored.density === "comfortable"
          ? stored.density
          : defaultDensity,
      knownColumns: columns.map((column) => column.id),
      version: 1,
      visibleColumns
    };
  } catch {
    return defaults;
  }
}

function findPreferenceTables(tableKey: string) {
  return Array.from(document.querySelectorAll<HTMLElement>("[data-vc-table-key]")).filter(
    (table) => table.dataset.vcTableKey === tableKey
  );
}

function applyPreferences(tableKey: string, preferences: TablePreferencesValue) {
  const visibleColumns = new Set(preferences.visibleColumns);

  for (const table of findPreferenceTables(tableKey)) {
    table.dataset.vcDensity = preferences.density;
    for (const cell of table.querySelectorAll<HTMLElement>("[data-column]")) {
      const columnId = cell.dataset.column;
      cell.hidden = Boolean(columnId && !visibleColumns.has(columnId));
    }
  }
}

export function TablePreferences({
  columns,
  defaultDensity = "comfortable",
  description = "Kies welke informatie je in deze tabel ziet en hoe compact de rijen zijn.",
  tableKey,
  title = "Tabelweergave",
  trigger,
  triggerLabel = "Weergave aanpassen"
}: TablePreferencesProps) {
  const groupId = useId();
  const defaults = useMemo(
    () => getDefaultPreferences(columns, defaultDensity),
    [columns, defaultDensity]
  );
  const [preferences, setPreferences] = useState<TablePreferencesValue>(defaults);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(getTablePreferencesStorageKey(tableKey));
    } catch {
      // Storage may be unavailable in a hardened or private browser context.
    }
    setPreferences(parseTablePreferences(stored, columns, defaultDensity));
    setHydrated(true);
  }, [columns, defaultDensity, tableKey]);

  useEffect(() => {
    if (!hydrated) return;

    applyPreferences(tableKey, preferences);
    try {
      window.localStorage.setItem(
        getTablePreferencesStorageKey(tableKey),
        JSON.stringify(preferences)
      );
    } catch {
      // The preference remains active for this session when persistence is unavailable.
    }

    const observer =
      typeof MutationObserver === "undefined"
        ? undefined
        : new MutationObserver(() => applyPreferences(tableKey, preferences));
    observer?.observe(document.body, { childList: true, subtree: true });
    return () => observer?.disconnect();
  }, [hydrated, preferences, tableKey]);

  const visibleColumns = new Set(preferences.visibleColumns);

  function setColumnVisible(columnId: string, visible: boolean) {
    setPreferences((current) => {
      const nextVisible = new Set(current.visibleColumns);
      if (visible) nextVisible.add(columnId);
      else nextVisible.delete(columnId);
      return { ...current, visibleColumns: columns.filter(({ id }) => nextVisible.has(id)).map(({ id }) => id) };
    });
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="secondary">
            {triggerLabel}
          </Button>
        )}
      </SheetTrigger>
      <SheetContent aria-describedby={`${groupId}-description`}>
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription id={`${groupId}-description`}>{description}</SheetDescription>
        </SheetHeader>
        <SheetBody>
          <fieldset className="vc-table-preferences__group">
            <legend className="vc-table-preferences__legend">Kolommen</legend>
            {columns.map((column) => (
              <label className="vc-table-preferences__option" key={column.id}>
                <input
                  checked={column.required || visibleColumns.has(column.id)}
                  disabled={column.required}
                  onChange={(event) => setColumnVisible(column.id, event.currentTarget.checked)}
                  type="checkbox"
                />
                <span>{column.label}</span>
                {column.required ? (
                  <span className="vc-table-preferences__hint">Altijd zichtbaar</span>
                ) : null}
              </label>
            ))}
          </fieldset>
          <fieldset className="vc-table-preferences__group">
            <legend className="vc-table-preferences__legend">Rijdichtheid</legend>
            {(["comfortable", "compact"] as const).map((density) => (
              <label className="vc-table-preferences__option" key={density}>
                <input
                  checked={preferences.density === density}
                  name={`${groupId}-density`}
                  onChange={() => setPreferences((current) => ({ ...current, density }))}
                  type="radio"
                  value={density}
                />
                <span>{density === "comfortable" ? "Comfortabel" : "Compact"}</span>
              </label>
            ))}
          </fieldset>
        </SheetBody>
        <SheetFooter>
          <Button onClick={() => setPreferences(defaults)} variant="secondary">
            Standaard herstellen
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
