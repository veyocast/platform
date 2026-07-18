import Link from "next/link";

import { requireControlSession } from "../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../lib/supabase/server";
import { HealthList, MetricCard, PageHeader, StatusPill, Timeline } from "../../_components/shell-primitives";
import {
  addPlaylistItem,
  archivePlaylist,
  createPlaylist,
  movePlaylistItem,
  publishPlaylist,
  removePlaylistItem,
  updatePlaylistDetails,
  updatePlaylistItem
} from "./actions";
import { PlaylistPreview, type PlaylistPreviewItem } from "./playlist-preview";

type PlaylistsPageProps = {
  searchParams: Promise<{ fout?: string; playlist?: string; q?: string; succes?: string }>;
};

type PlaylistRow = { created_at: string; description: string | null; id: string; name: string; status: string; updated_at: string };
type ItemRow = { duration_seconds: number; fit_mode: string; id: string; media_asset_id: string; muted: boolean; playlist_id: string; sort_order: number };
type AssetRow = { file_size_bytes: number; id: string; kind: "image" | "video"; mime_type: string; status: string; title: string };
type VariantRow = { asset_id: string; file_size_bytes: number; preview_url: string | null; storage_path: string; variant_type: string };
type ReleaseRow = { id: string; item_count: number; playlist_id: string; published_at: string; release_notes: string | null; total_bytes: number; total_duration_seconds: number; version: number };
type ScreenRow = { assigned_playlist_id: string | null; id: string; name: string; status: string };

const publishTimeline = [
  { detail: "Wijzig naam, volgorde, duur, uitsnede en audio zonder de actieve release te veranderen.", label: "Concept bewerken", meta: "Veilig", tone: "info" },
  { detail: "Castivo controleert ieder item, de player-variant, totale bytes en doelschermen.", label: "Publicatiereview", meta: "Blokkeert", tone: "warning" },
  { detail: "Een vaste snapshot krijgt een versienummer, manifest en SHA-256-hash.", label: "Release maken", meta: "Immutable", tone: "success" },
  { detail: "De huidige release blijft spelen totdat de Player de nieuwe release volledig heeft geverifieerd.", label: "Player bijwerken", meta: "Atomair", tone: "success" }
] as const;

