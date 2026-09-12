"use client";

import { useId } from "react";
import { Button } from "@veyocast/ui";
import styles from "./goal-overlay.module.css";

export const isGoalColor = (value: string | null) => value === null || /^#[0-9a-f]{6}$/i.test(value);

/** Native color inputs need opaque hex; the automatic preview retains its theme RGBA. */
function pickerColor(value: string) {
  if (/^#[0-9a-f]{6}$/i.test(value)) return value;
  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(value);
  return rgb ? `#${rgb.slice(1).map((channel) => Math.min(255, Number(channel)).toString(16).padStart(2, "0")).join("")}` : "#FFFFFF";
}

export function GoalColorField({ label, value, automatic, onChange }: {
  label: string;
  value: string | null;
  automatic: string;
  onChange: (value: string | null) => void;
}) {
  const id = useId();
  const invalid = !isGoalColor(value);
  return <div className={styles.colorField}>
    <label htmlFor={id}>{label}</label>
    <div className={styles.colorControls}>
      <input type="color" aria-label={`${label} kiezen`} value={pickerColor(value && !invalid ? value : automatic)}
        onChange={(event) => onChange(event.target.value.toUpperCase())} />
      <input id={id} type="text" aria-describedby={`${id}-help`} aria-invalid={invalid}
        value={value ?? ""} placeholder={pickerColor(automatic).toUpperCase()} maxLength={7}
        pattern="#[0-9a-fA-F]{6}" autoComplete="off" autoCapitalize="characters" spellCheck={false}
        onChange={(event) => onChange(event.target.value.toUpperCase() || null)} />
    </div>
    <div className={styles.colorHelp}>
      <span id={`${id}-help`}>{invalid ? "Gebruik # met zes kleurtekens, bijvoorbeeld #2459ED." : value === null ? "Automatisch · volgt de clubstijl" : "Eigen kleur"}</span>
      {value !== null ? <Button type="button" size="sm" variant="ghost" aria-label={`${label} automatisch`} onClick={() => onChange(null)}>Automatisch</Button> : null}
    </div>
  </div>;
}
