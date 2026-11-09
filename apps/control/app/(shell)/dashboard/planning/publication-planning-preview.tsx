"use client";

import { useState, useTransition } from "react";
import { Button } from "@veyocast/ui";
import { previewDefaultPublication } from "./effective-planning-actions";
import type { PlanningPreviewResult } from "./effective-planning";
import { EffectivePlanningView } from "./effective-planning-view";

export function PublicationPlanningPreview({ screenIds, playlistId }: { screenIds: string[]; playlistId: string }) {
  const [pending, startTransition] = useTransition();
  const [checked, setChecked] = useState<{ key: string; result: PlanningPreviewResult } | null>(null);
  const key = JSON.stringify([playlistId, [...screenIds].sort()]);
  const result = checked?.key === key ? checked.result : null;
  return <section aria-labelledby="publication-planning-title" className="workspace-section">
    <h2 className="workspace-section__title" id="publication-planning-title">Gevolg voor de planning</h2>
    <p>Deze publicatie wordt de standaardinhoud op de gekozen schermen. Een geldende planning of tijdelijke overname houdt haar voorrang. Controleer wanneer het concept volgens de planning in beeld kan komen.</p>
    <p>De vooruitblik beoordeelt de planning. Afspeelcapaciteiten en publiceerbaarheid worden door de bestaande publicatiecontrole beoordeeld.</p>
    <Button disabled={pending || !screenIds.length || screenIds.length > 50} type="button" variant="secondary"
      onClick={() => startTransition(async () => {
        try { setChecked({ key, result: await previewDefaultPublication({ screenIds, playlistId }) }); }
        catch { setChecked({ key, result: { report: null, error: "De vooruitblik kon niet worden opgehaald. Probeer opnieuw; er is niets gepubliceerd." } }); }
      })}>{pending ? "Planning controleren…" : "Nu, Hierna en Waarom controleren"}</Button>
    {screenIds.length > 50 ? <p>Controleer maximaal vijftig schermen tegelijk.</p> : null}
    {result?.error ? <p className="notice notice--critical" role="alert">{result.error}</p> : null}
    {result?.report ? <EffectivePlanningView report={result.report}/> : null}
  </section>;
}
