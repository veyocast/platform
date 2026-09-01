/* eslint-disable @next/next/no-img-element -- Signed tenant previews require native image sizing inside the artboard. */
"use client";

import {
  useEffect,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode
} from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Layers3,
  LayoutGrid,
  Lock,
  Maximize2,
  Monitor,
  Move,
  Palette,
  Plus,
  Redo2,
  RotateCcw,
  Smartphone,
  Sparkles,
  Trash2,
  Type,
  Undo2,
  Unlock,
  Upload,
  UserRound,
  Video
} from "lucide-react";

import {
  ledScoresCanvasImageBindings,
  ledScoresCanvasMaximumLayers,
  ledScoresCanvasMomentKeys,
  ledScoresCanvasTextBindings,
  type LedScoresCanvasExperience,
  type LedScoresCanvasImageBinding,
  type LedScoresCanvasLayer,
  type LedScoresCanvasMomentKey,
  type LedScoresCanvasOrientation,
  type LedScoresCanvasScene,
  type LedScoresCanvasTextBinding
} from "@veyocast/contracts";
import { Button } from "@veyocast/ui";

import {
  clampLayerRect,
  createImageLayer,
  createLedScoresCanvasEditorState,
  createLineupLayer,
  createShapeLayer,
  createTextLayer,
  ledScoresCanvasPreviewText,
  ledScoresCanvasEditorReducer,
  sceneAt
} from "./canvas-experience-state";
import styles from "./canvas-experience-editor.module.css";

export type LedScoresTenantMedia = {
  height: number | null;
  id: string;
  kind: "image" | "video";
  mimeType: string | null;
  previewUrl: string | null;
  title: string;
  width: number | null;
};

export type LedScoresCanvasExperienceEditorProps = {
  activeMoment: LedScoresCanvasMomentKey;
  canUpload: boolean;
  experience: LedScoresCanvasExperience;
  onActiveMomentChange: (moment: LedScoresCanvasMomentKey) => void;
  onChange: (experience: LedScoresCanvasExperience) => void;
  onUpload: () => void;
  tenantMedia: LedScoresTenantMedia[];
};

const momentLabels: Record<LedScoresCanvasMomentKey, string> = {
  goalOpponent: "Tegendoelpunt",
  goalOwn: "Doelpunt eigen team",
  goalUnknown: "Doelpunt onbekend",
  halfTime: "Rust",
  lineupAway: "Opstelling uit",
  lineupHome: "Opstelling thuis",
  matchEnd: "Einde wedstrijd",
  matchStart: "Start wedstrijd"
};

const textBindingLabels: Record<LedScoresCanvasTextBinding, string> = {
  awayScore: "Score uit",
  awayTeam: "Uitteam",
  clock: "Wedstrijdklok",
  eventLabel: "Momentlabel",
  headline: "Hoofdtekst (canvas)",
  homeScore: "Score thuis",
  homeTeam: "Thuisteam",
  period: "Wedstrijdperiode",
  previousScore: "Vorige stand",
  score: "Volledige stand",
  scorerName: "Naam doelpuntenmaker",
  scorerNumber: "Rugnummer doelpuntenmaker",
  scoringTeam: "Scorend team",
  secondaryText: "Subtekst (canvas)"
};

const imageBindingLabels: Record<LedScoresCanvasImageBinding, string> = {
  awayLogo: "Logo uitteam",
  homeLogo: "Logo thuisteam",
  scorerPhoto: "Foto doelpuntenmaker",
  scoringTeamLogo: "Logo scorend team"
};

type MobileStep = "moment" | "content" | "style";

