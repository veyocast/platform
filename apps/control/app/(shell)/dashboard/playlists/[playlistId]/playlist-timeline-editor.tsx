"use client";

import * as Dialog from "@radix-ui/react-dialog";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, Clock3, GripVertical, Pencil, Trash2, X } from "lucide-react";
import { startTransition, useEffect, useId, useState, type ReactNode } from "react";

import { Badge, IconButton } from "@veyocast/ui";

import { movePlaylistItem, removePlaylistItem, updatePlaylistItem } from "../actions";
import type { PlaylistStudioItem } from "../playlist-studio-contract";

type PlaylistTimelineEditorProps = {
  canWrite: boolean;
  items: PlaylistStudioItem[];
  playlistId: string;
  revision: number;
};

export function PlaylistTimelineEditor({ canWrite, items, playlistId, revision }: PlaylistTimelineEditorProps) {
  const [orderedItems, setOrderedItems] = useState(items);
  const [announcement, setAnnouncement] = useState("");
  const [savingOrder, setSavingOrder] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => setOrderedItems(items), [items]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !canWrite || savingOrder) return;
    const from = orderedItems.findIndex((item) => item.id === active.id);
    const to = orderedItems.findIndex((item) => item.id === over.id);
    if (from < 0 || to < 0) return;

    const movedItem = orderedItems[from];
    setOrderedItems(arrayMove(orderedItems, from, to));
    setAnnouncement(`${movedItem?.asset?.title ?? "Item"} staat nu op positie ${to + 1}.`);
    setSavingOrder(true);

    const formData = new FormData();
    formData.set("playlistId", playlistId);
    formData.set("expectedRevision", String(revision));
    formData.set("itemId", String(active.id));
    formData.set("targetPosition", String(to));
    startTransition(() => {
      void movePlaylistItem(formData).finally(() => setSavingOrder(false));
    });
  }

  return (
    <>
      <p className="playlist-reorder-hint">
        <GripVertical aria-hidden="true" size={17} /> Sleep media naar de gewenste plek of gebruik de pijlen.
        {savingOrder ? <span>Volgorde opslaan…</span> : null}
      </p>
      <p aria-live="polite" className="sr-only">{announcement}</p>
      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd} sensors={sensors}>
        <SortableContext items={orderedItems.map((item) => item.id)} strategy={verticalListSortingStrategy}>
          <ol className="playlist-item-list">
            {orderedItems.map((item, index) => (
              <SortablePlaylistItem
                canWrite={canWrite && !savingOrder}
                index={index}
                item={item}
                itemCount={orderedItems.length}
                key={item.id}
                playlistId={playlistId}
                revision={revision}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
    </>
  );
}

function SortablePlaylistItem({
  canWrite,
  index,
  item,
  itemCount,
  playlistId,
  revision
}: {
  canWrite: boolean;
  index: number;
  item: PlaylistStudioItem;
  itemCount: number;
  playlistId: string;
  revision: number;
}) {
  const title = item.asset?.title ?? "Ontbrekende media";
  const isReady = item.asset?.status === "ready" && Boolean(item.asset.variant);
  const dialogTitleId = useId();
  const {
    attributes,
    isDragging,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition
  } = useSortable({ disabled: !canWrite, id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <li
      className="playlist-item playlist-item--sortable"
      data-dragging={isDragging || undefined}
      id={index === 0 ? "item-settings" : undefined}
      ref={setNodeRef}
      style={style}
    >
      <button
        {...attributes}
        {...listeners}
        aria-label={`Versleep ${title}, huidige positie ${index + 1} van ${itemCount}`}
        className="playlist-item__drag-handle"
        disabled={!canWrite}
        ref={setActivatorNodeRef}
        type="button"
      >
        <GripVertical aria-hidden="true" size={22} />
      </button>
      <MediaPreview item={item} />
      <div className="playlist-item__body">
        <div className="playlist-item__heading">
          <div>
            <p className="playlist-item__position">Positie {index + 1}</p>
            <h3 className="work-panel__title">{title}</h3>
            <p className="work-panel__meta">{item.asset?.mimeType ?? "Media niet beschikbaar"}</p>
          </div>
          <div className="playlist-item__heading-actions">
            <Badge status={isReady ? "success" : "warning"}>{isReady ? "Gereed" : "Blokkade"}</Badge>
            <ItemEditDialog
              canWrite={canWrite}
              dialogTitleId={dialogTitleId}
              item={item}
              playlistId={playlistId}
              revision={revision}
            />
          </div>
        </div>
        <div className="playlist-item__summary">
          <span><Clock3 aria-hidden="true" size={16} /> {formatDuration(item.durationSeconds)}</span>
          <span>{item.fitMode === "cover" ? "Schermvullend" : "Volledig in beeld"}</span>
          {item.asset?.kind === "video" ? <span>{item.muted ? "Zonder geluid" : "Met geluid"}</span> : null}
        </div>
        <div className="playlist-item__actions" aria-label={`Volgordeacties voor ${title}`}>
          <MoveForm direction="up" disabled={!canWrite || index === 0} itemId={item.id} label="Omhoog" playlistId={playlistId} revision={revision}>
            <ArrowUp aria-hidden="true" size={16} />
          </MoveForm>
          <MoveForm direction="down" disabled={!canWrite || index === itemCount - 1} itemId={item.id} label="Omlaag" playlistId={playlistId} revision={revision}>
            <ArrowDown aria-hidden="true" size={16} />
          </MoveForm>
          <form action={removePlaylistItem}>
            <RevisionFields playlistId={playlistId} revision={revision} />
            <input name="itemId" type="hidden" value={item.id} />
            <button className="table-action table-action--critical" disabled={!canWrite} type="submit">
              <Trash2 aria-hidden="true" size={15} /> Verwijderen
            </button>
          </form>
        </div>
      </div>
    </li>
  );
}

function ItemEditDialog({
  canWrite,
  dialogTitleId,
  item,
  playlistId,
  revision
}: {
  canWrite: boolean;
  dialogTitleId: string;
  item: PlaylistStudioItem;
  playlistId: string;
  revision: number;
}) {
  const title = item.asset?.title ?? "Media-item";
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <IconButton aria-label={`${title} bewerken`} className="playlist-item__edit" disabled={!canWrite}>
          <Pencil aria-hidden="true" size={18} />
        </IconButton>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="playlist-edit-dialog__overlay" />
        <Dialog.Content aria-labelledby={dialogTitleId} className="playlist-edit-dialog__content">
          <div className="playlist-edit-dialog__header">
            <div>
              <Dialog.Title className="playlist-edit-dialog__title" id={dialogTitleId}>Playlistitem bewerken</Dialog.Title>
              <Dialog.Description className="work-panel__meta">Pas de naam en afspeelinstellingen aan.</Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <IconButton aria-label="Venster sluiten"><X aria-hidden="true" size={18} /></IconButton>
            </Dialog.Close>
          </div>
          <form action={updatePlaylistItem} className="playlist-edit-dialog__form">
            <RevisionFields playlistId={playlistId} revision={revision} />
            <input name="itemId" type="hidden" value={item.id} />
            <label className="field" htmlFor={`display-name-${item.id}`}>
              <span>Naam</span>
              <input defaultValue={title} id={`display-name-${item.id}`} maxLength={120} minLength={2} name="displayName" required type="text" />
              <small>De medianaam wordt ook bijgewerkt in de mediabibliotheek en andere concepten.</small>
            </label>
            <label className="field" htmlFor={`duration-${item.id}`}>
              <span>Afspeelduur in seconden</span>
              <input defaultValue={item.durationSeconds} id={`duration-${item.id}`} max={3600} min={5} name="duration" required type="number" />
              {item.asset?.kind === "video" && item.asset.variant?.durationSeconds ? (
                <small>De gevalideerde MP4-bron duurt {formatPreciseDuration(item.asset.variant.durationSeconds)}. Dit is automatisch als standaard gebruikt.</small>
              ) : null}
            </label>
            <label className="field" htmlFor={`fit-${item.id}`}>
              <span>Weergave</span>
              <select defaultValue={item.fitMode} id={`fit-${item.id}`} name="fitMode">
                <option value="contain">Volledig in beeld</option>
                <option value="cover">Schermvullend</option>
              </select>
            </label>
            <label className="compact-check">
              <input defaultChecked={item.muted} disabled={item.asset?.kind !== "video"} name="muted" type="checkbox" /> Zonder geluid
            </label>
            <div className="playlist-edit-dialog__actions">
              <Dialog.Close asChild><button className="button-link button-link--secondary" type="button">Annuleren</button></Dialog.Close>
              <button className="button-link button-link--primary" type="submit">Wijzigingen opslaan</button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function MediaPreview({ item }: { item: PlaylistStudioItem }) {
  const asset = item.asset;
  if (asset?.kind === "image" && asset.variant?.previewUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt="" className="playlist-item__preview playlist-item__preview--media" src={asset.variant.previewUrl} />;
  }
  if (asset?.kind === "video" && asset.variant?.previewUrl) {
    return <video aria-label={`Videofragment van ${asset.title}`} className="playlist-item__preview playlist-item__preview--media" muted playsInline preload="metadata" src={asset.variant.previewUrl}><track kind="captions" /></video>;
  }
  return <div className="playlist-item__preview" data-kind={asset?.kind ?? "unknown"}>{asset?.kind === "video" ? "Video" : "Afbeelding"}</div>;
}

function MoveForm({
  children,
  direction,
  disabled,
  itemId,
  label,
  playlistId,
  revision
}: {
  children: ReactNode;
  direction: "down" | "up";
  disabled: boolean;
  itemId: string;
  label: string;
  playlistId: string;
  revision: number;
}) {
  return (
    <form action={movePlaylistItem}>
      <RevisionFields playlistId={playlistId} revision={revision} />
      <input name="itemId" type="hidden" value={itemId} />
      <input name="direction" type="hidden" value={direction} />
      <button className="table-action" disabled={disabled} type="submit">{children} {label}</button>
    </form>
  );
}

function RevisionFields({ playlistId, revision }: { playlistId: string; revision: number }) {
  return <><input name="playlistId" type="hidden" value={playlistId} /><input name="expectedRevision" type="hidden" value={revision} /></>;
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes ? `${minutes}:${String(rest).padStart(2, "0")} min` : `${seconds} sec`;
}

function formatPreciseDuration(seconds: number) {
  return `${new Intl.NumberFormat("nl-NL", { maximumFractionDigits: 1 }).format(seconds)} seconden`;
}
