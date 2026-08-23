import { CheckCircle2, Clock3, History } from "lucide-react";

import { Button } from "@veyocast/ui";

import { createOrResumeDynamicSlideVersion } from "./version-actions";

export type DynamicSlideVersionSummary = {
  createdAt: string;
  id: string;
  isCurrent: boolean;
  publishedAt: string | null;
  status: "archived" | "draft" | "published" | "publishing";
  versionNumber: number;
};

export function VersionHistory({
  canWrite,
  editor,
  slideId,
  versions
}: {
  canWrite: boolean;
  editor: "menu" | "sportlink";
  slideId: string;
  versions: DynamicSlideVersionSummary[];
}) {
  const hasOpenDraft = versions.some((version) =>
    version.status === "draft" || version.status === "publishing"
  );
  return (
    <section aria-labelledby="version-history-title" className="data-surface vc-version-history">
      <div className="work-panel__header">
        <div>
          <h2 className="work-panel__title" id="version-history-title"><History aria-hidden="true" /> Versiegeschiedenis</h2>
          <p className="work-panel__meta">Oude versies blijven onveranderlijk en staan niet als losse slides in de bibliotheek.</p>
        </div>
      </div>
      <ol>
        {versions.map((version) => (
          <li key={version.id}>
            <span className="vc-version-history__number">v{version.versionNumber}</span>
            <span className="vc-version-history__state">
              {version.isCurrent ? <><CheckCircle2 aria-hidden="true" /> Huidig</> : version.status === "draft" ? <><Clock3 aria-hidden="true" /> Concept</> : version.status === "publishing" ? <><Clock3 aria-hidden="true" /> Publiceren</> : "Historisch"}
            </span>
            <time dateTime={version.publishedAt ?? version.createdAt}>{formatDate(version.publishedAt ?? version.createdAt)}</time>
            {canWrite && !hasOpenDraft && !version.isCurrent && version.status === "published" ? (
              <form action={createOrResumeDynamicSlideVersion}>
                <input name="basisVersionId" type="hidden" value={version.id} />
                <input name="editor" type="hidden" value={editor} />
                <input name="slideId" type="hidden" value={slideId} />
                <Button size="sm" type="submit" variant="ghost">Gebruik als basis</Button>
              </form>
            ) : null}
          </li>
        ))}
      </ol>
      <style>{`.vc-version-history ol{display:grid;gap:.25rem;margin:0;padding:0;list-style:none}.vc-version-history li{display:grid;grid-template-columns:3rem minmax(7rem,1fr) minmax(10rem,auto) auto;align-items:center;gap:.75rem;min-height:48px;padding:.5rem .75rem;border-top:1px solid var(--border)}.vc-version-history__number{font-weight:800;font-variant-numeric:tabular-nums}.vc-version-history__state{display:flex;align-items:center;gap:.4rem}.vc-version-history__state svg{width:16px;color:var(--success)}.vc-version-history time{color:var(--muted-foreground);font-size:.875rem}@media(max-width:680px){.vc-version-history li{grid-template-columns:3rem 1fr}.vc-version-history time,.vc-version-history form{grid-column:2}}`}</style>
    </section>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("nl-NL", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}
