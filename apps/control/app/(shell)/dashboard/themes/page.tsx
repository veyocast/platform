import Link from "next/link";
import { Palette } from "lucide-react";

import { Button, StatusPill } from "@veyocast/ui";

import { requireControlSession } from "../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../lib/supabase/server";
import { PageHeader } from "../../_components/shell-primitives";

export default async function ThemesPage() {
  const session = await requireControlSession();
  const profile = await loadProfile(session.tenantId, session.isLive);
  return (
    <>
      <PageHeader
        description="Beheer de visuele systemen van dynamische slides per theme."
        eyebrow={session.tenant}
        title="Thema's"
      />
      <section className="data-surface resource-table-shell" aria-labelledby="themes-title">
        <div className="work-panel__header">
          <div>
            <p className="section-kicker">Slidepresentatie</p>
            <h2 className="work-panel__title" id="themes-title">Beschikbare thema's</h2>
            <p className="work-panel__meta">
              Kleuren, typografie en logo-oppervlakken horen bij het theme en
              staan los van algemene verenigingsinstellingen.
            </p>
          </div>
        </div>
        <div className="data-table-wrap">
          <table className="data-table data-table--responsive">
            <thead><tr><th>Thema</th><th>Status</th><th>Versie</th><th>Bijgewerkt op</th><th><span className="sr-only">Acties</span></th></tr></thead>
            <tbody>
              <tr>
                <td data-label="Thema"><span className="resource-name"><Palette aria-hidden="true" /><strong>Royal Current · Navy Glass</strong></span></td>
                <td data-label="Status"><StatusPill label="Actief" tone="success" /></td>
                <td data-label="Versie">1.0.0 · revisie {profile.revision}</td>
                <td data-label="Bijgewerkt op">{formatDate(profile.updatedAt)}</td>
                <td data-label="Acties"><Button asChild size="sm" variant="secondary"><Link href="/dashboard/themes/fieldflow">Bewerken</Link></Button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

async function loadProfile(tenantId: string | null, isLive: boolean) {
  if (!tenantId || !isLive) return { revision: 0, updatedAt: null };
  const supabase = await createControlSupabaseClient();
  if (!supabase) return { revision: 0, updatedAt: null };
  const { data } = await supabase
    .from("tenant_theme_profiles")
    .select("revision,updated_at")
    .eq("tenant_id", tenantId)
    .eq("theme_id", "fieldflow")
    .maybeSingle();
  return {
    revision: Number(data?.revision ?? 0),
    updatedAt: data?.updated_at ?? null
  };
}

function formatDate(value: string | null) {
  if (!value) return "Nog niet gewijzigd";
  return new Intl.DateTimeFormat("nl-NL", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}
