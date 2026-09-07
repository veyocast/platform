"use client";

import { useId } from "react";

import type { SportlinkMatchLocation } from "@veyocast/contracts";

import styles from "./sportlink-match-location-field.module.css";

const options = [
  {
    description: "Toon iedere wedstrijd waarin een gekozen eigen team speelt.",
    label: "Thuis en uit",
    value: "both"
  },
  {
    description: "Toon alleen wedstrijden met een gekozen eigen team als thuisteam.",
    label: "Alleen thuis",
    value: "home"
  },
  {
    description: "Toon alleen wedstrijden met een gekozen eigen team als uitteam.",
    label: "Alleen uit",
    value: "away"
  }
] as const satisfies ReadonlyArray<{
  description: string;
  label: string;
  value: SportlinkMatchLocation;
}>;

export function SportlinkMatchLocationField({
  onChange,
  value
}: {
  onChange: (value: SportlinkMatchLocation) => void;
  value: SportlinkMatchLocation;
}) {
  const groupName = useId();
  return (
    <fieldset className={styles.fieldset}>
      <legend>Wedstrijden tonen</legend>
      <p>
        De richting wordt bepaald vanuit het gekozen eigen team, nooit vanuit
        een tegenstander uit dezelfde poule.
      </p>
      <div>
        {options.map((option) => (
          <label data-selected={value === option.value} key={option.value}>
            <input
              checked={value === option.value}
              name={groupName}
              onChange={() => onChange(option.value)}
              type="radio"
              value={option.value}
            />
            <span>
              <strong>{option.label}</strong>
              <small>{option.description}</small>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