export default async function PlaylistsPage({ searchParams }: PlaylistsPageProps) {
  const session = await requireControlSession();
  const params = await searchParams;
  const data = await loadPlaylistData(session.tenantId, session.isLive, params.playlist);
  const canWrite = session.isLive && session.roles.some((role) => ["platform_owner", "platform_admin", "tenant_owner", "tenant_admin", "tenant_editor"].includes(role));
  const canManage = session.isLive && session.roles.some((role) => ["platform_owner", "platform_admin", "tenant_owner", "tenant_admin"].includes(role));
  const query = (params.q ?? "").trim().toLocaleLowerCase("nl-NL");
  const visiblePlaylists = query ? data.playlists.filter((playlist) => playlist.name.toLocaleLowerCase("nl-NL").includes(query)) : data.playlists;
  const selected = data.playlists.find((playlist) => playlist.id === params.playlist) ?? visiblePlaylists[0] ?? null;
  const selectedItems = selected ? data.items.filter((item) => item.playlist_id === selected.id).sort((a, b) => a.sort_order - b.sort_order) : [];
  const assets = new Map(data.assets.map((asset) => [asset.id, asset]));
  const variants = new Map(data.variants.map((variant) => [`${variant.asset_id}:${variant.variant_type}`, variant]));
  const selectedReleases = selected ? data.releases.filter((release) => release.playlist_id === selected.id) : [];
  const readyAssets = data.assets.filter((asset) => asset.status === "ready");
  const review = reviewPlaylist(selectedItems, assets, variants);
  const totalDuration = selectedItems.reduce((total, item) => total + item.duration_seconds, 0);
  const previewItems: PlaylistPreviewItem[] = selectedItems.flatMap((item) => {
    const asset = assets.get(item.media_asset_id);
    const variant = asset ? variants.get(`${asset.id}:${asset.kind === "video" ? "player_1080p" : "original"}`) : null;
    if (!asset || !variant?.preview_url) return [];
    return [{ durationSeconds: item.duration_seconds, fitMode: item.fit_mode as PlaylistPreviewItem["fitMode"], id: item.id, kind: asset.kind, muted: item.muted, title: asset.title, url: variant.preview_url }];
  });
  const draftCount = data.playlists.filter((playlist) => playlist.status === "draft").length;
  const publishedCount = data.playlists.filter((playlist) => playlist.status === "published").length;

  return (
    <>
      <PageHeader
        actions={<a className="button-link button-link--primary" href="#new-playlist">Nieuwe playlist</a>}
        description="Bouw echte concepten met gereedstaande media en publiceer alleen een volledige, onveranderlijke release naar gekozen schermen."
        eyebrow={session.tenant}
        status={{ label: session.isLive ? "Live tenantdata" : "Demomodus zonder mutaties", tone: session.isLive ? "success" : "warning" }}
        title="Playlists"
      />

      {params.fout ? <p className="notice notice--critical" role="alert"><strong>Actie mislukt.</strong> {params.fout}</p> : null}
      {params.succes ? <p className="notice notice--success" role="status">{params.succes}</p> : null}
      {data.error ? <p className="notice notice--critical" role="alert"><strong>Playlists niet geladen.</strong> {data.error}</p> : null}
      {!session.isLive ? <p className="notice notice--warning" role="status">Configureer Supabase en log in om echte playlists te maken, bewerken en publiceren.</p> : null}

      <section className="metric-grid" aria-label="Playlistoverzicht">
        <MetricCard detail="Concepten met wijzigingen die nog niet actief zijn." label="Concepten" tone="info" value={String(draftCount)} />
        <MetricCard detail="Playlists met minimaal één immutable release." label="Gepubliceerd" tone="success" value={String(publishedCount)} />
        <MetricCard detail="Items die een publicatie momenteel blokkeren." label="Reviewblokkades" tone={review.blocked ? "warning" : "success"} value={String(review.blocked)} />
      </section>

      <form className="resource-toolbar" method="get" role="search">
        <div className="resource-toolbar__group">
          <input aria-label="Zoeken in playlists" className="toolbar-search" defaultValue={params.q} name="q" placeholder="Zoeken op playlistnaam" type="search" />
          <button className="button-link button-link--secondary" type="submit">Zoeken</button>
        </div>
        <p className="resource-toolbar__summary">{visiblePlaylists.length} zichtbaar · laatst gewijzigd eerst</p>
      </form>

      <section className="playlist-workspace">
        <section className="workspace-section" aria-labelledby="playlist-list-title">
          <div className="workspace-section__header">
            <div><h2 className="workspace-section__title" id="playlist-list-title">Playlists</h2><p className="work-panel__meta">Open een playlist om het concept te bewerken.</p></div>
            <StatusPill label={`${data.playlists.length} totaal`} tone="neutral" />
          </div>
          {visiblePlaylists.length ? (
            <div className="data-table-frame">
              <table className="data-table data-table--responsive">
                <caption>Playlists binnen de actieve vereniging.</caption>
                <thead><tr><th scope="col">Playlist</th><th scope="col">Status</th><th scope="col">Inhoud</th><th scope="col">Duur</th><th scope="col">Laatste wijziging</th><th scope="col">Actie</th></tr></thead>
                <tbody>{visiblePlaylists.map((playlist) => {
                  const playlistItems = data.items.filter((item) => item.playlist_id === playlist.id);
                  return <tr key={playlist.id} aria-current={selected?.id === playlist.id ? "true" : undefined}>
                    <td data-label="Playlist"><span className="table-primary">{playlist.name}</span><span className="table-secondary">{playlist.description || "Geen beschrijving"}</span></td>
                    <td data-label="Status"><StatusPill label={playlist.status === "published" ? "Gepubliceerd" : "Concept"} tone={playlist.status === "published" ? "success" : "info"} /></td>
                    <td data-label="Inhoud">{playlistItems.length} {playlistItems.length === 1 ? "item" : "items"}</td>
                    <td data-label="Duur">{formatDuration(playlistItems.reduce((sum, item) => sum + item.duration_seconds, 0))}</td>
                    <td data-label="Laatste wijziging">{formatDate(playlist.updated_at)}</td>
                    <td data-label="Actie"><Link className="table-action" href={`/dashboard/playlists?playlist=${playlist.id}`}>Openen</Link></td>
                  </tr>;
                })}</tbody>
              </table>
            </div>
          ) : <p className="notice" role="status">Nog geen playlists. Maak een concept en voeg daarna gereedstaande media toe.</p>}
        </section>

        <aside className="workspace-aside" aria-label="Playlist aanmaken en conceptdetails">
          <section className="inspector-panel" id="new-playlist" aria-labelledby="new-playlist-title">
            <div className="work-panel__header"><div><h2 className="work-panel__title" id="new-playlist-title">Nieuwe playlist</h2><p className="work-panel__meta">Een nieuw concept raakt nog geen scherm.</p></div><StatusPill label="Concept" tone="info" /></div>
            <form action={createPlaylist} className="playlist-form">
              <div className="field"><label htmlFor="new-playlist-name">Playlistnaam</label><input disabled={!canWrite} id="new-playlist-name" maxLength={120} minLength={2} name="name" placeholder="Bijvoorbeeld kantineprogramma" required type="text" /></div>
              <div className="field"><label htmlFor="new-playlist-description">Beschrijving</label><textarea disabled={!canWrite} id="new-playlist-description" maxLength={500} name="description" rows={3} /></div>
              <button className="button-link button-link--primary" disabled={!canWrite} type="submit">Concept maken</button>
            </form>
          </section>

          {selected ? <section className="inspector-panel" aria-labelledby="playlist-details-title">
            <div className="work-panel__header"><div><h2 className="work-panel__title" id="playlist-details-title">Conceptdetails</h2><p className="work-panel__meta">{selected.name}</p></div><StatusPill label={selected.status === "published" ? "Actief concept gelijk aan release" : "Concept gewijzigd"} tone={selected.status === "published" ? "success" : "info"} /></div>
            <form action={updatePlaylistDetails} className="playlist-form">
              <input name="playlistId" type="hidden" value={selected.id} />
              <div className="field"><label htmlFor="playlist-name">Playlistnaam</label><input defaultValue={selected.name} disabled={!canWrite} id="playlist-name" maxLength={120} minLength={2} name="name" required type="text" /></div>
              <div className="field"><label htmlFor="playlist-description">Beschrijving</label><textarea defaultValue={selected.description ?? ""} disabled={!canWrite} id="playlist-description" maxLength={500} name="description" rows={3} /></div>
              <button className="button-link button-link--secondary" disabled={!canWrite} type="submit">Conceptgegevens opslaan</button>
            </form>
            <dl className="meta-list"><div><dt>Items</dt><dd>{selectedItems.length}</dd></div><div><dt>Totale duur</dt><dd>{formatDuration(totalDuration)}</dd></div><div><dt>Releases</dt><dd>{selectedReleases.length}</dd></div></dl>
            {canManage ? <form action={archivePlaylist}><input name="playlistId" type="hidden" value={selected.id} /><button className="button-link button-link--secondary" type="submit">Playlist archiveren</button></form> : null}
          </section> : null}
        </aside>
      </section>

      {selected ? <section className="playlist-editor" aria-labelledby="playlist-editor-title">
        <div className="workspace-section__header"><div><h2 className="workspace-section__title" id="playlist-editor-title">Playlistitems</h2><p className="work-panel__meta">Wijzig de volgorde met Omhoog en Omlaag; publicatie blijft een aparte actie.</p></div><StatusPill label={`${selectedItems.length} items · ${formatDuration(totalDuration)}`} tone="neutral" /></div>

        <section className="data-surface" aria-labelledby="add-media-title">
          <div className="work-panel__header"><div><h3 className="work-panel__title" id="add-media-title">Media toevoegen</h3><p className="work-panel__meta">Alleen volledig gereedstaande tenantmedia is beschikbaar.</p></div><Link className="button-link button-link--secondary" href="/dashboard/media">Media uploaden</Link></div>
          <form action={addPlaylistItem} className="inline-form"><input name="playlistId" type="hidden" value={selected.id} /><div className="field"><label htmlFor="playlist-media-asset">Gereedstaande media</label><select disabled={!canWrite || !readyAssets.length} id="playlist-media-asset" name="mediaAssetId" required><option value="">Kies media</option>{readyAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.title} · {asset.kind === "video" ? "Video" : "Afbeelding"}</option>)}</select></div><button className="button-link button-link--primary" disabled={!canWrite || !readyAssets.length} type="submit">Aan playlist toevoegen</button></form>
        </section>

        <section className="data-surface" id="playlist-preview" aria-labelledby="playlist-preview-title">
          <div className="work-panel__header"><div><h3 className="work-panel__title" id="playlist-preview-title">Playerpreview</h3><p className="work-panel__meta">16:9-voorbeeld met de ingestelde volgorde, duur, uitsnede en muted video.</p></div><StatusPill label="Veilige zone 5%" tone="info" /></div>
          <PlaylistPreview items={previewItems} />
        </section>

        {selectedItems.length ? <ol className="playlist-item-list">{selectedItems.map((item, index) => {
          const asset = assets.get(item.media_asset_id);
          const isVideo = asset?.kind === "video";
          return <li className="playlist-item" key={item.id}>
            <div className="playlist-item__preview" data-kind={asset?.kind ?? "unknown"}>{isVideo ? "Video" : "Afbeelding"}</div>
            <div className="playlist-item__body">
              <div className="work-panel__header"><div><p className="playlist-item__position">Positie {index + 1}</p><h3 className="work-panel__title">{asset?.title ?? "Ontbrekende media"}</h3><p className="work-panel__meta">{asset?.mime_type ?? "Media niet beschikbaar"}</p></div><StatusPill label={asset?.status === "ready" ? "Gereed" : "Blokkade"} tone={asset?.status === "ready" ? "success" : "warning"} /></div>
              <form action={updatePlaylistItem} className="playlist-item__settings"><input name="playlistId" type="hidden" value={selected.id} /><input name="itemId" type="hidden" value={item.id} /><div className="field"><label htmlFor={`duration-${item.id}`}>Duur in seconden</label><input defaultValue={item.duration_seconds} disabled={!canWrite} id={`duration-${item.id}`} max={3600} min={5} name="duration" required type="number" /></div><div className="field"><label htmlFor={`fit-${item.id}`}>Weergave</label><select defaultValue={item.fit_mode} disabled={!canWrite} id={`fit-${item.id}`} name="fitMode"><option value="contain">Volledig in beeld</option><option value="cover">Schermvullend</option></select></div><label className="compact-check"><input defaultChecked={item.muted} disabled={!canWrite || !isVideo} name="muted" type="checkbox" /> Zonder geluid</label><button className="button-link button-link--secondary" disabled={!canWrite} type="submit">Iteminstellingen opslaan</button></form>
              <div className="playlist-item__actions">
                <form action={movePlaylistItem}><input name="playlistId" type="hidden" value={selected.id} /><input name="itemId" type="hidden" value={item.id} /><input name="direction" type="hidden" value="up" /><button className="table-action" disabled={!canWrite || index === 0} type="submit">Omhoog</button></form>
                <form action={movePlaylistItem}><input name="playlistId" type="hidden" value={selected.id} /><input name="itemId" type="hidden" value={item.id} /><input name="direction" type="hidden" value="down" /><button className="table-action" disabled={!canWrite || index === selectedItems.length - 1} type="submit">Omlaag</button></form>
                <form action={removePlaylistItem}><input name="playlistId" type="hidden" value={selected.id} /><input name="itemId" type="hidden" value={item.id} /><button className="table-action table-action--critical" disabled={!canWrite} type="submit">Verwijderen</button></form>
              </div>
            </div>
          </li>;
        })}</ol> : <p className="notice" role="status">Deze playlist is leeg. Voeg minimaal één gereedstaand media-item toe voordat je kunt publiceren.</p>}
      </section> : null}

      <section className="work-grid">
        <section className="data-surface" aria-labelledby="publish-review-title">
          <div className="work-panel__header"><div><h2 className="work-panel__title" id="publish-review-title">Publicatiereview</h2><p className="work-panel__meta">Controleer inhoud, omvang en doelschermen vóór de immutable snapshot.</p></div><StatusPill label={selected && !review.blocked && selectedItems.length ? "Klaar voor review" : "Niet klaar"} tone={selected && !review.blocked && selectedItems.length ? "success" : "warning"} /></div>
          {selected ? <>
            <HealthList ariaLabel="Publicatiereview controles" items={[
              { detail: "Een lege playlist kan niet worden gepubliceerd.", label: "Minimaal één item", status: selectedItems.length ? `${selectedItems.length} items` : "Blokkade", tone: selectedItems.length ? "success" : "warning" },
              { detail: "Afbeeldingen gebruiken original; video vereist een geverifieerde 1080p-player-variant.", label: "Alle media gereed", status: review.blocked ? `${review.blocked} blokkades` : "Gereed", tone: review.blocked ? "warning" : "success" },
              { detail: "Publiceren maakt nieuwe, onveranderlijke release-items en een manifest-hash.", label: "Immutable release", status: "Bevestigd", tone: "success" }
            ]} />
            <dl className="meta-list"><div><dt>Totale duur</dt><dd>{formatDuration(totalDuration)}</dd></div><div><dt>Downloadgrootte</dt><dd>{formatBytes(review.totalBytes)}</dd></div><div><dt>Nieuwe versie</dt><dd>v{(selectedReleases[0]?.version ?? 0) + 1}</dd></div></dl>
            <form action={publishPlaylist} className="playlist-form"><input name="playlistId" type="hidden" value={selected.id} /><fieldset className="checkbox-fieldset"><legend>Doelschermen</legend>{data.screens.length ? data.screens.map((screen) => <label className="check-row" key={screen.id}><input disabled={!canWrite} name="screenIds" type="checkbox" value={screen.id} /><span><strong>{screen.name}</strong><span className="work-panel__meta">{screen.assigned_playlist_id === selected.id ? "Deze playlist is hier al toegewezen" : "Nieuwe toewijzing"}</span></span></label>) : <p className="notice notice--warning">Maak eerst een actief scherm aan voordat je publiceert.</p>}</fieldset><div className="field"><label htmlFor="release-notes">Releasenotitie</label><textarea disabled={!canWrite} id="release-notes" maxLength={500} name="releaseNotes" placeholder="Wat verandert er in deze release?" rows={3} /></div><p className="notice" role="status">De huidige release blijft spelen totdat ieder bestand van deze nieuwe release lokaal is gedownload en geverifieerd.</p><button className="button-link button-link--primary" disabled={!canWrite || !selectedItems.length || Boolean(review.blocked) || !data.screens.length} type="submit">Release publiceren</button></form>
          </> : <p className="notice" role="status">Maak of open eerst een playlist om de publicatiereview uit te voeren.</p>}
        </section>

        <section className="data-surface" aria-labelledby="release-history-title">
          <div className="work-panel__header"><div><h2 className="work-panel__title" id="release-history-title">Releasehistorie</h2><p className="work-panel__meta">Oude versies blijven onveranderlijk en controleerbaar.</p></div><StatusPill label={`${selectedReleases.length} versies`} tone="neutral" /></div>
          {selectedReleases.length ? <ol className="release-history">{selectedReleases.map((release, index) => <li key={release.id}><span><strong>{selected?.name} v{release.version}</strong><span className="work-panel__meta">{formatDate(release.published_at)} · {release.item_count} items · {formatBytes(release.total_bytes)}</span></span><StatusPill label={index === 0 ? "Nieuwste" : "Historie"} tone={index === 0 ? "success" : "neutral"} /></li>)}</ol> : <p className="notice">Deze playlist heeft nog geen gepubliceerde release.</p>}
        </section>
      </section>

      <section className="data-surface" aria-labelledby="publish-timeline-title"><div className="work-panel__header"><div><h2 className="work-panel__title" id="publish-timeline-title">Publicatietijdlijn</h2><p className="work-panel__meta">Van bewerkbaar concept naar atomair bijgewerkte Player.</p></div><StatusPill label="Immutable" tone="success" /></div><Timeline ariaLabel="Playlist publicatietijdlijn" items={publishTimeline} /></section>
    </>
  );
}

