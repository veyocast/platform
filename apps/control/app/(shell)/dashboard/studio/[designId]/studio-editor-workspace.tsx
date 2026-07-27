"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
  useTransition
} from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Circle,
  Copy,
  Eye,
  EyeOff,
  Film,
  GripVertical,
  Hand,
  History,
  Image as ImageIcon,
  Layers3,
  Lock,
  Maximize,
  Minus,
  MonitorPlay,
  MoreHorizontal,
  Pause,
  Play,
  QrCode,
  Redo2,
  RotateCcw,
  Save,
  Repeat2,
  Sparkles,
  Square,
  Star,
  Trash2,
  Type,
  Undo2,
  Unlock,
  WandSparkles,
  ZoomIn,
  ZoomOut
} from "lucide-react";

import {
  studioAnimationPresets,
  studioLimits,
  type StudioElement,
  type StudioElementTiming
} from "@veyocast/studio";
import { Button, Progress, StatusPill } from "@veyocast/ui";

import {
  cancelStudioRenderAction,
  copyStudioConflictAction,
  mutateStudioProjectAction,
  requestStudioRenderAction,
  restoreStudioRevisionAction,
  retryStudioRenderAction,
  saveStudioDraftAction
} from "../actions";
import {
  createStudioEditorState,
  studioEditorReducer,
  type StudioEditorAction,
  type StudioEditorState
} from "../editor-state";
import {
  clearStudioRecovery,
  readStudioRecovery,
  writeStudioRecovery
} from "../studio-recovery";
import type {
  StudioEditorPermissions,
  StudioMediaAsset,
  StudioProjectDetail,
  StudioRenderJob,
  StudioRevision
} from "../types";
import styles from "../studio.module.css";
import { StudioKonvaCanvas } from "./studio-konva-canvas";

type WorkspaceProps = {
  assets: StudioMediaAsset[];
  error: string | null;
  initialRenderId: string | null;
  isLive: boolean;
  permissions: StudioEditorPermissions;
  project: StudioProjectDetail;
  renderJobs: StudioRenderJob[];
  revisions: StudioRevision[];
  tenantBrand?: {
    colors: string[];
    logoAssetId?: string;
    name: string;
  } | null;
  tenantId: string;
};

type RecoveryCandidate = Awaited<ReturnType<typeof readStudioRecovery>>;

