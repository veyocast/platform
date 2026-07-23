"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@veyocast/ui";

export function SettingsDirtySavebar({ disabled }: { disabled: boolean }) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const dirtyRef = useRef(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const form = anchorRef.current?.closest("form");
    if (!form || disabled) return;

    const initial = serializeForm(form);
    const update = () => {
      dirtyRef.current = serializeForm(form) !== initial;
      setDirty(dirtyRef.current);
    };
    const reset = () => {
      dirtyRef.current = false;
      setDirty(false);
    };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      event.preventDefault();
    };

    form.addEventListener("change", update);
    form.addEventListener("input", update);
    form.addEventListener("reset", reset);
    form.addEventListener("submit", reset);
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      form.removeEventListener("change", update);
      form.removeEventListener("input", update);
      form.removeEventListener("reset", reset);
      form.removeEventListener("submit", reset);
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, [disabled]);

  return (
    <div
      aria-hidden={!dirty}
      className="settings-savebar"
      data-visible={dirty || undefined}
      ref={anchorRef}
    >
      <div>
        <strong>Niet-opgeslagen wijzigingen</strong>
        <p>Controleer de actieve categorie en sla alle instellingen in één keer op.</p>
      </div>
      <Button disabled={disabled || !dirty} type="submit">
        Instellingen opslaan
      </Button>
    </div>
  );
}

function serializeForm(form: HTMLFormElement) {
  return JSON.stringify(
    [...new FormData(form).entries()]
      .map(([name, value]) => [name, typeof value === "string" ? value : value.name])
      .sort(([a], [b]) => String(a).localeCompare(String(b)))
  );
}
