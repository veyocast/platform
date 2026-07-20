import Link from "next/link";

import { hasCapability } from "@veyocast/auth";

import { requireControlSession } from "../../../../lib/control-session";
import { MetricCard, PageHeader, StatusPill } from "../../_components/shell-primitives";
import { createPlaylist } from "./actions";
import { loadPlaylistList, type PlaylistListFilter } from "./data";

type PlaylistsPageProps = {
  searchParams: Promise<{
    assignment?: string;
    fout?: string;
    page?: string;
    q?: string;
    sort?: string;
    status?: string;
    succes?: string;
  }>;
};

export default async function PlaylistsPage({ searchParams }: PlaylistsPageProps) {
  const session = await requireControlSession();
  const params = await searchParams;
  const filter = parseFilter(params);
  const data = session.isLive && session.tenantId
    ? await loadPlaylistList(session.tenantId, filter)
    : { error: null, page: 1, pageCount: 1, rows: [], total: 0 };
  const tenantIsMutable = session.isLive && session.tenantStatus === "active";
  const canWrite = tenantIsMutable && hasCapability(session.roles, "tenant.playlist.write");
  const draftCount = data.rows.filter(({ status }) => status === "draft").length;
  const publishedCount = data.rows.filter(({ lastPublishedVersion }) => lastPublishedVersion !== null).length;
  const assignedCount = data.rows.filter(({ assignedScreenCount }) => assignedScreenCount > 0).length;

  return (
    <>
      <PageHeader
        actions={canWrite ? <a className="button-link button-link--primary" href="#new-playlist">Nieuwe playlist</a> : null}
        description="Beheer concepten, publicatiestatus en schermgebruik. Open één playlist voor de volledige editor."
        eyebrow={session.tenant}
        status={{ label: session.isLive ? "Live tenantdata" : "Demomodus zonder mutaties", tone: session.isLive ? "success" : "warning" }}
        title="Playlists"
      />

      {params.fout ? <p className="notice notice--critical" role="alert"><strong>Actie mislukt.</strong> {params.fout}</p> : null}
      {params.succes ? <p className="notice notice--success" role="status">{params.succes}</p> : null}
      {data.error ? <p className="notice notice--critical" role="alert"><strong>Playlists niet geladen.</strong> {data.error}</p> : null}
      {!session.isLive ? <p className="notice notice--warning" role="status">Configureer Supabase en log in om echte playlists te maken en bewerken.</p> : null}

      <section className="metric-grid" aria-label="Playlistoverzicht van deze pagina">
        <MetricCard detail="Concepten met wijzigingen sinds de laatste release." label="Concepten" tone="info" value={String(draftCount)} />
        <MetricCard detail="Playlists met minimaal één immutable release." label="Met publicatie" tone="success" value={String(publishedCount)} />
        <MetricCard detail="Playlists die op minimaal één actief scherm zijn toegewezen." label="Toegewezen" tone="neutral" value={String(assignedCount)} />
      </section>

      <form className="resource-toolbar" method="get" role="search">
        <div className="resource-toolbar__group">
          <input aria-label="Zoeken in playlists" className="toolbar-search" defaultValue={filter.query} name="q" placeholder="Zoeken op playlistnaam" type="search" />
          <label className="toolbar-field"><span>Status</span><select defaultValue={filter.status} name="status"><option value="all">Alle statussen</option><option value="draft">Concept</option><option value="published">Gepubliceerd</option><option value="archived">Gearchiveerd</option></select></label>
          <label className="toolbar-field"><span>Schermgebruik</span><select defaultValue={filter.assignment} name="assignment"><option value="all">Alle toewijzingen</option><option value="assigned">Toegewezen</option><option value="unassigned">Niet toegewezen</option></select></label>
          <label className="toolbar-field"><span>Sorteren</span><select defaultValue={filter.sort} name="sort"><option value="updated">Laatst gewijzigd</option><option value="name">Naam</option></select></label>
          <button className="button-link button-link--secondary" type="submit">Filters toepassen</button>
        </div>
        <p className="resource-toolbar__summary">{data.total} {data.total === 1 ? "playlist" : "playlists"}</p>
      </form>

      <section className="resource-workspace">
        <section className="workspace-section" aria-labelledby="playlist-list-title">
          <div className="workspace-section__header">
            <div><h2 className="workspace-section__title" id="playlist-list-title">Playlistlijst</h2><p className="work-panel__meta">Concept, laatste publicatie en schermgebruik blijven afzonderlijk zichtbaar.</p></div>
            <StatusPill label={`Pagina ${data.page} van ${data.pageCount}`} tone="neutral" />
          </div>
          {data.rows.length ? (
            <div className="data-table-frame">
              <table className="data-table data-table--responsive">
                <caption>Playlists binnen de actieve vereniging.</caption>
                <thead><tr><th scope="col">Playlist</th><th scope="col">Conceptstatus</th><th scope="col">Inhoud</th><th scope="col">Laatste publicatie</th><th scope="col">Schermen</th><th scope="col">Laatst bewerkt</th><th scope="col">Actie</th></tr></thead>
                <tbody>{data.rows.map((playlist) => <tr key={playlist.id}>
                  <td data-label="Playlist"><span className="table-primary">{playlist.name}</span><span className="table-secondary">{playlist.description || "Geen beschrijving"}</span></td>
                  <td data-label="Conceptstatus"><StatusPill {...playlistStatus(playlist.status, playlist.lastPublishedVersion)} /></td>
                  <td data-label="Inhoud">{playlist.itemCount} {playlist.itemCount === 1 ? "item" : "items"}<span className="table-secondary">{formatDuration(playlist.totalDurationSeconds)}</span></td>
                  <td data-label="Laatste publicatie">{playlist.lastPublishedVersion ? `Versie ${playlist.lastPublishedVersion}` : "Nog niet gepubliceerd"}</td>
                  <td data-label="Schermen">{playlist.assignedScreenCount}</td>
                  <td data-label="Laatst bewerkt">{playlist.updatedBy}<span className="table-secondary">{formatDate(playlist.updatedAt)}</span></td>
                  <td data-label="Actie"><Link className="table-action" href={`/dashboard/playlists/${playlist.id}`}>Open Playlist Studio</Link></td>
                </tr>)}</tbody>
              </table>
            </div>
          ) : <div className="empty-state" role="status"><h2>Nog geen passende playlists</h2><p>Pas de filters aan of maak een playlist om media in een vaste volgorde te publiceren.</p>{canWrite ? <a className="button-link button-link--primary" href="#new-playlist">Nieuwe playlist</a> : null}</div>}
          {data.pageCount > 1 ? <nav aria-label="Playlistpagina's" className="pagination"><PaginationLink disabled={data.page <= 1} href={pageHref(params, data.page - 1)} label="Vorige pagina" /><span>Pagina {data.page} van {data.pageCount}</span><PaginationLink disabled={data.page >= data.pageCount} href={pageHref(params, data.page + 1)} label="Volgende pagina" /></nav> : null}
        </section>

        <aside className="workspace-aside" aria-labelledby="new-playlist-title">
          <section className="inspector-panel" id="new-playlist">
            <div className="work-panel__header"><div><h2 className="work-panel__title" id="new-playlist-title">Nieuwe playlist</h2><p className="work-panel__meta">Je opent het nieuwe concept direct in Playlist Studio.</p></div><StatusPill label="Concept" tone="info" /></div>
            <form action={createPlaylist} className="playlist-form">
              <div className="field"><label htmlFor="new-playlist-name">Playlistnaam</label><input disabled={!canWrite} id="new-playlist-name" maxLength={120} minLength={2} name="name" placeholder="Bijvoorbeeld kantineprogramma" required type="text" /></div>
              <div className="field"><label htmlFor="new-playlist-description">Beschrijving</label><textarea disabled={!canWrite} id="new-playlist-description" maxLength={500} name="description" rows={3} /></div>
              <button className="button-link button-link--primary" disabled={!canWrite} type="submit">Concept maken</button>
              {!canWrite ? <p className="work-panel__meta">Je hebt bewerkrechten en een actieve vereniging nodig om een playlist te maken.</p> : null}
            </form>
          </section>
        </aside>
      </section>
    </>
  );
}

