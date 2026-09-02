"use client";

import { ArrowRight, CheckCircle2 } from "lucide-react";
import { useState } from "react";

import type { SelectableThemeId } from "@veyocast/contracts";
import { themeCatalog } from "@veyocast/content-templates/theme-catalog";

export function FieldFlowStyleStep({
  disabled = false,
  label = "FieldFlow-stijl",
  legacySelected = false,
  onActivate,
  value
}: {
  disabled?: boolean;
  label?: string;
  legacySelected?: boolean;
  onActivate: () => void;
  value: SelectableThemeId;
}) {
  const historical = legacySelected || value !== "fieldflow";
  const historicalLabel = legacySelected
    ? "Editorial Arena · historische versie"
    : `${themeCatalog[value].name} · historisch`;
  const fieldflow = themeCatalog.fieldflow;

  return (
    <section aria-label={label} className="vc-fieldflow-style">
      <h3>{label}</h3>
      {historical ? (
        <aside className="vc-fieldflow-style__history">
          <strong>{historicalLabel}</strong>
          <p>
            De bestaande versie blijft ongewijzigd renderbaar. Een nieuwe of
            gewijzigde versie gebruikt uitsluitend FieldFlow.
          </p>
        </aside>
      ) : null}
      <div
        className="vc-fieldflow-style__card"
        style={{
          "--theme-accent": fieldflow.accentDefault,
          "--theme-canvas": fieldflow.light.canvas,
          "--theme-line": fieldflow.light.line,
          "--theme-surface": fieldflow.light.surface,
          "--theme-text": fieldflow.light.text
        } as React.CSSProperties}
      >
        <span aria-hidden="true" className="vc-fieldflow-style__preview">
          <span>VEYOCAST</span><strong>FieldFlow</strong><i /><i /><i />
        </span>
        <span className="vc-fieldflow-style__copy">
          <strong>FieldFlow</strong>
          <small>
            {historical
              ? "Activeer voor deze nieuwe versie"
              : "Vaste premium stijl voor nieuwe inhoud"}
          </small>
        </span>
        {historical ? (
          <button disabled={disabled} onClick={onActivate} type="button">
            FieldFlow gebruiken <ArrowRight aria-hidden="true" />
          </button>
        ) : <CheckCircle2 aria-label="FieldFlow actief" />}
      </div>
      <style>{`.vc-fieldflow-style{display:grid;gap:.7rem;min-width:0}.vc-fieldflow-style h3,.vc-fieldflow-style p{margin:0}.vc-fieldflow-style__history{padding:.75rem;border:1px solid var(--warning-border,var(--border));border-radius:var(--radius-lg);background:var(--warning-soft,var(--surface-subtle))}.vc-fieldflow-style__history p{margin-top:.3rem;color:var(--muted-foreground);font-size:.82rem;line-height:1.45}.vc-fieldflow-style__card{display:grid;grid-template-columns:64px minmax(0,1fr) auto;align-items:center;gap:.85rem;min-height:92px;padding:.8rem;border:1px solid var(--primary);border-radius:var(--radius-lg);background:var(--surface);box-shadow:var(--shadow-sm)}.vc-fieldflow-style__preview{display:grid;align-content:start;gap:3px;box-sizing:border-box;width:64px;height:64px;padding:7px;overflow:hidden;border:1px solid var(--theme-line);border-radius:8px;background:var(--theme-canvas);color:var(--theme-text)}.vc-fieldflow-style__preview span{padding-left:3px;border-left:2px solid var(--theme-accent);font-size:5px;font-weight:800}.vc-fieldflow-style__preview strong{font-size:8px;line-height:1}.vc-fieldflow-style__preview i{display:block;height:5px;border-left:2px solid var(--theme-accent);background:var(--theme-surface)}.vc-fieldflow-style__copy{display:grid;gap:.2rem;min-width:0}.vc-fieldflow-style__copy small{color:var(--muted-foreground);font-size:.78rem;line-height:1.35}.vc-fieldflow-style__card>button{display:inline-flex;align-items:center;gap:.4rem;min-height:44px;padding:.55rem .7rem;border:0;border-radius:var(--radius-md);background:var(--primary);color:var(--primary-foreground);font-weight:750}.vc-fieldflow-style__card>button svg,.vc-fieldflow-style__card>svg{width:18px}.vc-fieldflow-style__card>svg{color:var(--success)}@media(max-width:640px){.vc-fieldflow-style__card{grid-template-columns:56px minmax(0,1fr)}.vc-fieldflow-style__card>button{grid-column:1/-1;justify-content:center}}`}</style>
    </section>
  );
}

export function FieldFlowStyleField({
  disabled,
  initialThemeId,
  label = "FieldFlow-stijl",
  name = "themeId"
}: {
  disabled?: boolean;
  initialThemeId: SelectableThemeId;
  label?: string;
  name?: string;
}) {
  const [themeId, setThemeId] = useState<SelectableThemeId>(
    initialThemeId === "fieldflow" ? initialThemeId : "fieldflow"
  );
  return (
    <>
      <input name={name} type="hidden" value={themeId} />
      <FieldFlowStyleStep
        disabled={disabled}
        label={label}
        onActivate={() => setThemeId("fieldflow")}
        value={themeId}
      />
    </>
  );
}
