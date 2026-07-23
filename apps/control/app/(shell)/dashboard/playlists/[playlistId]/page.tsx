import Link from "next/link";
import { notFound } from "next/navigation";

import { hasCapability } from "@veyocast/auth";
import type { PlayerPlaybackItem } from "@veyocast/contracts";
import { Button } from "@veyocast/ui";

import { requireControlSession } from "../../../../../lib/control-session";
import { PageHeader, StatusPill } from "../../../_components/shell-primitives";
import {
  addPlaylistItem,
  archivePlaylist,
  updatePlaylistDetails
} from "../actions";
import { loadPlaylistStudio } from "../data";
import { PlaylistPreview, type PlaylistPreviewItem } from "../playlist-preview";
import { getReadinessCopy } from "../readiness-copy";
import { DirtyStateGuard } from "./dirty-state-guard";
import { PlaylistTimelineEditor } from "./playlist-timeline-editor";

type PlaylistStudioPageProps = {
  params: Promise<{ playlistId: string }>;
  searchParams: Promise<{
    actual?: string;
    conflict?: string;
    expected?: string;
    fout?: string;
    mediaq?: string;
    operation?: string;
    succes?: string;
  }>;
};

export default async function PlaylistStudioPage({ params, searchParams }: PlaylistStudioPageProps) {
  const session = await requireControlSession();
  const { playlistId } = await params;
  const query = await searchParams;
  const data = session.isLive && session.tenantId
    ? await loadPlaylistStudio(session.tenantId, playlistId)
    : { assets: [], error: null, items: [], playlist: null, readiness: null, releases: [], screens: [] };
  if (session.isLive && !data.playlist && !data.error) notFound();

  const playlist = data.playlist;
  const revision = playlist?.revision ?? 0;
  const tenantIsMutable = session.isLive && session.tenantStatus === "active" && playlist?.status !== "archived";
  const canWrite = Boolean(tenantIsMutable && hasCapability(session.roles, "tenant.playlist.write"));
  const canManage = Boolean(tenantIsMutable && hasCapability(session.roles, "tenant.playlist.archive"));
  const readiness = data.readiness;
  const mediaQuery = query.mediaq?.trim().toLocaleLowerCase("nl-NL") ?? "";
  const availableAssets = data.assets.filter((asset) =>
    !asset.deletedAt &&
    asset.status === "ready" &&
    asset.variant &&
    (!mediaQuery || asset.title.toLocaleLowerCase("nl-NL").includes(mediaQuery))
  );
  const previewItems: PlaylistPreviewItem[] = data.items.flatMap((item) => {
    const asset = item.asset;
    const url = asset?.variant?.previewUrl;
    if (!asset || !url) return [];
    const playback: PlayerPlaybackItem = {
      durationSeconds: item.durationSeconds,
      fitMode: item.fitMode,
      id: item.id,
      kind: asset.kind,
      muted: item.muted,
      title: asset.title
    };
    return [{ ...playback, url }];
  });

  return (
    <>
      <Link className="breadcrumb-link" href="/dashboard/playlists">← Terug naar playlists</Link>
      <PageHeader
        description={playlist ? `Laatst bewerkt door ${playlist.updatedBy} op ${formatDate(playlist.updatedAt)}.` : "Open een live playlist om het concept te bewerken."}
        eyebrow={`${session.tenant} · Playlist Studio`}
        status={!playlist
          ? { label: "Niet beschikbaar", tone: "warning" }
          : playlist.status === "archived"
            ? { label: "Gearchiveerd", tone: "neutral" }
            : undefined}
        title={playlist?.name ?? "Playlist Studio"}
      />

      {query.fout ? <p className="notice notice--critical" role="alert"><strong>Actie mislukt.</strong> {query.fout}</p> : null}
      {query.succes ? <p className="notice notice--success" role="status">{query.succes}</p> : null}
      {data.error ? <p className="notice notice--critical" role="alert"><strong>Playlist Studio niet volledig geladen.</strong> {data.error}</p> : null}
      {!session.isLive ? <p className="notice notice--warning" role="status">Playlist Studio gebruikt alleen live tenantdata. Configureer Supabase en log opnieuw in.</p> : null}
      {query.conflict && playlist ? <ConflictPanel actual={query.actual} expected={query.expected} operation={query.operation} playlistId={playlist.id} updatedBy={playlist.updatedBy} /> : null}

      {playlist ? <DirtyStateGuard toolbar={(
        <>
          <Button asChild size="sm" variant="secondary"><a href="#playlist-preview">Voorbeeld</a></Button>
          <Button asChild size="sm"><Link href={`/dashboard/playlists/${playlist.id}/publish`}>Publiceren</Link></Button>
        </>
      )}>
        <section className="playlist-studio-details" aria-labelledby="concept-details-title">
          <div className="workspace-section__header"><div><h2 className="workspace-section__title" id="concept-details-title">Conceptgegevens</h2><p className="work-panel__meta">Opslaan wijzigt alleen het concept, nooit een bestaande release.</p></div><StatusPill label={`Revisie ${revision}`} tone="info" /></div>
          <form action={updatePlaylistDetails} className="playlist-details-form">
            <RevisionFields playlistId={playlist.id} revision={revision} />
            <div className="field"><label htmlFor="playlist-name">Playlistnaam</label><input defaultValue={playlist.name} disabled={!canWrite} id="playlist-name" maxLength={120} minLength={2} name="name" required type="text" /></div>
            <div className="field"><label htmlFor="playlist-description">Beschrijving</label><textarea defaultValue={playlist.description ?? ""} disabled={!canWrite} id="playlist-description" maxLength={500} name="description" rows={2} /></div>
            <Button disabled={!canWrite} type="submit" variant="secondary">Conceptgegevens opslaan</Button>
          </form>
        </section>

        <div className="playlist-studio-layout">
          <section className="playlist-studio-library" id="add-media" aria-labelledby="add-media-title">
            <div className="workspace-section__header"><div><h2 className="workspace-section__title" id="add-media-title">Media toevoegen</h2><p className="work-panel__meta">Alleen gereedstaande Player-varianten.</p></div><Link className="table-action" href="/dashboard/media">Media beheren</Link></div>
            <form className="playlist-media-search" method="get" role="search"><label className="field" htmlFor="playlist-media-search"><span>Media zoeken</span><input defaultValue={query.mediaq} id="playlist-media-search" name="mediaq" placeholder="Zoek media" type="search" /></label><Button type="submit" variant="secondary">Zoeken</Button></form>
            {availableAssets.length ? <ul className="playlist-media-picker">{availableAssets.map((asset) => <li key={asset.id}>
              <div className="playlist-media-picker__preview" data-kind={asset.kind}>{asset.kind === "video" ? "Video" : "Afbeelding"}</div>
              <div><strong>{asset.title}</strong><span>{formatVariantLabel(asset.kind, asset.variant)}</span></div>
              <form action={addPlaylistItem}><RevisionFields playlistId={playlist.id} revision={revision} /><input name="mediaAssetId" type="hidden" value={asset.id} /><button className="table-action" disabled={!canWrite} type="submit">Toevoegen</button></form>
            </li>)}</ul> : <p className="notice" role="status">Geen gereedstaande media gevonden. Pas de zoekterm aan of upload media.</p>}
          </section>

          <section className="playlist-studio-timeline" id="playlist-items" aria-labelledby="playlist-items-title">
            <div className="workspace-section__header"><div><h2 className="workspace-section__title" id="playlist-items-title">Playlistitems</h2><p className="work-panel__meta">Volgorde en Playerinstellingen van het concept.</p></div><StatusPill label={`${data.items.length} items · ${formatDuration(readiness?.totalDurationSeconds ?? 0)}`} tone="neutral" /></div>
            {data.items.length ? <PlaylistTimelineEditor canWrite={canWrite} items={data.items} playlistId={playlist.id} revision={revision} /> : <div className="empty-state" role="status"><h2>Deze playlist is leeg</h2><p>Voeg minimaal één gereedstaand media-item toe voordat je kunt publiceren.</p><Button asChild><a href="#add-media">Media kiezen</a></Button></div>}
          </section>

          <aside className="playlist-studio-inspector" aria-label="Preview en publicatiegereedheid">
            <section className="inspector-panel" id="playlist-preview" aria-labelledby="playlist-preview-title"><div className="work-panel__header"><div><h2 className="work-panel__title" id="playlist-preview-title">Playerpreview</h2><p className="work-panel__meta">Dezelfde volgorde, duur, fit en muted-velden als het Playercontract.</p></div><StatusPill label="Veilige zone 5%" tone="info" /></div><PlaylistPreview items={previewItems} /></section>
            <section className="inspector-panel" aria-labelledby="readiness-title"><div className="work-panel__header"><div><h2 className="work-panel__title" id="readiness-title">Publicatiegereedheid</h2><p className="work-panel__meta">Deze centrale controle wordt opnieuw gebruikt bij publiceren.</p></div><StatusPill label={readiness?.canPublish ? "Klaar voor review" : "Niet klaar"} tone={readiness?.canPublish ? "success" : "warning"} /></div>
              {readiness?.canPublish ? <p className="notice notice--success" role="status">Alle {readiness.itemCount} items hebben een geldige Player-variant. Totale download: {formatBytes(readiness.totalBytes)}.</p> : <ol className="readiness-list">{readiness?.reasons.map((reason, index) => { const message = getReadinessCopy(reason); return <li key={`${reason.code}-${reason.itemId ?? index}`}><strong>{message.label}</strong><span>{message.detail}</span><span><b>Herstel:</b> {message.recovery}</span></li>; })}</ol>}
            </section>
          </aside>
        </div>

        <section className="playlist-studio-footer-actions" aria-label="Playlistbeheer">
          <p><strong>Archiveren</strong><span>Alleen mogelijk wanneer geen actief scherm deze playlist gebruikt.</span></p>
          <form action={archivePlaylist}><RevisionFields playlistId={playlist.id} revision={revision} /><Button disabled={!canManage} type="submit" variant="secondary">Playlist archiveren</Button></form>
        </section>
      </DirtyStateGuard> : null}
    </>
  );
}

