"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  CloudUpload,
  Eye,
  FileImage,
  Film,
  GripVertical,
  MoreVertical,
  Plus,
  Redo2,
  Search,
  Settings2,
  Trash2,
  Undo2
} from "lucide-react";
import Link from "next/link";
import {
  startTransition,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";

import {
  Badge,
  Button,
  IconButton,
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from "@veyocast/ui";

import {
  addPlaylistItem,
  archivePlaylist,
  movePlaylistItem,
  removePlaylistItem,
  updatePlaylistDetails,
  updatePlaylistItem
} from "../actions";
import type { PlaylistPreviewItem } from "../playlist-preview";
import type {
  PlaylistStudioAsset,
  PlaylistStudioItem
} from "../playlist-studio-contract";
import { PublisherStudioPreview } from "./publisher-studio-preview";
import {
  durationStep,
  itemOrder,
  reorderItems,
  restoreOrder
} from "../[playlistId]/publisher-studio-state";
import styles from "../[playlistId]/publisher-studio.module.css";

type Playlist = {
  description: string | null;
  id: string;
  name: string;
  revision: number;
  status: string;
  updatedAt: string;
  updatedBy: string;
};

type ReadinessMessage = {
  detail: string;
  label: string;
  recovery: string;
};

type PublisherStudioWorkspaceProps = {
  assets: PlaylistStudioAsset[];
  canManage: boolean;
  canWrite: boolean;
  latestReleaseVersion: number | null;
  playlist: Playlist;
  previewItems: PlaylistPreviewItem[];
  readiness: {
    canPublish: boolean;
    itemCount: number;
    messages: ReadinessMessage[];
    totalBytes: number;
    totalDurationSeconds: number;
  } | null;
  screenCount: number;
};

type SaveState = "changed" | "error" | "saved" | "saving";

type PendingMove = {
  activeId: string;
  targetPosition: number;
};

export function PublisherStudioWorkspace({
  assets,
  canManage,
  canWrite,
  latestReleaseVersion,
  items,
  playlist,
  previewItems,
  readiness,
  screenCount
}: PublisherStudioWorkspaceProps & { items: PlaylistStudioItem[] }) {
  const [orderedItems, setOrderedItems] = useState(items);
  const [selectedId, setSelectedId] = useState<string | null>(
    items[0]?.id ?? null
  );
  const [mediaQuery, setMediaQuery] = useState("");
  const [mediaKind, setMediaKind] = useState<"all" | "image" | "video">("all");
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [announcement, setAnnouncement] = useState("");
  const [history, setHistory] = useState<{
    future: string[][];
    past: string[][];
  }>({ future: [], past: [] });
  const [mediaSheetOpen, setMediaSheetOpen] = useState(false);
  const [previewSheetOpen, setPreviewSheetOpen] = useState(false);
  const [inspectorSheetOpen, setInspectorSheetOpen] = useState(false);
  const saveTimer = useRef<number | null>(null);
  const pendingMove = useRef<PendingMove | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 7 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    setOrderedItems(items);
    setSelectedId((current) =>
      current && items.some((item) => item.id === current)
        ? current
        : items[0]?.id ?? null
    );
    setHistory({ future: [], past: [] });
    setSaveState("saved");
  }, [items]);

  useEffect(
    () => () => {
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    },
    []
  );

  useEffect(() => {
    const dirty = saveState === "changed";
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
    };
    const followLink = (event: MouseEvent) => {
      if (!dirty || event.defaultPrevented || event.button !== 0) return;
      const target = event.target;
      const anchor =
        target instanceof Element ? target.closest("a[href]") : null;
      if (!anchor || anchor.getAttribute("href")?.startsWith("#")) return;
      if (
        !window.confirm(
          "Je hebt niet-opgeslagen wijzigingen. Wil je Playlist Studio verlaten?"
        )
      ) {
        event.preventDefault();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", followLink, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", followLink, true);
    };
  }, [saveState]);

  const selectedItem =
    orderedItems.find((item) => item.id === selectedId) ?? null;
  const availableAssets = useMemo(() => {
    const query = mediaQuery.trim().toLocaleLowerCase("nl-NL");
    return assets.filter(
      (asset) =>
        !asset.deletedAt &&
        asset.status === "ready" &&
        asset.variant &&
        (mediaKind === "all" || asset.kind === mediaKind) &&
        (!query || asset.title.toLocaleLowerCase("nl-NL").includes(query))
    );
  }, [assets, mediaKind, mediaQuery]);

  function scheduleOrderSave(move: PendingMove) {
    pendingMove.current = move;
    setSaveState("changed");
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      setSaveState("saving");
      const formData = new FormData();
      formData.set("playlistId", playlist.id);
      formData.set("expectedRevision", String(playlist.revision));
      formData.set("itemId", move.activeId);
      formData.set("targetPosition", String(move.targetPosition));
      startTransition(() => {
        void movePlaylistItem(formData).catch(() => setSaveState("error"));
      });
    }, 650);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || !canWrite || saveState === "saving") return;

    if (active.data.current?.type === "media") {
      const mediaAssetId = String(active.data.current.assetId ?? "");
      if (!mediaAssetId) return;
      setSaveState("saving");
      const formData = new FormData();
      formData.set("playlistId", playlist.id);
      formData.set("expectedRevision", String(playlist.revision));
      formData.set("mediaAssetId", mediaAssetId);
      startTransition(() => {
        void addPlaylistItem(formData).catch(() => setSaveState("error"));
      });
      return;
    }

    if (active.id === over.id) return;
    const next = reorderItems(orderedItems, String(active.id), String(over.id));
    if (next === orderedItems) return;
    const targetPosition = next.findIndex((item) => item.id === active.id);
    setHistory({ future: [], past: [itemOrder(orderedItems)] });
    setOrderedItems(next);
    setAnnouncement(
      `${next[targetPosition]?.asset?.title ?? "Item"} staat nu op positie ${targetPosition + 1}.`
    );
    scheduleOrderSave({
      activeId: String(active.id),
      targetPosition
    });
  }

  function undoPendingOrder() {
    const previous = history.past.at(-1);
    if (!previous || saveState === "saving") return;
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    saveTimer.current = null;
    const current = itemOrder(orderedItems);
    setOrderedItems(restoreOrder(orderedItems, previous));
    setHistory({ future: [current], past: [] });
    setSaveState("saved");
    setAnnouncement("De lokale volgordewijziging is ongedaan gemaakt.");
  }

  function redoPendingOrder() {
    const next = history.future.at(-1);
    const move = pendingMove.current;
    if (!next || !move || saveState === "saving") return;
    setHistory({ future: [], past: [itemOrder(orderedItems)] });
    setOrderedItems(restoreOrder(orderedItems, next));
    setAnnouncement("De lokale volgordewijziging is opnieuw toegepast.");
    scheduleOrderSave(move);
  }

  const mediaLibrary = (
    <MediaLibrary
      assets={availableAssets}
      canWrite={canWrite && saveState !== "saving"}
      mediaKind={mediaKind}
      mediaQuery={mediaQuery}
      onKindChange={setMediaKind}
      onQueryChange={setMediaQuery}
      playlistId={playlist.id}
      revision={playlist.revision}
    />
  );

  const inspector = (
    <Inspector
      canManage={canManage}
      canWrite={canWrite}
      item={selectedItem}
      onSaveStart={() => setSaveState("saving")}
      playlist={playlist}
      readiness={readiness}
    />
  );

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      sensors={sensors}
    >
      <div
        className={styles.studio}
        onChangeCapture={(event) => {
          if (
            event.target instanceof Element &&
            event.target.hasAttribute("data-editor-field")
          ) {
            setSaveState("changed");
          }
        }}
      >
        <header className={styles.editorHeader}>
          <div className={styles.headerIdentity}>
            <Link
              aria-label="Terug naar playlists"
              className={styles.backLink}
              href="/dashboard/playlists"
            >
              <ArrowLeft aria-hidden="true" size={18} />
            </Link>
            <div>
              <p className={styles.breadcrumb}>
                <Link href="/dashboard/playlists">Playlists</Link>
                <span aria-hidden="true">/</span>
                <span>{playlist.name}</span>
              </p>
              <h1>{playlist.name}</h1>
            </div>
          </div>

          <div className={styles.headerActions}>
            <div className={styles.historyActions}>
              <IconButton
                aria-label="Laatste lokale wijziging ongedaan maken"
                disabled={!history.past.length || saveState === "saving"}
                onClick={undoPendingOrder}
                title="Ongedaan maken"
              >
                <Undo2 aria-hidden="true" />
              </IconButton>
              <IconButton
                aria-label="Lokale wijziging opnieuw uitvoeren"
                disabled={!history.future.length || saveState === "saving"}
                onClick={redoPendingOrder}
                title="Opnieuw"
              >
                <Redo2 aria-hidden="true" />
              </IconButton>
            </div>
            <AutosaveIndicator state={saveState} />
            <Sheet open={previewSheetOpen} onOpenChange={setPreviewSheetOpen}>
              <SheetTrigger asChild>
                <Button size="sm" variant="secondary">
                  <Eye aria-hidden="true" size={16} />
                  Voorbeeld
                </Button>
              </SheetTrigger>
              <SheetContent className={styles.previewSheet} side="right">
                <SheetHeader>
                  <SheetTitle>Playlistvoorbeeld</SheetTitle>
                  <SheetDescription>
                    Bekijk de huidige conceptvolgorde met Playerinstellingen.
                  </SheetDescription>
                </SheetHeader>
                <SheetBody>
                  <PublisherStudioPreview items={previewItems} />
                </SheetBody>
              </SheetContent>
            </Sheet>
            {readiness?.canPublish ? (
              <Button asChild size="sm">
                <Link href={`/dashboard/playlists/${playlist.id}/publish`}>
                  <CloudUpload aria-hidden="true" size={16} />
                  Publiceren
                </Link>
              </Button>
            ) : (
              <Button
                disabled
                size="sm"
                title="Herstel eerst de publicatieblokkades"
              >
                <CloudUpload aria-hidden="true" size={16} />
                Publiceren
              </Button>
            )}
          </div>
        </header>

        <p aria-live="polite" className="sr-only">
          {announcement}
        </p>

        <div className={styles.workspace}>
          <aside
            aria-label="Mediabibliotheek"
            className={`${styles.panel} ${styles.libraryPanel}`}
          >
            {mediaLibrary}
          </aside>

          <main
            aria-labelledby="storyboard-title"
            className={`${styles.panel} ${styles.storyboardPanel}`}
          >
            <StoryboardHeader
              durationSeconds={readiness?.totalDurationSeconds ?? 0}
              itemCount={orderedItems.length}
              onPlaylistSelect={() => {
                setSelectedId(null);
                setInspectorSheetOpen(true);
              }}
              playlistName={playlist.name}
              revision={playlist.revision}
            />
            <Storyboard
              canWrite={canWrite && saveState !== "saving"}
              items={orderedItems}
              onSelect={(id) => {
                setSelectedId(id);
              if (window.matchMedia("(max-width: 1180px)").matches) {
                  setInspectorSheetOpen(true);
                }
              }}
              playlistId={playlist.id}
              revision={playlist.revision}
              selectedId={selectedId}
            />
          </main>

          <aside
            aria-label="Iteminstellingen"
            className={`${styles.panel} ${styles.inspectorPanel}`}
          >
            {inspector}
          </aside>
        </div>

        {screenCount > 0 ? (
          <footer className={styles.statusRail}>
            <Link href="/dashboard/screens">
              <span className={styles.onlineDot} aria-hidden="true" />
              {screenCount} {screenCount === 1 ? "scherm" : "schermen"} gekoppeld
            </Link>
            <Link href="/dashboard/releases">
              Versie {latestReleaseVersion ?? "—"}
            </Link>
            <span>
              <Check aria-hidden="true" size={16} />
              {latestReleaseVersion
                ? "Publicatiestatus beschikbaar"
                : "Nog niet gepubliceerd"}
            </span>
          </footer>
        ) : null}

        <nav aria-label="Playlistacties" className={styles.mobileActionBar}>
          <Sheet open={mediaSheetOpen} onOpenChange={setMediaSheetOpen}>
            <SheetTrigger asChild>
              <button type="button">
                <Plus aria-hidden="true" />
                Media
              </button>
            </SheetTrigger>
            <SheetContent className={styles.mobileSheet} side="bottom">
              <SheetHeader>
                <SheetTitle>Media toevoegen</SheetTitle>
                <SheetDescription>
                  Kies gereedstaande media voor deze playlist.
                </SheetDescription>
              </SheetHeader>
              <SheetBody>{mediaLibrary}</SheetBody>
            </SheetContent>
          </Sheet>
          <button onClick={() => setPreviewSheetOpen(true)} type="button">
            <Eye aria-hidden="true" />
            Preview
          </button>
          <Link
            aria-disabled={!readiness?.canPublish}
            data-disabled={!readiness?.canPublish || undefined}
            href={`/dashboard/playlists/${playlist.id}/publish`}
          >
            <CloudUpload aria-hidden="true" />
            Publiceren
          </Link>
        </nav>

        <Sheet open={inspectorSheetOpen} onOpenChange={setInspectorSheetOpen}>
          <SheetContent className={styles.mobileSheet} side="bottom">
            <SheetHeader>
              <SheetTitle>
                {selectedItem ? "Iteminstellingen" : "Playlistinstellingen"}
              </SheetTitle>
              <SheetDescription>
                Wijzig alleen het concept; releases blijven onveranderlijk.
              </SheetDescription>
            </SheetHeader>
            <SheetBody>{inspector}</SheetBody>
          </SheetContent>
        </Sheet>
      </div>
    </DndContext>
  );
}

