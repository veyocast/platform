import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";

import { hasCapability } from "@veyocast/auth";
import { compareReleaseItems, type ReleasePreflightReasonCode } from "@veyocast/domain";
import { SummaryStrip } from "@veyocast/ui";

import { requireTenantControlSession } from "../../../../../lib/control-session";
import { formatTenantDateTime } from "../../../../../lib/tenant-time";
import { PageHeader, StatusPill } from "../../../_components/shell-primitives";
import { reassignRelease, restoreReleaseToDraft } from "../actions";
import { loadReleaseDetail } from "../data";

type ReleaseDetailPageProps = {
  params: Promise<{ releaseId: string }>;
  searchParams: Promise<{ compare?: string; fout?: string; succes?: string }>;
};

export default async function ReleaseDetailPage({ params, searchParams }: ReleaseDetailPageProps) {
  const session = await requireTenantControlSession("tenant.release.read");
  const { releaseId } = await params;
  const query = await searchParams;
  const data = session.isLive && session.tenantId ? await loadReleaseDetail(session.tenantId, releaseId) : null;
  if (session.isLive && !data?.release && !data?.error) notFound();
  const release = data?.release ?? null;
  const comparisonId = query.compare && data?.comparisonReleases.some((candidate) => candidate.id === query.compare) ? query.compare : null;
  const comparisonData = comparisonId && session.tenantId ? await loadReleaseDetail(session.tenantId, comparisonId) : null;
  const comparison = comparisonData?.release?.playlistId === release?.playlistId
    ? compareReleaseItems(comparisonData?.items ?? [], data?.items ?? [])
    : null;
  const canReassign = Boolean(session.isLive && session.tenantStatus === "active" && hasCapability(session.capabilities, "tenant.playlist.publish"));
  const canRestore = Boolean(session.isLive && session.tenantStatus === "active" && hasCapability(session.capabilities, "tenant.playlist.publish"));
  const currentScreens = data?.screenStates.filter((state) => state.screen.assignedReleaseId === releaseId) ?? [];

  return <>
    <Link className="breadcrumb-link" href="/dashboard/releases">← Terug naar Release Center</Link>
    <PageHeader
      actions={release ? <div className="page-action-group"><Link className="button-link button-link--secondary" href={`/dashboard/playlists/${release.playlistId}`}>Open playlist</Link><a className="button-link button-link--primary" href="#opnieuw-toewijzen">Opnieuw toewijzen</a></div> : null}
      description={release ? `${release.itemCount} items · ${formatBytes(release.totalBytes)} · gepubliceerd door ${release.publishedBy} op ${formatDate(release.publishedAt)}.` : "De release kon niet worden geladen."}
      eyebrow={`${session.tenant} · Immutable release`}
      status={{ label: currentScreens.length ? `${currentScreens.length} huidig toegewezen` : "Historische release", tone: currentScreens.length ? "success" : "neutral" }}
      title={release ? `${release.playlistName} · versie ${release.version}` : "Releasedetail"}
    />
    {query.fout ? <p className="notice notice--critical" role="alert"><strong>Actie niet uitgevoerd.</strong> {query.fout}</p> : null}
    {query.succes ? <p className="notice notice--success" role="status">{query.succes}</p> : null}
    {data?.error ? <p className="notice notice--critical" role="alert"><strong>Releasedetails onvolledig.</strong> {data.error}</p> : null}

    {release && data ? <>
      <SummaryStrip
        aria-label="Releasefeiten"
        items={[
          { detail: "Immutable SHA-256", label: "Manifesthash", value: `${release.manifestHash.slice(0, 12)}…` },
          { detail: `${release.itemCount} items`, label: "Totale duur", value: formatDuration(release.totalDurationSeconds) },
          { detail: "Huidig toegewezen / alle schermen", label: "Uitrol", value: `${currentScreens.length}/${data.screenStates.length}` }
        ]}
      />

      <section className="workspace-section" aria-labelledby="sync-title">
        <div className="workspace-section__header"><div><h2 className="workspace-section__title" id="sync-title">Uitrol per scherm</h2><p className="work-panel__meta">Desired, downloaden, verifiëren en actief worden afzonderlijk getoond. Onbekend blijft onbekend.</p></div><StatusPill label="Live telemetry" tone="info" /></div>
        <div className="data-table-frame"><table className="data-table data-table--responsive"><caption>Preflight en synchronisatiefase per scherm.</caption><thead><tr><th scope="col">Scherm</th><th scope="col">Toewijzing</th><th scope="col">Voortgang</th><th scope="col">Preflight</th><th scope="col">Ontbrekend</th><th scope="col">Heartbeat</th></tr></thead><tbody>{data.screenStates.map((state) => <tr key={state.screen.id}>
          <td data-label="Scherm"><span className="table-primary">{state.screen.name}</span><span className="table-secondary">{state.screen.location || "Geen locatie"} · {state.screen.status}</span></td>
          <td data-label="Toewijzing"><StatusPill label={state.screen.assignedReleaseId === releaseId ? "Huidig gewenst" : "Niet toegewezen"} tone={state.screen.assignedReleaseId === releaseId ? "success" : "neutral"} /></td>
          <td data-label="Voortgang"><StatusPill {...progressStatus(state.activeReleaseId, state.desiredReleaseId ?? state.screen.assignedReleaseId, state.latestPhase, releaseId)} /></td>
          <td data-label="Preflight"><StatusPill {...preflightStatus(state.preflight.status)} /><span className="table-secondary">{state.preflight.reasons.map(reasonLabel).join(" · ") || "Alle controles groen"}</span></td>
          <td data-label="Ontbrekend">{state.preflight.missingBytes === null ? "Onbekend" : formatBytes(state.preflight.missingBytes)}</td>
          <td data-label="Heartbeat">{state.heartbeatAt ? formatDate(state.heartbeatAt) : "Nooit ontvangen"}</td>
        </tr>)}</tbody></table></div>
      </section>

      <section className="workspace-section" aria-labelledby="impact-title">
        <div className="workspace-section__header"><div><h2 className="workspace-section__title" id="impact-title">Impactketen</h2><p className="work-panel__meta">Assets blijven via playlist en immutable release herleidbaar naar elk doelscherm.</p></div><StatusPill label={`${data.items.length} assets`} tone="neutral" /></div>
        <ol className="impact-chain"><li><strong>Assets</strong><span>{data.items.map((item) => item.assetTitle).join(", ")}</span></li><li><strong>Playlist</strong><span>{release.playlistName}</span></li><li><strong>Release</strong><span>Versie {release.version} · {release.manifestHash.slice(0, 12)}…</span></li><li><strong>Schermen</strong><span>{data.assignments.length ? data.assignments.map((assignment) => assignment.screenName).join(", ") : "Nog geen historische targets"}</span></li></ol>
      </section>

      <section className="workspace-section" aria-labelledby="compare-title">
        <div className="workspace-section__header"><div><h2 className="workspace-section__title" id="compare-title">Versies vergelijken</h2><p className="work-panel__meta">Toegevoegd, verwijderd, verplaatst en inhoudelijk gewijzigd worden afzonderlijk berekend op stabiele item-ID’s en hashes.</p></div></div>
        <form className="resource-toolbar" method="get"><label className="toolbar-field"><span>Vergelijk met</span><select defaultValue={comparisonId ?? ""} name="compare"><option value="">Kies een versie</option>{data.comparisonReleases.filter((candidate) => candidate.id !== releaseId).map((candidate) => <option key={candidate.id} value={candidate.id}>Versie {candidate.version}</option>)}</select></label><button className="button-link button-link--secondary" type="submit">Vergelijken</button></form>
        {comparison ? <div className="release-diff-grid"><DiffCard label="Toegevoegd" items={comparison.added.map((item) => item.assetTitle)} /><DiffCard label="Verwijderd" items={comparison.removed.map((item) => item.assetTitle)} /><DiffCard label="Verplaatst" items={comparison.moved.map((item) => `${item.after.assetTitle}: ${item.from + 1} → ${item.to + 1}`)} /><DiffCard label="Gewijzigd" items={comparison.changed.map((item) => `${item.after.assetTitle}: ${item.fields.map(changeLabel).join(", ")}`)} /><article className="work-panel"><h3>Netto impact</h3><p>{signedDuration(comparison.durationDeltaSeconds)} · {signedBytes(comparison.bytesDelta)}</p></article></div> : <p className="notice" role="status">Kies een andere versie van deze playlist om het exacte verschil te zien.</p>}
      </section>

      <section className="publish-workspace" id="opnieuw-toewijzen" aria-labelledby="reassign-title">
        <div className="workspace-section__header"><div><h2 className="workspace-section__title" id="reassign-title">Bestaande release opnieuw toewijzen</h2><p className="work-panel__meta">Dit is een veilige rollbackassignment: de release, items, hash en historie blijven volledig ongewijzigd.</p></div><StatusPill label="Append-only" tone="success" /></div>
        <form action={reassignRelease} className="playlist-form"><input name="releaseId" type="hidden" value={releaseId} /><input name="idempotencyKey" type="hidden" value={randomUUID()} /><fieldset className="checkbox-fieldset"><legend>Beschikbare doelschermen</legend>{data.screenStates.filter((state) => state.screen.status !== "disabled").map((state) => <label className="check-row" key={state.screen.id}><input disabled={!canReassign || state.preflight.status === "blocked"} name="screenIds" type="checkbox" value={state.screen.id} /><span><strong>{state.screen.name}</strong><span className="work-panel__meta">{preflightStatus(state.preflight.status).label} · {state.preflight.missingBytes === null ? "ontbrekende bytes onbekend" : `${formatBytes(state.preflight.missingBytes)} ontbreekt`}</span></span></label>)}</fieldset><label className="check-row"><input disabled={!canReassign} name="confirmRisk" type="checkbox" /><span><strong>Waarschuwingen en onbekende telemetry zijn bewust beoordeeld</strong><span className="work-panel__meta">Verplicht zodra een gekozen scherm niet volledig als gereed kan worden bewezen.</span></span></label><label className="check-row"><input disabled={!canReassign} name="confirmImmutable" required type="checkbox" /><span><strong>Ik wijs versie {release.version} opnieuw toe</strong><span className="work-panel__meta">Er wordt geen nieuwe release gemaakt en geen historie overschreven.</span></span></label><button className="button-link button-link--primary" disabled={!canReassign} type="submit">Bestaande release toewijzen</button></form>
      </section>

      <section className="workspace-section" aria-labelledby="restore-title">
        <div className="workspace-section__header">
          <div>
            <h2 className="workspace-section__title" id="restore-title">Versie als concept herstellen</h2>
            <p className="work-panel__meta">De immutable release blijft intact. Alleen het bewerkbare concept wordt uit deze lossless authoringsnapshot opgebouwd.</p>
          </div>
          <StatusPill label="Release blijft immutable" tone="success" />
        </div>
        <form action={restoreReleaseToDraft} className="playlist-form">
          <input name="releaseId" type="hidden" value={releaseId} />
          <input name="idempotencyKey" type="hidden" value={randomUUID()} />
          <label className="check-row">
            <input disabled={!canRestore} name="confirmRestore" required type="checkbox" />
            <span>
              <strong>Herstel versie {release.version} als nieuw concept</strong>
              <span className="work-panel__meta">Niet-opgeslagen wijzigingen in het huidige concept worden vervangen; actieve schermen blijven hun huidige release spelen.</span>
            </span>
          </label>
          <button className="button-link button-link--secondary" disabled={!canRestore} type="submit">
            Als concept herstellen
          </button>
        </form>
      </section>
    </> : null}
  </>;
}

