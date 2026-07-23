import Link from "next/link";

import { Button, SummaryStrip } from "@veyocast/ui";

import { requireTenantControlSession } from "../../../../lib/control-session";
import { PageHeader, StatusPill } from "../../_components/shell-primitives";
import { loadReleaseCenter } from "./data";

type ReleaseCenterPageProps = {
  searchParams: Promise<{ fout?: string }>;
};

export default async function ReleaseCenterPage({ searchParams }: ReleaseCenterPageProps) {
  const session = await requireTenantControlSession("tenant.release.read");
  const query = await searchParams;
  const data = session.isLive && session.tenantId
    ? await loadReleaseCenter(session.tenantId)
    : { error: null, releases: [] };
  const active = data.releases.filter((release) => release.currentScreenCount > 0).length;
  const bytes = data.releases.reduce((total, release) => total + release.totalBytes, 0);

  return <>
    <PageHeader
      actions={<Button asChild variant="secondary"><Link href="/dashboard/playlists">Naar playlists</Link></Button>}
      description="Bekijk immutable publicatiehistorie, verschillen, impact en de actuele uitrol per scherm."
      eyebrow={`${session.tenant} · Distributie`}
      status={!session.isLive ? { label: "Demomodus", tone: "warning" } : undefined}
      title="Release Center"
    />
    {query.fout ? <p className="notice notice--critical" role="alert"><strong>Release Center niet geladen.</strong> {query.fout}</p> : null}
    {data.error ? <p className="notice notice--critical" role="alert"><strong>Releasehistorie niet beschikbaar.</strong> {data.error}</p> : null}
    {!session.isLive ? <p className="notice notice--warning" role="status">Configureer Supabase en log in om echte releasehistorie en schermuitrol te bekijken.</p> : null}

    <SummaryStrip
      aria-label="Releaseoverzicht"
      items={[
        { detail: "Immutable versies", label: "Releases", value: data.releases.length },
        {
          detail: "Nu aan minimaal één scherm toegewezen",
          label: "Huidig toegewezen",
          tone: active ? "success" : "neutral",
          value: active
        },
        { detail: "Historische releasebestanden", label: "Omvang", value: formatBytes(bytes) }
      ]}
    />

    <section className="workspace-section" aria-labelledby="release-list-title">
      <div className="workspace-section__header"><div><h2 className="workspace-section__title" id="release-list-title">Immutable historie</h2><p className="work-panel__meta">Een rollback is altijd een nieuwe toewijzing van een bestaande release; historie wordt nooit gemuteerd.</p></div><StatusPill label={`${data.releases.length} versies`} tone="neutral" /></div>
      {data.releases.length ? <div className="data-table-frame"><table className="data-table data-table--responsive">
        <caption>Immutable releases binnen de actieve vereniging.</caption>
        <thead><tr><th scope="col">Release</th><th scope="col">Publicatie</th><th scope="col">Inhoud</th><th scope="col">Hashstatus</th><th scope="col">Doelschermen</th><th scope="col">Actie</th></tr></thead>
        <tbody>{data.releases.map((release) => <tr key={release.id}>
          <td data-label="Release"><span className="table-primary">{release.playlistName} · versie {release.version}</span><span className="table-secondary">{release.notes || "Geen releasenotitie"}</span></td>
          <td data-label="Publicatie"><span className="table-primary">{formatDate(release.publishedAt)}</span><span className="table-secondary">door {release.publishedBy}</span></td>
          <td data-label="Inhoud">{release.itemCount} items · {formatDuration(release.totalDurationSeconds)} · {formatBytes(release.totalBytes)}</td>
          <td data-label="Hashstatus"><StatusPill label={/^[a-f0-9]{64}$/.test(release.manifestHash) ? "SHA-256 vastgelegd" : "Hash ongeldig"} tone={/^[a-f0-9]{64}$/.test(release.manifestHash) ? "success" : "critical"} /></td>
          <td data-label="Doelschermen"><span className="table-primary">{release.currentScreenCount} huidig</span><span className="table-secondary">{release.deploymentTargetCount} historisch uniek</span></td>
          <td data-label="Actie"><Link className="table-action" href={`/dashboard/releases/${release.id}`}>Open release</Link></td>
        </tr>)}</tbody>
      </table></div> : <div className="empty-state" role="status"><h2>Nog geen releases</h2><p>Publiceer eerst een gereed concept via de begeleide publicatieflow.</p><Button asChild><Link href="/dashboard/playlists">Playlist kiezen</Link></Button></div>}
    </section>
  </>;
}

function formatDate(value: string) { return new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
function formatDuration(seconds: number) { const minutes = Math.floor(seconds / 60); return `${minutes} min ${seconds % 60} sec`; }
function formatBytes(bytes: number) { if (!bytes) return "0 MB"; return bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(1)} GB` : `${(bytes / 1024 ** 2).toFixed(1)} MB`; }