export function LedScoresCanvasExperienceEditor({
  activeMoment,
  canUpload,
  experience,
  onActiveMomentChange,
  onChange,
  onUpload,
  tenantMedia
}: LedScoresCanvasExperienceEditorProps) {
  const [state, dispatch] = useReducer(
    ledScoresCanvasEditorReducer,
    experience,
    createLedScoresCanvasEditorState
  );
  const [orientation, setOrientation] = useState<LedScoresCanvasOrientation>("landscape");
  const [zoom, setZoom] = useState(1);
  const [showSafeArea, setShowSafeArea] = useState(true);
  const [textBinding, setTextBinding] = useState<LedScoresCanvasTextBinding>("headline");
  const [imageBinding, setImageBinding] = useState<LedScoresCanvasImageBinding>("scorerPhoto");
  const [selectedMediaId, setSelectedMediaId] = useState(tenantMedia[0]?.id ?? "");
  const [mobileStep, setMobileStep] = useState<MobileStep>("moment");
  const mobileViewport = useMobileCanvasEditor();
  const emittedExperience = useRef<LedScoresCanvasExperience | null>(null);
  const emittedRevision = useRef(0);
  const receivedExperience = useRef(experience);
  const scene = sceneAt(state.experience, activeMoment, orientation);
  const selectedLayer = scene.layers.find((layer) => layer.id === state.selectedLayerId) ?? null;
  const selectedMedia = tenantMedia.find((asset) => asset.id === selectedMediaId) ?? null;

  useEffect(() => {
    if (experience === receivedExperience.current) return;
    receivedExperience.current = experience;
    if (experience === emittedExperience.current || experience === state.experience) return;
    dispatch({ experience, type: "sync" });
  }, [experience, state.experience]);

  useEffect(() => {
    if (state.changeRevision === emittedRevision.current) return;
    emittedRevision.current = state.changeRevision;
    emittedExperience.current = state.experience;
    onChange(state.experience);
  }, [onChange, state.changeRevision, state.experience]);

  useEffect(() => {
    if (!selectedMediaId && tenantMedia[0]) setSelectedMediaId(tenantMedia[0].id);
  }, [selectedMediaId, tenantMedia]);

  useEffect(() => {
    dispatch({ layerId: null, type: "select" });
  }, [activeMoment, orientation]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      const modifier = event.metaKey || event.ctrlKey;
      if (modifier && event.key.toLowerCase() === "z") {
        event.preventDefault();
        dispatch({ type: event.shiftKey ? "redo" : "undo" });
        return;
      }
      if (modifier && event.key.toLowerCase() === "y") {
        event.preventDefault();
        dispatch({ type: "redo" });
        return;
      }
      if (!selectedLayer || selectedLayer.locked) return;
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        dispatch({
          layerId: selectedLayer.id,
          moment: activeMoment,
          orientation,
          type: "remove-layer"
        });
        return;
      }
      const distance = event.shiftKey ? 10 : 1;
      const delta = {
        ArrowDown: { x: 0, y: distance },
        ArrowLeft: { x: -distance, y: 0 },
        ArrowRight: { x: distance, y: 0 },
        ArrowUp: { x: 0, y: -distance }
      }[event.key];
      if (!delta) return;
      event.preventDefault();
      updateLayer({ x: selectedLayer.x + delta.x, y: selectedLayer.y + delta.y });
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  function updateLayer(patch: Partial<LedScoresCanvasLayer>) {
    if (!selectedLayer) return;
    dispatch({
      layerId: selectedLayer.id,
      moment: activeMoment,
      orientation,
      patch,
      type: "update-layer"
    });
  }

  function addLayer(layer: LedScoresCanvasLayer) {
    dispatch({ layer, moment: activeMoment, orientation, type: "add-layer" });
  }

  function setBackground(background: LedScoresCanvasScene["background"]) {
    dispatch({
      moment: activeMoment,
      orientation,
      scene: { ...scene, background },
      type: "replace-scene"
    });
  }

  function addSelectedMedia() {
    if (!selectedMedia || selectedMedia.kind !== "image") return;
    addLayer(createImageLayer(scene, { mediaAssetId: selectedMedia.id }));
  }

  function useMediaAsBackground() {
    if (!selectedMedia) return;
    setBackground({
      focusX: 0.5,
      focusY: 0.5,
      kind: "media",
      mediaAssetId: selectedMedia.id,
      objectFit: "cover",
      overlayColor: "#0a0a0a",
      overlayOpacity: 0.16
    });
  }

  function renderLibrary() {
    return (
      <LibraryPanel
        activeMoment={activeMoment}
        canAdd={scene.layers.length < ledScoresCanvasMaximumLayers}
        canUpload={canUpload}
        imageBinding={imageBinding}
        onActiveMomentChange={onActiveMomentChange}
        onAddImageBinding={() => addLayer(createImageLayer(scene, { binding: imageBinding }))}
        onAddLineup={() => addLayer(createLineupLayer(scene))}
        onAddMedia={addSelectedMedia}
        onAddShape={() => addLayer(createShapeLayer(scene))}
        onAddText={() => addLayer(createTextLayer(scene))}
        onAddTextBinding={() => addLayer(createTextLayer(scene, textBinding))}
        onImageBindingChange={setImageBinding}
        onMediaChange={setSelectedMediaId}
        onUpload={onUpload}
        onUseMediaAsBackground={useMediaAsBackground}
        selectedMedia={selectedMedia}
        selectedMediaId={selectedMediaId}
        tenantMedia={tenantMedia}
        textBinding={textBinding}
        onTextBindingChange={setTextBinding}
      />
    );
  }

  const properties = (
    <PropertiesPanel
      media={tenantMedia}
      onBackgroundChange={setBackground}
      onLayerChange={updateLayer}
      onMoveLayer={(layerId, toIndex) => {
        dispatch({
          layerId,
          moment: activeMoment,
          orientation,
          toIndex,
          type: "move-layer"
        });
      }}
      onRemoveLayer={() => {
        if (!selectedLayer) return;
        dispatch({
          layerId: selectedLayer.id,
          moment: activeMoment,
          orientation,
          type: "remove-layer"
        });
      }}
      onSelectLayer={(layerId) => dispatch({ layerId, type: "select" })}
      scene={scene}
      selectedLayer={selectedLayer}
    />
  );

  return (
    <section className={styles.editor} aria-label="LED Scores canvaseditor">
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}><Sparkles aria-hidden="true" />Dynamische wedstrijdexperience</span>
          <h2>Ontwerp elk moment op het canvas</h2>
          <p>Plaats live data, spelersbeelden en clubmedia exact waar je ze wilt. Liggend en staand blijven afzonderlijk instelbaar.</p>
        </div>
        <div className={styles.headerStatus} role="status">
          <span>{scene.layers.length}/{ledScoresCanvasMaximumLayers} lagen</span>
          <strong>Alle wijzigingen zijn contract-geldig</strong>
        </div>
      </header>

      {!mobileViewport ? <div className={styles.desktopEditor}>
        <aside className={styles.library} aria-label="Bibliotheek">
          {renderLibrary()}
        </aside>
        <main className={styles.workspace}>
          <CanvasToolbar
            canRedo={state.future.length > 0}
            canUndo={state.past.length > 0}
            onCopy={() => dispatch({
              from: orientation,
              moment: activeMoment,
              to: orientation === "landscape" ? "portrait" : "landscape",
              type: "copy-orientation"
            })}
            onOrientationChange={setOrientation}
            onRedo={() => dispatch({ type: "redo" })}
            onSafeAreaChange={setShowSafeArea}
            onUndo={() => dispatch({ type: "undo" })}
            onZoomChange={setZoom}
            orientation={orientation}
            showSafeArea={showSafeArea}
            zoom={zoom}
          />
          <CanvasStage
            interactive
            media={tenantMedia}
            moment={activeMoment}
            onCommit={(layerId, patch) => dispatch({
              layerId,
              moment: activeMoment,
              orientation,
              patch,
              type: "update-layer"
            })}
            onSelect={(layerId) => dispatch({ layerId, type: "select" })}
            scene={scene}
            selectedLayerId={selectedLayer?.id ?? null}
            showSafeArea={showSafeArea}
            zoom={zoom}
          />
          <p className={styles.canvasHint}><Move aria-hidden="true" />Sleep om te verplaatsen, gebruik de hoek om te schalen. Pijltjestoetsen verplaatsen 1 px; Shift 10 px.</p>
        </main>
        <aside className={styles.inspector} aria-label="Eigenschappen en lagen">
          {properties}
        </aside>
      </div> : null}

      {mobileViewport ? <div className={styles.mobileEditor}>
        <MobileFlowHeader
          activeMoment={activeMoment}
          mobileStep={mobileStep}
          onActiveMomentChange={onActiveMomentChange}
          onOrientationChange={setOrientation}
          orientation={orientation}
        />
        <div className={styles.mobilePreview}>
          <CanvasStage
            interactive={false}
            media={tenantMedia}
            moment={activeMoment}
            onCommit={() => undefined}
            onSelect={(layerId) => dispatch({ layerId, type: "select" })}
            scene={scene}
            selectedLayerId={selectedLayer?.id ?? null}
            showSafeArea={showSafeArea}
            zoom={1}
          />
        </div>
        <div className={styles.mobileTask}>
          {mobileStep === "moment" ? <MomentTask activeMoment={activeMoment} onChange={onActiveMomentChange} /> : null}
          {mobileStep === "content" ? renderLibrary() : null}
          {mobileStep === "style" ? properties : null}
        </div>
        <MobileFooter mobileStep={mobileStep} onStepChange={setMobileStep} />
      </div> : null}
    </section>
  );
}

function CanvasToolbar({
  canRedo,
  canUndo,
  onCopy,
  onOrientationChange,
  onRedo,
  onSafeAreaChange,
  onUndo,
  onZoomChange,
  orientation,
  showSafeArea,
  zoom
}: {
  canRedo: boolean;
  canUndo: boolean;
  onCopy: () => void;
  onOrientationChange: (orientation: LedScoresCanvasOrientation) => void;
  onRedo: () => void;
  onSafeAreaChange: (show: boolean) => void;
  onUndo: () => void;
  onZoomChange: (zoom: number) => void;
  orientation: LedScoresCanvasOrientation;
  showSafeArea: boolean;
  zoom: number;
}) {
  return (
    <div className={styles.canvasToolbar}>
      <div className={styles.segmented} aria-label="Schermstand">
        <button aria-pressed={orientation === "landscape"} onClick={() => onOrientationChange("landscape")} type="button"><Monitor aria-hidden="true" />Liggend</button>
        <button aria-pressed={orientation === "portrait"} onClick={() => onOrientationChange("portrait")} type="button"><Smartphone aria-hidden="true" />Staand</button>
      </div>
      <div className={styles.toolGroup}>
        <IconTool disabled={!canUndo} label="Ongedaan maken" onClick={onUndo}><Undo2 /></IconTool>
        <IconTool disabled={!canRedo} label="Opnieuw" onClick={onRedo}><Redo2 /></IconTool>
        <button className={styles.textTool} onClick={onCopy} type="button"><Copy aria-hidden="true" />Kopieer naar {orientation === "landscape" ? "staand" : "liggend"}</button>
      </div>
      <div className={styles.toolGroup}>
        <label className={styles.safeToggle}><input checked={showSafeArea} onChange={(event) => onSafeAreaChange(event.target.checked)} type="checkbox" />Veilige zone</label>
        <IconTool disabled={zoom <= 0.5} label="Uitzoomen" onClick={() => onZoomChange(Math.max(0.5, zoom - 0.1))}>−</IconTool>
        <span className={styles.zoomValue}>{Math.round(zoom * 100)}%</span>
        <IconTool disabled={zoom >= 1.8} label="Inzoomen" onClick={() => onZoomChange(Math.min(1.8, zoom + 0.1))}>+</IconTool>
        <IconTool label="Zoom herstellen" onClick={() => onZoomChange(1)}><RotateCcw /></IconTool>
      </div>
    </div>
  );
}

