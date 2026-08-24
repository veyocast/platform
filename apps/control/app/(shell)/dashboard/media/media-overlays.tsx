"use client";

import {
  Bookmark,
  FolderPlus,
  Image as ImageIcon,
  Layers3,
  Tags,
  Trash2,
  Video
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";

import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Inspector,
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  type StatusTone
} from "@veyocast/ui";

import {
  archiveMediaAsset,
  createMediaCollection,
  createMediaFolder,
  createMediaTag,
  deleteMediaView,
  saveMediaView
} from "./actions";
import { ImageUploadForm } from "./image-upload-form";
import { VideoUploadForm } from "./video-upload-form";

type MediaUploadDialogProps = {
  anonKey: string;
  canUpload: boolean;
  closeHref: string;
  open: boolean;
  supabaseUrl: string;
};

type MediaInspectorSheetProps = {
  children: ReactNode;
  closeHref: string;
  description: string;
  open: boolean;
  status: Readonly<{ label: string; tone: StatusTone }>;
  title: string;
};

type ArchiveMediaDialogProps = {
  canArchive: boolean;
  draftCount: number;
  idempotencyKey: string;
  kind: "image" | "video";
  releaseCount: number;
  screenCount: number;
  title: string;
  assetId: string;
};

export type MediaFolderOption = {
  id: string;
  name: string;
  parentFolderId: string | null;
  revision: number;
};

export type MediaTagOption = {
  color: string | null;
  id: string;
  name: string;
  revision: number;
};

export type SavedMediaViewOption = {
  active: boolean;
  href: string;
  id: string;
  name: string;
  revision: number;
  updatedLabel: string;
};

