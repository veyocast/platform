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
  type FormEvent,
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
  PlaylistStudioItem,
  PlaylistStudioSection
} from "../playlist-studio-contract";
import { PublisherStudioPreview } from "./publisher-studio-preview";
import {
  clearRecoveryFamily,
  createIdempotencyKey,
  findRecovery,
  saveRecovery,
  type PublisherMutationIntent,
  type PublisherRecoveryRecord
} from "../[playlistId]/publisher-studio-recovery";
import {
  durationStep,
  itemOrder,
  reorderItems,
  restoreOrder
} from "../[playlistId]/publisher-studio-state";
import styles from "../[playlistId]/publisher-studio.module.css";

type Playlist = {
  defaultBackgroundColor: string | null;
  defaultFitMode: "contain" | "cover";
  defaultImageDurationSeconds: number;
  defaultTransition: "crossfade" | "cut" | "wipe";
  defaultVideoMuted: boolean;
  description: string | null;
  id: string;
  loopEnabled: boolean;
  name: string;
  revision: number;
  status: string;
  tenantId: string;
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
  sections: PlaylistStudioSection[];
  screenCount: number;
  serverAcknowledged: boolean;
  serverConflict: boolean;
};

type SaveState =
  | "changed"
  | "conflict"
  | "error"
  | "offline"
  | "saved"
  | "saving";

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
  screenCount,
  serverAcknowledged,
  serverConflict
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
  const [networkOnline, setNetworkOnline] = useState(true);
  const [recovery, setRecovery] = useState<PublisherRecoveryRecord | null>(
    null
  );
  const [recoveryVisible, setRecoveryVisible] = useState(false);
  const [restoredIntent, setRestoredIntent] =
    useState<PublisherMutationIntent | null>(null);
  const saveTimer = useRef<number | null>(null);
  const pendingMove = useRef<PendingMove | null>(null);
  const replaying = useRef(false);
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

  useEffect(() => {
    setNetworkOnline(navigator.onLine);
    const online = () => setNetworkOnline(true);
    const offline = () => {
      setNetworkOnline(false);
      setSaveState("offline");
    };
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, []);

  useEffect(() => {
    if (serverAcknowledged) {
      clearRecoveryFamily(localStorage, playlist.tenantId, playlist.id);
      setRecovery(null);
      setRecoveryVisible(false);
      setRestoredIntent(null);
      return;
    }
    const found = findRecovery(localStorage, playlist.tenantId, playlist.id);
    if (!found) return;
    setRecovery(found);
    setRecoveryVisible(true);
    if (serverConflict || found.revision !== playlist.revision) {
      setSaveState("conflict");
    } else if (found.queued && !navigator.onLine) {
      setSaveState("offline");
    } else {
      setSaveState("changed");
    }
  }, [
    playlist.id,
    playlist.revision,
    playlist.tenantId,
    serverAcknowledged,
    serverConflict
  ]);

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

  useEffect(() => {
    if (
      !networkOnline ||
      !recovery?.queued ||
      replaying.current ||
      serverConflict ||
      recovery.revision !== playlist.revision
    ) {
      return;
    }
    if (recovery.intent.kind === "update_item") {
      setRecoveryVisible(true);
      setRestoredIntent(recovery.intent);
      setSelectedId(recovery.intent.itemId);
      setSaveState("changed");
      return;
    }
    replaying.current = true;
    setSaveState("saving");
    replayRecovery(recovery);
  }, [
    networkOnline,
    playlist.revision,
    recovery,
    serverConflict
  ]);

  function storeIntent(
    intent: PublisherMutationIntent,
    queued: boolean,
    order = itemOrder(orderedItems)
  ) {
    const record: PublisherRecoveryRecord = {
      createdAt: new Date().toISOString(),
      intent,
      order,
      playlistId: playlist.id,
      queued,
      revision: playlist.revision,
      tenantId: playlist.tenantId,
      version: 1
    };
    saveRecovery(localStorage, record);
    setRecovery(record);
    if (queued) setRecoveryVisible(true);
    return record;
  }

  function replayRecovery(record: PublisherRecoveryRecord) {
    const formData = new FormData();
    formData.set("playlistId", playlist.id);
    formData.set("expectedRevision", String(playlist.revision));
    formData.set("idempotencyKey", record.intent.idempotencyKey);
    const intent = record.intent;
    let action: Promise<void>;
    if (intent.kind === "reorder") {
      formData.set("itemId", intent.activeId);
      formData.set("targetPosition", String(intent.targetPosition));
      action = movePlaylistItem(formData);
    } else if (intent.kind === "update_playlist") {
      formData.set("name", intent.name);
      formData.set("description", intent.description);
      action = updatePlaylistDetails(formData);
    } else {
      replaying.current = false;
      setRestoredIntent(intent);
      setSelectedId(intent.itemId);
      setRecoveryVisible(true);
      setSaveState("changed");
      return;
    }
    startTransition(() => {
      void action.catch(() => {
        replaying.current = false;
        setSaveState("error");
        setRecoveryVisible(true);
      });
    });
  }

  function captureIntent(
    form: HTMLFormElement,
    submitter?: HTMLElement | null
  ): PublisherMutationIntent | null {
    const formData = new FormData(form);
    if (submitter instanceof HTMLButtonElement && submitter.name) {
      formData.set(submitter.name, submitter.value);
    }
    const kind = form.dataset.recoveryKind;
    if (kind === "update_playlist") {
      const name = String(formData.get("name") ?? "").trim();
      const description = String(formData.get("description") ?? "").trim();
      if (
        name.length < 2 ||
        name.length > 120 ||
        description.length > 500
      ) {
        return null;
      }
      const previous =
        recovery?.intent.kind === "update_playlist"
          ? recovery.intent.idempotencyKey
          : null;
      return {
        description,
        idempotencyKey: previous ?? createIdempotencyKey(),
        kind: "update_playlist",
        name
      };
    }
    if (kind === "update_item") {
      const itemId = String(formData.get("itemId") ?? "");
      const durationSeconds = Number.parseInt(
        String(formData.get("duration") ?? ""),
        10
      );
      const fitMode = String(formData.get("fitMode") ?? "");
      const transition = String(formData.get("transition") ?? "");
      const cropFocusX = Number(formData.get("cropFocusX"));
      const cropFocusY = Number(formData.get("cropFocusY"));
      const volumePercent = Number(formData.get("volumePercent"));
      const trimStartSeconds = Number(formData.get("trimStartSeconds"));
      const trimEndRaw = String(formData.get("trimEndSeconds") ?? "").trim();
      const trimEndSeconds = trimEndRaw ? Number(trimEndRaw) : null;
      if (
        !orderedItems.some((item) => item.id === itemId) ||
        !Number.isInteger(durationSeconds) ||
        durationSeconds < 5 ||
        durationSeconds > 3600 ||
        (fitMode !== "contain" && fitMode !== "cover") ||
        !["cut", "crossfade", "wipe"].includes(transition) ||
        !Number.isFinite(cropFocusX) ||
        !Number.isFinite(cropFocusY) ||
        !Number.isInteger(volumePercent) ||
        !Number.isFinite(trimStartSeconds) ||
        (trimEndSeconds !== null && !Number.isFinite(trimEndSeconds))
      ) {
        return null;
      }
      const previous =
        recovery?.intent.kind === "update_item" &&
        recovery.intent.itemId === itemId
          ? recovery.intent.idempotencyKey
          : null;
      return {
        accessibilityName: String(formData.get("accessibilityName") ?? "").trim(),
        backgroundColor: String(formData.get("backgroundColor") ?? "").trim(),
        cropFocusX,
        cropFocusY,
        displayTitle: String(formData.get("displayTitle") ?? "").trim(),
        durationSeconds,
        enabled: formData.get("enabled") === "on",
        fitMode,
        idempotencyKey: previous ?? createIdempotencyKey(),
        itemId,
        kind: "update_item",
        muted: formData.get("muted") === "on",
        transition: transition as "crossfade" | "cut" | "wipe",
        trimEndSeconds,
        trimStartSeconds,
        visibleFrom: String(formData.get("visibleFrom") ?? ""),
        visibleUntil: String(formData.get("visibleUntil") ?? ""),
        volumePercent
      };
    }
    if (kind === "reorder") {
      const itemId = String(formData.get("itemId") ?? "");
      const index = orderedItems.findIndex((item) => item.id === itemId);
      const direction = String(formData.get("direction") ?? "");
      if (index < 0 || (direction !== "up" && direction !== "down")) {
        return null;
      }
      return {
        activeId: itemId,
        idempotencyKey: createIdempotencyKey(),
        kind: "reorder",
        targetPosition:
          direction === "up"
            ? Math.max(0, index - 1)
            : Math.min(orderedItems.length - 1, index + 1)
      };
    }
    return null;
  }

  function handleSubmitCapture(event: FormEvent<HTMLDivElement>) {
    if (!(event.target instanceof HTMLFormElement)) return;
    const submitter =
      event.nativeEvent instanceof SubmitEvent
        ? event.nativeEvent.submitter
        : null;
    const intent = captureIntent(
      event.target,
      submitter instanceof HTMLElement ? submitter : null
    );
    if (!intent) {
      if (!navigator.onLine && event.target.dataset.onlineRequired) {
        event.preventDefault();
        setSaveState("offline");
      }
      return;
    }
    const queued = !navigator.onLine;
    storeIntent(intent, queued);
    if (queued) {
      event.preventDefault();
      setSaveState("offline");
    } else {
      setSaveState("saving");
    }
  }

  function scheduleOrderSave(move: PendingMove) {
    pendingMove.current = move;
    setSaveState("changed");
    const intent: PublisherMutationIntent = {
      activeId: move.activeId,
      idempotencyKey: createIdempotencyKey(),
      kind: "reorder",
      targetPosition: move.targetPosition
    };
    storeIntent(intent, false);
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      if (!navigator.onLine) {
        storeIntent(intent, true);
        setSaveState("offline");
        return;
      }
      setSaveState("saving");
      const formData = new FormData();
      formData.set("playlistId", playlist.id);
      formData.set("expectedRevision", String(playlist.revision));
      formData.set("itemId", move.activeId);
      formData.set("targetPosition", String(move.targetPosition));
      formData.set("idempotencyKey", intent.idempotencyKey);
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
    clearRecoveryFamily(localStorage, playlist.tenantId, playlist.id);
    setRecovery(null);
    setRecoveryVisible(false);
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

  function restoreRecovery() {
    if (!recovery || recovery.revision !== playlist.revision) return;
    if (recovery.intent.kind === "reorder") {
      const restored = restoreOrder(orderedItems, recovery.order);
      setOrderedItems(restored);
      setRecoveryVisible(false);
      storeIntent(recovery.intent, true, recovery.order);
      setSaveState(navigator.onLine ? "saving" : "offline");
      return;
    }
    setRestoredIntent(recovery.intent);
    if (recovery.intent.kind === "update_item") {
      setSelectedId(recovery.intent.itemId);
      setInspectorSheetOpen(
        window.matchMedia("(max-width: 1180px)").matches
      );
    } else {
      setSelectedId(null);
      setInspectorSheetOpen(
        window.matchMedia("(max-width: 1180px)").matches
      );
    }
    setRecoveryVisible(false);
    setSaveState("changed");
  }

  function discardRecovery() {
    clearRecoveryFamily(localStorage, playlist.tenantId, playlist.id);
    setRecovery(null);
    setRecoveryVisible(false);
    setRestoredIntent(null);
    setSaveState("saved");
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
      playlist={playlist}
      readiness={readiness}
      restoredIntent={restoredIntent}
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
            const form = event.target.closest("form");
            if (form instanceof HTMLFormElement) {
              const intent = captureIntent(form);
              if (intent) storeIntent(intent, false);
            }
            setSaveState("changed");
          }
        }}
        onSubmitCapture={handleSubmitCapture}
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
            {readiness?.canPublish && networkOnline ? (
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
                title={
                  networkOnline
                    ? "Herstel eerst de publicatieblokkades"
                    : "Publiceren vereist een online verbinding"
                }
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

        {recoveryVisible && recovery ? (
          <RecoveryBanner
            conflict={
              serverConflict || recovery.revision !== playlist.revision
            }
            currentRevision={playlist.revision}
            onDiscard={discardRecovery}
            onRestore={restoreRecovery}
            record={recovery}
          />
        ) : null}

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
          {readiness?.canPublish && networkOnline ? (
            <Link href={`/dashboard/playlists/${playlist.id}/publish`}>
              <CloudUpload aria-hidden="true" />
              Publiceren
            </Link>
          ) : (
            <button
              disabled
              title={
                networkOnline
                  ? "Herstel eerst de publicatieblokkades"
                  : "Publiceren vereist een online verbinding"
              }
              type="button"
            >
              <CloudUpload aria-hidden="true" />
              Publiceren
            </button>
          )}
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

function RecoveryBanner({
  conflict,
  currentRevision,
  onDiscard,
  onRestore,
  record
}: {
  conflict: boolean;
  currentRevision: number;
  onDiscard: () => void;
  onRestore: () => void;
  record: PublisherRecoveryRecord;
}) {
  const labels: Record<PublisherMutationIntent["kind"], string> = {
    reorder: "volgordewijziging",
    update_item: "itemwijziging",
    update_playlist: "playlistwijziging"
  };
  return (
    <section
      className={styles.recoveryBanner}
      data-conflict={conflict || undefined}
      role={conflict ? "alert" : "status"}
    >
      <div>
        <strong>
          {conflict
            ? "Lokale wijziging botst met de nieuwste revisie"
            : "Lokale wijziging gevonden"}
        </strong>
        <p>
          {conflict
            ? `De buffer hoort bij revisie ${record.revision}; de server staat op revisie ${currentRevision}. Automatisch hervatten is gestopt.`
            : `Er staat een ${labels[record.intent.kind]} klaar. Publiceren is niet offline uitgevoerd.`}
        </p>
      </div>
      <div>
        {!conflict ? (
          <Button onClick={onRestore} size="sm" variant="secondary">
            Herstellen
          </Button>
        ) : null}
        <Button onClick={onDiscard} size="sm" variant="ghost">
          Lokale wijziging verwerpen
        </Button>
      </div>
    </section>
  );
}

function AutosaveIndicator({ state }: { state: SaveState }) {
  const labels: Record<SaveState, string> = {
    changed: "Niet-opgeslagen wijziging",
    conflict: "Herstelconflict",
    error: "Opslaan mislukt",
    offline: "Offline gewijzigd",
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
      <form action={addPlaylistItem} data-online-required>
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
  const assetTitle = item.asset?.title ?? "Ontbrekende media";
  const title = item.displayTitle || assetTitle;
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
      data-recovery-kind="update_item"
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
        <form action={removePlaylistItem} data-online-required>
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
  playlist,
  readiness,
  restoredIntent
}: {
  canManage: boolean;
  canWrite: boolean;
  item: PlaylistStudioItem | null;
  playlist: Playlist;
  readiness: PublisherStudioWorkspaceProps["readiness"];
  restoredIntent: PublisherMutationIntent | null;
}) {
  if (!item) {
    const playlistDraft =
      restoredIntent?.kind === "update_playlist" ? restoredIntent : null;
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
          data-recovery-kind="update_playlist"
          key={playlistDraft?.idempotencyKey ?? "playlist-current"}
        >
          <RevisionFields
            playlistId={playlist.id}
            revision={playlist.revision}
          />
          <label>
            <span>Playlistnaam</span>
            <input
              data-editor-field
              defaultValue={playlistDraft?.name ?? playlist.name}
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
              defaultValue={
                playlistDraft?.description ?? playlist.description ?? ""
              }
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
        <form
          action={archivePlaylist}
          className={styles.archiveAction}
          data-online-required
        >
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

  const assetTitle = item.asset?.title ?? "Ontbrekende media";
  const title = item.displayTitle || assetTitle;
  const itemDraft =
    restoredIntent?.kind === "update_item" &&
    restoredIntent.itemId === item.id
      ? restoredIntent
      : null;
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
        data-recovery-kind="update_item"
        key={itemDraft?.idempotencyKey ?? item.id}
      >
        <RevisionFields
          playlistId={playlist.id}
          revision={playlist.revision}
        />
        <input name="itemId" type="hidden" value={item.id} />
        <label>
          <span>Titel binnen deze playlist</span>
          <input
            aria-describedby={`title-help-${item.id}`}
            data-editor-field
            defaultValue={itemDraft?.displayTitle ?? item.displayTitle ?? ""}
            disabled={!canWrite}
            maxLength={120}
            name="displayTitle"
            placeholder={assetTitle}
          />
          <small id={`title-help-${item.id}`}>
            Laat leeg om de bibliotheektitel “{assetTitle}” te gebruiken.
          </small>
        </label>
        <label>
          <span>Afspeelduur in seconden</span>
          <input
            data-editor-field
            defaultValue={itemDraft?.durationSeconds ?? item.durationSeconds}
            disabled={!canWrite}
            max={3600}
            min={5}
            name="duration"
            required
            type="number"
          />
        </label>
        <label>
          <span>Overgang</span>
          <select
            data-editor-field
            defaultValue={itemDraft?.transition ?? item.transition}
            disabled={!canWrite}
            name="transition"
          >
            <option value="cut">Direct</option>
            <option value="crossfade">Vervagen</option>
            <option value="wipe">Schuiven</option>
          </select>
        </label>
        <label>
          <span>Weergave</span>
          <select
            data-editor-field
            defaultValue={itemDraft?.fitMode ?? item.fitMode}
            disabled={!canWrite}
            name="fitMode"
          >
            <option value="cover">Vullen</option>
            <option value="contain">Passend</option>
          </select>
        </label>
        <fieldset>
          <legend>Focuspunt</legend>
          <label>
            <span>Horizontaal</span>
            <input
              data-editor-field
              defaultValue={itemDraft?.cropFocusX ?? item.cropFocusX}
              disabled={!canWrite}
              max={1}
              min={0}
              name="cropFocusX"
              step={0.05}
              type="range"
            />
          </label>
          <label>
            <span>Verticaal</span>
            <input
              data-editor-field
              defaultValue={itemDraft?.cropFocusY ?? item.cropFocusY}
              disabled={!canWrite}
              max={1}
              min={0}
              name="cropFocusY"
              step={0.05}
              type="range"
            />
          </label>
        </fieldset>
        <label>
          <span>Achtergrondkleur</span>
          <input
            data-editor-field
            defaultValue={itemDraft?.backgroundColor ?? item.backgroundColor ?? ""}
            disabled={!canWrite}
            name="backgroundColor"
            pattern="#[0-9A-Fa-f]{6}"
            placeholder={playlist.defaultBackgroundColor ?? "#000000"}
            type="text"
          />
        </label>
        {item.asset?.kind === "video" ? (
          <>
            <label>
              <span>Volume in procenten</span>
              <input
                data-editor-field
                defaultValue={itemDraft?.volumePercent ?? item.volumePercent}
                disabled={!canWrite}
                max={100}
                min={0}
                name="volumePercent"
                type="number"
              />
            </label>
            <label className={styles.checkboxField}>
              <input
                data-editor-field
                defaultChecked={itemDraft?.muted ?? item.muted}
                disabled={!canWrite}
                name="muted"
                type="checkbox"
              />
              <span>Zonder geluid afspelen</span>
            </label>
            <div className={styles.inspectorFormRow}>
              <label>
                <span>Startpunt</span>
                <input
                  data-editor-field
                  defaultValue={itemDraft?.trimStartSeconds ?? item.trimStartSeconds}
                  disabled={!canWrite}
                  min={0}
                  name="trimStartSeconds"
                  step={0.1}
                  type="number"
                />
              </label>
              <label>
                <span>Eindpunt</span>
                <input
                  data-editor-field
                  defaultValue={itemDraft?.trimEndSeconds ?? item.trimEndSeconds ?? ""}
                  disabled={!canWrite}
                  min={0.1}
                  name="trimEndSeconds"
                  step={0.1}
                  type="number"
                />
              </label>
            </div>
          </>
        ) : (
          <>
            <input name="muted" type="hidden" value={item.muted ? "on" : ""} />
            <input name="volumePercent" type="hidden" value={item.volumePercent} />
            <input name="trimStartSeconds" type="hidden" value={item.trimStartSeconds} />
            <input name="trimEndSeconds" type="hidden" value={item.trimEndSeconds ?? ""} />
          </>
        )}
        <div className={styles.inspectorFormRow}>
          <label>
            <span>Zichtbaar vanaf</span>
            <input
              data-editor-field
              defaultValue={toLocalDateTime(itemDraft?.visibleFrom ?? item.visibleFrom)}
              disabled={!canWrite}
              name="visibleFrom"
              type="datetime-local"
            />
          </label>
          <label>
            <span>Zichtbaar tot</span>
            <input
              data-editor-field
              defaultValue={toLocalDateTime(itemDraft?.visibleUntil ?? item.visibleUntil)}
              disabled={!canWrite}
              name="visibleUntil"
              type="datetime-local"
            />
          </label>
        </div>
        <label>
          <span>Toegankelijkheidsnaam</span>
          <input
            data-editor-field
            defaultValue={itemDraft?.accessibilityName ?? item.accessibilityName ?? ""}
            disabled={!canWrite}
            maxLength={160}
            name="accessibilityName"
            placeholder={title}
          />
        </label>
        <label className={styles.checkboxField}>
          <input
            data-editor-field
            defaultChecked={itemDraft?.enabled ?? item.enabled}
            disabled={!canWrite}
            name="enabled"
            type="checkbox"
          />
          <span>Item meenemen in publicatie</span>
        </label>
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
    <form action={movePlaylistItem} data-recovery-kind="reorder">
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
      <input name="displayTitle" type="hidden" value={item.displayTitle ?? ""} />
      <input name="fitMode" type="hidden" value={item.fitMode} />
      <input name="muted" type="hidden" value={item.muted ? "on" : ""} />
      <input name="transition" type="hidden" value={item.transition} />
      <input name="cropFocusX" type="hidden" value={item.cropFocusX} />
      <input name="cropFocusY" type="hidden" value={item.cropFocusY} />
      <input name="backgroundColor" type="hidden" value={item.backgroundColor ?? ""} />
      <input name="volumePercent" type="hidden" value={item.volumePercent} />
      <input name="trimStartSeconds" type="hidden" value={item.trimStartSeconds} />
      <input name="trimEndSeconds" type="hidden" value={item.trimEndSeconds ?? ""} />
      <input name="visibleFrom" type="hidden" value={item.visibleFrom ?? ""} />
      <input name="visibleUntil" type="hidden" value={item.visibleUntil ?? ""} />
      <input name="enabled" type="hidden" value={item.enabled ? "on" : ""} />
      <input name="accessibilityName" type="hidden" value={item.accessibilityName ?? ""} />
    </>
  );
}

function toLocalDateTime(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
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