function DiffCard({ items, label }: { items: string[]; label: string }) { return <article className="work-panel"><h3>{label}</h3>{items.length ? <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul> : <p>Geen</p>}</article>; }
function formatDate(value: string) { return formatTenantDateTime(value, null); }
function formatDuration(seconds: number) { const minutes = Math.floor(Math.abs(seconds) / 60); return `${minutes} min ${Math.abs(seconds) % 60} sec`; }
function formatBytes(bytes: number) { if (!bytes) return "0 MB"; return bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(1)} GB` : `${(bytes / 1024 ** 2).toFixed(1)} MB`; }
function signedDuration(value: number) { return `${value >= 0 ? "+" : "−"}${formatDuration(value)}`; }
function signedBytes(value: number) { return `${value >= 0 ? "+" : "−"}${formatBytes(Math.abs(value))}`; }
function changeLabel(value: string) { return ({ asset: "asset", checksum: "bestand", duration: "duur", fit: "weergave", muted: "geluid", size: "omvang" } as Record<string, string>)[value] ?? value; }
function preflightStatus(status: string) { return status === "ready" ? { label: "Gereed", tone: "success" as const } : status === "warning" ? { label: "Waarschuwing", tone: "warning" as const } : status === "blocked" ? { label: "Geblokkeerd", tone: "critical" as const } : { label: "Onbekend", tone: "info" as const }; }
function progressStatus(active: string | null, desired: string | null, phase: string | null, releaseId: string) { if (active === releaseId) return { label: "Actief", tone: "success" as const }; if (phase === "switch_pending") return { label: "Switch gereed", tone: "info" as const }; if (phase === "verifying") return { label: "Verifiëren", tone: "info" as const }; if (phase === "downloading" || phase === "manifest_received") return { label: "Downloaden", tone: "info" as const }; if (desired === releaseId) return { label: "Gewenst", tone: "warning" as const }; return { label: "Historisch", tone: "neutral" as const }; }
function reasonLabel(code: ReleasePreflightReasonCode) { return ({ SCREEN_DISABLED: "scherm uitgeschakeld", SCREEN_MAINTENANCE: "onderhoudsmodus", DEVICE_MISSING: "Player niet gekoppeld", HEARTBEAT_MISSING: "heartbeat ontbreekt", HEARTBEAT_STALE: "heartbeat verouderd", MANIFEST_INCOMPATIBLE: "manifest incompatibel", MANIFEST_COMPATIBILITY_UNKNOWN: "compatibiliteit onbekend", STORAGE_UNKNOWN: "opslag onbekend", STORAGE_INSUFFICIENT: "opslag onvoldoende", STORAGE_MARGIN_LOW: "weinig opslagmarge" } satisfies Record<ReleasePreflightReasonCode, string>)[code]; }
