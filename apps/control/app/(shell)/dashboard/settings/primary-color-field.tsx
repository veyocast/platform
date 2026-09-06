"use client";

import { useId, useState } from "react";

const canonicalFallback = "#FF5C20";
const hexColorPattern = /^#[0-9A-F]{6}$/;

export function PrimaryColorField({
  defaultValue,
  disabled
}: {
  defaultValue: string;
  disabled: boolean;
}) {
  const fieldId = useId();
  const helpId = useId();
  const [value, setValue] = useState(defaultValue.toUpperCase());
  const pickerValue = hexColorPattern.test(value)
    ? value
    : canonicalFallback;

  return (
    <div className="field">
      <label htmlFor={fieldId}>Primaire kleur</label>
      <div className="settings-color-field">
        <input
          aria-label="Primaire kleur kiezen"
          disabled={disabled}
          onChange={(event) => setValue(event.currentTarget.value.toUpperCase())}
          type="color"
          value={pickerValue}
        />
        <input
          aria-describedby={helpId}
          autoComplete="off"
          disabled={disabled}
          id={fieldId}
          maxLength={7}
          name="primaryColor"
          onChange={(event) => setValue(event.currentTarget.value.toUpperCase())}
          pattern="^#[0-9A-Fa-f]{6}$"
          required
          spellCheck={false}
          type="text"
          value={value}
        />
      </div>
      <span className="work-panel__meta" id={helpId}>
        Gebruik een hexkleur zoals #315CFF voor merkmetadata en oudere
        templates. De FieldFlow-slidekleuren beheer je hierboven tenantbreed.
      </span>
    </div>
  );
}
