"use client";

import { useState, useTransition } from "react";
import { Button } from "@veyocast/ui";
import { previewScheduleProposal } from "./effective-planning-actions";
import type { PlanningPreviewResult } from "./effective-planning";
import { EffectivePlanningView } from "./effective-planning-view";

export function ScheduleOutcomePreview({ readForm }: { readForm: () => FormData | null }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<PlanningPreviewResult | null>(null);
  return <section aria-label="Uitkomst van het concept">
    <p>Bekijk bij de start van dit moment welke planning werkelijk wint en wanneer de gewone programmering hervat.</p>
    <Button disabled={pending} type="button" variant="secondary" onClick={() => startTransition(async () => {
      const values = readForm();
      if (!values) return;
      try { setResult(await previewScheduleProposal(values)); }
      catch { setResult({ report: null, error: "De vooruitblik kon niet worden opgehaald. Probeer opnieuw; er is niets opgeslagen." }); }
    })}>{pending ? "Uitkomst controleren…" : "Nu, Hierna en Waarom van dit concept"}</Button>
    {result?.error ? <p className="notice notice--critical" role="alert">{result.error}</p> : null}
    {result?.report ? <EffectivePlanningView report={result.report}/> : null}
  </section>;
}