export function MediaUploadDialog({
  anonKey,
  canUpload,
  closeHref,
  open,
  supabaseUrl
}: MediaUploadDialogProps) {
  const [kind, setKind] = useState<"image" | "video">("image");
  const [dialogOpen, setDialogOpen] = useState(open);
  const dialogReadyRef = useRef(false);

  useEffect(() => setDialogOpen(open), [open]);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      dialogReadyRef.current = true;
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <Dialog
      onOpenChange={(nextOpen) => {
        if (!dialogReadyRef.current && !nextOpen) return;
        setDialogOpen(nextOpen);
        if (dialogOpen && !nextOpen) {
          window.location.assign(closeHref);
        }
      }}
      open={dialogOpen}
    >
      <DialogContent closeLabel="Uploadvenster sluiten">
        <DialogHeader>
          <DialogTitle>Media uploaden</DialogTitle>
          <DialogDescription>
            Kies een afbeelding of video. VeyoCast valideert ieder bestand voordat
            het in een playlist beschikbaar komt.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div aria-label="Mediatype kiezen" className="media-upload-dialog__segments" role="tablist">
            <Button
              aria-controls="media-image-upload"
              aria-selected={kind === "image"}
              onClick={() => setKind("image")}
              role="tab"
              size="sm"
              type="button"
              variant={kind === "image" ? "secondary" : "ghost"}
            >
              <ImageIcon aria-hidden="true" />
              Afbeelding
            </Button>
            <Button
              aria-controls="media-video-upload"
              aria-selected={kind === "video"}
              onClick={() => setKind("video")}
              role="tab"
              size="sm"
              type="button"
              variant={kind === "video" ? "secondary" : "ghost"}
            >
              <Video aria-hidden="true" />
              Video
            </Button>
          </div>

          {kind === "image" ? (
            <section
              aria-labelledby="media-image-upload-title"
              className="media-upload-dialog__panel"
              id="media-image-upload"
              role="tabpanel"
            >
              <div>
                <h3 id="media-image-upload-title">Afbeelding</h3>
                <p>JPEG, PNG of WebP · maximaal 20 MB.</p>
              </div>
              <ImageUploadForm canUpload={canUpload} />
            </section>
          ) : (
            <section
              aria-labelledby="media-video-upload-title"
              className="media-upload-dialog__panel"
              id="media-video-upload"
              role="tabpanel"
            >
              <div>
                <h3 id="media-video-upload-title">Video</h3>
                <p>MP4 · maximaal 500 MB en vijf minuten · veilig hervatbaar.</p>
              </div>
              <VideoUploadForm
                anonKey={anonKey}
                canUpload={canUpload}
                supabaseUrl={supabaseUrl}
              />
            </section>
          )}

          <details className="media-upload-dialog__help">
            <summary>Ondersteunde bestanden en verwerking</summary>
            <p>
              Afbeeldingen worden gecontroleerd op echte bestandsinhoud. Video
              wordt via private opslag geprobed en genormaliseerd naar een
              geverifieerde Player-variant voordat de status Gereed verschijnt.
            </p>
          </details>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

export function MediaInspectorSheet({
  children,
  closeHref,
  description,
  open,
  status,
  title
}: MediaInspectorSheetProps) {
  const [sheetOpen, setSheetOpen] = useState(open);
  const sheetReadyRef = useRef(false);

  useEffect(() => setSheetOpen(open), [open]);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      sheetReadyRef.current = true;
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <Sheet
      onOpenChange={(nextOpen) => {
        if (!sheetReadyRef.current && !nextOpen) return;
        setSheetOpen(nextOpen);
        if (sheetOpen && !nextOpen) {
          window.location.assign(closeHref);
        }
      }}
      open={sheetOpen}
    >
      <SheetContent closeLabel="Mediadetails sluiten" side="right">
        <SheetHeader>
          <SheetTitle>Mediadetails</SheetTitle>
          <SheetDescription>
            Bekijk metadata, gebruik, verwerking en veilige beheeracties.
          </SheetDescription>
        </SheetHeader>
        <SheetBody>
          <Inspector description={description} status={status} title={title}>
            {children}
          </Inspector>
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}

export function ArchiveMediaDialog({
  assetId,
  canArchive,
  draftCount,
  idempotencyKey,
  kind,
  releaseCount,
  screenCount,
  title
}: ArchiveMediaDialogProps) {
  const mediaLabel = kind === "video" ? "video" : "afbeelding";

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button disabled={!canArchive} type="button" variant="destructive">
          <Trash2 aria-hidden="true" />
          Uit Media verwijderen
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {kind === "video" ? "Video" : "Afbeelding"} ‘{title}’ verwijderen?
          </DialogTitle>
          <DialogDescription>
            De {mediaLabel} verdwijnt uit de actieve mediabibliotheek en gaat naar
            het herstelbare archief. Het bestand wordt niet direct fysiek gewist.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="notice notice--warning" role="status">
            <strong>Gevolgen voor concepten</strong>
            <br />
            {draftCount > 0 ? (
              <span>
                De {mediaLabel} wordt ook uit {draftCount} conceptplaylist
                {draftCount === 1 ? "" : "s"} verwijderd. Die concepten krijgen
                niet-gepubliceerde wijzigingen.
              </span>
            ) : (
              <span>De {mediaLabel} staat niet in een conceptplaylist.</span>
            )}
          </div>
          <div className="notice notice--success" role="status">
            <strong>Blijft behouden</strong>
            <br />
            <span>
              {releaseCount > 0
                ? `${releaseCount} bestaande release${releaseCount === 1 ? "" : "s"}`
                : "Bestaande releasehistorie"} blijft onveranderlijk en
              afspeelbaar{screenCount > 0 ? ` op ${screenCount} actieve scherm${screenCount === 1 ? "" : "en"}` : ""}.
            </span>
          </div>
          <form action={archiveMediaAsset} className="playlist-form">
            <input name="assetId" type="hidden" value={assetId} />
            <input name="expectedDraftCount" type="hidden" value={draftCount} />
            <input name="idempotencyKey" type="hidden" value={idempotencyKey} />
            <label className="check-row">
              <input name="confirmArchive" required type="checkbox" />
              <span>
                <strong>Ik begrijp de gevolgen</strong>
                <span className="work-panel__meta">
                  Verwijder deze {mediaLabel} uit Media
                  {draftCount > 0 ? " en uit de genoemde conceptplaylists" : ""}.
                </span>
              </span>
            </label>
            <DialogFooter>
              <Button type="submit" variant="destructive">
                {kind === "video" ? "Video verwijderen" : "Afbeelding verwijderen"}
              </Button>
            </DialogFooter>
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

export function MediaOrganizationDialog({
  canWrite,
  folders
}: {
  canWrite: boolean;
  folders: MediaFolderOption[];
}) {
  const folderKey = useRef<HTMLInputElement>(null);
  const collectionKey = useRef<HTMLInputElement>(null);
  const tagKey = useRef<HTMLInputElement>(null);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button disabled={!canWrite} variant="secondary">
          <FolderPlus aria-hidden="true" />
          Organiseren
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mappen en tags</DialogTitle>
          <DialogDescription>
            Organiseer herbruikbare media zonder bestanden of bestaande playlistplaatsingen te wijzigen.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <form
            action={async (formData) => completeMediaOrganization(await createMediaFolder(formData))}
            className="playlist-form"
            onSubmit={() => ensureIdempotencyKey(folderKey.current)}
          >
            <input name="idempotencyKey" ref={folderKey} type="hidden" />
            <h3><FolderPlus aria-hidden="true" /> Nieuwe map</h3>
            <div className="field">
              <label htmlFor="new-media-folder-name">Mapnaam</label>
              <input id="new-media-folder-name" maxLength={120} name="name" required type="text" />
            </div>
            <div className="field">
              <label htmlFor="new-media-folder-parent">Bovenliggende map</label>
              <select id="new-media-folder-parent" name="parentFolderId">
                <option value="">Hoofdniveau</option>
                {folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
              </select>
            </div>
            <DialogFooter><Button type="submit">Map maken</Button></DialogFooter>
          </form>

          <form
            action={async (formData) => completeMediaOrganization(await createMediaTag(formData))}
            className="playlist-form"
            onSubmit={() => ensureIdempotencyKey(tagKey.current)}
          >
            <input name="idempotencyKey" ref={tagKey} type="hidden" />
            <h3><Tags aria-hidden="true" /> Nieuwe tag</h3>
            <div className="field">
              <label htmlFor="new-media-tag-name">Tagnaam</label>
              <input id="new-media-tag-name" maxLength={48} name="name" required type="text" />
            </div>
            <div className="field">
              <label htmlFor="new-media-tag-color">Kleur</label>
              <input defaultValue="#3658d6" id="new-media-tag-color" name="color" type="color" />
            </div>
            <DialogFooter><Button type="submit">Tag maken</Button></DialogFooter>
          </form>

          <form
            action={async (formData) => completeMediaOrganization(await createMediaCollection(formData))}
            className="playlist-form"
            onSubmit={() => ensureIdempotencyKey(collectionKey.current)}
          >
            <input name="idempotencyKey" ref={collectionKey} type="hidden" />
            <h3><Layers3 aria-hidden="true" /> Nieuwe collectie</h3>
            <div className="field">
              <label htmlFor="new-media-collection-name">Collectienaam</label>
              <input id="new-media-collection-name" maxLength={80} minLength={2} name="name" required type="text" />
            </div>
            <div className="field">
              <label htmlFor="new-media-collection-description">Omschrijving <span>(optioneel)</span></label>
              <textarea id="new-media-collection-description" maxLength={240} name="description" rows={3} />
            </div>
            <DialogFooter><Button type="submit">Collectie maken</Button></DialogFooter>
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

function completeMediaOrganization(message: string) {
  window.location.assign(`/dashboard/media?succes=${encodeURIComponent(message)}`);
}

export function SavedMediaViewsDialog({
  canSave,
  currentState,
  views
}: {
  canSave: boolean;
  currentState: string;
  views: readonly SavedMediaViewOption[];
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">
          <Bookmark aria-hidden="true" />
          Weergaven
          {views.length > 0 ? <span aria-label={`${views.length} opgeslagen`}>{views.length}</span> : null}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Persoonlijke weergaven</DialogTitle>
          <DialogDescription>
            Bewaar de huidige zoekopdracht, filters, sortering en lijst- of rasterweergave
            voor jezelf binnen deze vereniging.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <section aria-labelledby="saved-media-views-title" className="media-usage">
            <div>
              <h3 id="saved-media-views-title">Opgeslagen</h3>
              <p className="work-panel__meta">
                Deze weergaven zijn persoonlijk en nooit zichtbaar voor andere gebruikers.
              </p>
            </div>
            {views.length > 0 ? (
              <ul aria-label="Persoonlijke mediaweergaven" className="media-usage__list">
                {views.map((view) => (
                  <li key={view.id}>
                    <div>
                      <strong>{view.name}</strong>
                      <span>
                        {view.active ? "Nu actief" : `Bijgewerkt ${view.updatedLabel}`}
                      </span>
                    </div>
                    <div className="page-action-group">
                      <Button asChild size="sm" variant={view.active ? "secondary" : "ghost"}>
                        <Link aria-current={view.active ? "page" : undefined} href={view.href}>
                          Toepassen
                        </Link>
                      </Button>
                      <form action={deleteMediaView}>
                        <input name="expectedRevision" type="hidden" value={view.revision} />
                        <input name="viewId" type="hidden" value={view.id} />
                        <input name="viewState" type="hidden" value={currentState} />
                        <Button
                          aria-label={`${view.name} verwijderen`}
                          size="sm"
                          title={`${view.name} verwijderen`}
                          type="submit"
                          variant="ghost"
                        >
                          <Trash2 aria-hidden="true" />
                        </Button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="notice" role="status">
                Je hebt nog geen persoonlijke mediaweergaven opgeslagen.
              </p>
            )}
          </section>

          <form action={saveMediaView} className="playlist-form">
            <input name="viewState" type="hidden" value={currentState} />
            <div className="field">
              <label htmlFor="saved-media-view-name">Naam</label>
              <input
                autoComplete="off"
                disabled={!canSave}
                id="saved-media-view-name"
                maxLength={80}
                minLength={2}
                name="name"
                placeholder="Bijvoorbeeld gereed sponsorbeeld"
                required
                type="text"
              />
            </div>
            <DialogFooter>
              <Button disabled={!canSave} type="submit">
                Huidige weergave opslaan
              </Button>
            </DialogFooter>
            {!canSave ? (
              <p className="notice notice--warning" role="status">
                Persoonlijke weergaven kunnen alleen binnen een actieve live vereniging worden gewijzigd.
              </p>
            ) : null}
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

function ensureIdempotencyKey(input: HTMLInputElement | null) {
  if (input && !input.value) input.value = crypto.randomUUID();
}