function RevisionFields({ playlistId, revision }: { playlistId: string; revision: number }) {
  return <><input name="playlistId" type="hidden" value={playlistId} /><input name="expectedRevision" type="hidden" value={revision} /></>;
}

function ConflictPanel({ actual, expected, operation, playlistId, updatedBy }: { actual?: string; expected?: string; operation?: string; playlistId: string; updatedBy: string }) {
  return <section className="notice notice--warning playlist-conflict" id="playlist-conflict" role="alert"><div><strong>Dit concept is ondertussen gewijzigd.</strong><p>Jouw actie is niet uitgevoerd. De nieuwste revisie blijft intact, zodat er geen wijzigingen verloren gaan.</p></div><details><summary>Revisies vergelijken</summary><dl className="meta-list"><div><dt>Jouw revisie</dt><dd>{expected ?? "Onbekend"}</dd></div><div><dt>Nieuwste revisie</dt><dd>{actual ?? "Onbekend"}</dd></div><div><dt>Laatste bewerker</dt><dd>{updatedBy}</dd></div><div><dt>Niet uitgevoerde actie</dt><dd>{operationLabel(operation)}</dd></div></dl></details><div className="page-action-group"><Link className="button-link button-link--primary" href={`/dashboard/playlists/${playlistId}`}>Nieuwste versie laden</Link><a className="button-link button-link--secondary" href="#playlist-items">Wijziging opnieuw invoeren</a></div></section>;
}

function operationLabel(operation?: string) {
  const labels: Record<string, string> = { add_item: "Media toevoegen", archive: "Archiveren", move_item: "Volgorde wijzigen", publish: "Publiceren", remove_item: "Item verwijderen", update_details: "Conceptgegevens opslaan", update_item: "Iteminstellingen opslaan" };
  return operation ? labels[operation] ?? "Concept wijzigen" : "Concept wijzigen";
}

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}` : `${minutes}:${String(rest).padStart(2, "0")}`;
}

function formatVariantLabel(kind: "image" | "video", variant: { durationSeconds: number | null; height: number | null; width: number | null } | null) {
  if (!variant) return "Variant ontbreekt";
  if (kind === "video" && variant.durationSeconds) return `MP4 · ${new Intl.NumberFormat("nl-NL", { maximumFractionDigits: 1 }).format(variant.durationSeconds)} sec`;
  if (variant.width && variant.height) return `${variant.width} × ${variant.height}`;
  return kind === "video" ? "MP4-player variant" : "Gereed voor Player";
}

function formatBytes(bytes: number) {
  if (!bytes) return "0 MB";
  return bytes >= 1024 * 1024 * 1024 ? `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