function AutosaveIndicator({ state }: { state: SaveState }) {
  const labels: Record<SaveState, string> = {
    changed: "Niet-opgeslagen wijziging",
    error: "Opslaan mislukt",
    saved: "Opgeslagen",
    saving: "Bezig met opslaan"
  };
  return (
    <p
      aria-live="polite"
      className={styles.saveState}
      data-state={state}
    >
      <span aria-hidden="true" />
      {labels[state]}
    </p>
  );
}

function MediaLibrary({
  assets,
  canWrite,
  mediaKind,
  mediaQuery,
  onKindChange,
  onQueryChange,
  playlistId,
  revision
}: {
  assets: PlaylistStudioAsset[];
  canWrite: boolean;
  mediaKind: "all" | "image" | "video";
  mediaQuery: string;
  onKindChange: (kind: "all" | "image" | "video") => void;
  onQueryChange: (query: string) => void;
  playlistId: string;
  revision: number;
}) {
  return (
    <div className={styles.library}>
      <div className={styles.panelHeading}>
        <div>
          <h2>Mediabibliotheek</h2>
          <p>Sleep of voeg gereedstaande media toe.</p>
        </div>
        <Link href="/dashboard/media">Beheren</Link>
      </div>
      <label className={styles.searchField}>
        <Search aria-hidden="true" />
        <span className="sr-only">Zoek media</span>
        <input
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Zoek media"
          type="search"
          value={mediaQuery}
        />
      </label>
      <div aria-label="Filter media op type" className={styles.filterChips}>
        {(["all", "image", "video"] as const).map((kind) => (
          <button
            aria-pressed={mediaKind === kind}
            key={kind}
            onClick={() => onKindChange(kind)}
            type="button"
          >
            {kind === "all"
              ? "Alles"
              : kind === "image"
                ? "Afbeeldingen"
                : "Video"}
          </button>
        ))}
      </div>
      {assets.length ? (
        <ul aria-label="Gereedstaande media" className={styles.mediaGrid}>
          {assets.map((asset) => (
            <DraggableMediaCard
              asset={asset}
              canWrite={canWrite}
              key={asset.id}
              playlistId={playlistId}
              revision={revision}
            />
          ))}
        </ul>
      ) : (
        <div className={styles.compactEmpty} role="status">
          <FileImage aria-hidden="true" />
          <p>Geen gereedstaande media gevonden.</p>
        </div>
      )}
      <Link className={styles.uploadDropzone} href="/dashboard/media">
        <CloudUpload aria-hidden="true" />
        <strong>Media uploaden</strong>
        <span>Open de veilige uploadflow</span>
      </Link>
    </div>
  );
}

