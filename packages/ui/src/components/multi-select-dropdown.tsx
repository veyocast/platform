"use client";

import * as Collapsible from "@radix-ui/react-collapsible";
import { useId, useMemo, useState } from "react";

import { cn } from "../utils";

export type MultiSelectOption = Readonly<{
  description?: string;
  disabled?: boolean;
  disabledReason?: string;
  keywords?: readonly string[];
  label: string;
  value: string;
}>;

export type MultiSelectDropdownProps = Readonly<{
  allowClear?: boolean;
  allowSelectAll?: boolean;
  className?: string;
  clearLabel?: string;
  defaultOpen?: boolean;
  defaultValue?: readonly string[];
  description?: string;
  disabled?: boolean;
  emptyLabel?: string;
  label: string;
  maximumSelected?: number;
  minimumSelected?: number;
  name?: string;
  noResultsLabel?: string;
  onValueChange?: (values: string[]) => void;
  options: readonly MultiSelectOption[];
  placeholder?: string;
  searchable?: boolean;
  searchLabel?: string;
  searchPlaceholder?: string;
  selectAllLabel?: string;
  selectionNoun?: Readonly<{ plural: string; singular: string }>;
  showSelectedChips?: boolean;
  value?: readonly string[];
}>;

const defaultSelectionNoun = { plural: "opties", singular: "optie" } as const;

