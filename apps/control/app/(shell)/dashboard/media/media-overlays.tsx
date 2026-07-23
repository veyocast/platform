"use client";

import {
  Bookmark,
  FolderPlus,
  Image as ImageIcon,
  Tags,
  Trash2,
  Video
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";

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
  const router = useRouter();
  const [kind, setKind] = useState<"image" | "video">("image");

  return (
    <Dialog
      onOpenChange={(nextOpen) => {
        if (!nextOpen) router.replace(closeHref, { scroll: false });
      }}
      open={open}
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
  const router = useRouter();

  return (
    <Sheet
      onOpenChange={(nextOpen) => {
        if (!nextOpen) router.replace(closeHref, { scroll: false });
      }}
      open={open}
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

export function MediaOrganizationDialog({
  canWrite,
  folders
}: {
  canWrite: boolean;
  folders: MediaFolderOption[];
}) {
  const folderKey = useRef<HTMLInputElement>(null);
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
            action={createMediaFolder}
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
            action={createMediaTag}
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
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
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