async function loadPlaylistData(tenantId: string | null, isLive: boolean, requestedPlaylistId?: string) {
  const empty = { assets: [] as AssetRow[], error: null as string | null, items: [] as ItemRow[], playlists: [] as PlaylistRow[], releases: [] as ReleaseRow[], screens: [] as ScreenRow[], variants: [] as VariantRow[] };
  if (!isLive || !tenantId) return empty;
  const supabase = await createControlSupabaseClient();
  if (!supabase) return { ...empty, error: "De beveiligde datasessie ontbreekt." };
  const [playlists, items, assets, variants, releases, screens] = await Promise.all([
    supabase.from("playlists").select("id, name, description, status, created_at, updated_at").eq("tenant_id", tenantId).neq("status", "archived").order("updated_at", { ascending: false }),
    supabase.from("playlist_items").select("id, playlist_id, media_asset_id, sort_order, duration_seconds, fit_mode, muted").eq("tenant_id", tenantId).order("sort_order", { ascending: true }),
    supabase.from("media_assets").select("id, title, kind, mime_type, status, file_size_bytes").eq("tenant_id", tenantId).is("deleted_at", null).order("created_at", { ascending: false }),
    supabase.from("media_variants").select("asset_id, variant_type, file_size_bytes, storage_path").eq("tenant_id", tenantId),
    supabase.from("playlist_releases").select("id, playlist_id, version, release_notes, item_count, total_duration_seconds, total_bytes, published_at").eq("tenant_id", tenantId).order("published_at", { ascending: false }),
    supabase.from("screens").select("id, name, status, assigned_playlist_id").eq("tenant_id", tenantId).eq("status", "active").order("name")
  ]);
  const error = [playlists.error, items.error, assets.error, variants.error, releases.error, screens.error].find(Boolean);
  if (error) { console.error("Playlistbeheer laden mislukt", error); return { ...empty, error: "De actuele playlistgegevens konden niet veilig worden gelezen. Vernieuw de pagina of log opnieuw in." }; }
  const previewPlaylistId = (playlists.data ?? []).some((playlist) => playlist.id === requestedPlaylistId) ? requestedPlaylistId : playlists.data?.[0]?.id;
  const previewAssetIds = new Set((items.data ?? []).filter((item) => item.playlist_id === previewPlaylistId).map((item) => item.media_asset_id));
  const signedVariants = await Promise.all((variants.data ?? []).map(async (variant) => {
    if (!previewAssetIds.has(variant.asset_id)) return { ...variant, preview_url: null };
    const { data } = await supabase.storage.from("tenant-media").createSignedUrl(variant.storage_path, 600);
    return { ...variant, preview_url: data?.signedUrl ?? null };
  }));
  return { assets: (assets.data ?? []) as AssetRow[], error: null, items: (items.data ?? []) as ItemRow[], playlists: (playlists.data ?? []) as PlaylistRow[], releases: (releases.data ?? []) as ReleaseRow[], screens: (screens.data ?? []) as ScreenRow[], variants: signedVariants as VariantRow[] };
}

function reviewPlaylist(items: ItemRow[], assets: Map<string, AssetRow>, variants: Map<string, VariantRow>) {
  let blocked = 0; let totalBytes = 0;
  for (const item of items) { const asset = assets.get(item.media_asset_id); const variant = asset ? variants.get(`${asset.id}:${asset.kind === "video" ? "player_1080p" : "original"}`) : null; if (!asset || asset.status !== "ready" || !variant) blocked += 1; else totalBytes += Number(variant.file_size_bytes); }
  return { blocked, totalBytes };
}

function formatDuration(seconds: number) { const hours = Math.floor(seconds / 3600); const minutes = Math.floor((seconds % 3600) / 60); const rest = seconds % 60; return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}` : `${minutes}:${String(rest).padStart(2, "0")}`; }
function formatBytes(bytes: number) { if (!bytes) return "0 MB"; return bytes >= 1024 * 1024 * 1024 ? `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`; }
function formatDate(value: string) { return new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