function DraggableMediaCard({
  asset,
  canWrite,
  playlistId,
  revision
}: {
  asset: PlaylistStudioAsset;
  canWrite: boolean;
  playlistId: string;
  revision: number;
}) {
  const {
    attributes,
    isDragging,
    listeners,
    setNodeRef,
    transform
  } = useDraggable({
    data: { assetId: asset.id, type: "media" },
    disabled: !canWrite,
    id: `media-${asset.id}`
  });
  return (
    <li
      className={styles.mediaCard}
      data-dragging={isDragging || undefined}
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
    >
      <button
        {...attributes}
        {...listeners}
        aria-label={`${asset.title} naar playlist slepen`}
        className={styles.mediaDragTarget}
        disabled={!canWrite}
        type="button"
      >
        <MediaThumb asset={asset} className={styles.mediaThumb ?? ""} />
        <span>
          <strong>{asset.title}</strong>
          <small>
            {asset.kind === "video"
              ? formatSeconds(asset.variant?.durationSeconds ?? 0)
              : asset.variant?.width && asset.variant.height
                ? `${asset.variant.width} × ${asset.variant.height}`
                : "Afbeelding"}
          </small>
        </span>
      </button>
      <form action={addPlaylistItem}>
        <RevisionFields playlistId={playlistId} revision={revision} />
        <input name="mediaAssetId" type="hidden" value={asset.id} />
        <button
          aria-label={`Toevoegen: ${asset.title}`}
          disabled={!canWrite}
          type="submit"
        >
          <Plus aria-hidden="true" />
        </button>
      </form>
    </li>
  );
}

