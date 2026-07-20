import Link from "next/link";
import { notFound } from "next/navigation";

import { hasCapability } from "@veyocast/auth";
import type { PlayerPlaybackItem } from "@veyocast/contracts";

import { requireControlSession } from "../../../../../lib/control-session";
import { PageHeader, StatusPill } from "../../../_components/shell-primitives";
import {
  addPlaylistItem,
  archivePlaylist,
  movePlaylistItem,
  publishPlaylist,
  removePlaylistItem,
  updatePlaylistDetails,
  updatePlaylistItem
} from "../actions";
import { loadPlaylistStudio } from "../data";
import { PlaylistPreview, type PlaylistPreviewItem } from "../playlist-preview";
import { getReadinessCopy } from "../readiness-copy";
import { DirtyStateGuard } from "./dirty-state-guard";

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
  const canPublish = Boolean(tenantIsMutable && hasCapability(session.roles, "tenant.playlist.publish"));
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
        actions={playlist ? <div className="page-action-group"><a className="button-link button-link--secondary" href="#playlist-preview">Voorbeeld</a><a className="button-link button-link--primary" href="#publish-playlist">Publiceren</a></div> : null}
        description={playlist ? `Revisie ${playlist.revision} · laatst bewerkt door ${playlist.updatedBy} op ${formatDate(playlist.updatedAt)}.` : "Open een live playlist om het concept te bewerken."}
        eyebrow={`${session.tenant} · Playlist Studio`}
        status={playlist ? playlistStatus(playlist.status, data.releases.length > 0) : { label: "Niet beschikbaar", tone: "warning" }}
        title={playlist?.name ?? "Playlist Studio"}
      />

      {query.fout ? <p className="notice notice--critical" role="alert"><strong>Actie mislukt.</strong> {query.fout}</p> : null}
      {query.succes ? <p className="notice notice--success" role="status">{query.succes}</p> : null}
      {data.error ? <p className="notice notice--critical" role="alert"><strong>Playlist Studio niet volledig geladen.</strong> {data.error}</p> : null}
      {!session.isLive ? <p className="notice notice--warning" role="status">Playlist Studio gebruikt alleen live tenantdata. Configureer Supabase en log opnieuw in.</p> : null}
      {query.conflict && playlist ? <ConflictPanel actual={query.actual} expected={query.expected} operation={query.operation} playlistId={playlist.id} updatedBy={playlist.updatedBy} /> : null}

      {playlist ? <DirtyStateGuard>
        <nav aria-label="Stappen in Playlist Studio" className="playlist-studio-steps">
          <a href="#playlist-items">1. Playlistitems</a>
          <a href="#add-media">2. Media toevoegen</a>
          <a href="#item-settings">3. Iteminstellingen</a>
          <a href="#playlist-preview">4. Preview</a>
          <a href="#publish-playlist">5. Publiceren</a>
        </nav>

        <section className="playlist-studio-details" aria-labelledby="concept-details-title">
          <div className="workspace-section__header"><div><h2 className="workspace-section__title" id="concept-details-title">Conceptgegevens</h2><p className="work-panel__meta">Opslaan wijzigt alleen het concept, nooit een bestaande release.</p></div><StatusPill label={`Revisie ${revision}`} tone="info" /></div>
          <form action={updatePlaylistDetails} className="playlist-details-form">
            <RevisionFields playlistId={playlist.id} revision={revision} />
            <div className="field"><label htmlFor="playlist-name">Playlistnaam</label><input defaultValue={playlist.name} disabled={!canWrite} id="playlist-name" maxLength={120} minLength={2} name="name" required type="text" /></div>
            <div className="field"><label htmlFor="playlist-description">Beschrijving</label><textarea defaultValue={playlist.description ?? ""} disabled={!canWrite} id="playlist-description" maxLength={500} name="description" rows={2} /></div>
            <button className="button-link button-link--secondary" disabled={!canWrite} type="submit">Conceptgegevens opslaan</button>
          </form>
        </section>

        <div className="playlist-studio-layout">
          <section className="playlist-studio-library" id="add-media" aria-labelledby="add-media-title">
            <div className="workspace-section__header"><div><h2 className="workspace-section__title" id="add-media-title">Media toevoegen</h2><p className="work-panel__meta">Alleen gereedstaande Player-varianten.</p></div><Link className="table-action" href="/dashboard/media">Media beheren</Link></div>
            <form className="playlist-media-search" method="get" role="search"><label className="field" htmlFor="playlist-media-search"><span>Media zoeken</span><input defaultValue={query.mediaq} id="playlist-media-search" name="mediaq" placeholder="Zoek media" type="search" /></label><button className="button-link button-link--secondary" type="submit">Zoeken</button></form>
            {availableAssets.length ? <ul className="playlist-media-picker">{availableAssets.map((asset) => <li key={asset.id}>
              <div className="playlist-media-picker__preview" data-kind={asset.kind}>{asset.kind === "video" ? "Video" : "Afbeelding"}</div>
              <div><strong>{asset.title}</strong><span>{formatVariantLabel(asset.kind, asset.variant)}</span></div>
              <form action={addPlaylistItem}><RevisionFields playlistId={playlist.id} revision={revision} /><input name="mediaAssetId" type="hidden" value={asset.id} /><button className="table-action" disabled={!canWrite} type="submit">Toevoegen</button></form>
            </li>)}</ul> : <p className="notice" role="status">Geen gereedstaande media gevonden. Pas de zoekterm aan of upload media.</p>}
          </section>

          <section className="playlist-studio-timeline" id="playlist-items" aria-labelledby="playlist-items-title">
            <div className="workspace-section__header"><div><h2 className="workspace-section__title" id="playlist-items-title">Playlistitems</h2><p className="work-panel__meta">Volgorde en Playerinstellingen van het concept.</p></div><StatusPill label={`${data.items.length} items · ${formatDuration(readiness?.totalDurationSeconds ?? 0)}`} tone="neutral" /></div>
            {data.items.length ? <ol className="playlist-item-list">{data.items.map((item, index) => {
              const asset = item.asset;
              return <li className="playlist-item" id={index === 0 ? "item-settings" : undefined} key={item.id}>
                <div className="playlist-item__preview" data-kind={asset?.kind ?? "unknown"}>{asset?.kind === "video" ? "Video" : "Afbeelding"}</div>
                <div className="playlist-item__body">
                  <div className="work-panel__header"><div><p className="playlist-item__position">Positie {index + 1}</p><h3 className="work-panel__title">{asset?.title ?? "Ontbrekende media"}</h3><p className="work-panel__meta">{asset?.mimeType ?? "Media niet beschikbaar"}</p></div><StatusPill label={asset?.status === "ready" && asset.variant ? "Gereed" : "Blokkade"} tone={asset?.status === "ready" && asset.variant ? "success" : "warning"} /></div>
                  <form action={updatePlaylistItem} className="playlist-item__settings"><RevisionFields playlistId={playlist.id} revision={revision} /><input name="itemId" type="hidden" value={item.id} /><div className="field"><label htmlFor={`duration-${item.id}`}>Duur in seconden</label><input defaultValue={item.durationSeconds} disabled={!canWrite} id={`duration-${item.id}`} max={3600} min={5} name="duration" required type="number" /></div><div className="field"><label htmlFor={`fit-${item.id}`}>Weergave</label><select defaultValue={item.fitMode} disabled={!canWrite} id={`fit-${item.id}`} name="fitMode"><option value="contain">Volledig in beeld</option><option value="cover">Schermvullend</option></select></div><label className="compact-check"><input defaultChecked={item.muted} disabled={!canWrite || asset?.kind !== "video"} name="muted" type="checkbox" /> Zonder geluid</label><button className="button-link button-link--secondary" disabled={!canWrite} type="submit">Iteminstellingen opslaan</button></form>
                  <div className="playlist-item__actions" aria-label={`Volgordeacties voor ${asset?.title ?? `item ${index + 1}`}`}>
                    <MoveForm direction="start" disabled={!canWrite || index === 0} itemId={item.id} label="Naar begin" playlistId={playlist.id} revision={revision} />
                    <MoveForm direction="up" disabled={!canWrite || index === 0} itemId={item.id} label="Omhoog" playlistId={playlist.id} revision={revision} />
                    <MoveForm direction="down" disabled={!canWrite || index === data.items.length - 1} itemId={item.id} label="Omlaag" playlistId={playlist.id} revision={revision} />
                    <MoveForm direction="end" disabled={!canWrite || index === data.items.length - 1} itemId={item.id} label="Naar einde" playlistId={playlist.id} revision={revision} />
                    <form action={removePlaylistItem}><RevisionFields playlistId={playlist.id} revision={revision} /><input name="itemId" type="hidden" value={item.id} /><button className="table-action table-action--critical" disabled={!canWrite} type="submit">Verwijderen</button></form>
                  </div>
                </div>
              </li>;
            })}</ol> : <div className="empty-state" role="status"><h2>Deze playlist is leeg</h2><p>Voeg minimaal één gereedstaand media-item toe voordat je kunt publiceren.</p><a className="button-link button-link--primary" href="#add-media">Media kiezen</a></div>}
          </section>

          <aside className="playlist-studio-inspector" aria-label="Preview en publicatiegereedheid">
            <section className="inspector-panel" id="playlist-preview" aria-labelledby="playlist-preview-title"><div className="work-panel__header"><div><h2 className="work-panel__title" id="playlist-preview-title">Playerpreview</h2><p className="work-panel__meta">Dezelfde volgorde, duur, fit en muted-velden als het Playercontract.</p></div><StatusPill label="Veilige zone 5%" tone="info" /></div><PlaylistPreview items={previewItems} /></section>
            <section className="inspector-panel" aria-labelledby="readiness-title"><div className="work-panel__header"><div><h2 className="work-panel__title" id="readiness-title">Publicatiegereedheid</h2><p className="work-panel__meta">Deze centrale controle wordt opnieuw gebruikt bij publiceren.</p></div><StatusPill label={readiness?.canPublish ? "Klaar voor review" : "Niet klaar"} tone={readiness?.canPublish ? "success" : "warning"} /></div>
              {readiness?.canPublish ? <p className="notice notice--success" role="status">Alle {readiness.itemCount} items hebben een geldige Player-variant. Totale download: {formatBytes(readiness.totalBytes)}.</p> : <ol className="readiness-list">{readiness?.reasons.map((reason, index) => { const message = getReadinessCopy(reason); return <li key={`${reason.code}-${reason.itemId ?? index}`}><strong>{message.label}</strong><span>{message.detail}</span><span><b>Herstel:</b> {message.recovery}</span></li>; })}</ol>}
            </section>
          </aside>
        </div>

        <section className="publish-workspace" id="publish-playlist" aria-labelledby="publish-playlist-title">
          <div className="workspace-section__header"><div><h2 className="workspace-section__title" id="publish-playlist-title">Publiceren</h2><p className="work-panel__meta">Maak een immutable release en wijs die als gewenste release aan schermen toe.</p></div><StatusPill label={`Volgende versie ${data.releases.length ? data.releases[0]!.version + 1 : 1}`} tone="neutral" /></div>
          <div className="publish-workspace__grid">
            <form action={publishPlaylist} className="playlist-form"><RevisionFields playlistId={playlist.id} revision={revision} /><fieldset className="checkbox-fieldset"><legend>Doelschermen</legend>{data.screens.length ? data.screens.map((screen) => <label className="check-row" key={screen.id}><input disabled={!canPublish} name="screenIds" type="checkbox" value={screen.id} /><span><strong>{screen.name}</strong><span className="work-panel__meta">{screen.orientation === "portrait" ? "Staand" : "Liggend"} · {screen.assignedPlaylistId === playlist.id ? "deze playlist toegewezen" : "nieuwe toewijzing"}</span></span></label>) : <p className="notice notice--warning">Maak eerst een actief scherm aan voordat je publiceert.</p>}</fieldset><div className="field"><label htmlFor="release-notes">Releasenotitie</label><textarea disabled={!canPublish} id="release-notes" maxLength={500} name="releaseNotes" placeholder="Wat verandert er in deze release?" rows={3} /></div><p className="notice" role="status">De huidige release blijft spelen totdat ieder bestand lokaal is gedownload en geverifieerd.</p><button className="button-link button-link--primary" disabled={!canPublish || !readiness?.canPublish || !data.screens.length} type="submit">Release publiceren</button></form>
            <section aria-labelledby="release-summary-title"><h3 id="release-summary-title">Conceptsamenvatting</h3><dl className="meta-list"><div><dt>Revisie</dt><dd>{revision}</dd></div><div><dt>Items</dt><dd>{readiness?.itemCount ?? 0}</dd></div><div><dt>Totale duur</dt><dd>{formatDuration(readiness?.totalDurationSeconds ?? 0)}</dd></div><div><dt>Downloadgrootte</dt><dd>{formatBytes(readiness?.totalBytes ?? 0)}</dd></div><div><dt>Laatste release</dt><dd>{data.releases[0] ? `Versie ${data.releases[0].version}` : "Nog geen"}</dd></div></dl></section>
          </div>
        </section>

        <section className="playlist-studio-footer-actions" aria-label="Playlistbeheer">
          <p><strong>Archiveren</strong><span>Alleen mogelijk wanneer geen actief scherm deze playlist gebruikt.</span></p>
          <form action={archivePlaylist}><RevisionFields playlistId={playlist.id} revision={revision} /><button className="button-link button-link--secondary" disabled={!canManage} type="submit">Playlist archiveren</button></form>
        </section>
      </DirtyStateGuard> : null}
    </>
  );
}

