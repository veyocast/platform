import Link from "next/link";
import Image from "next/image";

import { hasCapability } from "@veyocast/auth";
import {
  Button,
  FilterBar,
  SummaryStrip,
  TablePreferences
} from "@veyocast/ui";
import {
  Grid3X3,
  List,
  ListVideo,
  Monitor,
  Timer,
  TriangleAlert
} from "lucide-react";

import { requireControlSession } from "../../../../lib/control-session";
import { formatTenantDateTime } from "../../../../lib/tenant-time";
import { PageHeader, StatusPill } from "../../_components/shell-primitives";
import { loadPlaylistList, type PlaylistListFilter } from "./data";
import { PlaylistCreateDialog } from "./playlist-create-dialog";
import { PlaylistLibraryWorkspace } from "./playlist-library-workspace";
import styles from "./playlists-overview.module.css";

type PlaylistsPageProps = {
  searchParams: Promise<{
    assignment?: string;
    fout?: string;
    page?: string;
    q?: string;
    sort?: string;
    status?: string;
    succes?: string;
    view?: string;
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
  const canWrite = tenantIsMutable && hasCapability(session.capabilities, "tenant.playlist.write");
  const view = "list" as "cards" | "list";
  const draftsNeedingAttention = data.rows.filter(
    ({ lastPublishedVersion, status }) => status === "draft" && lastPublishedVersion !== null
  ).length;

  return (
    <>
      <PageHeader
        actions={canWrite ? <PlaylistCreateDialog canWrite={canWrite} sources={data.rows.map(({ id, name }) => ({ id, name }))} /> : null}
        description="Beheer concepten, publicatiestatus en schermgebruik. Open één playlist voor de volledige editor."
        eyebrow={session.tenant}
        status={!session.isLive ? { label: "Demomodus", tone: "warning" } : undefined}
        title="Playlists"
      />

      {params.fout ? <p className="notice notice--critical" role="alert"><strong>Actie mislukt.</strong> {params.fout}</p> : null}
      {params.succes ? <p className="notice notice--success" role="status">{params.succes}</p> : null}
      {data.error ? <p className="notice notice--critical" role="alert"><strong>Playlists niet geladen.</strong> {data.error}</p> : null}
      {!session.isLive ? <p className="notice notice--warning" role="status">Configureer Supabase en log in om echte playlists te maken en bewerken.</p> : null}

      <SummaryStrip
        aria-label="Compact playlistoverzicht"
        items={[
          {
            detail: draftsNeedingAttention ? "Concept wijkt af van de laatste release" : "Geen open publicatiewijzigingen op deze pagina",
            label: "Actie nodig",
            tone: draftsNeedingAttention ? "warning" : "success",
            value: draftsNeedingAttention
          },
          { label: "Playlists", value: data.total },
          {
            label: "Toegewezen",
            value: data.rows.filter(({ assignedScreenCount }) => assignedScreenCount > 0).length
          }
        ]}
      />

      <form method="get" role="search">
        <FilterBar
          activeCount={playlistFilterCount(filter)}
          actions={(
            <TablePreferences
              columns={[
                { id: "playlist", label: "Playlist", required: true },
                { id: "status", label: "Conceptstatus" },
                { id: "content", label: "Inhoud" },
                { id: "release", label: "Laatste publicatie" },
                { id: "screens", label: "Schermen" },
                { defaultVisible: false, id: "updated", label: "Laatst bewerkt" },
                { id: "action", label: "Actie", required: true }
              ]}
              defaultDensity="comfortable"
              tableKey="tenant-playlists"
            />
          )}
          clearHref="/dashboard/playlists"
          defaultOpen={playlistFilterCount(filter) > 0}
          primary={<input aria-label="Zoeken in playlists" className="toolbar-search" defaultValue={filter.query} name="q" placeholder="Zoeken op playlistnaam" type="search" />}
          results={`${data.total} ${data.total === 1 ? "playlist" : "playlists"}`}
        >
          <label className="toolbar-field"><span>Status</span><select defaultValue={filter.status} name="status"><option value="all">Alle statussen</option><option value="draft">Concept</option><option value="published">Gepubliceerd</option><option value="archived">Gearchiveerd</option></select></label>
          <label className="toolbar-field"><span>Schermgebruik</span><select defaultValue={filter.assignment} name="assignment"><option value="all">Alle toewijzingen</option><option value="assigned">Toegewezen</option><option value="unassigned">Niet toegewezen</option></select></label>
          <label className="toolbar-field"><span>Sorteren</span><select defaultValue={filter.sort} name="sort"><option value="updated">Laatst gewijzigd</option><option value="name">Naam</option></select></label>
          <Button type="submit" variant="secondary">Filters toepassen</Button>
        </FilterBar>
      </form>

      <div className={styles.viewBar}>
        <nav aria-label="Playlistweergave" className={styles.viewTabs}>
          <Link
            aria-current={view === "cards" ? "page" : undefined}
            className={styles.viewTab}
            data-active={view === "cards"}
            href={viewHref(params, "cards")}
          >
            <Grid3X3 aria-hidden="true" />
            Kaarten
          </Link>
          <Link
            aria-current={view === "list" ? "page" : undefined}
            className={styles.viewTab}
            data-active={view === "list"}
            href={viewHref(params, "list")}
          >
            <List aria-hidden="true" />
            Tabel
          </Link>
        </nav>
        <StatusPill label={`${data.total} ${data.total === 1 ? "playlist" : "playlists"}`} tone="neutral" />
      </div>

      <section aria-labelledby="playlist-list-title">
        <h2 className="sr-only" id="playlist-list-title">Playlistoverzicht</h2>
        {data.rows.length ? (
          <PlaylistLibraryWorkspace canWrite={canWrite} rows={data.rows} />
        ) : (
          <div className="empty-state" role="status">
            <h2>Nog geen passende playlists</h2>
            <p>Pas de filters aan of gebruik Nieuwe playlist bovenaan om media in een vaste volgorde te publiceren.</p>
          </div>
        )}
        {/* Legacy card/table renderer intentionally removed: playlists are list-only. */}
        {view === "cards" ? (
          <div className={styles.playlistGrid}>
            {data.rows.map((playlist, playlistIndex) => (
              <article className={styles.playlistCard} key={playlist.id}>
                <div className={styles.playlistCover} data-count={playlist.coverPreviewUrls.length}>
                  {playlist.coverPreviewUrls.length ? playlist.coverPreviewUrls.map((url, index) => (
                    <span className={styles.coverTile} key={url}>
                      <Image
                        alt=""
                        fill
                        priority={playlistIndex === 0 && index === 0}
                        sizes="(max-width: 680px) 100vw, (max-width: 1180px) 50vw, 33vw"
                        src={url}
                        unoptimized
                      />
                    </span>
                  )) : (
                    <span className={styles.coverFallback}>
                      <ListVideo aria-hidden="true" />
                    </span>
                  )}
                </div>
                <div className={styles.cardBody}>
                  <div className={styles.cardTitleRow}>
                    <Link className={styles.cardTitle} href={`/dashboard/playlists/${playlist.id}`}>
                      {playlist.name}
                    </Link>
                    <StatusPill {...playlistStatus(playlist.status, playlist.lastPublishedVersion)} />
                  </div>
                  <p className={styles.cardDescription}>
                    {playlist.description || "Geen beschrijving toegevoegd."}
                  </p>
                  <dl className={styles.cardMeta}>
                    <div>
                      <dt>Inhoud</dt>
                      <dd><ListVideo aria-hidden="true" /> {playlist.itemCount} items</dd>
                    </div>
                    <div>
                      <dt>Duur</dt>
                      <dd><Timer aria-hidden="true" /> {formatDuration(playlist.totalDurationSeconds)}</dd>
                    </div>
                    <div>
                      <dt>Schermen</dt>
                      <dd><Monitor aria-hidden="true" /> {playlist.assignedScreenCount}</dd>
                    </div>
                  </dl>
                  <div className={styles.cardFooter}>
                    <span>{formatDate(playlist.updatedAt)} · {playlist.updatedBy}</span>
                    {playlist.warningCount ? (
                      <span className={styles.warning}>
                        <TriangleAlert aria-hidden="true" />
                        {playlist.warningCount} {playlist.warningCount === 1 ? "waarschuwing" : "waarschuwingen"}
                      </span>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : data.rows.length ? (
          <div className={styles.listFrame}>
            <table className="data-table data-table--responsive" data-vc-table-key="tenant-playlists">
              <caption>Playlists binnen de actieve vereniging.</caption>
              <thead><tr><th data-column="playlist" scope="col">Playlist</th><th data-column="status" scope="col">Conceptstatus</th><th data-column="content" scope="col">Inhoud</th><th data-column="release" scope="col">Laatste publicatie</th><th data-column="screens" scope="col">Schermen</th><th data-column="updated" scope="col">Laatst bewerkt</th><th data-column="action" scope="col">Actie</th></tr></thead>
              <tbody>{data.rows.map((playlist) => <tr key={playlist.id}>
                <td data-column="playlist" data-label="Playlist"><span className="table-primary">{playlist.name}</span><span className="table-secondary">{playlist.description || "Geen beschrijving"}</span></td>
                <td data-column="status" data-label="Conceptstatus"><StatusPill {...playlistStatus(playlist.status, playlist.lastPublishedVersion)} /></td>
                <td data-column="content" data-label="Inhoud">{playlist.itemCount} {playlist.itemCount === 1 ? "item" : "items"}<span className="table-secondary">{formatDuration(playlist.totalDurationSeconds)}</span></td>
                <td data-column="release" data-label="Laatste publicatie">{playlist.lastPublishedVersion ? `Versie ${playlist.lastPublishedVersion}` : "Nog niet gepubliceerd"}</td>
                <td data-column="screens" data-label="Schermen">{playlist.assignedScreenCount}</td>
                <td data-column="updated" data-label="Laatst bewerkt">{playlist.updatedBy}<span className="table-secondary">{formatDate(playlist.updatedAt)}</span></td>
                <td data-column="action" data-label="Actie"><Link className="table-action" href={`/dashboard/playlists/${playlist.id}`}>Open playlisteditor</Link></td>
              </tr>)}</tbody>
            </table>
          </div>
        ) : null}
        {data.pageCount > 1 ? <nav aria-label="Playlistpagina's" className="pagination"><PaginationLink disabled={data.page <= 1} href={pageHref(params, data.page - 1)} label="Vorige pagina" /><span>Pagina {data.page} van {data.pageCount}</span><PaginationLink disabled={data.page >= data.pageCount} href={pageHref(params, data.page + 1)} label="Volgende pagina" /></nav> : null}
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

function playlistFilterCount(filter: PlaylistListFilter) {
  return [
    Boolean(filter.query),
    filter.status !== "all",
    filter.assignment !== "all",
    filter.sort !== "updated"
  ].filter(Boolean).length;
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

function viewHref(
  params: Awaited<PlaylistsPageProps["searchParams"]>,
  view: "cards" | "list"
) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && !["page", "view"].includes(key)) query.set(key, value);
  }
  if (view === "list") query.set("view", view);
  const suffix = query.toString();
  return suffix ? `/dashboard/playlists?${suffix}` : "/dashboard/playlists";
}

function PaginationLink({ disabled, href, label }: { disabled: boolean; href: string; label: string }) {
  return disabled
    ? <Button aria-disabled="true" disabled variant="secondary">{label}</Button>
    : <Button asChild variant="secondary"><Link href={href}>{label}</Link></Button>;
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

function formatDate(value: string) {
  return formatTenantDateTime(value, null);
}
