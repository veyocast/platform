"use client";
import { useEffect, useState } from "react";
import { buildSitesPresentationFromDynamicPayload, resolveSitesDynamicAsset } from "@veyocast/content-templates/sites-dynamic-projector";
import { SitesStaticView } from "@veyocast/content-templates/sites-static-view";
import type { PlayerDynamicTemplatePayload, SportlinkSlideDraft } from "@veyocast/contracts";
import { previewSitesSportlinkDraft } from "./sites-sportlink-preview-action";
export function SitesSportlinkDraftPreview({ draft, sourceId }: { draft: SportlinkSlideDraft | null; sourceId: string }) {
  const request = draft ? JSON.stringify(draft) : "";
  const [result, setResult] = useState<{ request: string; sourceId: string; payload: PlayerDynamicTemplatePayload | null; message: string } | null>(null);
  useEffect(() => {
    if (!request || !sourceId) return;
    let active = true;
    const timer = window.setTimeout(async () => {
      try {
        const response = await previewSitesSportlinkDraft(sourceId, JSON.parse(request));
        if (active) setResult({ request, sourceId, payload: response.ok ? response.payload : null, message: response.ok ? "" : response.message });
      } catch {
        if (active) setResult({ request, sourceId, payload: null, message: "Het schermvoorbeeld is tijdelijk niet bereikbaar. Je ontwerp blijft behouden. Probeer opnieuw." });
      }
    }, 350);
    return () => { active = false; window.clearTimeout(timer); };
  }, [request, sourceId]);
  if (!draft) return <p>Kies je inhoud en teams om het schermvoorbeeld te bekijken.</p>;
  if (!result || result.request !== request || result.sourceId !== sourceId) return <p role="status">Schermvoorbeeld uit je opgeslagen bron laden…</p>;
  const presentation = result.payload ? buildSitesPresentationFromDynamicPayload(result.payload, draft.sitesConfiguration) : null;
  return presentation && result.payload ? <><SitesStaticView presentation={presentation} resolveAsset={ref => resolveSitesDynamicAsset(result.payload!, ref)} />{presentation.kind === "dynamic" && !presentation.content.rows.length && <p role="status">Er zijn nog geen opgeslagen gegevens voor deze selectie. Controleer de bronstatus of kies een andere selectie.</p>}</> : <p role="status">{result.message || "Er zijn nog geen gegevens voor deze selectie. Controleer de bronstatus of kies een andere selectie."}</p>;
}