function RevisionFields({ playlistId, revision }: { playlistId: string; revision: number }) {
  return <><input name="playlistId" type="hidden" value={playlistId} /><input name="expectedRevision" type="hidden" value={revision} /></>;
}

function MoveForm({ direction, disabled, itemId, label, playlistId, revision }: { direction: string; disabled: boolean; itemId: string; label: string; playlistId: string; revision: number }) {
  return <form action={movePlaylistItem}><RevisionFields playlistId={playlistId} revision={revision} /><input name="itemId" type="hidden" value={itemId} /><input name="direction" type="hidden" value={direction} /><button className="table-action" disabled={disabled} type="submit">{label}</button></form>;
}

function ConflictPanel({ actual, expected, operation, playlistId, updatedBy }: { actual?: string; expected?: string; operation?: string; playlistId: string; updatedBy: string }) {
  return <section className="notice notice--warning playlist-conflict" id="playlist-conflict" role="alert"><div><strong>Dit concept is ondertussen gewijzigd.</strong><p>Jouw actie is niet uitgevoerd. De nieuwste revisie blijft intact, zodat er geen wijzigingen verloren gaan.</p></div><details><summary>Revisies vergelijken</summary><dl className="meta-list"><div><dt>Jouw revisie</dt><dd>{expected ?? "Onbekend"}</dd></div><div><dt>Nieuwste revisie</dt><dd>{actual ?? "Onbekend"}</dd></div><div><dt>Laatste bewerker</dt><dd>{updatedBy}</dd></div><div><dt>Niet uitgevoerde actie</dt><dd>{operationLabel(operation)}</dd></div></dl></details><div className="page-action-group"><Link className="button-link button-link--primary" href={`/dashboard/playlists/${playlistId}`}>Nieuwste versie laden</Link><a className="button-link button-link--secondary" href="#playlist-items">Wijziging opnieuw invoeren</a></div></section>;
}

function operationLabel(operation?: string) {
  const labels: Record<string, string> = { add_item: "Media toevoegen", archive: "Archiveren", move_item: "Volgorde wijzigen", publish: "Publiceren", remove_item: "Item verwijderen", update_details: "Conceptgegevens opslaan", update_item: "Iteminstellingen opslaan" };
  return operation ? labels[operation] ?? "Concept wijzigen" : "Concept wijzigen";
}

function playlistStatus(status: string, hasRelease: boolean) {
  if (status === "archived") return { label: "Gearchiveerd", tone: "neutral" as const };
  if (status === "published") return { label: "Gepubliceerd", tone: "success" as const };
  return { label: hasRelease ? "Bijwerken" : "Concept", tone: hasRelease ? "warning" as const : "info" as const };
}

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}` : `${minutes}:${String(rest).padStart(2, "0")}`;
}

function formatVariantLabel(kind: "image" | "video", variant: { height: number | null; width: number | null } | null) {
  if (!variant) return "Variant ontbreekt";
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