type Interaction = {
  layer: LedScoresCanvasLayer;
  mode: "move" | "resize";
  pointerX: number;
  pointerY: number;
};

type DraftLayerRect = Pick<LedScoresCanvasLayer, "height" | "width" | "x" | "y">;

function CanvasStage({
  interactive,
  media,
  moment,
  onCommit,
  onSelect,
  scene,
  selectedLayerId,
  showSafeArea,
  zoom
}: {
  interactive: boolean;
  media: LedScoresTenantMedia[];
  moment: LedScoresCanvasMomentKey;
  onCommit: (layerId: string, patch: DraftLayerRect) => void;
  onSelect: (layerId: string | null) => void;
  scene: LedScoresCanvasScene;
  selectedLayerId: string | null;
  showSafeArea: boolean;
  zoom: number;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewportSize, setViewportSize] = useState({ height: 500, width: 900 });
  const [interaction, setInteraction] = useState<Interaction | null>(null);
  const [draft, setDraft] = useState<DraftLayerRect | null>(null);
  const [guides, setGuides] = useState<{ x: number[]; y: number[] }>({ x: [], y: [] });
  const dimensions = canvasDimensions(scene.orientation);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const measure = () => setViewportSize({ height: element.clientHeight, width: element.clientWidth });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const fit = Math.min(
    Math.max(0.1, (viewportSize.width - 56) / dimensions.width),
    Math.max(0.1, (viewportSize.height - 56) / dimensions.height)
  );
  const scale = fit * zoom;
  const canvasStyle = {
    "--canvas-height": `${dimensions.height}px`,
    "--canvas-scale": scale,
    "--canvas-width": `${dimensions.width}px`,
    height: dimensions.height * scale,
    width: dimensions.width * scale
  } as CSSProperties;

  function startInteraction(
    event: ReactPointerEvent<HTMLElement>,
    layer: LedScoresCanvasLayer,
    mode: Interaction["mode"]
  ) {
    if (!interactive || layer.locked) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    onSelect(layer.id);
    setDraft({ height: layer.height, width: layer.width, x: layer.x, y: layer.y });
    setInteraction({ layer, mode, pointerX: event.clientX, pointerY: event.clientY });
  }

  function moveInteraction(event: ReactPointerEvent<HTMLDivElement>) {
    if (!interaction) return;
    const deltaX = (event.clientX - interaction.pointerX) / scale;
    const deltaY = (event.clientY - interaction.pointerY) / scale;
    const base = interaction.layer;
    const changed = interaction.mode === "move"
      ? { height: base.height, width: base.width, x: base.x + deltaX, y: base.y + deltaY }
      : { height: base.height + deltaY, width: base.width + deltaX, x: base.x, y: base.y };
    const clamped = clampLayerRect(scene, changed);
    const snapped = snapLayerRect(scene, clamped, interaction.mode);
    setDraft(snapped.rect);
    setGuides(snapped.guides);
  }

  function stopInteraction() {
    if (interaction && draft) onCommit(interaction.layer.id, draft);
    setDraft(null);
    setGuides({ x: [], y: [] });
    setInteraction(null);
  }

  return (
    <div
      className={styles.canvasViewport}
      onPointerMove={moveInteraction}
      onPointerUp={stopInteraction}
      onPointerCancel={stopInteraction}
      ref={viewportRef}
    >
      <div className={styles.canvasFrame} style={canvasStyle}>
        <div
          aria-label={`${scene.orientation === "landscape" ? "Liggend" : "Staand"} ontwerpcanvas`}
          className={styles.canvas}
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) onSelect(null);
          }}
          role="application"
          style={{ height: dimensions.height, transform: `scale(${scale})`, width: dimensions.width }}
          tabIndex={0}
        >
          <SceneBackground background={scene.background} media={media} />
          {showSafeArea ? <div aria-hidden="true" className={styles.safeArea} data-orientation={scene.orientation} /> : null}
          {guides.x.map((position) => <span aria-hidden="true" className={styles.guideVertical} key={`x-${position}`} style={{ left: position }} />)}
          {guides.y.map((position) => <span aria-hidden="true" className={styles.guideHorizontal} key={`y-${position}`} style={{ top: position }} />)}
          {[...scene.layers].sort((left, right) => left.zIndex - right.zIndex).map((layer) => {
            const isInteracting = interaction?.layer.id === layer.id && draft;
            const rect = isInteracting ? draft : layer;
            const selected = selectedLayerId === layer.id;
            return (
              <div
                aria-label={`${layer.name}${layer.locked ? ", vergrendeld" : ""}`}
                aria-pressed={selected}
                className={styles.canvasLayer}
                data-locked={layer.locked || undefined}
                data-selected={selected || undefined}
                key={layer.id}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelect(layer.id);
                }}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  event.stopPropagation();
                  onSelect(layer.id);
                }}
                onPointerDown={(event) => startInteraction(event, layer, "move")}
                role="button"
                style={{
                  height: rect.height,
                  left: rect.x,
                  opacity: layer.opacity,
                  top: rect.y,
                  transform: `rotate(${layer.rotation}deg)`,
                  width: rect.width,
                  zIndex: layer.zIndex + 2
                }}
                tabIndex={interactive ? 0 : -1}
              >
                <LayerPreview layer={layer} media={media} moment={moment} />
                {selected && interactive && !layer.locked ? (
                  <span
                    aria-hidden="true"
                    className={styles.resizeHandle}
                    onPointerDown={(event) => startInteraction(event, layer, "resize")}
                  ><Maximize2 aria-hidden="true" /></span>
                ) : null}
                {selected ? <span aria-hidden="true" className={styles.layerLabel}>{layer.name}</span> : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SceneBackground({
  background,
  media
}: {
  background: LedScoresCanvasScene["background"];
  media: LedScoresTenantMedia[];
}) {
  if (background.kind === "solid") {
    return <div aria-hidden="true" className={styles.sceneBackground} style={{ background: background.color }} />;
  }
  if (background.kind === "gradient") {
    return <div aria-hidden="true" className={styles.sceneBackground} style={{ background: `linear-gradient(${background.angle}deg, ${background.from}, ${background.to})` }} />;
  }
  const asset = media.find((item) => item.id === background.mediaAssetId);
  const mediaStyle = {
    objectFit: background.objectFit,
    objectPosition: `${background.focusX * 100}% ${background.focusY * 100}%`
  } as CSSProperties;
  return (
    <div aria-hidden="true" className={styles.sceneBackground}>
      {asset?.previewUrl && asset.kind === "video" ? <video autoPlay loop muted playsInline src={asset.previewUrl} style={mediaStyle} /> : null}
      {asset?.previewUrl && asset.kind === "image" ? <img alt="" draggable={false} src={asset.previewUrl} style={mediaStyle} /> : null}
      {!asset?.previewUrl ? <div className={styles.missingMedia}><ImageIcon /><span>Achtergrondmedia niet beschikbaar</span></div> : null}
      <span style={{ background: background.overlayColor, opacity: background.overlayOpacity }} />
    </div>
  );
}

function LayerPreview({
  layer,
  media,
  moment
}: {
  layer: LedScoresCanvasLayer;
  media: LedScoresTenantMedia[];
  moment: LedScoresCanvasMomentKey;
}) {
  if (!layer.visible) return <div className={styles.hiddenLayerPreview}><EyeOff /><span>Verborgen</span></div>;
  if (layer.type === "text") {
    const text = layer.binding
      ? layer.binding === "headline" || layer.binding === "secondaryText"
        ? layer.text
        : ledScoresCanvasPreviewText(moment)[layer.binding]
      : layer.text;
    return (
      <div
        className={styles.textLayerPreview}
        style={{
          alignItems: verticalAlignment(layer.verticalAlign),
          background: layer.backgroundColor ?? "transparent",
          borderRadius: layer.cornerRadius,
          color: layer.fill,
          fontFamily: layer.fontFamily,
          fontSize: layer.fontSize,
          fontWeight: layer.fontWeight,
          justifyContent: horizontalAlignment(layer.align),
          letterSpacing: layer.letterSpacing,
          lineHeight: layer.lineHeight,
          padding: layer.padding,
          textAlign: layer.align
        }}
      ><span>{text}</span></div>
    );
  }
  if (layer.type === "shape") {
    return <div className={styles.shapeLayerPreview} data-shape={layer.shape} style={{
      background: layer.shape === "line" ? "transparent" : layer.fill,
      border: layer.stroke ? `${layer.strokeWidth}px solid ${layer.stroke}` : undefined,
      borderRadius: layer.shape === "ellipse" ? "50%" : layer.cornerRadius,
      "--editor-line-color": layer.stroke ?? layer.fill,
      "--editor-line-width": `${Math.max(2, layer.strokeWidth)}px`
    } as CSSProperties} />;
  }
  if (layer.type === "image") {
    const asset = layer.mediaAssetId ? media.find((item) => item.id === layer.mediaAssetId) : null;
    if (asset?.previewUrl && asset.kind === "image") {
      return <img alt="" className={styles.imageLayerPreview} draggable={false} src={asset.previewUrl} style={{ borderRadius: layer.cornerRadius, objectFit: layer.objectFit, objectPosition: `${layer.focusX * 100}% ${layer.focusY * 100}%` }} />;
    }
    return <div className={styles.bindingImagePreview} style={{ borderRadius: layer.cornerRadius }}><UserRound /><strong>{layer.binding ? imageBindingLabels[layer.binding] : "Afbeelding"}</strong><span>Live gevuld op het scherm</span></div>;
  }
  const players = ["Jansen", "De Jong", "Smit", "Visser", "Bakker", "Mulder", "Bos", "Vos"];
  return (
    <div className={styles.lineupPreview} style={{ gap: layer.gap, gridTemplateColumns: `repeat(${layer.columns}, minmax(0, 1fr))` }}>
      {players.map((name, index) => (
        <div key={name} style={{ background: layer.cardColor, color: layer.textColor }}>
          {layer.showPhoto ? <UserRound aria-hidden="true" /> : null}
          {layer.showNumber ? <b style={{ color: layer.accentColor }}>{index + 1}</b> : null}
          {layer.showName ? <span>{name}</span> : null}
        </div>
      ))}
    </div>
  );
}

function LibraryPanel({
  activeMoment,
  canAdd,
  canUpload,
  imageBinding,
  onActiveMomentChange,
  onAddImageBinding,
  onAddLineup,
  onAddMedia,
  onAddShape,
  onAddText,
  onAddTextBinding,
  onImageBindingChange,
  onMediaChange,
  onTextBindingChange,
  onUpload,
  onUseMediaAsBackground,
  selectedMedia,
  selectedMediaId,
  tenantMedia,
  textBinding
}: {
  activeMoment: LedScoresCanvasMomentKey;
  canAdd: boolean;
  canUpload: boolean;
  imageBinding: LedScoresCanvasImageBinding;
  onActiveMomentChange: (moment: LedScoresCanvasMomentKey) => void;
  onAddImageBinding: () => void;
  onAddLineup: () => void;
  onAddMedia: () => void;
  onAddShape: () => void;
  onAddText: () => void;
  onAddTextBinding: () => void;
  onImageBindingChange: (binding: LedScoresCanvasImageBinding) => void;
  onMediaChange: (id: string) => void;
  onTextBindingChange: (binding: LedScoresCanvasTextBinding) => void;
  onUpload: () => void;
  onUseMediaAsBackground: () => void;
  selectedMedia: LedScoresTenantMedia | null;
  selectedMediaId: string;
  tenantMedia: LedScoresTenantMedia[];
  textBinding: LedScoresCanvasTextBinding;
}) {
  return (
    <div className={styles.panelStack}>
      <PanelHeading icon={<Sparkles />} title="Momenten" description="Elk wedstrijdmoment heeft een eigen ontwerp." />
      <div className={styles.momentList}>
        {ledScoresCanvasMomentKeys.map((moment) => (
          <button
            aria-current={moment === activeMoment ? "true" : undefined}
            key={moment}
            onClick={() => onActiveMomentChange(moment)}
            type="button"
          >
            <span>{momentLabels[moment]}</span>
            <small>{moment.startsWith("goal") ? "Live score-event" : moment.startsWith("lineup") ? "Opstellings-event" : "Wedstrijdstatus"}</small>
          </button>
        ))}
      </div>

      <PanelHeading icon={<Plus />} title="Elementen" description="Voeg vaste of live gevulde lagen toe." />
      {!canAdd ? <p className={styles.notice}>Dit ontwerp heeft het maximum van {ledScoresCanvasMaximumLayers} lagen bereikt.</p> : null}
      <div className={styles.addGrid}>
        <button disabled={!canAdd} onClick={onAddText} type="button"><Type /><span><strong>Tekst</strong><small>Vrije tekst</small></span></button>
        <button disabled={!canAdd} onClick={onAddShape} type="button"><Palette /><span><strong>Vorm</strong><small>Vlak, cirkel of lijn</small></span></button>
        <button disabled={!canAdd} onClick={onAddLineup} type="button"><LayoutGrid /><span><strong>Opstelling</strong><small>Dynamisch raster</small></span></button>
      </div>

      <Field label="Tekstveld">
        <select onChange={(event) => onTextBindingChange(event.target.value as LedScoresCanvasTextBinding)} value={textBinding}>
          {ledScoresCanvasTextBindings.map((binding) => <option key={binding} value={binding}>{textBindingLabels[binding]}</option>)}
        </select>
      </Field>
      <Button disabled={!canAdd} onClick={onAddTextBinding} size="sm" type="button" variant="secondary"><Plus aria-hidden="true" />Tekstveld toevoegen</Button>

      <Field label="Live beeldveld">
        <select onChange={(event) => onImageBindingChange(event.target.value as LedScoresCanvasImageBinding)} value={imageBinding}>
          {ledScoresCanvasImageBindings.map((binding) => <option key={binding} value={binding}>{imageBindingLabels[binding]}</option>)}
        </select>
      </Field>
      <Button disabled={!canAdd} onClick={onAddImageBinding} size="sm" type="button" variant="secondary"><Plus aria-hidden="true" />Live beeld toevoegen</Button>

      <PanelHeading icon={<ImageIcon />} title="Clubmedia" description="Gebruik een afbeelding als laag of beeld/video als achtergrond." />
      {tenantMedia.length > 0 ? (
        <>
          <Field label="Media kiezen">
            <select onChange={(event) => onMediaChange(event.target.value)} value={selectedMediaId}>
              {tenantMedia.map((asset) => <option key={asset.id} value={asset.id}>{asset.title} · {asset.kind === "video" ? "video" : "afbeelding"}</option>)}
            </select>
          </Field>
          <div className={styles.mediaPreview}>
            {selectedMedia?.previewUrl && selectedMedia.kind === "image" ? <img alt="" src={selectedMedia.previewUrl} /> : null}
            {selectedMedia?.previewUrl && selectedMedia.kind === "video" ? <video muted playsInline preload="metadata" src={selectedMedia.previewUrl} /> : null}
            {!selectedMedia?.previewUrl ? <ImageIcon aria-hidden="true" /> : null}
            <span>{selectedMedia?.kind === "video" ? <Video aria-hidden="true" /> : <ImageIcon aria-hidden="true" />}{selectedMedia?.title}</span>
          </div>
          <div className={styles.inlineActions}>
            <Button disabled={!canAdd || selectedMedia?.kind !== "image"} onClick={onAddMedia} size="sm" type="button" variant="secondary">Als laag</Button>
            <Button onClick={onUseMediaAsBackground} size="sm" type="button" variant="secondary">Als achtergrond</Button>
          </div>
          {selectedMedia?.kind === "video" ? <p className={styles.fieldHelp}>Video speelt als canvasachtergrond; beeldlagen blijven stilstaand.</p> : null}
        </>
      ) : <p className={styles.emptyState}>Nog geen geschikte clubmedia. Upload eerst een afbeelding of video.</p>}
      {canUpload ? <Button onClick={onUpload} size="sm" type="button" variant="ghost"><Upload aria-hidden="true" />Media uploaden</Button> : null}
    </div>
  );
}

function PropertiesPanel({
  media,
  onBackgroundChange,
  onLayerChange,
  onMoveLayer,
  onRemoveLayer,
  onSelectLayer,
  scene,
  selectedLayer
}: {
  media: LedScoresTenantMedia[];
  onBackgroundChange: (background: LedScoresCanvasScene["background"]) => void;
  onLayerChange: (patch: Partial<LedScoresCanvasLayer>) => void;
  onMoveLayer: (layerId: string, toIndex: number) => void;
  onRemoveLayer: () => void;
  onSelectLayer: (layerId: string) => void;
  scene: LedScoresCanvasScene;
  selectedLayer: LedScoresCanvasLayer | null;
}) {
  const ordered = [...scene.layers].sort((left, right) => right.zIndex - left.zIndex);
  const dimensions = canvasDimensions(scene.orientation);
  return (
    <div className={styles.panelStack}>
      <BackgroundInspector background={scene.background} media={media} onChange={onBackgroundChange} />
      <div className={styles.panelDivider} />
      <label className={styles.mobileLayerPicker}>
        <span>Laag om vorm te geven</span>
        <select onChange={(event) => onSelectLayer(event.target.value)} value={selectedLayer?.id ?? ""}>
          <option disabled value="">Kies een laag</option>
          {ordered.map((layer) => <option key={layer.id} value={layer.id}>{layer.name}</option>)}
        </select>
      </label>
      <PanelHeading
        icon={<Move />}
        title={selectedLayer ? selectedLayer.name : "Laag selecteren"}
        description={selectedLayer ? `${layerTypeLabel(selectedLayer)} · laag ${selectedLayer.zIndex + 1}` : "Klik een element op het canvas of in de lagenlijst."}
      />
      {selectedLayer ? (
        <>
          <Field label="Laagnaam">
            <input maxLength={80} onChange={(event) => {
              if (event.target.value.trim()) onLayerChange({ name: event.target.value });
            }} type="text" value={selectedLayer.name} />
          </Field>
          <div className={styles.numericGrid}>
            <NumberField label="X" max={dimensions.width * 2} min={-dimensions.width} onChange={(x) => onLayerChange({ x })} value={selectedLayer.x} />
            <NumberField label="Y" max={dimensions.height * 2} min={-dimensions.height} onChange={(y) => onLayerChange({ y })} value={selectedLayer.y} />
            <NumberField label="Breedte" max={3_840} min={8} onChange={(width) => onLayerChange({ width })} value={selectedLayer.width} />
            <NumberField label="Hoogte" max={3_840} min={8} onChange={(height) => onLayerChange({ height })} value={selectedLayer.height} />
            <NumberField label="Rotatie" max={180} min={-180} onChange={(rotation) => onLayerChange({ rotation })} value={selectedLayer.rotation} />
            <NumberField label="Dekking %" max={100} min={0} onChange={(opacity) => onLayerChange({ opacity: opacity / 100 })} value={Math.round(selectedLayer.opacity * 100)} />
          </div>
          <Field label="Animatie">
            <select onChange={(event) => onLayerChange({ animation: event.target.value as LedScoresCanvasLayer["animation"] })} value={selectedLayer.animation}>
              <option value="none">Geen</option><option value="fade">Fade</option><option value="rise">Omhoog</option><option value="zoom">Zoom</option><option value="wipe">Wipe</option>
            </select>
          </Field>
          <div className={styles.inlineActions}>
            <button className={styles.toggleButton} onClick={() => onLayerChange({ visible: !selectedLayer.visible })} type="button">{selectedLayer.visible ? <Eye /> : <EyeOff />}{selectedLayer.visible ? "Zichtbaar" : "Verborgen"}</button>
            <button className={styles.toggleButton} onClick={() => onLayerChange({ locked: !selectedLayer.locked })} type="button">{selectedLayer.locked ? <Lock /> : <Unlock />}{selectedLayer.locked ? "Vergrendeld" : "Vrij"}</button>
          </div>
          <LayerSpecificInspector layer={selectedLayer} media={media} onChange={onLayerChange} />
          <div className={styles.mobileNudge}>
            <span>Precies verplaatsen</span>
            <div>
              <IconTool label="Naar links" onClick={() => onLayerChange({ x: selectedLayer.x - 10 })}><ArrowLeft /></IconTool>
              <IconTool label="Omhoog" onClick={() => onLayerChange({ y: selectedLayer.y - 10 })}><ArrowUp /></IconTool>
              <IconTool label="Omlaag" onClick={() => onLayerChange({ y: selectedLayer.y + 10 })}><ArrowDown /></IconTool>
              <IconTool label="Naar rechts" onClick={() => onLayerChange({ x: selectedLayer.x + 10 })}><ArrowRight /></IconTool>
            </div>
          </div>
          <Button onClick={onRemoveLayer} size="sm" type="button" variant="destructive"><Trash2 aria-hidden="true" />Laag verwijderen</Button>
        </>
      ) : <div className={styles.selectionEmpty}><Layers3 /><p>Selecteer een laag om positie, databinding en vormgeving in te stellen.</p></div>}

      <div className={styles.panelDivider} />
      <PanelHeading icon={<Layers3 />} title="Lagen" description="Bovenste items staan vooraan in beeld." />
      <ol className={styles.layerList}>
        {ordered.map((layer) => (
          <li data-selected={selectedLayer?.id === layer.id || undefined} key={layer.id}>
            <button className={styles.layerSelect} onClick={() => onSelectLayer(layer.id)} type="button">
              <LayerIcon layer={layer} />
              <span><strong>{layer.name}</strong><small>{layerTypeLabel(layer)}</small></span>
            </button>
            <IconTool disabled={layer.zIndex >= scene.layers.length - 1} label="Naar voren" onClick={() => onMoveLayer(layer.id, layer.zIndex + 1)}><ArrowUp /></IconTool>
            <IconTool disabled={layer.zIndex <= 0} label="Naar achteren" onClick={() => onMoveLayer(layer.id, layer.zIndex - 1)}><ArrowDown /></IconTool>
          </li>
        ))}
      </ol>
    </div>
  );
}

function BackgroundInspector({
  background,
  media,
  onChange
}: {
  background: LedScoresCanvasScene["background"];
  media: LedScoresTenantMedia[];
  onChange: (background: LedScoresCanvasScene["background"]) => void;
}) {
  const mediaId = background.kind === "media" ? background.mediaAssetId : media[0]?.id;
  function changeKind(kind: LedScoresCanvasScene["background"]["kind"]) {
    if (kind === "solid") return onChange({ color: backgroundColor(background, "#0a0a0a"), kind });
    if (kind === "gradient") return onChange({ angle: 135, from: backgroundColor(background, "#0a0a0a"), kind, to: "#ff5c20" });
    if (!mediaId) return;
    onChange({ focusX: 0.5, focusY: 0.5, kind, mediaAssetId: mediaId, objectFit: "cover", overlayColor: "#0a0a0a", overlayOpacity: 0.16 });
  }
  return (
    <>
      <PanelHeading icon={<Palette />} title="Achtergrond" description="Kleur, verloop, afbeelding of video." />
      <Field label="Type achtergrond">
        <select onChange={(event) => changeKind(event.target.value as LedScoresCanvasScene["background"]["kind"])} value={background.kind}>
          <option value="solid">Effen kleur</option><option value="gradient">Kleurverloop</option><option disabled={media.length === 0} value="media">Afbeelding of video</option>
        </select>
      </Field>
      {background.kind === "solid" ? <ColorField label="Achtergrondkleur" onChange={(color) => onChange({ ...background, color })} value={background.color} /> : null}
      {background.kind === "gradient" ? (
        <>
          <div className={styles.colorPair}><ColorField label="Van" onChange={(from) => onChange({ ...background, from })} value={background.from} /><ColorField label="Naar" onChange={(to) => onChange({ ...background, to })} value={background.to} /></div>
          <NumberField label="Hoek" max={360} min={0} onChange={(angle) => onChange({ ...background, angle })} value={background.angle} />
        </>
      ) : null}
      {background.kind === "media" ? (
        <>
          <Field label="Media">
            <select onChange={(event) => onChange({ ...background, mediaAssetId: event.target.value })} value={background.mediaAssetId}>
              {media.map((asset) => <option key={asset.id} value={asset.id}>{asset.title} · {asset.kind}</option>)}
            </select>
          </Field>
          <Field label="Passend maken"><select onChange={(event) => onChange({ ...background, objectFit: event.target.value as "contain" | "cover" })} value={background.objectFit}><option value="cover">Vullen</option><option value="contain">Volledig tonen</option></select></Field>
          <div className={styles.numericGrid}>
            <NumberField label="Focus horizontaal %" max={100} min={0} onChange={(focusX) => onChange({ ...background, focusX: focusX / 100 })} value={Math.round(background.focusX * 100)} />
            <NumberField label="Focus verticaal %" max={100} min={0} onChange={(focusY) => onChange({ ...background, focusY: focusY / 100 })} value={Math.round(background.focusY * 100)} />
            <NumberField label="Overlay %" max={100} min={0} onChange={(overlayOpacity) => onChange({ ...background, overlayOpacity: overlayOpacity / 100 })} value={Math.round(background.overlayOpacity * 100)} />
          </div>
          <ColorField label="Overlaykleur" onChange={(overlayColor) => onChange({ ...background, overlayColor })} value={background.overlayColor} />
        </>
      ) : null}
    </>
  );
}

function LayerSpecificInspector({
  layer,
  media,
  onChange
}: {
  layer: LedScoresCanvasLayer;
  media: LedScoresTenantMedia[];
  onChange: (patch: Partial<LedScoresCanvasLayer>) => void;
}) {
  if (layer.type === "text") {
    return (
      <fieldset className={styles.fieldset}>
        <legend>Tekst en databinding</legend>
        <Field label={layer.binding === "headline" || layer.binding === "secondaryText"
          ? "Tekst op het scherm"
          : layer.binding
            ? "Fallback bij ontbrekende live waarde"
            : "Inhoud"}>
          <textarea maxLength={240} onChange={(event) => {
            const text = event.target.value;
            if (layer.binding || text.trim()) onChange({ text });
          }} rows={3} value={layer.text} />
        </Field>
        <Field label="Tekstbron">
          <select onChange={(event) => {
            const binding = event.target.value ? event.target.value as LedScoresCanvasTextBinding : null;
            onChange({ binding, text: binding || layer.text.trim() ? layer.text : "Nieuwe tekst" });
          }} value={layer.binding ?? ""}>
            <option value="">Geen · vaste tekst</option>
            {ledScoresCanvasTextBindings.map((binding) => <option key={binding} value={binding}>{textBindingLabels[binding]}</option>)}
          </select>
        </Field>
        <div className={styles.colorPair}><ColorField label="Tekstkleur" onChange={(fill) => onChange({ fill })} value={layer.fill} /><ColorField label="Achtergrond" onChange={(backgroundColor) => onChange({ backgroundColor })} onClear={() => onChange({ backgroundColor: null })} value={layer.backgroundColor} /></div>
        <div className={styles.numericGrid}>
          <NumberField label="Tekstgrootte" max={360} min={16} onChange={(fontSize) => onChange({ fontSize })} value={layer.fontSize} />
          <NumberField label="Regelhoogte" max={2} min={0.8} onChange={(lineHeight) => onChange({ lineHeight })} step={0.05} value={layer.lineHeight} />
          <NumberField label="Letterafstand" max={40} min={-10} onChange={(letterSpacing) => onChange({ letterSpacing })} step={0.5} value={layer.letterSpacing} />
          <NumberField label="Binnenruimte" max={160} min={0} onChange={(padding) => onChange({ padding })} value={layer.padding} />
        </div>
        <div className={styles.segmented} aria-label="Tekstuitlijning">
          <button aria-label="Links uitlijnen" aria-pressed={layer.align === "left"} onClick={() => onChange({ align: "left" })} type="button"><AlignLeft /></button>
          <button aria-label="Centreren" aria-pressed={layer.align === "center"} onClick={() => onChange({ align: "center" })} type="button"><AlignCenter /></button>
          <button aria-label="Rechts uitlijnen" aria-pressed={layer.align === "right"} onClick={() => onChange({ align: "right" })} type="button"><AlignRight /></button>
        </div>
        <div className={styles.twoColumns}>
          <Field label="Lettertype"><select onChange={(event) => onChange({ fontFamily: event.target.value as "Inter" | "Inter Tight" })} value={layer.fontFamily}><option value="Inter Tight">Inter Tight</option><option value="Inter">Inter</option></select></Field>
          <Field label="Dikte"><select onChange={(event) => onChange({ fontWeight: Number(event.target.value) as 400 | 500 | 600 | 700 | 800 | 900 })} value={layer.fontWeight}><option value="400">Normaal</option><option value="500">Medium</option><option value="600">Semibold</option><option value="700">Vet</option><option value="800">Extra vet</option><option value="900">Black</option></select></Field>
        </div>
      </fieldset>
    );
  }
  if (layer.type === "image") {
    return (
      <fieldset className={styles.fieldset}>
        <legend>Beeldbron</legend>
        <Field label="Bron">
          <select onChange={(event) => {
            const [kind, value] = event.target.value.split(":", 2);
            if (kind === "binding" && value) onChange({ binding: value as LedScoresCanvasImageBinding, mediaAssetId: null });
            if (kind === "media" && value) onChange({ binding: null, mediaAssetId: value });
          }} value={layer.binding ? `binding:${layer.binding}` : `media:${layer.mediaAssetId}`}>
            <optgroup label="Live data">{ledScoresCanvasImageBindings.map((binding) => <option key={binding} value={`binding:${binding}`}>{imageBindingLabels[binding]}</option>)}</optgroup>
            <optgroup label="Clubmedia">{media.filter((asset) => asset.kind === "image").map((asset) => <option key={asset.id} value={`media:${asset.id}`}>{asset.title}</option>)}</optgroup>
          </select>
        </Field>
        <Field label="Passend maken"><select onChange={(event) => onChange({ objectFit: event.target.value as "contain" | "cover" })} value={layer.objectFit}><option value="cover">Vullen</option><option value="contain">Volledig tonen</option></select></Field>
        <div className={styles.numericGrid}>
          <NumberField label="Focus horizontaal %" max={100} min={0} onChange={(focusX) => onChange({ focusX: focusX / 100 })} value={Math.round(layer.focusX * 100)} />
          <NumberField label="Focus verticaal %" max={100} min={0} onChange={(focusY) => onChange({ focusY: focusY / 100 })} value={Math.round(layer.focusY * 100)} />
          <NumberField label="Hoekafronding" max={960} min={0} onChange={(cornerRadius) => onChange({ cornerRadius })} value={layer.cornerRadius} />
        </div>
      </fieldset>
    );
  }
  if (layer.type === "shape") {
    return (
      <fieldset className={styles.fieldset}>
        <legend>Vormgeving</legend>
        <Field label="Vorm"><select onChange={(event) => onChange({ shape: event.target.value as "ellipse" | "line" | "rectangle" })} value={layer.shape}><option value="rectangle">Rechthoek</option><option value="ellipse">Ellips</option><option value="line">Lijn</option></select></Field>
        <div className={styles.colorPair}><ColorField label="Vulkleur" onChange={(fill) => onChange({ fill })} value={layer.fill} /><ColorField label="Randkleur" onChange={(stroke) => onChange({ stroke })} onClear={() => onChange({ stroke: null })} value={layer.stroke} /></div>
        <div className={styles.numericGrid}>
          <NumberField label="Randdikte" max={32} min={0} onChange={(strokeWidth) => onChange({ strokeWidth })} value={layer.strokeWidth} />
          <NumberField label="Hoekafronding" max={960} min={0} onChange={(cornerRadius) => onChange({ cornerRadius })} value={layer.cornerRadius} />
        </div>
      </fieldset>
    );
  }
  return (
    <fieldset className={styles.fieldset}>
      <legend>Opstellingsraster</legend>
      <div className={styles.numericGrid}>
        <NumberField label="Kolommen" max={6} min={1} onChange={(columns) => onChange({ columns: Math.round(columns) })} value={layer.columns} />
        <NumberField label="Tussenruimte" max={96} min={0} onChange={(gap) => onChange({ gap })} value={layer.gap} />
      </div>
      <div className={styles.colorPair}><ColorField label="Accent" onChange={(accentColor) => onChange({ accentColor })} value={layer.accentColor} /><ColorField label="Tekst" onChange={(textColor) => onChange({ textColor })} value={layer.textColor} /></div>
      <ColorField label="Spelerkaart" onChange={(cardColor) => onChange({ cardColor })} value={layer.cardColor} />
      <div className={styles.checkList}>
        <CheckField checked={layer.showPhoto} label="Spelerfoto" onChange={(showPhoto) => onChange({ showPhoto })} />
        <CheckField checked={layer.showName} label="Naam" onChange={(showName) => onChange({ showName })} />
        <CheckField checked={layer.showNumber} label="Rugnummer" onChange={(showNumber) => onChange({ showNumber })} />
      </div>
    </fieldset>
  );
}

function MobileFlowHeader({
  activeMoment,
  mobileStep,
  onActiveMomentChange,
  onOrientationChange,
  orientation
}: {
  activeMoment: LedScoresCanvasMomentKey;
  mobileStep: MobileStep;
  onActiveMomentChange: (moment: LedScoresCanvasMomentKey) => void;
  onOrientationChange: (orientation: LedScoresCanvasOrientation) => void;
  orientation: LedScoresCanvasOrientation;
}) {
  const labels: Record<MobileStep, string> = { content: "Inhoud", moment: "Moment", style: "Vormgeving" };
  return (
    <div className={styles.mobileHeader}>
      <div><span>Stap {mobileStep === "moment" ? 1 : mobileStep === "content" ? 2 : 3} van 3</span><strong>{labels[mobileStep]}</strong></div>
      <Field label="Moment">
        <select onChange={(event) => onActiveMomentChange(event.target.value as LedScoresCanvasMomentKey)} value={activeMoment}>
          {ledScoresCanvasMomentKeys.map((moment) => <option key={moment} value={moment}>{momentLabels[moment]}</option>)}
        </select>
      </Field>
      <div className={styles.segmented} aria-label="Schermstand">
        <button aria-label="Liggend" aria-pressed={orientation === "landscape"} onClick={() => onOrientationChange("landscape")} type="button"><Monitor /></button>
        <button aria-label="Staand" aria-pressed={orientation === "portrait"} onClick={() => onOrientationChange("portrait")} type="button"><Smartphone /></button>
      </div>
    </div>
  );
}

function MomentTask({
  activeMoment,
  onChange
}: {
  activeMoment: LedScoresCanvasMomentKey;
  onChange: (moment: LedScoresCanvasMomentKey) => void;
}) {
  return (
    <div className={styles.mobileMomentTask}>
      <PanelHeading icon={<Sparkles />} title="Kies het wedstrijdmoment" description="Je bewerkt per moment een eigen liggende en staande compositie." />
      {ledScoresCanvasMomentKeys.map((moment) => (
        <button aria-pressed={moment === activeMoment} key={moment} onClick={() => onChange(moment)} type="button">
          <span>{momentLabels[moment]}</span><ChevronRight aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

function MobileFooter({ mobileStep, onStepChange }: { mobileStep: MobileStep; onStepChange: (step: MobileStep) => void }) {
  const steps: MobileStep[] = ["moment", "content", "style"];
  const index = steps.indexOf(mobileStep);
  return (
    <footer className={styles.mobileFooter}>
      <Button disabled={index === 0} onClick={() => onStepChange(steps[index - 1] ?? "moment")} type="button" variant="secondary"><ChevronLeft />Vorige</Button>
      <span>{index + 1} / {steps.length}</span>
      {index < steps.length - 1 ? <Button onClick={() => onStepChange(steps[index + 1] ?? "style")} type="button">Volgende<ChevronRight /></Button> : <Button onClick={() => onStepChange("moment")} type="button">Klaar</Button>}
    </footer>
  );
}

function PanelHeading({ description, icon, title }: { description: string; icon: ReactNode; title: string }) {
  return <div className={styles.panelHeading}><span aria-hidden="true">{icon}</span><div><h3>{title}</h3><p>{description}</p></div></div>;
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return <label className={styles.field}><span>{label}</span>{children}</label>;
}

function NumberField({
  label,
  max,
  min,
  onChange,
  step = 1,
  value
}: {
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  step?: number;
  value: number;
}) {
  return (
    <Field label={label}>
      <input
        max={max}
        min={min}
        onChange={(event) => {
          const numericValue = event.target.valueAsNumber;
          if (Number.isFinite(numericValue)) onChange(Math.min(max, Math.max(min, numericValue)));
        }}
        step={step}
        type="number"
        value={roundForInput(value)}
      />
    </Field>
  );
}

function ColorField({
  label,
  onChange,
  onClear,
  value
}: {
  label: string;
  onChange: (color: string) => void;
  onClear?: () => void;
  value: string | null;
}) {
  const [draft, setDraft] = useState(value ?? "");
  useEffect(() => setDraft(value ?? ""), [value]);
  const displayColor = value?.slice(0, 7) ?? "#0a0a0a";
  return (
    <div className={styles.colorField}>
      <span>{label}</span>
      <div>
        <input aria-label={`${label} kiezen`} onChange={(event) => onChange(event.target.value)} type="color" value={displayColor} />
        <input aria-label={`${label} hexcode`} maxLength={9} onBlur={() => {
          const normalized = normalizeColor(draft);
          if (normalized) onChange(normalized);
          else setDraft(value ?? "");
        }} onChange={(event) => setDraft(event.target.value)} type="text" value={draft} />
        {onClear ? <button aria-label={`${label} verwijderen`} disabled={!value} onClick={onClear} type="button">×</button> : null}
      </div>
    </div>
  );
}

function CheckField({ checked, label, onChange }: { checked: boolean; label: string; onChange: (checked: boolean) => void }) {
  return <label><input checked={checked} onChange={(event) => onChange(event.target.checked)} type="checkbox" /><span>{label}</span></label>;
}

function IconTool({
  children,
  disabled = false,
  label,
  onClick
}: {
  children: ReactNode;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return <button aria-label={label} className={styles.iconTool} disabled={disabled} onClick={onClick} title={label} type="button">{children}</button>;
}

function LayerIcon({ layer }: { layer: LedScoresCanvasLayer }) {
  if (layer.type === "text") return <Type aria-hidden="true" />;
  if (layer.type === "image") return <ImageIcon aria-hidden="true" />;
  if (layer.type === "lineup") return <LayoutGrid aria-hidden="true" />;
  return <Palette aria-hidden="true" />;
}

function layerTypeLabel(layer: LedScoresCanvasLayer) {
  if (layer.type === "text") {
    if (!layer.binding) return "Vaste tekst";
    return layer.binding === "headline" || layer.binding === "secondaryText"
      ? `Canvascopy · ${textBindingLabels[layer.binding]}`
      : `Live tekst · ${textBindingLabels[layer.binding]}`;
  }
  if (layer.type === "image") return layer.binding ? `Live beeld · ${imageBindingLabels[layer.binding]}` : "Vaste afbeelding";
  if (layer.type === "lineup") return "Live opstellingsraster";
  return `Vorm · ${layer.shape === "rectangle" ? "rechthoek" : layer.shape === "ellipse" ? "ellips" : "lijn"}`;
}

function horizontalAlignment(align: "center" | "left" | "right") {
  return align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start";
}

function verticalAlignment(align: "bottom" | "middle" | "top") {
  return align === "middle" ? "center" : align === "bottom" ? "flex-end" : "flex-start";
}

function backgroundColor(background: LedScoresCanvasScene["background"], fallback: string) {
  if (background.kind === "solid") return background.color;
  if (background.kind === "gradient") return background.from;
  return background.overlayColor || fallback;
}

function canvasDimensions(orientation: LedScoresCanvasOrientation) {
  return orientation === "landscape" ? { height: 1_080, width: 1_920 } : { height: 1_920, width: 1_080 };
}

function useMobileCanvasEditor() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 60rem)");
    const sync = () => setMobile(query.matches);
    sync();
    if (typeof query.addEventListener === "function") {
      query.addEventListener("change", sync);
      return () => query.removeEventListener("change", sync);
    }
    query.addListener(sync);
    return () => query.removeListener(sync);
  }, []);
  return mobile;
}

function snapLayerRect(scene: LedScoresCanvasScene, rect: DraftLayerRect, mode: Interaction["mode"]) {
  const dimensions = canvasDimensions(scene.orientation);
  const safeInset = dimensions.width * (scene.orientation === "landscape" ? 0.05 : 0.06);
  const xGuides = [0, safeInset, dimensions.width / 2, dimensions.width - safeInset, dimensions.width];
  const yGuides = [0, dimensions.height * (scene.orientation === "landscape" ? 0.05 : 0.06), dimensions.height / 2, dimensions.height * (scene.orientation === "landscape" ? 0.95 : 0.94), dimensions.height];
  const snapped: DraftLayerRect = {
    height: snapGrid(rect.height),
    width: snapGrid(rect.width),
    x: snapGrid(rect.x),
    y: snapGrid(rect.y)
  };
  const active = { x: [] as number[], y: [] as number[] };
  if (mode === "move") {
    const xEdges = [snapped.x, snapped.x + snapped.width / 2, snapped.x + snapped.width];
    const yEdges = [snapped.y, snapped.y + snapped.height / 2, snapped.y + snapped.height];
    const xMatch = closestGuide(xEdges, xGuides);
    const yMatch = closestGuide(yEdges, yGuides);
    if (xMatch) {
      snapped.x += xMatch.guide - xMatch.edge;
      active.x.push(xMatch.guide);
    }
    if (yMatch) {
      snapped.y += yMatch.guide - yMatch.edge;
      active.y.push(yMatch.guide);
    }
  } else {
    const right = snapped.x + snapped.width;
    const bottom = snapped.y + snapped.height;
    const xGuide = xGuides.find((guide) => Math.abs(guide - right) <= 12);
    const yGuide = yGuides.find((guide) => Math.abs(guide - bottom) <= 12);
    if (xGuide !== undefined) {
      snapped.width = Math.max(8, xGuide - snapped.x);
      active.x.push(xGuide);
    }
    if (yGuide !== undefined) {
      snapped.height = Math.max(8, yGuide - snapped.y);
      active.y.push(yGuide);
    }
  }
  return { guides: active, rect: clampLayerRect(scene, snapped) };
}

function closestGuide(edges: number[], guides: number[]) {
  let match: { distance: number; edge: number; guide: number } | null = null;
  for (const edge of edges) {
    for (const guide of guides) {
      const distance = Math.abs(edge - guide);
      if (distance <= 12 && (!match || distance < match.distance)) match = { distance, edge, guide };
    }
  }
  return match;
}

function snapGrid(value: number) {
  return Math.round(value / 8) * 8;
}

function normalizeColor(value: string) {
  const normalized = value.trim().toLowerCase();
  return /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/.test(normalized) ? normalized : null;
}

function roundForInput(value: number) {
  return Math.round(value * 100) / 100;
}