function StoryboardHeader({
  durationSeconds,
  itemCount,
  onPlaylistSelect,
  playlistName,
  revision
}: {
  durationSeconds: number;
  itemCount: number;
  onPlaylistSelect: () => void;
  playlistName: string;
  revision: number;
}) {
  return (
    <div className={styles.storyboardHeading}>
      <div>
        <h2 id="storyboard-title">{playlistName}</h2>
        <p>
          {itemCount} {itemCount === 1 ? "item" : "items"} ·{" "}
          {formatSeconds(durationSeconds)}
        </p>
      </div>
      <div>
        <Badge status="neutral">Concept</Badge>
        <Badge status="info">Revisie {revision}</Badge>
        <IconButton
          aria-label="Playlistinstellingen openen"
          onClick={onPlaylistSelect}
          title="Playlistinstellingen"
        >
          <Settings2 aria-hidden="true" />
        </IconButton>
      </div>
    </div>
  );
}

function Storyboard({
  canWrite,
  items,
  onSelect,
  playlistId,
  revision,
  selectedId
}: {
  canWrite: boolean;
  items: PlaylistStudioItem[];
  onSelect: (id: string) => void;
  playlistId: string;
  revision: number;
  selectedId: string | null;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: "storyboard-dropzone" });
  if (!items.length) {
    return (
      <div
        className={styles.storyboardEmpty}
        data-over={isOver || undefined}
        ref={setNodeRef}
        role="status"
      >
        <CloudUpload aria-hidden="true" />
        <h3>Start met je eerste item</h3>
        <p>Sleep media hierheen of gebruik Media toevoegen.</p>
      </div>
    );
  }
  return (
    <div
      className={styles.storyboard}
      data-over={isOver || undefined}
      ref={setNodeRef}
    >
      <SortableContext
        items={items.map((item) => item.id)}
        strategy={verticalListSortingStrategy}
      >
        <ol aria-label="Playlistitems" className={styles.itemList}>
          {items.map((item, index) => (
            <SortableItem
              canWrite={canWrite}
              index={index}
              item={item}
              itemCount={items.length}
              key={item.id}
              onSelect={onSelect}
              playlistId={playlistId}
              revision={revision}
              selected={item.id === selectedId}
            />
          ))}
        </ol>
      </SortableContext>
      <div className={styles.insertIndicator} aria-hidden="true">
        <span />
        <Plus />
        <span />
      </div>
    </div>
  );
}