export function MultiSelectDropdown({
  allowClear = true,
  allowSelectAll = true,
  className,
  clearLabel = "Selectie wissen",
  defaultOpen = false,
  defaultValue = [],
  description,
  disabled = false,
  emptyLabel = "Er zijn geen opties beschikbaar.",
  label,
  maximumSelected,
  minimumSelected = 0,
  name,
  noResultsLabel = "Geen opties gevonden. Pas je zoekopdracht aan.",
  onValueChange,
  options,
  placeholder = "Maak een selectie",
  searchable,
  searchLabel = "Zoeken",
  searchPlaceholder = "Zoek in de opties",
  selectAllLabel = "Alles selecteren",
  selectionNoun = defaultSelectionNoun,
  showSelectedChips = true,
  value
}: MultiSelectDropdownProps) {
  const generatedId = useId();
  const [open, setOpen] = useState(defaultOpen);
  const [query, setQuery] = useState("");
  const [uncontrolledValue, setUncontrolledValue] = useState(() =>
    uniqueValues(defaultValue)
  );
  const selectedValues = useMemo(
    () => uniqueValues(value ?? uncontrolledValue),
    [uncontrolledValue, value]
  );
  const optionByValue = useMemo(
    () => new Map(options.map((option) => [option.value, option])),
    [options]
  );
  const selectedSet = useMemo(() => new Set(selectedValues), [selectedValues]);
  const normalizedQuery = normalizeSearch(query);
  const visibleOptions = useMemo(
    () => options.filter((option) => {
      if (!normalizedQuery) return true;
      return normalizeSearch([
        option.label,
        option.description,
        ...(option.keywords ?? [])
      ].filter(Boolean).join(" ")).includes(normalizedQuery);
    }),
    [normalizedQuery, options]
  );
  const enabledValues = options
    .filter((option) => !option.disabled)
    .map((option) => option.value);
  const allEnabledSelected = enabledValues.length > 0 &&
    enabledValues.every((optionValue) => selectedSet.has(optionValue));
  const atMaximum = maximumSelected !== undefined &&
    selectedValues.length >= maximumSelected;
  const canClear = selectedValues.length > minimumSelected;
  const shouldSearch = searchable ?? options.length > 7;
  const labelId = `${generatedId}-label`;
  const descriptionId = `${generatedId}-description`;
  const summaryId = `${generatedId}-summary`;

  function commit(nextValues: readonly string[]) {
    const next = uniqueValues(nextValues);
    if (value === undefined) setUncontrolledValue(next);
    onValueChange?.(next);
  }

  function toggle(optionValue: string) {
    if (selectedSet.has(optionValue)) {
      if (selectedValues.length <= minimumSelected) return;
      commit(selectedValues.filter((candidate) => candidate !== optionValue));
      return;
    }
    if (atMaximum) return;
    commit([...selectedValues, optionValue]);
  }

  function selectAll() {
    const enabledSet = new Set(enabledValues);
    const retainedValues = selectedValues.filter((selectedValue) =>
      !enabledSet.has(selectedValue)
    );
    const remainingCapacity = maximumSelected === undefined
      ? enabledValues.length
      : Math.max(0, maximumSelected - retainedValues.length);
    commit([
      ...retainedValues,
      ...enabledValues.slice(0, remainingCapacity)
    ]);
  }

  function clear() {
    commit(selectedValues.slice(0, minimumSelected));
  }

  const summary = selectionSummary(
    selectedValues,
    optionByValue,
    placeholder,
    selectionNoun
  );
  const countLabel = `${selectedValues.length} ${selectedValues.length === 1
    ? selectionNoun.singular
    : selectionNoun.plural} geselecteerd`;

  return (
    <Collapsible.Root
      className={cn("vc-multi-select", className)}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setQuery("");
      }}
      open={open}
    >
      {name ? selectedValues.map((selectedValue) => (
        <input key={selectedValue} name={name} type="hidden" value={selectedValue} />
      )) : null}
      <div className="vc-multi-select__heading">
        <span className="vc-multi-select__label" id={labelId}>{label}</span>
        <span aria-live="polite" className="vc-multi-select__count">{countLabel}</span>
      </div>
      {description ? (
        <span className="vc-multi-select__description" id={descriptionId}>
          {description}
        </span>
      ) : null}
      {!options.length ? (
        <p className="vc-multi-select__empty" role="status">{emptyLabel}</p>
      ) : null}
      <Collapsible.Trigger asChild>
        <button
          aria-describedby={description ? descriptionId : undefined}
          aria-labelledby={`${labelId} ${summaryId}`}
          className="vc-multi-select__trigger"
          disabled={disabled || options.length === 0}
          type="button"
        >
          <span className="vc-multi-select__trigger-copy">
            <strong id={summaryId}>{summary}</strong>
            <small>{options.length} {options.length === 1
              ? selectionNoun.singular
              : selectionNoun.plural} beschikbaar</small>
          </span>
          <span aria-hidden="true" className="vc-multi-select__chevron">⌄</span>
        </button>
      </Collapsible.Trigger>

      {showSelectedChips ? (
        <div aria-label={`Geselecteerde ${selectionNoun.plural}`} className="vc-multi-select__chips">
          {selectedValues.map((selectedValue) => {
            const selectedOption = optionByValue.get(selectedValue);
            const selectedLabel = selectedOption?.label ?? selectedValue;
            return (
              <span className="vc-multi-select__chip" key={selectedValue}>
                <span>{selectedLabel}</span>
                <button
                  aria-label={`${selectedLabel} verwijderen`}
                  disabled={disabled || selectedValues.length <= minimumSelected}
                  onClick={() => toggle(selectedValue)}
                  type="button"
                >
                  <span aria-hidden="true">×</span>
                </button>
              </span>
            );
          })}
          {!selectedValues.length ? (
            <span className="vc-multi-select__empty-selection">Nog niets gekozen.</span>
          ) : null}
        </div>
      ) : null}

      <Collapsible.Content className="vc-multi-select__content">
        {shouldSearch && options.length ? (
          <label className="vc-multi-select__search">
            <span>{searchLabel}</span>
            <span className="vc-multi-select__search-control">
              <input
                autoComplete="off"
                onChange={(event) => setQuery(event.currentTarget.value)}
                placeholder={searchPlaceholder}
                type="search"
                value={query}
              />
              {query ? (
                <button
                  aria-label="Zoekopdracht wissen"
                  onClick={() => setQuery("")}
                  type="button"
                >
                  <span aria-hidden="true">×</span>
                </button>
              ) : null}
            </span>
          </label>
        ) : null}

        {options.length ? (
          <div className="vc-multi-select__actions">
            {allowSelectAll ? (
              <button
                disabled={disabled || allEnabledSelected || enabledValues.length === 0}
                onClick={selectAll}
                type="button"
              >
                {selectAllLabel}
              </button>
            ) : null}
            {allowClear ? (
              <button disabled={disabled || !canClear} onClick={clear} type="button">
                {clearLabel}
              </button>
            ) : null}
          </div>
        ) : null}

        {visibleOptions.length ? (
          <div
            aria-label={`${label}: beschikbare ${selectionNoun.plural}`}
            className="vc-multi-select__options"
            role="group"
          >
            {visibleOptions.map((option, optionIndex) => {
              const checked = selectedSet.has(option.value);
              const optionDisabled = disabled || Boolean(option.disabled) ||
                (!checked && atMaximum) ||
                (checked && selectedValues.length <= minimumSelected);
              const optionDescription = option.disabledReason ?? option.description;
              const optionDescriptionId = optionDescription
                ? `${generatedId}-option-${optionIndex}-description`
                : undefined;
              return (
                <label data-disabled={optionDisabled || undefined} key={option.value}>
                  <input
                    aria-describedby={optionDescriptionId}
                    checked={checked}
                    disabled={optionDisabled}
                    onChange={() => toggle(option.value)}
                    type="checkbox"
                  />
                  <span>
                    <strong>{option.label}</strong>
                    {optionDescription ? (
                      <small id={optionDescriptionId}>{optionDescription}</small>
                    ) : null}
                  </span>
                </label>
              );
            })}
          </div>
        ) : (
          <p className="vc-multi-select__empty" role="status">
            {options.length ? noResultsLabel : emptyLabel}
          </p>
        )}

        {maximumSelected !== undefined ? (
          <p className="vc-multi-select__limit" role="status">
            Maximaal {maximumSelected} {maximumSelected === 1
              ? selectionNoun.singular
              : selectionNoun.plural}.
          </p>
        ) : null}
      </Collapsible.Content>
    </Collapsible.Root>
  );
}

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .trim()
    .toLocaleLowerCase("nl-NL");
}

function selectionSummary(
  selectedValues: readonly string[],
  optionByValue: ReadonlyMap<string, MultiSelectOption>,
  placeholder: string,
  selectionNoun: Readonly<{ plural: string; singular: string }>
) {
  if (!selectedValues.length) return placeholder;
  if (selectedValues.length === 1) {
    return optionByValue.get(selectedValues[0] ?? "")?.label ?? selectedValues[0];
  }
  return `${selectedValues.length} ${selectionNoun.plural}`;
}

function uniqueValues(values: readonly string[]) {
  return [...new Set(values.filter(Boolean))];
}
