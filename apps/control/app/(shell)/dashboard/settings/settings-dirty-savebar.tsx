"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@veyocast/ui";

export function SettingsDirtySavebar({
  disabled,
  validationFieldName
}: {
  disabled: boolean;
  validationFieldName?: string;
}) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const dirtyRef = useRef(false);
  const [dirty, setDirty] = useState(false);
  const [ready, setReady] = useState(true);

  useEffect(() => {
    const form = anchorRef.current?.closest("form");
    if (!form || disabled) return;

    const initial = serializeForm(form);
    let active = true;
    const validate = () => {
      const readiness = validationFieldName
        ? form.elements.namedItem(validationFieldName)
        : null;
      const paletteReady = !(readiness instanceof HTMLInputElement) ||
        readiness.value !== "blocked";
      const nextReady = paletteReady && form.checkValidity();
      setReady(nextReady);
      return nextReady;
    };
    const update = () => {
      dirtyRef.current = serializeForm(form) !== initial;
      setDirty(dirtyRef.current);
      validate();
    };
    const scheduleUpdate = () => {
      queueMicrotask(() => {
        if (active) update();
      });
    };
    const scheduleClickUpdate = (event: MouseEvent) => {
      const button = event.target instanceof Element
        ? event.target.closest("button")
        : null;
      if (button instanceof HTMLButtonElement && button.type === "submit") return;
      scheduleUpdate();
    };
    const reset = () => {
      dirtyRef.current = false;
      setDirty(false);
      queueMicrotask(validate);
    };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      event.preventDefault();
    };

    form.addEventListener("change", scheduleUpdate);
    form.addEventListener("click", scheduleClickUpdate);
    form.addEventListener("input", scheduleUpdate);
    form.addEventListener("reset", reset);
    form.addEventListener("submit", reset);
    window.addEventListener("beforeunload", beforeUnload);
    validate();
    return () => {
      active = false;
      form.removeEventListener("change", scheduleUpdate);
      form.removeEventListener("click", scheduleClickUpdate);
      form.removeEventListener("input", scheduleUpdate);
      form.removeEventListener("reset", reset);
      form.removeEventListener("submit", reset);
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, [disabled, validationFieldName]);

  return (
    <div
      aria-hidden={!dirty}
      className="settings-savebar"
      data-visible={dirty || undefined}
      ref={anchorRef}
    >
      <div>
        <strong>Niet-opgeslagen wijzigingen</strong>
        <p>
          {ready
            ? "Controleer de actieve categorie en sla alle instellingen in één keer op."
            : "Herstel eerst de gemarkeerde kleurwaarde of contrastcombinatie."}
        </p>
      </div>
      <Button disabled={disabled || !dirty || !ready} type="submit">
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