function SortableItem({
  canWrite,
  index,
  item,
  itemCount,
  onSelect,
  playlistId,
  revision,
  selected
}: {
  canWrite: boolean;
  index: number;
  item: PlaylistStudioItem;
  itemCount: number;
  onSelect: (id: string) => void;
  playlistId: string;
  revision: number;
  selected: boolean;
}) {
  const title = item.asset?.title ?? "Ontbrekende media";
  const {
    attributes,
    isDragging,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition
  } = useSortable({ disabled: !canWrite, id: item.id });
  return (
    <li
      className={styles.itemRow}
      data-dragging={isDragging || undefined}
      data-selected={selected || undefined}
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition
      }}
    >
      <button
        {...attributes}
        {...listeners}
        aria-label={`Versleep ${title}, positie ${index + 1} van ${itemCount}`}
        className={styles.dragHandle}
        disabled={!canWrite}
        ref={setActivatorNodeRef}
        type="button"
      >
        <GripVertical aria-hidden="true" />
      </button>
      <span className={styles.position}>{index + 1}</span>
      <MediaThumb asset={item.asset} className={styles.itemThumb ?? ""} />
      <button
        aria-label={`${title} bewerken`}
        className={styles.itemIdentity}
        onClick={() => onSelect(item.id)}
        type="button"
      >
        <strong>{title}</strong>
        <span>
          {item.asset?.kind === "video" ? "Video" : "Afbeelding"} ·{" "}
          {item.fitMode === "cover" ? "Vullen" : "Passend"}
        </span>
      </button>
      <DurationStepper
        canWrite={canWrite}
        item={item}
        playlistId={playlistId}
        revision={revision}
      />
      <ItemMenu
        canWrite={canWrite}
        index={index}
        item={item}
        itemCount={itemCount}
        onSettings={() => onSelect(item.id)}
        playlistId={playlistId}
        revision={revision}
      />
    </li>
  );
}

