import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";

import { hasCapability } from "@veyocast/auth";
import type { ReleasePreflightReasonCode } from "@veyocast/domain";

import { requireTenantControlSession } from "../../../../../../lib/control-session";
import { PageHeader, StatusPill } from "../../../../_components/shell-primitives";
import { publishPlaylistGuided } from "../../actions";
import { loadPlaylistStudio } from "../../data";
import { PlaylistPreview, type PlaylistPreviewItem } from "../../playlist-preview";
import { loadDraftPreflight } from "../../../releases/data";

type PublishJourneyPageProps = {
  params: Promise<{ playlistId: string }>;
  searchParams: Promise<{
    fout?: string;
    screen?: string | string[];
  }>;
};

export default async function PublishJourneyPage({ params, searchParams }: PublishJourneyPageProps) {
  const session = await requireTenantControlSession("tenant.playlist.read");
  const { playlistId } = await params;
  const query = await searchParams;
  const studio = session.isLive && session.tenantId ? await loadPlaylistStudio(session.tenantId, playlistId) : null;
  if (session.isLive && !studio?.playlist && !studio?.error) notFound();
  const playlist = studio?.playlist ?? null;
  const selectedIds = [...new Set((Array.isArray(query.screen) ? query.screen : query.screen ? [query.screen] : []).filter((id) => studio?.screens.some((screen) => screen.id === id)))];
  const targetItems = studio?.items.flatMap((item) => item.asset?.variant
    ? [{ checksumSha256: item.asset.variant.checksumSha256, fileSizeBytes: item.asset.variant.fileSizeBytes }]
    : []) ?? [];
  const preflight = session.isLive && session.tenantId && playlist
    ? await loadDraftPreflight(session.tenantId, targetItems)
    : { error: null, screenStates: [] };
  const selectedStates = preflight.screenStates.filter((state) => selectedIds.includes(state.screen.id));
  const hasBlocked = selectedStates.some((state) => state.preflight.status === "blocked");
  const hasRisk = selectedStates.some((state) => state.preflight.status === "warning" || state.preflight.status === "unknown");
  const canPublish = Boolean(
    session.isLive &&
    session.tenantStatus === "active" &&
    playlist?.status !== "archived" &&
    hasCapability(session.roles, "tenant.playlist.publish") &&
    studio?.readiness?.canPublish
  );
  const previewItems: PlaylistPreviewItem[] = studio?.items.flatMap((item) => {
    if (!item.asset?.variant?.previewUrl) return [];
    return [{
      accessibilityName: item.accessibilityName || undefined,
      backgroundColor: item.backgroundColor || undefined,
      cropFocusX: item.cropFocusX,
      cropFocusY: item.cropFocusY,
      displayTitle: item.displayTitle || undefined,
      durationSeconds: item.durationSeconds,
      enabled: item.enabled,
      fitMode: item.fitMode,
      id: item.id,
      kind: item.asset.kind,
      muted: item.muted,
      title: item.asset.title,
      transition: item.transition,
      trimEndSeconds: item.trimEndSeconds ?? undefined,
      trimStartSeconds: item.trimStartSeconds,
      url: item.asset.variant.previewUrl,
      visibleFrom: item.visibleFrom ?? undefined,
      visibleUntil: item.visibleUntil ?? undefined,
      volumePercent: item.volumePercent
    }];
  }) ?? [];

  return <>
    <Link className="breadcrumb-link" href={`/dashboard/playlists/${playlistId}`}>← Terug naar Playlist Studio</Link>
    <PageHeader
      description="Doorloop readiness, preview, releasegegevens, doelschermen, preflight en bevestiging boven echte concept- en schermdata."
      eyebrow={`${session.tenant} · Begeleide publicatie`}
      status={{ label: studio?.readiness?.canPublish ? "Concept gereed" : "Readiness geblokkeerd", tone: studio?.readiness?.canPublish ? "success" : "warning" }}
      title={playlist ? `${playlist.name} publiceren` : "Publiceren"}
    />
    {query.fout ? <p className="notice notice--critical" role="alert"><strong>Publicatie niet uitgevoerd.</strong> {query.fout}</p> : null}
    {studio?.error || preflight.error ? <p className="notice notice--critical" role="alert"><strong>Publicatiecontrole onvolledig.</strong> {studio?.error ?? preflight.error}</p> : null}

    {playlist && studio ? <>
      <nav aria-label="Stappen in publicatie" className="playlist-studio-steps"><a href="#readiness">1. Readiness</a><a href="#preview">2. Preview</a><a href="#targets">3. Doelschermen</a><a href="#preflight">4. Preflight</a><a href="#confirmation">5. Bevestiging</a></nav>

      <section className="workspace-section" id="readiness" aria-labelledby="publish-readiness-title">
        <div className="workspace-section__header"><div><h2 className="workspace-section__title" id="publish-readiness-title">1. Media en readiness</h2><p className="work-panel__meta">Dezelfde centrale readiness-engine wordt vlak vóór de databaseactie opnieuw uitgevoerd.</p></div><StatusPill label={studio.readiness?.canPublish ? "Gereed" : "Geblokkeerd"} tone={studio.readiness?.canPublish ? "success" : "critical"} /></div>
        <dl className="meta-list"><div><dt>Conceptrevisie</dt><dd>{playlist.revision}</dd></div><div><dt>Items</dt><dd>{studio.readiness?.itemCount ?? 0}</dd></div><div><dt>Duur</dt><dd>{formatDuration(studio.readiness?.totalDurationSeconds ?? 0)}</dd></div><div><dt>Totale download</dt><dd>{formatBytes(studio.readiness?.totalBytes ?? 0)}</dd></div></dl>
        {!studio.readiness?.canPublish ? <p className="notice notice--critical">Herstel eerst de readinessblokkades in <Link href={`/dashboard/playlists/${playlistId}`}>Playlist Studio</Link>. Er kan geen release worden gemaakt.</p> : null}
      </section>

      <section className="workspace-section" id="preview" aria-labelledby="publish-preview-title"><div className="workspace-section__header"><div><h2 className="workspace-section__title" id="publish-preview-title">2. Preview</h2><p className="work-panel__meta">Controleer de vaste volgorde, duur, fit en muted-instellingen die in de immutable release terechtkomen.</p></div><StatusPill label={`${previewItems.length} items`} tone="info" /></div><div className="publish-preview-frame"><PlaylistPreview items={previewItems} /></div></section>

      <section className="workspace-section" id="targets" aria-labelledby="publish-targets-title">
        <div className="workspace-section__header"><div><h2 className="workspace-section__title" id="publish-targets-title">3. Doelschermen kiezen</h2><p className="work-panel__meta">De keuze blijft hervatbaar in de URL; er ontstaat nog geen verborgen tijdelijke productdata.</p></div><StatusPill label={`${selectedIds.length} gekozen`} tone={selectedIds.length ? "info" : "neutral"} /></div>
        <form className="playlist-form" method="get"><fieldset className="checkbox-fieldset"><legend>Actieve en onderhoudsschermen</legend>{preflight.screenStates.filter((state) => state.screen.status !== "disabled").map((state) => <label className="check-row" key={state.screen.id}><input defaultChecked={selectedIds.includes(state.screen.id)} name="screen" type="checkbox" value={state.screen.id} /><span><strong>{state.screen.name}</strong><span className="work-panel__meta">{state.screen.location || "Geen locatie"} · {state.screen.orientation === "portrait" ? "staand" : "liggend"}</span></span></label>)}</fieldset><button className="button-link button-link--secondary" type="submit">Preflight voor selectie berekenen</button></form>
      </section>

      <section className="workspace-section" id="preflight" aria-labelledby="publish-preflight-title">
        <div className="workspace-section__header"><div><h2 className="workspace-section__title" id="publish-preflight-title">4. Preflight per scherm</h2><p className="work-panel__meta">Stale of ontbrekende heartbeat levert nooit bewijs voor cache, compatibiliteit of beschikbare opslag.</p></div><StatusPill label={hasBlocked ? "Publicatie geblokkeerd" : hasRisk ? "Bewuste bevestiging nodig" : selectedIds.length ? "Alle doelen gereed" : "Kies schermen"} tone={hasBlocked ? "critical" : hasRisk ? "warning" : selectedIds.length ? "success" : "neutral"} /></div>
        {selectedStates.length ? <div className="data-table-frame"><table className="data-table data-table--responsive"><caption>Deterministische publicatiepreflight voor de gekozen schermen.</caption><thead><tr><th scope="col">Scherm</th><th scope="col">Status</th><th scope="col">Ontbrekend</th><th scope="col">Vrije opslag</th><th scope="col">Onderbouwing</th></tr></thead><tbody>{selectedStates.map((state) => <tr key={state.screen.id}><td data-label="Scherm"><span className="table-primary">{state.screen.name}</span><span className="table-secondary">{state.heartbeatAt ? `Heartbeat ${formatDate(state.heartbeatAt)}` : "Geen heartbeat"}</span></td><td data-label="Status"><StatusPill {...preflightStatus(state.preflight.status)} /></td><td data-label="Ontbrekend">{state.preflight.missingBytes === null ? "Onbekend" : formatBytes(state.preflight.missingBytes)}</td><td data-label="Vrije opslag">{state.preflight.availableBytes === null ? "Onbekend" : formatBytes(state.preflight.availableBytes)}</td><td data-label="Onderbouwing">{state.preflight.reasons.map(reasonLabel).join(" · ") || "Status, compatibiliteit en opslag zijn aantoonbaar voldoende."}</td></tr>)}</tbody></table></div> : <p className="notice" role="status">Kies eerst minimaal één doelscherm om de preflight te berekenen.</p>}
      </section>

      <section className="publish-workspace" id="confirmation" aria-labelledby="publish-confirm-title">
        <div className="workspace-section__header"><div><h2 className="workspace-section__title" id="publish-confirm-title">5. Releasegegevens en bevestiging</h2><p className="work-panel__meta">De definitieve actie controleert revisie, readiness en schermpreflight opnieuw en maakt daarna één immutable release.</p></div><StatusPill label={`Volgende versie ${studio.releases[0] ? studio.releases[0].version + 1 : 1}`} tone="neutral" /></div>
        <form action={publishPlaylistGuided} className="playlist-form"><input name="playlistId" type="hidden" value={playlistId} /><input name="expectedRevision" type="hidden" value={playlist.revision} /><input name="idempotencyKey" type="hidden" value={randomUUID()} />{selectedIds.map((screenId) => <input key={screenId} name="screenIds" type="hidden" value={screenId} />)}<div className="field"><label htmlFor="guided-release-notes">Releasenotitie</label><textarea disabled={!canPublish} id="guided-release-notes" maxLength={500} name="releaseNotes" placeholder="Wat verandert er en waarom?" rows={3} /></div>{hasRisk ? <label className="check-row"><input disabled={!canPublish || hasBlocked} name="confirmRisk" required type="checkbox" /><span><strong>Ik bevestig bewust de waarschuwingen en onbekende telemetry</strong><span className="work-panel__meta">De huidige release blijft actief totdat de nieuwe release volledig is gedownload en geverifieerd.</span></span></label> : null}<label className="check-row"><input disabled={!canPublish || hasBlocked || !selectedIds.length} name="confirmPublish" required type="checkbox" /><span><strong>Maak een nieuwe immutable release</strong><span className="work-panel__meta">Na publicatie kan deze versie niet worden gewijzigd of verwijderd.</span></span></label><button className="button-link button-link--primary" disabled={!canPublish || hasBlocked || !selectedIds.length} type="submit">Release publiceren en uitrol volgen</button></form>
      </section>
    </> : null}
  </>;
}

