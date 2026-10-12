"use client";

/* eslint-disable @next/next/no-img-element */
import {
  Archive,
  CheckCircle2,
  Clock3,
  Eye,
  FileWarning,
  Image as ImageIcon,
  MoreHorizontal,
  Star,
  ListPlus,
  Pencil,
  Trash2,
  Video
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";

import {
  BulkActionBar,
  Button,
  DataTable,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  IconButton,
  StatusPill
} from "@veyocast/ui";

import { addPlaylistItem } from "../playlists/actions";
import { bulkOrganizeMediaAssets, bulkOrganizeMediaAssetsAndRedirect } from "./actions";
import {
  archiveMediaResources,
  type MediaArchiveState
} from "./media-resource-actions";
import styles from "./media-resource.module.css";
import sites from "./sites-media.module.css";
import { SitesMediaEditor } from "./sites-media-editor";

export type MediaLibraryAsset = {
  createdLabel: string;
  details: string;
  draftCount: number;
  fileName: string;
  folderName: string;
  folderId?: string | null;
  collectionLabels?: readonly string[];
  updatedAt?: string;
  tagLabels: readonly string[];
  id: string;
  isFavorite: boolean;
  kind: "image" | "video";
  manageHref: string;
  previewUrl: string | null;
  releaseCount: number;
  screenCount: number;
  status: string;
  statusLabel: string;
  statusTone: "critical" | "neutral" | "success" | "warning";
  title: string;
  updatedLabel: string;
  usage: string;
};

type Option = { id: string; name: string };
type PlaylistOption = Option & { revision: number };

export function MediaLibraryWorkspace({
  assets,
  canAddToPlaylist,
  canBulk,
  collections,
  folders,
  playlists,
  tags,
  view
}: {
  assets: readonly MediaLibraryAsset[];
  canAddToPlaylist: boolean;
  canBulk: boolean;
  collections: readonly Option[];
  folders: readonly Option[];
  playlists: readonly PlaylistOption[];
  tags: readonly Option[];
  view: "grid" | "list";
}) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [editing, setEditing] = useState<MediaLibraryAsset | null>(null);
  const selectedAssets = useMemo(
    () => assets.filter((asset) => selected.has(asset.id)),
    [assets, selected]
  );
  const allSelected = assets.length > 0 && selectedAssets.length === assets.length;

  if (!assets.length) {
    return (
      <div className={sites.empty} role="status"><h3>Geen beelden gevonden</h3><p>Pas je zoekopdracht aan of voeg een nieuw clubbeeld toe.</p></div>
    );
  }

  function toggle(assetId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(assetId)) next.delete(assetId);
      else next.add(assetId);
      return next;
    });
  }

  const selectionControl = (asset: MediaLibraryAsset) => (
    <label className={styles.checkbox}>
      <input
        aria-label={`${asset.title} selecteren`}
        checked={selected.has(asset.id)}
        disabled={!canBulk}
        onChange={() => toggle(asset.id)}
        type="checkbox"
      />
    </label>
  );

  return (
    <>
      {canBulk ? (
        <div className={sites.selectionBar}>
          <label>
            <input
              checked={allSelected}
              onChange={() => setSelected(allSelected ? new Set() : new Set(assets.map((asset) => asset.id)))}
              type="checkbox"
            />
            <span>Zichtbare beelden selecteren</span>
          </label>
          <span aria-live="polite">{selectedAssets.length} geselecteerd</span>
        </div>
      ) : null}

      <div className={view === "grid" ? sites.mediaGrid : sites.mediaList}>
        {assets.map((asset) => (
          <article className={`${sites.mediaCard} ${sites.organizedMedia}`} data-selected={selected.has(asset.id)} key={asset.id}>
            <div className={sites.mediaControls}>
              <input aria-label={`${asset.title} selecteren`} checked={selected.has(asset.id)} disabled={!canBulk} onChange={() => toggle(asset.id)} type="checkbox" />
              <form action={bulkOrganizeMediaAssetsAndRedirect}><input name="assetIds" type="hidden" value={JSON.stringify([asset.id])} /><input name="bulkCommand" type="hidden" value={asset.isFavorite ? "unfavorite" : "favorite"} /><button aria-label={`${asset.title} ${asset.isFavorite ? "uit favorieten verwijderen" : "favoriet maken"}`} aria-pressed={asset.isFavorite} disabled={!canBulk} type="submit"><Star aria-hidden="true" fill={asset.isFavorite ? "currentColor" : "none"} size={17} /></button></form>
            </div>
            <button className={sites.mediaOpen} onClick={() => setEditing(asset)} type="button">
              <div className={sites.mediaImage}><LibraryPreview asset={asset} /><span><Eye aria-hidden="true" size={17} />Bekijken</span></div>
              <div className={sites.mediaInfo}><span className={sites.smallIcon}>{asset.kind === "video" ? <Video aria-hidden="true" size={17} /> : <ImageIcon aria-hidden="true" size={17} />}</span><div><strong>{asset.title}</strong><small>{asset.folderName} · {asset.usage}</small></div><MoreHorizontal aria-hidden="true" size={19} /></div>
            </button>
            {asset.tagLabels.length ? <div className={sites.tags}>{asset.tagLabels.slice(0,3).map((tag) => <span key={tag}>{tag}</span>)}</div> : null}
            {asset.status !== "ready" ? <div className={sites.stateLabel}><MediaStatus asset={asset} /></div> : null}
          </article>
        ))}
      </div>
      {editing ? <SitesMediaEditor asset={editing} canWrite={canBulk && editing.status !== "archived"} folders={folders} onClose={() => setEditing(null)} addAction={pending => <AddMediaToPlaylistDialog asset={editing} disabled={pending || !canAddToPlaylist || editing.status !== "ready" || !playlists.length} label="Aan playlist toevoegen" playlists={playlists} />} archiveAction={pending => <MediaArchiveDialog assets={[editing]} disabled={pending || !canBulk} label={editing.title} onSuccess={() => { setSelected(current => withoutId(current, editing.id)); setEditing(null); }} trigger={<button className={sites.dangerLink} disabled={pending || !canBulk} type="button"><Archive aria-hidden="true" size={15} />{editing.kind === "image" ? "Afbeelding archiveren" : "Video archiveren"}</button>} />} /> : null}
      {view === "list" ? (
        <details className={sites.tableOptions}><summary>Uitgebreide tabel en media-acties</summary>
        <DataTable caption="Media binnen de actieve vereniging." tableKey="media">
          <thead>
            <tr>
              <th scope="col">Selectie</th>
              <th data-column="type" scope="col">Type</th>
              <th data-column="name" scope="col">Naam media</th>
              <th data-column="status" scope="col">Status</th>
              <th data-column="created" scope="col">Aangemaakt op</th>
              <th data-column="updated" scope="col">Bijgewerkt op</th>
              <th data-column="actions" scope="col">Acties</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((asset) => (
              <tr data-selected={selected.has(asset.id)} key={asset.id}>
                <td data-label="Selectie">{selectionControl(asset)}</td>
                <td data-column="type" data-label="Type"><MediaType asset={asset} /></td>
                <td data-column="name" data-label="Naam media">
                  <span className="table-primary">{asset.isFavorite ? "★ " : ""}{asset.title}</span>
                  <span className="table-secondary">{asset.fileName}</span>
                  <span className="table-secondary">{asset.details} · {asset.usage}</span>
                </td>
                <td data-column="status" data-label="Status"><MediaStatus asset={asset} /></td>
                <td data-column="created" data-label="Aangemaakt op">{asset.createdLabel}</td>
                <td data-column="updated" data-label="Bijgewerkt op">{asset.updatedLabel}</td>
                <td data-column="actions" data-label="Acties">
                  <MediaActions
                    asset={asset}
                    canAddToPlaylist={canAddToPlaylist}
                    canArchive={canBulk}
                    canWrite={canBulk}
                    onArchived={() => setSelected((current) => withoutId(current, asset.id))}
                    playlists={playlists}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
        </details>
      ) : null}

      {canBulk && selectedAssets.length ? (
        <BulkActionBar
          className={sites.bulkBar}
          actions={(
            <>
              <form
                action={async (formData) => {
                  const message = await bulkOrganizeMediaAssets(formData);
                  window.location.assign(`/dashboard/media?succes=${encodeURIComponent(message)}`);
                }}
                className={styles.organizeForm}
              >
                <input name="assetIds" type="hidden" value={JSON.stringify(selectedAssets.map((asset) => asset.id))} />
                <label>
                  <span>Organiseren</span>
                  <select defaultValue="" name="bulkCommand" required>
                    <option disabled value="">Kies een actie</option>
                    <option value="favorite">Favoriet maken</option>
                    <option value="unfavorite">Uit favorieten verwijderen</option>
                    <optgroup label="Verplaatsen naar map">
                      <option value="move:root">Hoofdniveau</option>
                      {folders.map((folder) => <option key={folder.id} value={`move:${folder.id}`}>{folder.name}</option>)}
                    </optgroup>
                    {tags.length ? <optgroup label="Tag toevoegen">{tags.map((tag) => <option key={tag.id} value={`tag:add:${tag.id}`}>{tag.name}</option>)}</optgroup> : null}
                    {tags.length ? <optgroup label="Tag verwijderen">{tags.map((tag) => <option key={tag.id} value={`tag:remove:${tag.id}`}>{tag.name}</option>)}</optgroup> : null}
                    {collections.length ? <optgroup label="Aan collectie toevoegen">{collections.map((collection) => <option key={collection.id} value={`collection:add:${collection.id}`}>Toevoegen: {collection.name}</option>)}</optgroup> : null}
                    {collections.length ? <optgroup label="Uit collectie verwijderen">{collections.map((collection) => <option key={collection.id} value={`collection:remove:${collection.id}`}>Verwijderen: {collection.name}</option>)}</optgroup> : null}
                  </select>
                </label>
                <Button type="submit" variant="secondary">Toepassen</Button>
              </form>
              <MediaArchiveDialog
                assets={selectedAssets}
                label={`${selectedAssets.length} geselecteerde ${selectedAssets.length === 1 ? "media-item" : "media-items"}`}
                onSuccess={() => setSelected(new Set())}
                trigger={<Button type="button" variant="destructive"><Trash2 aria-hidden="true" />Verwijderen</Button>}
              />
              <Button onClick={() => setSelected(new Set())} type="button" variant="secondary">Selectie wissen</Button>
            </>
          )}
          description="Organiseer of archiveer de selectie. Conceptimpact wordt opnieuw server-side gecontroleerd."
          title={`${selectedAssets.length} ${selectedAssets.length === 1 ? "item geselecteerd" : "items geselecteerd"}`}
        />
      ) : null}
    </>
  );
}

function MediaActions({
  asset,
  canAddToPlaylist,
  canArchive,
  canWrite,
  onArchived,
  playlists
}: {
  asset: MediaLibraryAsset;
  canAddToPlaylist: boolean;
  canArchive: boolean;
  canWrite: boolean;
  onArchived: () => void;
  playlists: readonly PlaylistOption[];
}) {
  return (
    <div className={styles.actions}>
      <MediaPreviewDialog asset={asset} />
      {canWrite ? (
        <IconButton asChild aria-label={`${asset.title} bewerken`} title="Bewerken">
          <a href={`${asset.manageHref}#media-rename-title`}><Pencil aria-hidden="true" /></a>
        </IconButton>
      ) : (
        <IconButton aria-label={`${asset.title} kan niet worden bewerkt`} disabled title="Geen schrijfrechten">
          <Pencil aria-hidden="true" />
        </IconButton>
      )}
      <MediaArchiveDialog
        assets={[asset]}
        disabled={!canArchive}
        label={asset.title}
        onSuccess={onArchived}
        trigger={(
          <IconButton
            aria-label={`${asset.title} verwijderen`}
            disabled={!canArchive}
            title={canArchive ? "Verwijderen" : "Niet beschikbaar in deze weergave"}
            variant="destructive"
          >
            <Trash2 aria-hidden="true" />
          </IconButton>
        )}
      />
      <AddMediaToPlaylistDialog
        asset={asset}
        disabled={!canAddToPlaylist || asset.status !== "ready" || !playlists.length}
        playlists={playlists}
      />
    </div>
  );
}

function MediaPreviewDialog({ asset }: { asset: MediaLibraryAsset }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <IconButton aria-label={`${asset.title} tonen`} title="Tonen"><Eye aria-hidden="true" /></IconButton>
      </DialogTrigger>
      <DialogContent closeLabel="Mediavoorbeeld sluiten" size="wide">
        <DialogHeader>
          <DialogTitle>{asset.title}</DialogTitle>
          <DialogDescription>{asset.fileName}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <MediaPreview asset={asset} />
          <dl className={styles.previewMeta}>
            <div><dt>Status</dt><dd>{asset.statusLabel}</dd></div>
            <div><dt>Bestand</dt><dd>{asset.details}</dd></div>
            <div><dt>Gebruik</dt><dd>{asset.usage}</dd></div>
            <div><dt>Aangemaakt</dt><dd>{asset.createdLabel}</dd></div>
            <div><dt>Bijgewerkt</dt><dd>{asset.updatedLabel}</dd></div>
          </dl>
        </DialogBody>
        <DialogFooter><Button asChild variant="secondary"><a href={asset.manageHref}>Details openen</a></Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MediaArchiveDialog({
  assets,
  disabled = false,
  label,
  onSuccess,
  trigger
}: {
  assets: readonly MediaLibraryAsset[];
  disabled?: boolean;
  label: string;
  onSuccess: () => void;
  trigger: ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [state, setState] = useState<MediaArchiveState>(initialArchiveState);
  const byId = useMemo(() => new Map(assets.map((asset) => [asset.id, asset])), [assets]);
  const targetAssets = state.status === "blocked"
    ? state.blockedAssetIds.flatMap((id) => byId.get(id) ? [byId.get(id)!] : [])
    : assets;

  function changeOpen(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) setState(initialArchiveState);
  }

  async function submit(formData: FormData) {
    setPending(true);
    try {
      const next = await archiveMediaResources(initialArchiveState, formData);
      setState(next);
      if (next.status === "success") {
        onSuccess();
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog onOpenChange={changeOpen} open={open}>
      <DialogTrigger asChild disabled={disabled}>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{label} verwijderen?</DialogTitle>
          <DialogDescription>
            De media gaat naar het herstelbare archief. Bestanden en immutable releases worden niet fysiek gewist.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          {state.message ? (
            <div
              className={`notice ${state.status === "error" ? "notice--critical" : state.status === "success" ? "notice--success" : "notice--warning"}`}
              role={state.status === "error" ? "alert" : "status"}
            >
              <strong>{state.status === "blocked" ? "Conceptgebruik blokkeert media." : state.status === "success" ? "Media bijgewerkt." : "Archiveren niet volledig gelukt."}</strong>{" "}
              {state.message}
            </div>
          ) : (
            <div className="notice notice--warning" role="status">
              <strong>Veilige controle.</strong> Media met conceptplaylistgebruik wordt eerst geblokkeerd; overige media kan afzonderlijk worden gearchiveerd.
            </div>
          )}

          {state.status === "blocked" ? (
            <form action={submit} className={styles.archiveForm}>
              <ArchiveInputs assets={targetAssets} override />
              <label className="check-row">
                <input name="confirmOverride" required type="checkbox" />
                <span>
                  <strong>Override bevestigen</strong>
                  <span className="work-panel__meta">Verwijder de geblokkeerde media ook uit conceptplaylists. Releases blijven onveranderd.</span>
                </span>
              </label>
              <DialogFooter>
                <Button disabled={pending} type="submit" variant="destructive">
                  {pending ? "Override uitvoeren…" : "Override en verwijderen"}
                </Button>
              </DialogFooter>
            </form>
          ) : state.status !== "success" ? (
            <form action={submit}>
              <ArchiveInputs assets={assets} />
              <DialogFooter>
                <Button disabled={pending} type="submit" variant="destructive">
                  {pending ? "Controleren…" : "Veilig verwijderen"}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

function ArchiveInputs({ assets, override = false }: { assets: readonly MediaLibraryAsset[]; override?: boolean }) {
  return (
    <>
      <input name="assetIds" type="hidden" value={JSON.stringify(assets.map((asset) => asset.id))} />
      <input name="expectedDraftCounts" type="hidden" value={JSON.stringify(Object.fromEntries(assets.map((asset) => [asset.id, asset.draftCount])))} />
      <input name="override" type="hidden" value={override ? "true" : "false"} />
    </>
  );
}

export function AddMediaToPlaylistDialog({
  asset,
  disabled,
  playlists,
  label
}: {
  asset: Pick<MediaLibraryAsset, "id" | "title">;
  label?: string;
  disabled: boolean;
  playlists: readonly PlaylistOption[];
}) {
  const [playlistId, setPlaylistId] = useState("");
  const revision = playlists.find((playlist) => playlist.id === playlistId)?.revision ?? 0;
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button aria-label={`${asset.title} aan playlist toevoegen`} disabled={disabled} title={disabled ? "Alleen gereedstaande media kan worden toegevoegd" : "Aan playlist toevoegen"} variant="secondary"><ListPlus aria-hidden="true" />{label ?? "Aan playlist toevoegen"}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{asset.title} toevoegen</DialogTitle>
          <DialogDescription>Kies één playlistconcept. De server controleert de actuele conceptrevisie.</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <form action={addPlaylistItem} className={styles.playlistForm}>
            <input name="mediaAssetId" type="hidden" value={asset.id} />
            <input name="expectedRevision" type="hidden" value={revision} />
            <label>
              <span>Playlist</span>
              <select name="playlistId" onChange={(event) => setPlaylistId(event.target.value)} required value={playlistId}>
                <option value="">Kies een playlist</option>
                {playlists.map((playlist) => <option key={playlist.id} value={playlist.id}>{playlist.name}</option>)}
              </select>
            </label>
            <DialogFooter><Button disabled={!playlistId} type="submit"><ListPlus aria-hidden="true" />Toevoegen</Button></DialogFooter>
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

function LibraryPreview({ asset }: { asset: MediaLibraryAsset }) {
  if (!asset.previewUrl) return <FileWarning aria-hidden="true" />;
  if (asset.kind === "video") return <Video aria-hidden="true" />;
  return <img alt={`Voorbeeld van ${asset.title}`} src={asset.previewUrl} />;
}

function MediaPreview({ asset }: { asset: MediaLibraryAsset }) {
  if (!asset.previewUrl) {
    return <div className={styles.previewUnavailable}><FileWarning aria-hidden="true" /><strong>Voorbeeld niet beschikbaar</strong><span>De status en metadata zijn wel geladen. Controleer de verwerking en probeer opnieuw.</span></div>;
  }
  if (asset.kind === "video") {
    return <video className={styles.preview} controls muted preload="metadata" src={asset.previewUrl}><track kind="captions" /></video>;
  }
  return <img alt={`Voorbeeld van ${asset.title}`} className={styles.preview} src={asset.previewUrl} />;
}

function MediaStatus({ asset }: { asset: MediaLibraryAsset }) {
  const Icon = asset.status === "ready" ? CheckCircle2 : asset.status === "archived" ? Archive : asset.status === "validation_failed" || asset.status === "quarantined" ? FileWarning : Clock3;
  return <span className={styles.status}><Icon aria-hidden="true" /><StatusPill label={asset.statusLabel} tone={asset.statusTone} /></span>;
}

function MediaType({ asset }: { asset: MediaLibraryAsset }) {
  if (["validation_failed", "quarantined"].includes(asset.status)) return <span className="media-type media-type--failed" aria-label="Afgewezen media" role="img"><FileWarning aria-hidden="true" /></span>;
  if (asset.kind === "video") return <span className="media-type media-type--video" aria-label="Video" role="img"><Video aria-hidden="true" /></span>;
  return <span className="media-type" aria-label="Afbeelding" role="img"><ImageIcon aria-hidden="true" /></span>;
}

function withoutId(current: ReadonlySet<string>, id: string) {
  const next = new Set(current);
  next.delete(id);
  return next;
}

const initialArchiveState: MediaArchiveState = {
  archivedCount: 0,
  blockedAssetIds: [],
  draftReferenceCount: 0,
  failedAssetIds: [],
  message: "",
  status: "idle"
};