function DurationStepper({
  canWrite,
  item,
  playlistId,
  revision
}: {
  canWrite: boolean;
  item: PlaylistStudioItem;
  playlistId: string;
  revision: number;
}) {
  const title = item.asset?.title ?? "Media-item";
  return (
    <form
      action={updatePlaylistItem}
      aria-label={`Afspeelduur van ${title}`}
      className={styles.durationStepper}
    >
      <RevisionFields playlistId={playlistId} revision={revision} />
      <ItemUpdateFields item={item} />
      <button
        aria-label="Een seconde korter"
        disabled={!canWrite || item.durationSeconds <= 5}
        name="duration"
        type="submit"
        value={durationStep(item.durationSeconds, "decrease")}
      >
        −
      </button>
      <span>{item.durationSeconds} sec</span>
      <button
        aria-label="Een seconde langer"
        disabled={!canWrite || item.durationSeconds >= 3600}
        name="duration"
        type="submit"
        value={durationStep(item.durationSeconds, "increase")}
      >
        +
      </button>
    </form>
  );
}

function ItemMenu({
  canWrite,
  index,
  item,
  itemCount,
  onSettings,
  playlistId,
  revision
}: {
  canWrite: boolean;
  index: number;
  item: PlaylistStudioItem;
  itemCount: number;
  onSettings: () => void;
  playlistId: string;
  revision: number;
}) {
  return (
    <details className={styles.itemMenu}>
      <summary aria-label="Itemacties">
        <MoreVertical aria-hidden="true" />
      </summary>
      <div>
        <button onClick={onSettings} type="button">
          <Settings2 aria-hidden="true" /> Instellingen
        </button>
        <MoveForm
          direction="up"
          disabled={!canWrite || index === 0}
          itemId={item.id}
          label="Omhoog"
          playlistId={playlistId}
          revision={revision}
        >
          <ArrowUp aria-hidden="true" />
        </MoveForm>
        <MoveForm
          direction="down"
          disabled={!canWrite || index === itemCount - 1}
          itemId={item.id}
          label="Omlaag"
          playlistId={playlistId}
          revision={revision}
        >
          <ArrowDown aria-hidden="true" />
        </MoveForm>
        <form action={removePlaylistItem}>
          <RevisionFields playlistId={playlistId} revision={revision} />
          <input name="itemId" type="hidden" value={item.id} />
          <button disabled={!canWrite} type="submit">
            <Trash2 aria-hidden="true" /> Verwijderen
          </button>
        </form>
      </div>
    </details>
  );
}