function parseFilter(params: Awaited<PlaylistsPageProps["searchParams"]>): PlaylistListFilter {
  return {
    assignment: params.assignment === "assigned" || params.assignment === "unassigned" ? params.assignment : "all",
    page: Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1),
    query: params.q?.trim() ?? "",
    sort: params.sort === "name" ? "name" : "updated",
    status: params.status === "draft" || params.status === "published" || params.status === "archived" ? params.status : "all"
  };
}

function playlistStatus(status: string, lastPublishedVersion: number | null) {
  if (status === "archived") return { label: "Gearchiveerd", tone: "neutral" as const };
  if (status === "published") return { label: "Gepubliceerd", tone: "success" as const };
  if (lastPublishedVersion) return { label: "Bijwerken", tone: "warning" as const };
  return { label: "Concept", tone: "info" as const };
}

function pageHref(params: Awaited<PlaylistsPageProps["searchParams"]>, page: number) {
  const next = new URLSearchParams();
  for (const key of ["q", "status", "assignment", "sort"] as const) if (params[key]) next.set(key, params[key]);
  next.set("page", String(page));
  return `/dashboard/playlists?${next.toString()}`;
}

function PaginationLink({ disabled, href, label }: { disabled: boolean; href: string; label: string }) {
  return disabled
    ? <span aria-disabled="true" className="button-link button-link--secondary">{label}</span>
    : <Link className="button-link button-link--secondary" href={href}>{label}</Link>;
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