function formatDate(value: string) { return new Intl.DateTimeFormat("nl-NL", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)); }
function formatDuration(seconds: number) { return `${Math.floor(seconds / 60)} min ${seconds % 60} sec`; }
function formatBytes(bytes: number) { if (!bytes) return "0 MB"; return bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(1)} GB` : `${(bytes / 1024 ** 2).toFixed(1)} MB`; }
function preflightStatus(status: string) { return status === "ready" ? { label: "Gereed", tone: "success" as const } : status === "warning" ? { label: "Waarschuwing", tone: "warning" as const } : status === "blocked" ? { label: "Geblokkeerd", tone: "critical" as const } : { label: "Onbekend", tone: "info" as const }; }
function reasonLabel(code: ReleasePreflightReasonCode) { return ({ SCREEN_DISABLED: "scherm uitgeschakeld", SCREEN_MAINTENANCE: "onderhoudsmodus", DEVICE_MISSING: "Player niet gekoppeld", HEARTBEAT_MISSING: "heartbeat ontbreekt", HEARTBEAT_STALE: "heartbeat verouderd", MANIFEST_INCOMPATIBLE: "manifest incompatibel", MANIFEST_COMPATIBILITY_UNKNOWN: "compatibiliteit onbekend", STORAGE_UNKNOWN: "opslag onbekend", STORAGE_INSUFFICIENT: "opslag onvoldoende", STORAGE_MARGIN_LOW: "weinig opslagmarge" } satisfies Record<ReleasePreflightReasonCode, string>)[code]; }