function Inspector({
  canManage,
  canWrite,
  item,
  onSaveStart,
  playlist,
  readiness
}: {
  canManage: boolean;
  canWrite: boolean;
  item: PlaylistStudioItem | null;
  onSaveStart: () => void;
  playlist: Playlist;
  readiness: PublisherStudioWorkspaceProps["readiness"];
}) {
  if (!item) {
    return (
      <div className={styles.inspector}>
        <div className={styles.panelHeading}>
          <div>
            <h2>Playlistinstellingen</h2>
            <p>Alleen het concept wordt bijgewerkt.</p>
          </div>
          <Badge status={readiness?.canPublish ? "success" : "warning"}>
            {readiness?.canPublish ? "Gereed" : "Aandacht"}
          </Badge>
        </div>
        <form
          action={updatePlaylistDetails}
          className={styles.inspectorForm}
          onSubmit={onSaveStart}
        >
          <RevisionFields
            playlistId={playlist.id}
            revision={playlist.revision}
          />
          <label>
            <span>Playlistnaam</span>
            <input
              data-editor-field
              defaultValue={playlist.name}
              disabled={!canWrite}
              maxLength={120}
              minLength={2}
              name="name"
              required
              type="text"
            />
          </label>
          <label>
            <span>Beschrijving</span>
            <textarea
              data-editor-field
              defaultValue={playlist.description ?? ""}
              disabled={!canWrite}
              maxLength={500}
              name="description"
              rows={4}
            />
          </label>
          <Button disabled={!canWrite} size="sm" type="submit">
            Playlist opslaan
          </Button>
        </form>
        <Readiness readiness={readiness} />
        <form action={archivePlaylist} className={styles.archiveAction}>
          <RevisionFields
            playlistId={playlist.id}
            revision={playlist.revision}
          />
          <Button
            disabled={!canManage}
            size="sm"
            type="submit"
            variant="secondary"
          >
            Playlist archiveren
          </Button>
        </form>
      </div>
    );
  }

  const title = item.asset?.title ?? "Ontbrekende media";
  return (
    <div className={styles.inspector}>
      <div className={styles.panelHeading}>
        <div>
          <h2>Iteminstellingen</h2>
          <p>{title}</p>
        </div>
        <Badge status={item.asset?.status === "ready" ? "success" : "warning"}>
          {item.asset?.status === "ready" ? "Gereed" : "Blokkade"}
        </Badge>
      </div>
      <MediaThumb
        asset={item.asset}
        className={styles.inspectorPreview ?? ""}
      />
      <form
        action={updatePlaylistItem}
        className={styles.inspectorForm}
        onSubmit={onSaveStart}
      >
        <RevisionFields
          playlistId={playlist.id}
          revision={playlist.revision}
        />
        <input name="itemId" type="hidden" value={item.id} />
        <input name="displayName" type="hidden" value={title} />
        <label>
          <span>Titel in mediabibliotheek</span>
          <input
            aria-describedby={`title-help-${item.id}`}
            readOnly
            value={title}
          />
          <small id={`title-help-${item.id}`}>
            De titel is hier alleen-lezen, zodat andere playlists niet
            onverwacht wijzigen.
          </small>
        </label>
        <label>
          <span>Afspeelduur in seconden</span>
          <input
            data-editor-field
            defaultValue={item.durationSeconds}
            disabled={!canWrite}
            max={3600}
            min={5}
            name="duration"
            required
            type="number"
          />
        </label>
        <label>
          <span>Weergave</span>
          <select
            data-editor-field
            defaultValue={item.fitMode}
            disabled={!canWrite}
            name="fitMode"
          >
            <option value="cover">Vullen</option>
            <option value="contain">Passend</option>
          </select>
        </label>
        {item.asset?.kind === "video" ? (
          <label className={styles.checkboxField}>
            <input
              data-editor-field
              defaultChecked={item.muted}
              disabled={!canWrite}
              name="muted"
              type="checkbox"
            />
            <span>Zonder geluid afspelen</span>
          </label>
        ) : (
          <input name="muted" type="hidden" value={item.muted ? "on" : ""} />
        )}
        <Button disabled={!canWrite} size="sm" type="submit">
          Item opslaan
        </Button>
      </form>
    </div>
  );
}