export function StudioEditorWorkspace({
  assets,
  error,
  initialRenderId,
  isLive,
  permissions,
  project,
  renderJobs,
  revisions,
  tenantBrand = null,
  tenantId
}: WorkspaceProps) {
  const [state, dispatch] = useReducer(
    studioEditorReducer,
    createStudioEditorState(project.document, project.draftRevision)
  );
  const stateRef = useRef(state);
  const projectRevisionRef = useRef(project.projectRevision);
  const savingRef = useRef(false);
  const clipboardRef = useRef<string[]>([]);
  const [recovery, setRecovery] = useState<RecoveryCandidate>(null);
  const [renderMessage, setRenderMessage] = useState<string | null>(null);
  const [projectName, setProjectName] = useState(project.name);
  const [renderPanelOpen, setRenderPanelOpen] = useState(
    Boolean(initialRenderId) || renderJobs.length > 0
  );
  const [canvasScale, setCanvasScale] = useState(1);
  const [leftPanelWidth, setLeftPanelWidth] = useState(240);
  const [panEnabled, setPanEnabled] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [revisionPanelOpen, setRevisionPanelOpen] = useState(false);
  const [selectedRevision, setSelectedRevision] =
    useState<StudioRevision | null>(null);
  const [rightPanelWidth, setRightPanelWidth] = useState(280);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    readStudioRecovery(tenantId, project.id)
      .then((candidate) => {
        if (
          candidate &&
          (candidate.draftRevision >= project.draftRevision ||
            Date.parse(candidate.savedAt) > Date.parse(project.updatedAt))
        ) {
          setRecovery(candidate);
        }
      })
      .catch(() => undefined);
  }, [project.draftRevision, project.id, project.updatedAt, tenantId]);

  const save = useCallback(async (): Promise<number | null> => {
    const snapshot = stateRef.current;
    if (
      !permissions.canEdit ||
      savingRef.current ||
      !["dirty", "offline", "error"].includes(snapshot.saveState)
    ) {
      return snapshot.saveState === "saved" ? snapshot.draftRevision : null;
    }
    await writeStudioRecovery({
      document: snapshot.document,
      draftRevision: snapshot.draftRevision,
      projectId: project.id,
      savedAt: new Date().toISOString(),
      tenantId
    }).catch(() => undefined);
    if (!navigator.onLine) {
      dispatch({ saveState: "offline", type: "save/state" });
      return null;
    }
    savingRef.current = true;
    dispatch({ saveState: "saving", type: "save/state" });
    let result;
    try {
      result = await saveStudioDraftAction({
        document: snapshot.document,
        expectedRevision: snapshot.draftRevision,
        idempotencyKey: crypto.randomUUID(),
        projectId: project.id
      });
    } catch {
      dispatch({ saveState: "error", type: "save/state" });
      setRenderMessage(
        "Opslaan is onverwacht onderbroken. Je lokale herstelversie blijft beschikbaar."
      );
      return null;
    } finally {
      savingRef.current = false;
    }
    if (!result.ok) {
      dispatch({
        saveState: result.outcome === "conflict" ? "conflict" : "error",
        type: "save/state"
      });
      setRenderMessage(result.error ?? null);
      return null;
    }
    const nextRevision = result.revision ?? snapshot.draftRevision;
    projectRevisionRef.current =
      result.projectRevision ?? projectRevisionRef.current;
    if (stateRef.current.document === snapshot.document) {
      dispatch({
        revision: nextRevision,
        saveState: "saved",
        type: "save/state"
      });
      await clearStudioRecovery(tenantId, project.id).catch(() => undefined);
    } else {
      dispatch({
        revision: nextRevision,
        saveState: "dirty",
        type: "save/state"
      });
    }
    return nextRevision;
  }, [permissions.canEdit, project.id, tenantId]);

  const renameProject = useCallback(
    async (name: string) => {
      const normalized = name.trim();
      if (normalized === projectName) return true;
      if (normalized.length < 2 || normalized.length > 120) {
        setRenderMessage("Gebruik een ontwerpnaam van 2 tot en met 120 tekens.");
        return false;
      }
      const savedRevision = await save();
      if (
        savedRevision === null &&
        stateRef.current.saveState !== "saved"
      ) {
        setRenderMessage(
          "Sla de inhoud eerst veilig op voordat je de ontwerpnaam wijzigt."
        );
        return false;
      }
      const result = await mutateStudioProjectAction({
        expectedRevision: projectRevisionRef.current,
        idempotencyKey: crypto.randomUUID(),
        operation: "rename",
        payload: { name: normalized },
        projectId: project.id
      });
      if (!result.ok) {
        setRenderMessage(result.error ?? "De ontwerpnaam is niet gewijzigd.");
        return false;
      }
      projectRevisionRef.current =
        result.revision ?? projectRevisionRef.current;
      setProjectName(normalized);
      setRenderMessage("De ontwerpnaam is opgeslagen.");
      return true;
    },
    [project.id, projectName, save]
  );

  useEffect(() => {
    if (
      !renderPanelOpen ||
      !renderJobs.some((job) =>
        ["queued", "preparing", "rendering", "encoding", "uploading", "creating_media"].includes(
          job.status
        )
      )
    ) {
      return;
    }
    const timer = window.setInterval(() => router.refresh(), 3_000);
    return () => window.clearInterval(timer);
  }, [renderJobs, renderPanelOpen, router]);

  useEffect(() => {
    if (!permissions.canEdit || state.saveState !== "dirty") return;
    writeStudioRecovery({
      document: state.document,
      draftRevision: state.draftRevision,
      projectId: project.id,
      savedAt: new Date().toISOString(),
      tenantId
    }).catch(() => undefined);
    const timer = window.setTimeout(() => void save(), 900);
    return () => window.clearTimeout(timer);
  }, [
    permissions.canEdit,
    project.id,
    save,
    state.document,
    state.draftRevision,
    state.saveState,
    tenantId
  ]);

  useEffect(() => {
    const handleOnline = () => {
      if (stateRef.current.saveState === "offline") {
        dispatch({ saveState: "dirty", type: "save/state" });
      }
    };
    const handleOffline = () => {
      if (stateRef.current.saveState !== "saved") {
        dispatch({ saveState: "offline", type: "save/state" });
      }
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!state.playing) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const delta = now - last;
      last = now;
      const next =
        stateRef.current.playheadMs + delta >=
        stateRef.current.document.motion.durationMs
          ? stateRef.current.looping
            ? 0
            : stateRef.current.document.motion.durationMs
          : stateRef.current.playheadMs + delta;
      dispatch({ playheadMs: next, type: "playback/seek" });
      if (
        next === stateRef.current.document.motion.durationMs &&
        !stateRef.current.looping
      ) {
        dispatch({ playing: false, type: "playback/toggle" });
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [state.playing]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      ) {
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        dispatch({ type: event.shiftKey ? "history/redo" : "history/undo" });
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "c") {
        clipboardRef.current = [...stateRef.current.selectedIds];
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "v") {
        if (permissions.canEdit) {
          event.preventDefault();
          for (const elementId of clipboardRef.current) {
            dispatch({ elementId, type: "element/duplicate" });
          }
        }
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        if (permissions.canEdit && stateRef.current.selectedIds.length) {
          event.preventDefault();
          dispatch({
            elementIds: stateRef.current.selectedIds,
            type: "element/remove"
          });
        }
        return;
      }
      const delta = event.shiftKey ? 10 : 1;
      const directions: Record<string, [number, number]> = {
        ArrowDown: [0, delta],
        ArrowLeft: [-delta, 0],
        ArrowRight: [delta, 0],
        ArrowUp: [0, -delta]
      };
      const direction = directions[event.key];
      if (direction && permissions.canEdit) {
        event.preventDefault();
        dispatch({
          deltaX: direction[0],
          deltaY: direction[1],
          type: "element/nudge"
        });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [permissions.canEdit]);

  function requestRender() {
    startTransition(async () => {
      setRenderMessage(null);
      const savedRevision = await save();
      const current = stateRef.current;
      if (savedRevision === null) {
        setRenderMessage(
          current.saveState === "conflict"
            ? "Los eerst het opslagconflict op voordat je rendert."
            : "Het concept moet online en veilig opgeslagen zijn voor de render."
        );
        return;
      }
      const result = await requestStudioRenderAction({
        expectedDraftRevision: savedRevision,
        idempotencyKey: crypto.randomUUID(),
        outputKind: stateRef.current.document.motion.enabled ? "mp4" : "png",
        projectId: project.id
      });
      if (!result.ok) {
        setRenderMessage(result.error ?? "Render aanvragen mislukt.");
        return;
      }
      setRenderPanelOpen(true);
      setRenderMessage(
        result.outcome === "demo"
          ? "Demorender voltooid. In live modus wordt dit een echt Media-item."
          : "Render staat veilig in de wachtrij. Je kunt blijven doorwerken."
      );
      router.refresh();
    });
  }

  function restoreRevision(revision: StudioRevision) {
    startTransition(async () => {
      setRenderMessage(null);
      const result = await restoreStudioRevisionAction({
        expectedDraftRevision: stateRef.current.draftRevision,
        idempotencyKey: crypto.randomUUID(),
        projectId: project.id,
        revisionId: revision.id
      });
      if (!result.ok || result.revision === undefined) {
        setRenderMessage(
          result.error ?? "De gekozen revisie kon niet worden hersteld."
        );
        if (result.outcome === "conflict") {
          dispatch({ saveState: "conflict", type: "save/state" });
        }
        return;
      }
      dispatch({
        document: revision.document,
        revision: result.revision,
        type: "document/replace"
      });
      await clearStudioRecovery(tenantId, project.id).catch(() => undefined);
      setRevisionPanelOpen(false);
      setSelectedRevision(null);
      setRenderMessage(`Revisie ${revision.number} is als nieuw concept hersteld.`);
      router.refresh();
    });
  }

  function copyConflict() {
    startTransition(async () => {
      setRenderMessage(null);
      const result = await copyStudioConflictAction({
        document: stateRef.current.document,
        idempotencyKey: crypto.randomUUID(),
        projectId: project.id
      });
      if (!result.ok || !result.projectId) {
        setRenderMessage(
          result.error ?? "De conflictkopie kon niet veilig worden gemaakt."
        );
        return;
      }
      await clearStudioRecovery(tenantId, project.id).catch(() => undefined);
      router.push(`/dashboard/studio/${result.projectId}`);
    });
  }

  return (
    <section aria-label="Studio-editor" className={styles.editorShell}>
      <header className={styles.editorHeader}>
        <div className={styles.editorIdentity}>
          <Button asChild aria-label="Terug naar Studio" size="sm" variant="ghost">
            <Link href="/dashboard/studio">
              <ArrowLeft aria-hidden="true" />
            </Link>
          </Button>
          <div>
            <span>Studio</span>
            <h1>{projectName}</h1>
          </div>
        </div>
        <div className={styles.editorHeaderActions}>
          <div className={styles.historyButtons}>
            <Button
              aria-label="Ongedaan maken"
              disabled={!state.past.length || !permissions.canEdit}
              onClick={() => dispatch({ type: "history/undo" })}
              size="sm"
              variant="ghost"
            >
              <Undo2 aria-hidden="true" />
            </Button>
            <Button
              aria-label="Opnieuw uitvoeren"
              disabled={!state.future.length || !permissions.canEdit}
              onClick={() => dispatch({ type: "history/redo" })}
              size="sm"
              variant="ghost"
            >
              <Redo2 aria-hidden="true" />
            </Button>
            <Button
              aria-label="Revisiegeschiedenis openen"
              onClick={() => setRevisionPanelOpen(true)}
              size="sm"
              title="Revisies"
              variant="ghost"
            >
              <History aria-hidden="true" />
            </Button>
          </div>
          <SaveIndicator saveState={state.saveState} />
          {state.saveState !== "saved" ? (
            <Button
              disabled={!permissions.canEdit || state.saveState === "saving"}
              onClick={() => void save()}
              size="sm"
              variant="secondary"
            >
              <Save aria-hidden="true" />
              Opslaan
            </Button>
          ) : null}
          <Button
            onClick={() => setPreviewOpen(true)}
            size="sm"
            variant="secondary"
          >
            <MonitorPlay aria-hidden="true" />
            Voorbeeld
          </Button>
          <Button
            disabled={!permissions.canRender || isPending}
            onClick={requestRender}
            size="sm"
          >
            <WandSparkles aria-hidden="true" />
            {isPending ? "Voorbereiden…" : "Genereren"}
          </Button>
        </div>
      </header>

      {error ? (
        <div className={styles.editorBanner} role="alert">
          <strong>Niet alle Studio-data is beschikbaar.</strong>
          <span>{error}</span>
        </div>
      ) : null}
      {recovery ? (
        <div className={styles.editorBanner} role="status">
          <div>
            <strong>Lokale herstelversie gevonden</strong>
            <span>
              Je serverversie is niet overschreven. Kies zelf welke versie je
              wilt gebruiken.
            </span>
          </div>
          <div>
            <Button
              onClick={() => {
                dispatch({
                  document: recovery.document,
                  revision: recovery.draftRevision,
                  type: "document/replace"
                });
                dispatch({ saveState: "dirty", type: "save/state" });
                setRecovery(null);
              }}
              size="sm"
              variant="secondary"
            >
              Herstellen
            </Button>
            <Button
              onClick={() => {
                void clearStudioRecovery(tenantId, project.id);
                setRecovery(null);
              }}
              size="sm"
              variant="ghost"
            >
              Negeren
            </Button>
          </div>
        </div>
      ) : null}
      {state.saveState === "conflict" ? (
        <div className={styles.conflictBanner} role="alert">
          <div>
            <strong>Er is een nieuwere serverversie</strong>
            <span>
              Je lokale ontwerp blijft bewaard en wordt niet automatisch over
              de andere versie heen geschreven. Maak een kopie of laad bewust
              de nieuwste versie.
            </span>
          </div>
          <div>
            {permissions.canCreate ? (
              <Button
                disabled={isPending}
                onClick={copyConflict}
                size="sm"
                variant="secondary"
              >
                <Copy aria-hidden="true" />
                Eigen wijzigingen als kopie
              </Button>
            ) : null}
            <Button
              disabled={isPending}
              onClick={() => {
                void clearStudioRecovery(tenantId, project.id).finally(() =>
                  window.location.reload()
                );
              }}
              size="sm"
              variant="ghost"
            >
              <RotateCcw aria-hidden="true" />
              Nieuwste laden
            </Button>
          </div>
        </div>
      ) : null}

      <div
        className={styles.desktopEditor}
        style={
          {
            "--studio-left-panel": `${leftPanelWidth}px`,
            "--studio-right-panel": `${rightPanelWidth}px`
          } as CSSProperties
        }
      >
        <aside className={styles.libraryPanel}>
          <ElementLibrary
            assets={assets}
            canEdit={permissions.canEdit}
            dispatch={dispatch}
            state={state}
            tenantBrand={tenantBrand}
          />
        </aside>
        <PanelResizeHandle
          direction={1}
          label="Breedte elementpaneel"
          maximum={360}
          minimum={190}
          onChange={setLeftPanelWidth}
          value={leftPanelWidth}
        />
        <section className={styles.canvasPanel}>
          <div className={styles.canvasToolbar}>
            <span>
              {project.orientation === "landscape" ? "Liggend HD" : "Staand HD"} ·{" "}
              {project.document.artboard.width} × {project.document.artboard.height}
            </span>
            <div>
              <Button
                aria-pressed={panEnabled}
                aria-label="Canvas verschuiven; houd ook spatie ingedrukt"
                onClick={() => setPanEnabled((value) => !value)}
                size="sm"
                variant={panEnabled ? "secondary" : "ghost"}
              >
                <Hand aria-hidden="true" />
              </Button>
              <Button
                aria-label="Passend in werkvlak"
                onClick={() => dispatch({ type: "zoom/reset" })}
                size="sm"
                variant="ghost"
              >
                <Maximize aria-hidden="true" />
                Passend
              </Button>
              <button
                onClick={() => {
                  const fitScale = canvasScale / state.zoom;
                  dispatch({
                    type: "zoom/set",
                    zoom: fitScale > 0 ? 1 / fitScale : 1
                  });
                }}
                type="button"
              >
                100%
              </button>
              <Button
                aria-label="Uitzoomen"
                onClick={() => dispatch({ type: "zoom/out" })}
                size="sm"
                variant="ghost"
              >
                <ZoomOut aria-hidden="true" />
              </Button>
              <button onClick={() => dispatch({ type: "zoom/reset" })} type="button">
                {Math.round(canvasScale * 100)}%
              </button>
              <Button
                aria-label="Inzoomen"
                onClick={() => dispatch({ type: "zoom/in" })}
                size="sm"
                variant="ghost"
              >
                <ZoomIn aria-hidden="true" />
              </Button>
            </div>
          </div>
          <StudioKonvaCanvas
            assets={assets}
            canEdit={permissions.canEdit}
            dispatch={dispatch}
            document={state.document}
            onScaleChange={setCanvasScale}
            panEnabled={panEnabled}
            playheadMs={state.playheadMs}
            selectedIds={state.selectedIds}
            zoom={state.zoom}
          />
          <MotionTimeline dispatch={dispatch} state={state} />
        </section>
        <PanelResizeHandle
          direction={-1}
          label="Breedte instellingenpaneel"
          maximum={390}
          minimum={220}
          onChange={setRightPanelWidth}
          value={rightPanelWidth}
        />
        <aside className={styles.inspectorPanel}>
          <InspectorPanel
            assets={assets}
            canEdit={permissions.canEdit}
            dispatch={dispatch}
            state={state}
          />
        </aside>
      </div>

      <MobileQuickEdit
        assets={assets}
        canEdit={permissions.canEdit}
        dispatch={dispatch}
        onRename={renameProject}
        projectName={projectName}
        requestRender={requestRender}
        state={state}
      />

      <PreviewDialog
        assets={assets}
        dispatch={dispatch}
        onClose={() => setPreviewOpen(false)}
        open={previewOpen}
        state={state}
      />

      <RevisionDialog
        assets={assets}
        canRestore={permissions.canEdit && isLive}
        currentRevision={state.draftRevision}
        onClose={() => {
          setRevisionPanelOpen(false);
          setSelectedRevision(null);
        }}
        onRestore={restoreRevision}
        onSelect={setSelectedRevision}
        open={revisionPanelOpen}
        pending={isPending}
        revisions={revisions}
        selectedRevision={selectedRevision}
      />

      <RenderPanel
        canManageJobs={permissions.canManageJobs}
        message={renderMessage}
        onClose={() => setRenderPanelOpen(false)}
        open={renderPanelOpen}
        renderJobs={renderJobs}
      />

      <footer className={styles.editorFooter}>
        <span>
          Concept · revisie {state.draftRevision}
        </span>
        <span>
          {isLive ? "Veilige tenantopslag actief" : "Demomodus"} ·{" "}
          {state.document.elements.length} lagen
        </span>
        <button onClick={() => setRenderPanelOpen(true)} type="button">
          <Film aria-hidden="true" />
          Renderstatus
        </button>
      </footer>
    </section>
  );
}

function PanelResizeHandle({
  direction,
  label,
  maximum,
  minimum,
  onChange,
  value
}: {
  direction: 1 | -1;
  label: string;
  maximum: number;
  minimum: number;
  onChange: (value: number) => void;
  value: number;
}) {
  function resize(nextValue: number) {
    onChange(Math.max(minimum, Math.min(maximum, Math.round(nextValue))));
  }

  return (
    <button
      aria-label={`${label}: ${value} pixels`}
      aria-orientation="vertical"
      aria-valuemax={maximum}
      aria-valuemin={minimum}
      aria-valuenow={value}
      className={styles.panelResizeHandle}
      onKeyDown={(event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        const delta = event.key === "ArrowRight" ? 8 : -8;
        resize(value + delta * direction);
      }}
      onPointerDown={(event) => {
        event.preventDefault();
        const startX = event.clientX;
        const startValue = value;
        const move = (moveEvent: PointerEvent) =>
          resize(startValue + (moveEvent.clientX - startX) * direction);
        const stop = () => {
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", stop);
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", stop, { once: true });
      }}
      role="separator"
      type="button"
    >
      <span />
    </button>
  );
}

function ElementLibrary({
  assets,
  canEdit,
  dispatch,
  state,
  tenantBrand
}: {
  assets: StudioMediaAsset[];
  canEdit: boolean;
  dispatch: (action: StudioEditorAction) => void;
  state: StudioEditorState;
  tenantBrand: WorkspaceProps["tenantBrand"];
}) {
  const [query, setQuery] = useState("");
  const filteredAssets = assets.filter((asset) =>
    asset.title.toLocaleLowerCase("nl-NL").includes(query.toLocaleLowerCase("nl-NL"))
  );

  function add(
    kind: "text" | "rectangle" | "ellipse" | "icon" | "line" | "qr"
  ) {
    if (!canEdit) return;
    const zIndex = state.document.elements.length;
    const id = `element-${crypto.randomUUID().slice(0, 8)}`;
    const common = {
      height: kind === "text" ? 150 : kind === "line" ? 8 : 280,
      id,
      locked: false,
      name:
        kind === "text"
          ? "Nieuwe tekst"
          : kind === "qr"
            ? "QR-code"
            : kind === "icon"
              ? "Icoon"
              : kind === "line"
                ? "Lijn"
            : "Nieuw vlak",
      opacity: 1,
      rotation: 0,
      visible: true,
      width: kind === "text" ? 760 : 420,
      x: 180,
      y: 180,
      zIndex
    };
    const element: StudioElement =
      kind === "text"
        ? {
            ...common,
            align: "left",
            autoFit: false,
            cornerRadius: 0,
            fill: "#FAFAF7",
            fontFamily: "Inter Tight Variable",
            fontSize: 72,
            fontWeight: 700,
            letterSpacing: 0,
            lineHeight: 1.05,
            padding: 0,
            text: "Nieuwe tekst",
            type: "text",
            verticalAlign: "top"
          }
        : kind === "qr"
          ? {
              ...common,
              background: "#FAFAF7",
              errorCorrection: "M",
              foreground: "#0A0A0A",
              type: "qr",
              value: "https://veyocast.nl"
            }
          : kind === "icon"
            ? {
                ...common,
                fill: "#FF5C20",
                icon: "star",
                strokeWidth: 0,
                type: "icon"
              }
          : {
            ...common,
            cornerRadius: kind === "rectangle" ? 24 : 0,
            fill: { color: "#FF5C20", kind: "solid" },
            shape: kind,
            type: "shape"
          };
    dispatch({ element, type: "element/add" });
  }

  function addImage(asset: StudioMediaAsset) {
    dispatch({
      element: {
        alt: asset.title,
        cornerRadius: 24,
        focusX: 0.5,
        focusY: 0.5,
        height: 420,
        id: `image-${crypto.randomUUID().slice(0, 8)}`,
        locked: false,
        mediaAssetId: asset.id,
        name: asset.title,
        objectFit: "cover",
        opacity: 1,
        rotation: 0,
        type: "image",
        variant: "thumbnail",
        visible: true,
        width: 640,
        x: 220,
        y: 220,
        zIndex: state.document.elements.length
      },
      type: "element/add"
    });
  }

  return (
    <div className={styles.library}>
      <div className={styles.panelTitle}>
        <div>
          <h2>Elementen</h2>
          <p>Voeg bewerkbare lagen toe.</p>
        </div>
      </div>
      <div className={styles.elementButtons}>
        <button disabled={!canEdit} onClick={() => add("text")} type="button">
          <Type aria-hidden="true" />
          Tekst
        </button>
        <button disabled={!canEdit} onClick={() => add("rectangle")} type="button">
          <Square aria-hidden="true" />
          Vlak
        </button>
        <button disabled={!canEdit} onClick={() => add("ellipse")} type="button">
          <Circle aria-hidden="true" />
          Cirkel
        </button>
        <button disabled={!canEdit} onClick={() => add("line")} type="button">
          <Minus aria-hidden="true" />
          Lijn
        </button>
        <button disabled={!canEdit} onClick={() => add("qr")} type="button">
          <QrCode aria-hidden="true" />
          QR-code
        </button>
        <button disabled={!canEdit} onClick={() => add("icon")} type="button">
          <Star aria-hidden="true" />
          Icoon
        </button>
      </div>
      {tenantBrand ? (
        <section className={styles.brandKit} aria-label={`${tenantBrand.name} huisstijl`}>
          <div className={styles.panelTitle}>
            <div>
              <h2>Huisstijl</h2>
              <p>{tenantBrand.name}</p>
            </div>
          </div>
          {tenantBrand.colors.length ? (
            <div className={styles.brandColors}>
              {tenantBrand.colors.map((color) => (
                <button
                  aria-label={`${color} als canvasachtergrond gebruiken`}
                  disabled={!canEdit}
                  key={color}
                  onClick={() =>
                    dispatch({
                      background: { color, kind: "solid" },
                      type: "document/background"
                    })
                  }
                  style={{ backgroundColor: color }}
                  type="button"
                />
              ))}
            </div>
          ) : null}
          {tenantBrand.logoAssetId ? (
            <Button
              disabled={!canEdit}
              onClick={() => {
                const logo = assets.find(
                  (asset) => asset.id === tenantBrand.logoAssetId
                );
                if (logo) addImage(logo);
              }}
              size="sm"
              variant="secondary"
            >
              Clublogo toevoegen
            </Button>
          ) : null}
        </section>
      ) : null}
      <div className={styles.libraryDivider} />
      <div className={styles.panelTitle}>
        <div>
          <h2>Media</h2>
          <p>Alleen gereedstaande afbeeldingen.</p>
        </div>
        <Link href="/dashboard/media?upload=1">Uploaden</Link>
      </div>
      <input
        aria-label="Media zoeken"
        className={styles.compactInput}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Zoek media"
        type="search"
        value={query}
      />
      <div className={styles.assetGrid}>
        {filteredAssets.map((asset) => (
          <button
            disabled={!canEdit}
            key={asset.id}
            onClick={() => addImage(asset)}
            type="button"
          >
            {asset.previewUrl ? (
              // Signed URLs come from the tenant-scoped server read.
              // eslint-disable-next-line @next/next/no-img-element
              <img alt="" src={asset.previewUrl} />
            ) : (
              <ImageIcon aria-hidden="true" />
            )}
            <span>{asset.title}</span>
          </button>
        ))}
        {!filteredAssets.length ? (
          <p className={styles.mutedText}>Geen passende media gevonden.</p>
        ) : null}
      </div>
    </div>
  );
}

function InspectorPanel({
  assets,
  canEdit,
  dispatch,
  state
}: {
  assets: StudioMediaAsset[];
  canEdit: boolean;
  dispatch: (action: StudioEditorAction) => void;
  state: StudioEditorState;
}) {
  const selected = state.document.elements.find(
    (element) => element.id === state.selectedIds[0]
  );
  return (
    <div className={styles.inspector}>
      <div className={styles.panelTitle}>
        <div>
          <h2>
            {state.selectedIds.length > 1
              ? "Selectie uitlijnen"
              : selected
                ? "Elementinstellingen"
                : "Lagen"}
          </h2>
          <p>
            {state.selectedIds.length > 1
              ? `${state.selectedIds.length} lagen geselecteerd`
              : selected
              ? selected.name
              : `${state.document.elements.length} bewerkbare lagen`}
          </p>
        </div>
        {selected ? (
          <Button
            aria-label="Selectie sluiten"
            onClick={() => dispatch({ elementId: null, type: "selection/set" })}
            size="sm"
            variant="ghost"
          >
            <Layers3 aria-hidden="true" />
          </Button>
        ) : null}
      </div>
      {state.selectedIds.length > 1 ? (
        <MultiSelectionInspector
          canEdit={canEdit}
          dispatch={dispatch}
          selectedCount={state.selectedIds.length}
        />
      ) : selected ? (
        <ElementInspector
          assets={assets}
          canEdit={canEdit}
          dispatch={dispatch}
          element={selected}
          documentDurationMs={state.document.motion.durationMs}
        />
      ) : (
        <LayerList canEdit={canEdit} dispatch={dispatch} state={state} />
      )}
    </div>
  );
}

function ElementInspector({
  assets,
  canEdit,
  dispatch,
  documentDurationMs,
  element
}: {
  assets: StudioMediaAsset[];
  canEdit: boolean;
  dispatch: (action: StudioEditorAction) => void;
  documentDurationMs: number;
  element: StudioElement;
}) {
  const [iconQuery, setIconQuery] = useState("");
  const patch = (value: Partial<StudioElement>) =>
    dispatch({ elementId: element.id, patch: value, type: "element/update" });
  if (element.type === "group") {
    return (
      <div className={styles.inspectorSection}>
        <p className={styles.mutedText}>
          Deze groep bevat {element.childIds.length} lagen. Maak de groep los
          om de afzonderlijke inhoud te bewerken.
        </p>
        <Button
          disabled={!canEdit}
          onClick={() =>
            dispatch({ groupId: element.id, type: "selection/ungroup" })
          }
          size="sm"
          variant="secondary"
        >
          Groep opheffen
        </Button>
      </div>
    );
  }
  return (
    <>
      <div className={styles.inspectorSection}>
        <label>
          <span>Laagnaam</span>
          <input
            disabled={!canEdit}
            maxLength={80}
            onChange={(event) => patch({ name: event.target.value })}
            value={element.name}
          />
        </label>
        {element.type === "text" ? (
          <>
            <label>
              <span>Tekst</span>
              <textarea
                disabled={!canEdit}
                maxLength={studioLimits.maxTextLength}
                onChange={(event) => patch({ text: event.target.value })}
                rows={4}
                value={element.text}
              />
            </label>
            <div className={styles.fieldRow}>
              <label>
                <span>Grootte</span>
                <input
                  disabled={!canEdit}
                  max={360}
                  min={12}
                  onChange={(event) => patch({ fontSize: Number(event.target.value) })}
                  type="number"
                  value={element.fontSize}
                />
              </label>
              <label>
                <span>Kleur</span>
                <input
                  disabled={!canEdit}
                  onChange={(event) => patch({ fill: event.target.value })}
                  type="color"
                  value={element.fill.slice(0, 7)}
                />
              </label>
            </div>
            <div className={styles.fieldRow}>
              <label>
                <span>Lettertype</span>
                <select
                  disabled={!canEdit}
                  onChange={(event) =>
                    patch({
                      fontFamily:
                        event.target.value === "Inter Variable"
                          ? "Inter Variable"
                          : "Inter Tight Variable"
                    })
                  }
                  value={element.fontFamily}
                >
                  <option value="Inter Variable">Inter</option>
                  <option value="Inter Tight Variable">Inter Tight</option>
                </select>
              </label>
              <label>
                <span>Gewicht</span>
                <select
                  disabled={!canEdit}
                  onChange={(event) =>
                    patch({
                      fontWeight: Number(event.target.value) as typeof element.fontWeight
                    })
                  }
                  value={element.fontWeight}
                >
                  {[400, 500, 600, 700, 800].map((weight) => (
                    <option key={weight} value={weight}>
                      {weight}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className={styles.fieldRow}>
              <label>
                <span>Uitlijning</span>
                <select
                  disabled={!canEdit}
                  onChange={(event) =>
                    patch({ align: event.target.value as typeof element.align })
                  }
                  value={element.align}
                >
                  <option value="left">Links</option>
                  <option value="center">Midden</option>
                  <option value="right">Rechts</option>
                </select>
              </label>
              <label>
                <span>Automatisch passend</span>
                <select
                  disabled={!canEdit}
                  onChange={(event) =>
                    patch({ autoFit: event.target.value === "true" })
                  }
                  value={String(element.autoFit)}
                >
                  <option value="false">Uit</option>
                  <option value="true">Aan</option>
                </select>
              </label>
            </div>
          </>
        ) : null}
        {element.type === "image" ? (
          <>
            <label>
              <span>Afbeelding</span>
              <select
                disabled={!canEdit}
                onChange={(event) =>
                  patch({ mediaAssetId: event.target.value })
                }
                value={element.mediaAssetId}
              >
                {assets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.title}
                  </option>
                ))}
              </select>
            </label>
            <div className={styles.fieldRow}>
              <label>
                <span>Uitsnede</span>
                <select
                  disabled={!canEdit}
                  onChange={(event) =>
                    patch({
                      objectFit:
                        event.target.value === "contain" ? "contain" : "cover"
                    })
                  }
                  value={element.objectFit}
                >
                  <option value="cover">Vullen</option>
                  <option value="contain">Passend</option>
                </select>
              </label>
              <label>
                <span>Radius</span>
                <input
                  disabled={!canEdit}
                  max={320}
                  min={0}
                  onChange={(event) =>
                    patch({ cornerRadius: Number(event.target.value) })
                  }
                  type="number"
                  value={element.cornerRadius}
                />
              </label>
            </div>
            <label>
              <span>Horizontaal focuspunt · {Math.round(element.focusX * 100)}%</span>
              <input
                disabled={!canEdit}
                max={1}
                min={0}
                onChange={(event) => patch({ focusX: Number(event.target.value) })}
                step={0.05}
                type="range"
                value={element.focusX}
              />
            </label>
            <label>
              <span>Verticaal focuspunt · {Math.round(element.focusY * 100)}%</span>
              <input
                disabled={!canEdit}
                max={1}
                min={0}
                onChange={(event) => patch({ focusY: Number(event.target.value) })}
                step={0.05}
                type="range"
                value={element.focusY}
              />
            </label>
          </>
        ) : null}
        {element.type === "placeholder" ? (
          <label>
            <span>Beeldslot vervangen</span>
            <select
              defaultValue=""
              disabled={!canEdit || !assets.length}
              onChange={(event) => {
                const asset = assets.find(
                  (candidate) => candidate.id === event.target.value
                );
                if (!asset) return;
                dispatch({
                  element: {
                    alt: asset.title,
                    cornerRadius: 0,
                    focusX: 0.5,
                    focusY: 0.5,
                    height: element.height,
                    id: `image-${crypto.randomUUID().slice(0, 8)}`,
                    locked: element.locked,
                    mediaAssetId: asset.id,
                    name: element.name,
                    objectFit: "cover",
                    opacity: element.opacity,
                    rotation: element.rotation,
                    type: "image",
                    variant: "thumbnail",
                    visible: element.visible,
                    width: element.width,
                    x: element.x,
                    y: element.y,
                    zIndex: element.zIndex
                  },
                  elementId: element.id,
                  type: "element/replace"
                });
              }}
            >
              <option value="">Kies een afbeelding</option>
              {assets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.title}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {element.type === "icon" ? (
          <div className={styles.inspectorSection}>
            <label>
              <span>Iconen zoeken</span>
              <input
                disabled={!canEdit}
                onChange={(event) => setIconQuery(event.target.value)}
                placeholder="Bijvoorbeeld klok of schild"
                type="search"
                value={iconQuery}
              />
            </label>
            <div className={styles.fieldRow}>
            <label>
              <span>Icoon</span>
              <select
                disabled={!canEdit}
                onChange={(event) =>
                  patch({
                    icon: event.target.value as typeof element.icon
                  })
                }
                value={element.icon}
              >
                {studioIconOptions
                  .filter(
                    (icon) =>
                      icon === element.icon ||
                      studioIconLabel(icon)
                        .toLocaleLowerCase("nl-NL")
                        .includes(iconQuery.toLocaleLowerCase("nl-NL"))
                  )
                  .map((icon) => (
                  <option key={icon} value={icon}>
                    {studioIconLabel(icon)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Kleur</span>
              <input
                disabled={!canEdit}
                onChange={(event) => patch({ fill: event.target.value })}
                type="color"
                value={element.fill}
              />
            </label>
            </div>
          </div>
        ) : null}
        {element.type === "qr" ? (
          <label>
            <span>Bestemming</span>
            <input
              disabled={!canEdit}
              maxLength={1024}
              onChange={(event) => patch({ value: event.target.value })}
              type="url"
              value={element.value}
            />
          </label>
        ) : null}
      </div>
      <div className={styles.inspectorSection}>
        <h3>Positie en formaat</h3>
        <div className={styles.fieldGrid}>
          {(["x", "y", "width", "height", "rotation"] as const).map((property) => (
            <label key={property}>
              <span>{property.toUpperCase()}</span>
              <input
                disabled={!canEdit || element.locked}
                min={property === "width" || property === "height" ? 1 : undefined}
                onChange={(event) =>
                  patch({ [property]: Number(event.target.value) })
                }
                type="number"
                value={Math.round(element[property])}
              />
            </label>
          ))}
        </div>
        <label>
          <span>Dekking · {Math.round(element.opacity * 100)}%</span>
          <input
            disabled={!canEdit}
            max={1}
            min={0}
            onChange={(event) => patch({ opacity: Number(event.target.value) })}
            step={0.05}
            type="range"
            value={element.opacity}
          />
        </label>
        {"cornerRadius" in element ? (
          <label>
            <span>Hoekradius</span>
            <input
              disabled={!canEdit}
              max={320}
              min={0}
              onChange={(event) =>
                patch({ cornerRadius: Math.max(0, Number(event.target.value)) })
              }
              type="number"
              value={element.cornerRadius}
            />
          </label>
        ) : null}
        {"border" in element ? (
          <div className={styles.fieldRow}>
            <label>
              <span>Randdikte</span>
              <input
                disabled={!canEdit}
                max={24}
                min={0}
                onChange={(event) => {
                  const width = Math.max(0, Number(event.target.value));
                  patch({
                    border: width
                      ? {
                          color: element.border?.color ?? "#FAFAF7",
                          width
                        }
                      : undefined
                  });
                }}
                type="number"
                value={element.border?.width ?? 0}
              />
            </label>
            <label>
              <span>Randkleur</span>
              <input
                disabled={!canEdit || !element.border}
                onChange={(event) =>
                  patch({
                    border: {
                      color: event.target.value,
                      width: element.border?.width ?? 1
                    }
                  })
                }
                type="color"
                value={element.border?.color ?? "#FAFAF7"}
              />
            </label>
          </div>
        ) : null}
      </div>
      <MotionInspector
        canEdit={canEdit}
        dispatch={dispatch}
        documentDurationMs={documentDurationMs}
        element={element}
      />
      <div className={styles.inspectorActions}>
        <Button
          aria-label="Laag omhoog"
          disabled={!canEdit}
          onClick={() =>
            dispatch({
              elementId: element.id,
              targetIndex: element.zIndex + 1,
              type: "element/move"
            })
          }
          size="sm"
          variant="ghost"
        >
          <ArrowUp aria-hidden="true" />
        </Button>
        <Button
          aria-label="Laag omlaag"
          disabled={!canEdit}
          onClick={() =>
            dispatch({
              elementId: element.id,
              targetIndex: element.zIndex - 1,
              type: "element/move"
            })
          }
          size="sm"
          variant="ghost"
        >
          <ArrowDown aria-hidden="true" />
        </Button>
        <Button
          disabled={!canEdit}
          onClick={() =>
            dispatch({
              elementId: element.id,
              targetIndex: Number.MAX_SAFE_INTEGER,
              type: "element/move"
            })
          }
          size="sm"
          variant="ghost"
        >
          Voorgrond
        </Button>
        <Button
          disabled={!canEdit}
          onClick={() =>
            dispatch({
              elementId: element.id,
              targetIndex: 0,
              type: "element/move"
            })
          }
          size="sm"
          variant="ghost"
        >
          Achtergrond
        </Button>
        <Button
          disabled={!canEdit}
          onClick={() =>
            dispatch({ elementId: element.id, type: "element/duplicate" })
          }
          size="sm"
          variant="secondary"
        >
          <Copy aria-hidden="true" />
          Dupliceren
        </Button>
        <Button
          disabled={!canEdit}
          onClick={() =>
            dispatch({ elementIds: [element.id], type: "element/remove" })
          }
          size="sm"
          variant="ghost"
        >
          <Trash2 aria-hidden="true" />
          Verwijderen
        </Button>
      </div>
    </>
  );
}

function MultiSelectionInspector({
  canEdit,
  dispatch,
  selectedCount
}: {
  canEdit: boolean;
  dispatch: (action: StudioEditorAction) => void;
  selectedCount: number;
}) {
  return (
    <div className={styles.inspectorSection}>
      <p className={styles.mutedText}>
        {selectedCount} lagen geselecteerd. Lijn ze uit, verdeel de tussenruimte
        of maak er één logische groep van.
      </p>
      <fieldset className={styles.toolFieldset}>
        <legend>Horizontaal uitlijnen</legend>
        <div>
          {(["left", "center", "right"] as const).map((alignment) => (
            <Button
              disabled={!canEdit}
              key={alignment}
              onClick={() =>
                dispatch({ alignment, type: "selection/align" })
              }
              size="sm"
              variant="secondary"
            >
              {{ center: "Midden", left: "Links", right: "Rechts" }[alignment]}
            </Button>
          ))}
        </div>
      </fieldset>
      <fieldset className={styles.toolFieldset}>
        <legend>Verticaal uitlijnen</legend>
        <div>
          {(["top", "middle", "bottom"] as const).map((alignment) => (
            <Button
              disabled={!canEdit}
              key={alignment}
              onClick={() =>
                dispatch({ alignment, type: "selection/align" })
              }
              size="sm"
              variant="secondary"
            >
              {{ bottom: "Onder", middle: "Midden", top: "Boven" }[alignment]}
            </Button>
          ))}
        </div>
      </fieldset>
      <div className={styles.inspectorActions}>
        <Button
          disabled={!canEdit || selectedCount < 3}
          onClick={() =>
            dispatch({ axis: "horizontal", type: "selection/distribute" })
          }
          size="sm"
          variant="secondary"
        >
          Horizontaal verdelen
        </Button>
        <Button
          disabled={!canEdit || selectedCount < 3}
          onClick={() =>
            dispatch({ axis: "vertical", type: "selection/distribute" })
          }
          size="sm"
          variant="secondary"
        >
          Verticaal verdelen
        </Button>
        <Button
          disabled={!canEdit}
          onClick={() => dispatch({ type: "selection/group" })}
          size="sm"
        >
          Groeperen
        </Button>
      </div>
    </div>
  );
}

function MotionInspector({
  canEdit,
  dispatch,
  documentDurationMs,
  element
}: {
  canEdit: boolean;
  dispatch: (action: StudioEditorAction) => void;
  documentDurationMs: number;
  element: Exclude<StudioElement, { type: "group" }>;
}) {
  const timing = element.timing;
  type Phase = "continuous" | "entry" | "exit";
  type Animation = NonNullable<StudioElementTiming["entry"]>;
  const updatePhase = (phase: Phase, nextPreset: string) => {
    const base = timing ?? {
      endMs: documentDurationMs,
      startMs: 0
    };
    const next = { ...base };
    if (nextPreset === "none") {
      delete next[phase];
    } else {
      next[phase] = {
        delayMs: 0,
        distance: 96,
        durationMs: phase === "continuous" ? 5_000 : 700,
        easing: "ease-out",
        intensity: 0.16,
        preset: nextPreset as Animation["preset"]
      };
    }
    const hasAnimation = next.entry || next.exit || next.continuous;
    dispatch({
      elementId: element.id,
      timing: hasAnimation ? next : undefined,
      type: "element/timing"
    });
  };
  const updateAnimation = (
    phase: Phase,
    patch: Partial<Animation>
  ) => {
    const animation = timing?.[phase];
    if (!timing || !animation) return;
    dispatch({
      elementId: element.id,
      timing: {
        ...timing,
        [phase]: { ...animation, ...patch }
      },
      type: "element/timing"
    });
  };
  return (
    <div className={styles.inspectorSection}>
      <h3>Animatie</h3>
      <AnimationPhaseControl
        animation={timing?.entry}
        canEdit={canEdit}
        label="Ingang"
        onAnimationChange={(patch) => updateAnimation("entry", patch)}
        onPresetChange={(preset) => updatePhase("entry", preset)}
        presets={studioAnimationPresets.filter(
          (value) => !["drift", "slow-zoom"].includes(value)
        )}
      />
      <AnimationPhaseControl
        animation={timing?.exit}
        canEdit={canEdit}
        label="Uitgang"
        onAnimationChange={(patch) => updateAnimation("exit", patch)}
        onPresetChange={(preset) => updatePhase("exit", preset)}
        presets={studioAnimationPresets.filter(
          (value) => !["drift", "slow-zoom"].includes(value)
        )}
      />
      <AnimationPhaseControl
        animation={timing?.continuous}
        canEdit={canEdit}
        label="Continu"
        onAnimationChange={(patch) => updateAnimation("continuous", patch)}
        onPresetChange={(preset) => updatePhase("continuous", preset)}
        presets={["none", "drift", "slow-zoom"]}
      />
      {timing ? (
        <div className={styles.fieldRow}>
          <label>
            <span>Start (sec)</span>
            <input
              disabled={!canEdit}
              max={(timing.endMs - 1) / 1000}
              min={0}
              onChange={(event) => {
                const startMs = Math.min(
                  timing.endMs - 500,
                  Math.max(0, snapHalfSecond(Number(event.target.value)))
                );
                dispatch({
                  elementId: element.id,
                  timing: {
                    ...timing,
                    startMs
                  },
                  type: "element/timing"
                });
              }}
              step={0.5}
              type="number"
              value={timing.startMs / 1000}
            />
          </label>
          <label>
            <span>Einde (sec)</span>
            <input
              disabled={!canEdit}
              max={documentDurationMs / 1000}
              min={(timing.startMs + 1) / 1000}
              onChange={(event) => {
                const endMs = Math.max(
                  timing.startMs + 500,
                  Math.min(
                    documentDurationMs,
                    snapHalfSecond(Number(event.target.value))
                  )
                );
                dispatch({
                  elementId: element.id,
                  timing: {
                    ...timing,
                    endMs
                  },
                  type: "element/timing"
                });
              }}
              step={0.5}
              type="number"
              value={timing.endMs / 1000}
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}

function AnimationPhaseControl({
  animation,
  canEdit,
  label,
  onAnimationChange,
  onPresetChange,
  presets
}: {
  animation: StudioElementTiming["entry"];
  canEdit: boolean;
  label: string;
  onAnimationChange: (
    patch: Partial<NonNullable<StudioElementTiming["entry"]>>
  ) => void;
  onPresetChange: (preset: string) => void;
  presets: readonly string[];
}) {
  return (
    <div className={styles.animationPhase}>
      <label>
        <span>{label}</span>
        <select
          disabled={!canEdit}
          onChange={(event) => onPresetChange(event.target.value)}
          value={animation?.preset ?? "none"}
        >
          {presets.map((value) => (
            <option key={value} value={value}>
              {animationLabel(value)}
            </option>
          ))}
        </select>
      </label>
      {animation ? (
        <details>
          <summary>Timing en beweging</summary>
          <div className={styles.animationFields}>
            <label>
              <span>Duur (sec)</span>
              <input
                disabled={!canEdit}
                max={5}
                min={0}
                onChange={(event) =>
                  onAnimationChange({
                    durationMs: Math.max(
                      0,
                      Math.min(
                        5_000,
                        Math.round(Number(event.target.value) * 1000)
                      )
                    )
                  })
                }
                step={0.1}
                type="number"
                value={animation.durationMs / 1000}
              />
            </label>
            <label>
              <span>Vertraging (sec)</span>
              <input
                disabled={!canEdit}
                max={10}
                min={0}
                onChange={(event) =>
                  onAnimationChange({
                    delayMs: Math.max(
                      0,
                      Math.min(
                        10_000,
                        Math.round(Number(event.target.value) * 1000)
                      )
                    )
                  })
                }
                step={0.1}
                type="number"
                value={animation.delayMs / 1000}
              />
            </label>
            <label>
              <span>Easing</span>
              <select
                disabled={!canEdit}
                onChange={(event) =>
                  onAnimationChange({
                    easing: event.target.value as typeof animation.easing
                  })
                }
                value={animation.easing}
              >
                <option value="linear">Lineair</option>
                <option value="ease-in">Versnellen</option>
                <option value="ease-out">Vertragen</option>
                <option value="ease-in-out">Vloeiend</option>
              </select>
            </label>
            <label>
              <span>Afstand</span>
              <input
                disabled={!canEdit}
                max={1920}
                min={0}
                onChange={(event) =>
                  onAnimationChange({
                    distance: Math.max(
                      0,
                      Math.min(1_920, Number(event.target.value))
                    )
                  })
                }
                step={8}
                type="number"
                value={animation.distance}
              />
            </label>
            <label>
              <span>Intensiteit · {Math.round(animation.intensity * 100)}%</span>
              <input
                disabled={!canEdit}
                max={1}
                min={0}
                onChange={(event) =>
                  onAnimationChange({
                    intensity: Math.max(
                      0,
                      Math.min(1, Number(event.target.value))
                    )
                  })
                }
                step={0.05}
                type="range"
                value={animation.intensity}
              />
            </label>
          </div>
        </details>
      ) : null}
    </div>
  );
}

function LayerList({
  canEdit,
  dispatch,
  state
}: {
  canEdit: boolean;
  dispatch: (action: StudioEditorAction) => void;
  state: StudioEditorState;
}) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const layers = [...state.document.elements].sort(
    (left, right) => right.zIndex - left.zIndex
  );
  return (
    <ol className={styles.layerList}>
      {layers.map((element) => (
        <li
          data-dragging={draggedId === element.id}
          draggable={canEdit}
          key={element.id}
          onDragEnd={() => setDraggedId(null)}
          onDragOver={(event) => {
            if (canEdit && draggedId) event.preventDefault();
          }}
          onDragStart={(event) => {
            setDraggedId(element.id);
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", element.id);
          }}
          onDrop={(event) => {
            event.preventDefault();
            const sourceId =
              event.dataTransfer.getData("text/plain") || draggedId;
            if (!sourceId || sourceId === element.id) return;
            dispatch({
              elementId: sourceId,
              targetIndex: element.zIndex,
              type: "element/move"
            });
            setDraggedId(null);
          }}
        >
          <span aria-hidden="true" className={styles.layerDragHandle}>
            <GripVertical />
          </span>
          <button
            onKeyDown={(event) => {
              if (!event.altKey) return;
              if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                event.preventDefault();
                dispatch({
                  elementId: element.id,
                  targetIndex:
                    element.zIndex + (event.key === "ArrowUp" ? 1 : -1),
                  type: "element/move"
                });
              }
            }}
            onClick={() =>
              dispatch({ elementId: element.id, type: "selection/set" })
            }
            type="button"
          >
            <ElementTypeIcon element={element} />
            <span>
              <strong>{element.name}</strong>
              <small>{elementTypeLabel(element.type)}</small>
            </span>
          </button>
          <div>
            <button
              aria-label={element.visible ? "Laag verbergen" : "Laag tonen"}
              disabled={!canEdit}
              onClick={() =>
                dispatch({ elementId: element.id, type: "element/toggle-visible" })
              }
              type="button"
            >
              {element.visible ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}
            </button>
            <button
              aria-label={element.locked ? "Laag ontgrendelen" : "Laag vergrendelen"}
              disabled={!canEdit}
              onClick={() =>
                dispatch({ elementId: element.id, type: "element/toggle-lock" })
              }
              type="button"
            >
              {element.locked ? <Lock aria-hidden="true" /> : <Unlock aria-hidden="true" />}
            </button>
          </div>
          <details className={styles.layerContext}>
            <summary aria-label={`Meer acties voor ${element.name}`}>
              <MoreHorizontal aria-hidden="true" />
            </summary>
            <div>
              <button
                disabled={!canEdit || element.type === "group"}
                onClick={() =>
                  dispatch({ elementId: element.id, type: "element/duplicate" })
                }
                type="button"
              >
                Dupliceren
              </button>
              <button
                disabled={!canEdit}
                onClick={() =>
                  dispatch({
                    elementId: element.id,
                    targetIndex: element.zIndex + 1,
                    type: "element/move"
                  })
                }
                type="button"
              >
                Naar voren
              </button>
              <button
                disabled={!canEdit}
                onClick={() =>
                  dispatch({
                    elementId: element.id,
                    targetIndex: element.zIndex - 1,
                    type: "element/move"
                  })
                }
                type="button"
              >
                Naar achteren
              </button>
              <button
                disabled={!canEdit}
                onClick={() =>
                  dispatch({
                    elementId: element.id,
                    targetIndex: Number.MAX_SAFE_INTEGER,
                    type: "element/move"
                  })
                }
                type="button"
              >
                Helemaal vooraan
              </button>
              <button
                disabled={!canEdit}
                onClick={() =>
                  dispatch({
                    elementId: element.id,
                    targetIndex: 0,
                    type: "element/move"
                  })
                }
                type="button"
              >
                Helemaal achteraan
              </button>
              <button
                className={styles.contextDelete}
                disabled={!canEdit}
                onClick={() =>
                  dispatch({ elementIds: [element.id], type: "element/remove" })
                }
                type="button"
              >
                Verwijderen
              </button>
            </div>
          </details>
        </li>
      ))}
    </ol>
  );
}

function MotionTimeline({
  dispatch,
  state
}: {
  dispatch: (action: StudioEditorAction) => void;
  state: StudioEditorState;
}) {
  const seconds = state.document.motion.durationMs / 1000;
  return (
    <section className={styles.timeline} aria-label="Motion-tijdlijn">
      <div className={styles.timelineSettings}>
        <span>Duur</span>
        <div role="group" aria-label="Vooraf ingestelde documentduur">
          {[5, 10, 15].map((duration) => (
            <button
              aria-pressed={seconds === duration}
              key={duration}
              onClick={() =>
                dispatch({
                  durationMs: duration * 1000,
                  type: "document/duration"
                })
              }
              type="button"
            >
              {duration} sec
            </button>
          ))}
        </div>
        <label>
          <span>Aangepast</span>
          <input
            aria-label="Aangepaste documentduur in seconden"
            max={30}
            min={1}
            onChange={(event) =>
              dispatch({
                durationMs: Number(event.target.value) * 1000,
                type: "document/duration"
              })
            }
            step={0.5}
            type="number"
            value={seconds}
          />
        </label>
        <Button
          onClick={() => dispatch({ type: "playback/reset" })}
          size="sm"
          variant="ghost"
        >
          <RotateCcw aria-hidden="true" />
          Reset
        </Button>
        <Button
          aria-pressed={state.looping}
          onClick={() => dispatch({ type: "playback/loop" })}
          size="sm"
          variant={state.looping ? "secondary" : "ghost"}
        >
          <Repeat2 aria-hidden="true" />
          Loop
        </Button>
      </div>
      <div className={styles.timelineControls}>
        <Button
          aria-label={state.playing ? "Pauzeren" : "Afspelen"}
          onClick={() => dispatch({ type: "playback/toggle" })}
          size="sm"
          variant="secondary"
        >
          {state.playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
        </Button>
        <span>
          {(state.playheadMs / 1000).toFixed(1)} / {seconds.toFixed(1)} sec
        </span>
        <label>
          <span className="sr-only">Afspeelpositie</span>
          <input
            max={state.document.motion.durationMs}
            min={0}
            onChange={(event) =>
              dispatch({
                playheadMs: Number(event.target.value),
                type: "playback/seek"
              })
            }
            step={500}
            type="range"
            value={state.playheadMs}
          />
        </label>
      </div>
      <div className={styles.timelineTracks}>
        {[...state.document.elements]
          .filter((element) => element.type !== "group")
          .sort((left, right) => {
            const leftSelected = state.selectedIds.includes(left.id);
            const rightSelected = state.selectedIds.includes(right.id);
            return leftSelected === rightSelected
              ? right.zIndex - left.zIndex
              : leftSelected
                ? -1
                : 1;
          })
          .slice(0, 8)
          .map((element) => {
            const start = element.timing?.startMs ?? 0;
            const end =
              element.timing?.endMs ?? state.document.motion.durationMs;
            return (
              <button
                key={element.id}
                onClick={() =>
                  dispatch({ elementId: element.id, type: "selection/set" })
                }
                type="button"
              >
                <span>{element.name}</span>
                <i
                  style={{
                    left: `${(start / state.document.motion.durationMs) * 100}%`,
                    width: `${((end - start) / state.document.motion.durationMs) * 100}%`
                  }}
                />
              </button>
            );
          })}
      </div>
    </section>
  );
}

function MobileQuickEdit({
  assets,
  canEdit,
  dispatch,
  onRename,
  projectName,
  requestRender,
  state
}: {
  assets: StudioMediaAsset[];
  canEdit: boolean;
  dispatch: (action: StudioEditorAction) => void;
  onRename: (name: string) => Promise<boolean>;
  projectName: string;
  requestRender: () => void;
  state: StudioEditorState;
}) {
  const [draftName, setDraftName] = useState(projectName);
  const [renamePending, setRenamePending] = useState(false);
  const [renameMessage, setRenameMessage] = useState<string | null>(null);
  useEffect(() => setDraftName(projectName), [projectName]);
  const backgroundColor =
    state.document.artboard.background.kind === "solid"
      ? state.document.artboard.background.color
      : state.document.artboard.background.kind === "linear-gradient"
        ? state.document.artboard.background.from
        : "#FAFAF7";
  return (
    <section className={styles.mobileQuickEdit}>
      <div className={styles.mobilePreview}>
        <StudioKonvaCanvas
          assets={assets}
          canEdit={false}
          dispatch={dispatch}
          document={state.document}
          playheadMs={state.playheadMs}
          selectedIds={[]}
          zoom={1}
        />
      </div>
      <div className={styles.mobileSection}>
        <h2>Snel bewerken</h2>
        <p>Pas tekst en beeldslots aan. Gebruik desktop voor vrije positionering.</p>
      </div>
      <article className={styles.mobileElementCard}>
        <div>
          <Type aria-hidden="true" />
          <span>
            <strong>Ontwerpnaam</strong>
            <small>Zichtbaar in Studio en Media</small>
          </span>
        </div>
        <label>
          <span className="sr-only">Ontwerpnaam</span>
          <input
            disabled={!canEdit || renamePending}
            maxLength={120}
            minLength={2}
            onChange={(event) => setDraftName(event.target.value)}
            value={draftName}
          />
        </label>
        <Button
          disabled={
            !canEdit ||
            renamePending ||
            draftName.trim() === projectName
          }
          onClick={() => {
            setRenamePending(true);
            setRenameMessage(null);
            void onRename(draftName).then((saved) => {
              setRenamePending(false);
              setRenameMessage(
                saved
                  ? "Naam opgeslagen."
                  : "Naam niet opgeslagen; je inhoud blijft bewaard."
              );
            });
          }}
          size="sm"
          variant="secondary"
        >
          {renamePending ? "Opslaan…" : "Naam opslaan"}
        </Button>
        {renameMessage ? <small role="status">{renameMessage}</small> : null}
      </article>
      <article className={styles.mobileElementCard}>
        <div>
          <Square aria-hidden="true" />
          <span>
            <strong>Canvasachtergrond</strong>
            <small>Eenvoudige kleur voor snelle aanpassing</small>
          </span>
        </div>
        <label>
          <span className="sr-only">Canvasachtergrondkleur</span>
          <input
            disabled={!canEdit}
            onChange={(event) =>
              dispatch({
                background: { color: event.target.value, kind: "solid" },
                type: "document/background"
              })
            }
            type="color"
            value={backgroundColor}
          />
        </label>
      </article>
      {state.document.elements
        .filter(
          (element) =>
            element.type === "text" ||
            element.type === "image" ||
            element.type === "placeholder"
        )
        .map((element) => (
          <article className={styles.mobileElementCard} key={element.id}>
            <div>
              <ElementTypeIcon element={element} />
              <span>
                <strong>{element.name}</strong>
                <small>{elementTypeLabel(element.type)}</small>
              </span>
            </div>
            {element.type === "text" ? (
              <textarea
                disabled={!canEdit}
                onChange={(event) =>
                  dispatch({
                    elementId: element.id,
                    patch: { text: event.target.value },
                    type: "element/update"
                  })
                }
                rows={3}
                value={element.text}
              />
            ) : (
              <select
                disabled={!canEdit || !assets.length}
                onChange={(event) => {
                  const asset = assets.find(
                    (candidate) => candidate.id === event.target.value
                  );
                  if (!asset) return;
                  if (element.type === "image") {
                    dispatch({
                      elementId: element.id,
                      patch: { mediaAssetId: asset.id },
                      type: "element/update"
                    });
                  } else if (element.type === "placeholder") {
                    dispatch({
                      element: {
                        alt: asset.title,
                        cornerRadius: 0,
                        focusX: 0.5,
                        focusY: 0.5,
                        height: element.height,
                        id: `image-${crypto.randomUUID().slice(0, 8)}`,
                        locked: element.locked,
                        mediaAssetId: asset.id,
                        name: element.name,
                        objectFit: "cover",
                        opacity: element.opacity,
                        rotation: element.rotation,
                        type: "image",
                        variant: "thumbnail",
                        visible: element.visible,
                        width: element.width,
                        x: element.x,
                        y: element.y,
                        zIndex: element.zIndex
                      },
                      elementId: element.id,
                      type: "element/replace"
                    });
                  }
                }}
                value={element.type === "image" ? element.mediaAssetId : ""}
              >
                <option value="">Kies een afbeelding</option>
                {assets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.title}
                  </option>
                ))}
              </select>
            )}
          </article>
        ))}
      <div className={styles.mobileGenerateBar}>
        <SaveIndicator saveState={state.saveState} />
        <Button disabled={!canEdit} onClick={requestRender}>
          <WandSparkles aria-hidden="true" />
          Genereren
        </Button>
      </div>
    </section>
  );
}

function PreviewDialog({
  assets,
  dispatch,
  onClose,
  open,
  state
}: {
  assets: StudioMediaAsset[];
  dispatch: (action: StudioEditorAction) => void;
  onClose: () => void;
  open: boolean;
  state: StudioEditorState;
}) {
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, open]);
  if (!open) return null;
  return (
    <div className={styles.previewBackdrop} role="presentation">
      <section
        aria-labelledby="studio-preview-title"
        aria-modal="true"
        className={styles.previewDialog}
        role="dialog"
      >
        <header>
          <div>
            <h2 id="studio-preview-title">Voorbeeld</h2>
            <p>
              Betrouwbare preview op {state.document.artboard.width} ×{" "}
              {state.document.artboard.height}.
            </p>
          </div>
          <Button autoFocus onClick={onClose} size="sm" variant="secondary">
            Sluiten
          </Button>
        </header>
        <div className={styles.previewStage}>
          <StudioKonvaCanvas
            assets={assets}
            canEdit={false}
            dispatch={dispatch}
            document={state.document}
            playheadMs={state.playheadMs}
            selectedIds={[]}
            zoom={1}
          />
        </div>
        <footer>
          <Button
            aria-label={state.playing ? "Voorbeeld pauzeren" : "Voorbeeld afspelen"}
            onClick={() => dispatch({ type: "playback/toggle" })}
            size="sm"
            variant="secondary"
          >
            {state.playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
            {state.playing ? "Pauzeren" : "Afspelen"}
          </Button>
          <Button
            onClick={() => dispatch({ type: "playback/reset" })}
            size="sm"
            variant="ghost"
          >
            <RotateCcw aria-hidden="true" />
            Opnieuw
          </Button>
          <Button
            aria-pressed={state.looping}
            onClick={() => dispatch({ type: "playback/loop" })}
            size="sm"
            variant={state.looping ? "secondary" : "ghost"}
          >
            <Repeat2 aria-hidden="true" />
            Herhalen
          </Button>
          <span>
            {(state.playheadMs / 1000).toFixed(1)} /{" "}
            {(state.document.motion.durationMs / 1000).toFixed(1)} sec
          </span>
        </footer>
      </section>
    </div>
  );
}

function RevisionDialog({
  assets,
  canRestore,
  currentRevision,
  onClose,
  onRestore,
  onSelect,
  open,
  pending,
  revisions,
  selectedRevision
}: {
  assets: StudioMediaAsset[];
  canRestore: boolean;
  currentRevision: number;
  onClose: () => void;
  onRestore: (revision: StudioRevision) => void;
  onSelect: (revision: StudioRevision) => void;
  open: boolean;
  pending: boolean;
  revisions: StudioRevision[];
  selectedRevision: StudioRevision | null;
}) {
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, open]);
  if (!open) return null;

  return (
    <div className={styles.previewBackdrop} role="presentation">
      <section
        aria-labelledby="studio-revisions-title"
        aria-modal="true"
        className={styles.revisionDialog}
        role="dialog"
      >
        <header>
          <div>
            <h2 id="studio-revisions-title">Revisiegeschiedenis</h2>
            <p>
              Bekijk veilige checkpoints. Herstellen maakt een nieuwe revisie;
              geschiedenis blijft behouden.
            </p>
          </div>
          <Button autoFocus onClick={onClose} size="sm" variant="secondary">
            Sluiten
          </Button>
        </header>
        <div className={styles.revisionDialogBody}>
          <div
            aria-label="Beschikbare revisies"
            className={styles.revisionList}
            role="list"
          >
            {revisions.length ? (
              revisions.map((revision) => (
                <article key={revision.id} role="listitem">
                  <button
                    aria-pressed={selectedRevision?.id === revision.id}
                    onClick={() => onSelect(revision)}
                    type="button"
                  >
                    <span>
                      <strong>Revisie {revision.number}</strong>
                      <small>{revisionReasonLabel(revision.reason)}</small>
                    </span>
                    <span>
                      <small>{revision.createdByName}</small>
                      <time dateTime={revision.createdAt}>
                        {formatRevisionDate(revision.createdAt)}
                      </time>
                    </span>
                  </button>
                </article>
              ))
            ) : (
              <p className={styles.revisionEmpty}>
                Er zijn nog geen vaste revisies. Studio maakt automatisch
                checkpoints tijdens het werken en vóór renders.
              </p>
            )}
          </div>
          <section
            aria-label="Geselecteerde revisie"
            className={styles.revisionPreview}
          >
            {selectedRevision ? (
              <>
                <div>
                  <span>
                    Revisie {selectedRevision.number} · concept{" "}
                    {selectedRevision.draftRevision}
                  </span>
                  <strong>
                    {selectedRevision.document.artboard.width} ×{" "}
                    {selectedRevision.document.artboard.height}
                  </strong>
                </div>
                <div className={styles.revisionCanvas}>
                  <StudioKonvaCanvas
                    assets={assets}
                    canEdit={false}
                    dispatch={() => undefined}
                    document={selectedRevision.document}
                    playheadMs={0}
                    selectedIds={[]}
                    zoom={1}
                  />
                </div>
                <footer>
                  <span>Huidig concept: revisie {currentRevision}</span>
                  <Button
                    disabled={!canRestore || pending}
                    onClick={() => onRestore(selectedRevision)}
                    size="sm"
                  >
                    <RotateCcw aria-hidden="true" />
                    {pending ? "Herstellen…" : "Als nieuw concept herstellen"}
                  </Button>
                </footer>
              </>
            ) : (
              <div className={styles.revisionPreviewEmpty}>
                <History aria-hidden="true" />
                <strong>Kies een revisie</strong>
                <span>De historische versie wordt hier alleen bekeken.</span>
              </div>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}

function RenderPanel({
  canManageJobs,
  message,
  onClose,
  open,
  renderJobs
}: {
  canManageJobs: boolean;
  message: string | null;
  onClose: () => void;
  open: boolean;
  renderJobs: StudioRenderJob[];
}) {
  const [pending, startTransition] = useTransition();
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  if (!open) return null;
  function mutate(job: StudioRenderJob, operation: "cancel" | "retry") {
    startTransition(async () => {
      const result =
        operation === "retry"
          ? await retryStudioRenderAction({
              idempotencyKey: crypto.randomUUID(),
              renderJobId: job.id
            })
          : await cancelStudioRenderAction({
              idempotencyKey: crypto.randomUUID(),
              renderJobId: job.id
            });
      setActionMessage(
        result.ok
          ? "De renderstatus is bijgewerkt."
          : result.error ?? "De renderactie is niet uitgevoerd."
      );
    });
  }
  return (
    <div className={styles.renderBackdrop} onClick={onClose} role="presentation">
      <aside
        aria-label="Renderstatus"
        className={styles.renderPanel}
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <h2>Renderstatus</h2>
            <p>Genereren gebeurt veilig op de achtergrond.</p>
          </div>
          <Button onClick={onClose} size="sm" variant="ghost">
            Sluiten
          </Button>
        </header>
        {message ? <p className={styles.renderMessage}>{message}</p> : null}
        {actionMessage ? (
          <p className={styles.renderMessage} role="status">
            {actionMessage}
          </p>
        ) : null}
        <div className={styles.renderJobs}>
          {renderJobs.length ? (
            renderJobs.map((job) => (
              <article key={job.id}>
                <div>
                  <StatusPill
                    label={renderJobLabel(job.status)}
                    tone={renderJobTone(job.status)}
                  />
                  <strong>{job.outputKind.toUpperCase()}</strong>
                  <time>{formatJobDate(job.createdAt)}</time>
                </div>
                <Progress
                  label={`Rendervoortgang ${job.progress}%`}
                  value={job.progress}
                />
                {job.status === "failed" ? (
                  <p>
                    {job.errorDetail ||
                      "De render kon niet worden voltooid. Je concept is ongewijzigd."}
                  </p>
                ) : null}
                {job.status === "completed" && job.mediaAssetId ? (
                  <div className={styles.renderResultActions}>
                    <Button asChild size="sm" variant="secondary">
                      <Link
                        href={`/dashboard/media?asset=${encodeURIComponent(job.mediaAssetId)}`}
                      >
                        Openen in Media
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="ghost">
                      <Link href="/dashboard/playlists">
                        Openen in Publisher
                      </Link>
                    </Button>
                  </div>
                ) : null}
                {canManageJobs ? (
                  <div>
                    {job.status === "failed" ? (
                      <Button
                        disabled={pending}
                        onClick={() => mutate(job, "retry")}
                        size="sm"
                        variant="secondary"
                      >
                        Opnieuw proberen
                      </Button>
                    ) : null}
                    {["queued", "preparing", "rendering"].includes(job.status) ? (
                      <Button
                        disabled={pending}
                        onClick={() => mutate(job, "cancel")}
                        size="sm"
                        variant="ghost"
                      >
                        Annuleren
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </article>
            ))
          ) : (
            <div className={styles.noRenders}>
              <Sparkles aria-hidden="true" />
              <strong>Nog geen renders</strong>
              <p>Gebruik Genereren om een PNG- of MP4-media-item te maken.</p>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function SaveIndicator({ saveState }: { saveState: StudioEditorState["saveState"] }) {
  const label = {
    conflict: "Opslagconflict",
    dirty: "Wijzigingen",
    error: "Niet opgeslagen",
    offline: "Lokaal bewaard",
    saved: "Opgeslagen",
    saving: "Opslaan…"
  }[saveState];
  return (
    <span
      aria-live="polite"
      className={styles.saveIndicator}
      data-state={saveState}
      role="status"
    >
      <i />
      {label}
    </span>
  );
}

function ElementTypeIcon({ element }: { element: StudioElement }) {
  if (element.type === "text") return <Type aria-hidden="true" />;
  if (element.type === "image" || element.type === "placeholder") {
    return <ImageIcon aria-hidden="true" />;
  }
  if (element.type === "shape") return <Square aria-hidden="true" />;
  if (element.type === "group") return <Layers3 aria-hidden="true" />;
  return <Sparkles aria-hidden="true" />;
}

function elementTypeLabel(type: StudioElement["type"]) {
  const labels: Record<StudioElement["type"], string> = {
    group: "Groep",
    icon: "Icoon",
    image: "Afbeelding",
    placeholder: "Beeldslot",
    qr: "QR-code",
    shape: "Vorm",
    text: "Tekst"
  };
  return labels[type];
}

function animationLabel(value: string) {
  const labels: Record<string, string> = {
    bounce: "Stuiteren",
    drift: "Zweven",
    fade: "Vervagen",
    none: "Geen",
    pop: "Pop",
    "slide-down": "Van boven",
    "slide-left": "Van rechts",
    "slide-right": "Van links",
    "slide-up": "Van onder",
    "slow-zoom": "Langzaam zoomen",
    typewriter: "Typemachine",
    wipe: "Onthullen",
    zoom: "Inzoomen"
  };
  return labels[value] ?? value;
}

const studioIconOptions = [
  "activity",
  "calendar",
  "clock",
  "heart",
  "image",
  "info",
  "location",
  "megaphone",
  "shield",
  "star",
  "trophy",
  "users"
] as const;

function studioIconLabel(value: (typeof studioIconOptions)[number]) {
  const labels: Record<(typeof studioIconOptions)[number], string> = {
    activity: "Activiteit",
    calendar: "Kalender",
    clock: "Klok",
    heart: "Hart",
    image: "Afbeelding",
    info: "Informatie",
    location: "Locatie",
    megaphone: "Megafoon",
    shield: "Schild",
    star: "Ster",
    trophy: "Trofee",
    users: "Personen"
  };
  return labels[value];
}

function snapHalfSecond(seconds: number) {
  return Math.max(0, Math.round(seconds * 2) * 500);
}

function renderJobLabel(status: StudioRenderJob["status"]) {
  const labels: Record<StudioRenderJob["status"], string> = {
    cancelled: "Geannuleerd",
    completed: "Gereed in Media",
    creating_media: "Media maken",
    encoding: "Coderen",
    failed: "Mislukt",
    preparing: "Voorbereiden",
    queued: "In wachtrij",
    rendering: "Renderen",
    uploading: "Uploaden"
  };
  return labels[status];
}

function renderJobTone(status: StudioRenderJob["status"]) {
  if (status === "completed") return "success" as const;
  if (status === "failed") return "critical" as const;
  if (status === "cancelled") return "neutral" as const;
  return "info" as const;
}

function formatJobDate(value: string) {
  return new Intl.DateTimeFormat("nl-NL", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatRevisionDate(value: string) {
  return new Intl.DateTimeFormat("nl-NL", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function revisionReasonLabel(reason: StudioRevision["reason"]) {
  return {
    checkpoint: "Automatisch checkpoint",
    render: "Vastgelegd vóór render",
    restore: "Herstelde versie"
  }[reason];
}