function Readiness({
  readiness
}: {
  readiness: PublisherStudioWorkspaceProps["readiness"];
}) {
  if (!readiness) return null;
  return (
    <section className={styles.readiness}>
      <div>
        <h3>Publicatiegereedheid</h3>
        <span>{formatBytes(readiness.totalBytes)}</span>
      </div>
      {readiness.canPublish ? (
        <p>
          <Check aria-hidden="true" />
          Alle {readiness.itemCount} items zijn gereed voor review.
        </p>
      ) : (
        <ul>
          {readiness.messages.map((message) => (
            <li key={`${message.label}-${message.detail}`}>
              <strong>{message.label}</strong>
              <span>{message.detail}</span>
              <small>Herstel: {message.recovery}</small>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function MediaThumb({
  asset,
  className
}: {
  asset: PlaylistStudioAsset | null;
  className: string;
}) {
  if (asset?.kind === "image" && asset.variant?.previewUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt="" className={className} src={asset.variant.previewUrl} />;
  }
  if (asset?.kind === "video" && asset.variant?.previewUrl) {
    return (
      <span className={`${className} ${styles.videoThumb}`}>
        <video
          aria-label={`Videofragment van ${asset.title}`}
          muted
          playsInline
          preload="metadata"
          src={asset.variant.previewUrl}
        >
          <track kind="captions" />
        </video>
        <Film aria-hidden="true" />
      </span>
    );
  }
  return (
    <span className={`${className} ${styles.missingThumb}`}>
      {asset?.kind === "video" ? (
        <Film aria-hidden="true" />
      ) : (
        <FileImage aria-hidden="true" />
      )}
    </span>
  );
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
      <button disabled={disabled} type="submit">
        {children}
        {label}
      </button>
    </form>
  );
}

function RevisionFields({
  playlistId,
  revision
}: {
  playlistId: string;
  revision: number;
}) {
  return (
    <>
      <input name="playlistId" type="hidden" value={playlistId} />
      <input name="expectedRevision" type="hidden" value={revision} />
    </>
  );
}

function ItemUpdateFields({ item }: { item: PlaylistStudioItem }) {
  return (
    <>
      <input name="itemId" type="hidden" value={item.id} />
      <input
        name="displayName"
        type="hidden"
        value={item.asset?.title ?? "Media-item"}
      />
      <input name="fitMode" type="hidden" value={item.fitMode} />
      <input name="muted" type="hidden" value={item.muted ? "on" : ""} />
    </>
  );
}

function formatSeconds(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return minutes
    ? `${minutes}:${String(rest).padStart(2, "0")}`
    : `${rest} sec`;
}

function formatBytes(bytes: number) {
  if (!bytes) return "0 MB";
  return bytes >= 1024 * 1024 * 1024
    ? `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
