"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type Konva from "konva";
import QRCode from "qrcode";
import {
  Ellipse,
  Image as KonvaImage,
  Layer,
  Line,
  Rect,
  Stage,
  Text,
  Transformer
} from "react-konva";

import {
  evaluateStudioFrame,
  evaluateStudioReducedMotionFrame,
  layoutStudioText,
  type StudioDocument,
  type StudioElement
} from "@veyocast/studio";

import type { StudioEditorAction } from "../editor-state";
import type { StudioMediaAsset } from "../types";
import styles from "../studio.module.css";

type CanvasProps = {
  assets: StudioMediaAsset[];
  canEdit: boolean;
  dispatch: (action: StudioEditorAction) => void;
  document: StudioDocument;
  onScaleChange?: (scale: number) => void;
  panEnabled?: boolean;
  playheadMs: number;
  reducedMotion?: boolean;
  selectedIds: string[];
  zoom: number;
};

export function StudioKonvaCanvas({
  assets,
  canEdit,
  dispatch,
  document,
  onScaleChange,
  panEnabled = false,
  playheadMs,
  reducedMotion = false,
  selectedIds,
  zoom
}: CanvasProps) {
  const frame = useMemo(
    () => reducedMotion
      ? evaluateStudioReducedMotionFrame(document)
      : evaluateStudioFrame(document, playheadMs),
    [document, playheadMs, reducedMotion]
  );
  const wrapRef = useRef<HTMLDivElement>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const layerRef = useRef<Konva.Layer>(null);
  const [viewport, setViewport] = useState({ height: 620, width: 920 });
  const [spacePanning, setSpacePanning] = useState(false);
  const [dragPanning, setDragPanning] = useState(false);
  const [marquee, setMarquee] = useState<{
    additive: boolean;
    height: number;
    originX: number;
    originY: number;
    width: number;
    x: number;
    y: number;
  } | null>(null);
  const panRef = useRef<{
    clientX: number;
    clientY: number;
    pointerId: number;
    scrollLeft: number;
    scrollTop: number;
  } | null>(null);

  useEffect(() => {
    const node = wrapRef.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setViewport({
        height: Math.max(240, entry.contentRect.height - 32),
        width: Math.max(280, entry.contentRect.width - 32)
      });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      if (
        event.code !== "Space" ||
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      ) {
        return;
      }
      event.preventDefault();
      setSpacePanning(true);
    };
    const keyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") setSpacePanning(false);
    };
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    return () => {
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
    };
  }, []);

  const scale =
    Math.min(
      viewport.width / document.artboard.width,
      viewport.height / document.artboard.height
    ) * zoom;
  const stageWidth = Math.round(document.artboard.width * scale);
  const stageHeight = Math.round(document.artboard.height * scale);
  const activePan = panEnabled || spacePanning;

  useEffect(() => {
    onScaleChange?.(scale);
  }, [onScaleChange, scale]);

  useEffect(() => {
    const layer = layerRef.current;
    const transformer = transformerRef.current;
    if (!layer || !transformer) return;
    transformer.nodes(
      selectedIds.flatMap((id) => {
        const node = layer.findOne(`#${id}`);
        return node ? [node] : [];
      })
    );
    transformer.getLayer()?.batchDraw();
  }, [selectedIds, frame]);

  const background = document.artboard.background;

  return (
    <div
      aria-label="Studio-artboard"
      className={styles.canvasViewport}
      data-panning={activePan || dragPanning}
      onPointerDown={(event) => {
        if (!activePan) return;
        const node = wrapRef.current;
        if (!node) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        panRef.current = {
          clientX: event.clientX,
          clientY: event.clientY,
          pointerId: event.pointerId,
          scrollLeft: node.scrollLeft,
          scrollTop: node.scrollTop
        };
        setDragPanning(true);
      }}
      onPointerMove={(event) => {
        const start = panRef.current;
        const node = wrapRef.current;
        if (!start || !node || start.pointerId !== event.pointerId) return;
        node.scrollLeft = start.scrollLeft - (event.clientX - start.clientX);
        node.scrollTop = start.scrollTop - (event.clientY - start.clientY);
      }}
      onPointerUp={(event) => {
        if (panRef.current?.pointerId !== event.pointerId) return;
        panRef.current = null;
        setDragPanning(false);
        event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      ref={wrapRef}
    >
      <div
        className={styles.canvasFrame}
        style={{ height: stageHeight, width: stageWidth }}
      >
        <Stage
          height={stageHeight}
          onMouseDown={(event) => {
            if (activePan) return;
            if (event.target === event.target.getStage()) {
              const pointer = event.target.getStage()?.getPointerPosition();
              if (!pointer) return;
              const x = pointer.x / scale;
              const y = pointer.y / scale;
              setMarquee({
                additive: event.evt.shiftKey,
                height: 0,
                originX: x,
                originY: y,
                width: 0,
                x,
                y
              });
            }
          }}
          onMouseMove={(event) => {
            if (!marquee || activePan) return;
            const pointer = event.target.getStage()?.getPointerPosition();
            if (!pointer) return;
            const currentX = pointer.x / scale;
            const currentY = pointer.y / scale;
            setMarquee({
              ...marquee,
              height: Math.abs(currentY - marquee.originY),
              width: Math.abs(currentX - marquee.originX),
              x: Math.min(currentX, marquee.originX),
              y: Math.min(currentY, marquee.originY)
            });
          }}
          onMouseUp={() => {
            if (!marquee || activePan) return;
            const selected =
              marquee.width < 4 && marquee.height < 4
                ? []
                : document.elements
                    .filter(
                      (element) =>
                        element.type !== "group" &&
                        element.visible &&
                        rectanglesIntersect(marquee, element)
                    )
                    .map((element) => element.id);
            dispatch({
              elementIds: marquee.additive
                ? [...new Set([...selectedIds, ...selected])]
                : selected,
              type: "selection/replace"
            });
            setMarquee(null);
          }}
          width={stageWidth}
        >
          <Layer
            listening={!activePan}
            ref={layerRef}
            scaleX={scale}
            scaleY={scale}
          >
            <Rect
              fill={
                background.kind === "solid"
                  ? background.color
                  : background.kind === "transparent"
                    ? "#FFFFFF"
                    : undefined
              }
              fillLinearGradientColorStops={
                background.kind === "linear-gradient"
                  ? [0, background.from, 1, background.to]
                  : undefined
              }
              fillLinearGradientEndPoint={
                background.kind === "linear-gradient"
                  ? gradientPoint(background.angle, document.artboard.width, document.artboard.height)
                  : undefined
              }
              height={document.artboard.height}
              listening={false}
              width={document.artboard.width}
            />
            <Rect
              dash={[12, 12]}
              height={
                document.artboard.height -
                document.artboard.safeArea.top -
                document.artboard.safeArea.bottom
              }
              listening={false}
              opacity={0.32}
              stroke="#FFAE72"
              strokeWidth={2}
              width={
                document.artboard.width -
                document.artboard.safeArea.left -
                document.artboard.safeArea.right
              }
              x={document.artboard.safeArea.left}
              y={document.artboard.safeArea.top}
            />
            {frame.map(({ element, transform, visibleText }) =>
              element.type === "group" ? null : (
                <CanvasElement
                  asset={assetForElement(assets, element)}
                  canEdit={canEdit}
                  dispatch={dispatch}
                  documentHeight={document.artboard.height}
                  documentWidth={document.artboard.width}
                  element={element}
                  key={element.id}
                  transform={transform}
                  visibleText={visibleText}
                />
              )
            )}
            {marquee ? (
              <Rect
                dash={[10, 6]}
                fill="rgba(255, 92, 32, 0.12)"
                height={marquee.height}
                listening={false}
                stroke="#FF5C20"
                strokeWidth={2 / scale}
                width={marquee.width}
                x={marquee.x}
                y={marquee.y}
              />
            ) : null}
            {canEdit ? (
              <Transformer
                anchorFill="#FAFAF7"
                anchorSize={12 / scale}
                anchorStroke="#FF5C20"
                borderDash={[8 / scale, 4 / scale]}
                borderStroke="#FF5C20"
                flipEnabled={false}
                keepRatio={false}
                ref={transformerRef}
                rotateAnchorOffset={28 / scale}
              />
            ) : null}
          </Layer>
        </Stage>
      </div>
    </div>
  );
}

function CanvasElement({
  asset,
  canEdit,
  dispatch,
  documentHeight,
  documentWidth,
  element,
  transform,
  visibleText
}: {
  asset: StudioMediaAsset | null;
  canEdit: boolean;
  dispatch: (action: StudioEditorAction) => void;
  documentHeight: number;
  documentWidth: number;
  element: Exclude<StudioElement, { type: "group" }>;
  transform: ReturnType<typeof evaluateStudioFrame>[number]["transform"];
  visibleText: string | undefined;
}) {
  const border =
    element.type === "image" || element.type === "shape"
      ? element.border
      : undefined;
  const common = {
    draggable: canEdit && !element.locked,
    height: element.height,
    id: element.id,
    listening: canEdit,
    name: "studio-element",
    offsetX: element.width / 2,
    offsetY: element.height / 2,
    onClick: (event: Konva.KonvaEventObject<MouseEvent>) => {
      event.cancelBubble = true;
      dispatch({
        additive: event.evt.shiftKey,
        elementId: element.id,
        type: "selection/set"
      });
    },
    onDragEnd: (event: Konva.KonvaEventObject<DragEvent>) => {
      dispatch({
        elementId: element.id,
        patch: {
          x: snapCoordinate(
            event.target.x() - element.width / 2,
            element.width,
            documentWidth
          ),
          y: snapCoordinate(
            event.target.y() - element.height / 2,
            element.height,
            documentHeight
          )
        },
        type: "element/update"
      });
    },
    onTransformEnd: (event: Konva.KonvaEventObject<Event>) => {
      const node = event.target;
      const width = Math.max(8, node.width() * node.scaleX());
      const height = Math.max(8, node.height() * node.scaleY());
      node.scaleX(1);
      node.scaleY(1);
      dispatch({
        elementId: element.id,
        patch: {
          height,
          rotation: node.rotation(),
          width,
          x: node.x() - width / 2,
          y: node.y() - height / 2
        },
        type: "element/update"
      });
    },
    opacity: transform.opacity,
    rotation: element.rotation,
    scaleX: transform.scaleX,
    scaleY: transform.scaleY,
    stroke: border?.color,
    strokeWidth: border?.width,
    visible: element.visible,
    width: element.width,
    x: transform.x + element.width / 2,
    y: transform.y + element.height / 2
  };

  if (element.type === "text") {
    const layout = layoutStudioText({
      ...element,
      text: visibleText ?? element.text
    });
    return (
      <Text
        {...common}
        align={element.align}
        fill={element.fill}
        fontFamily={element.fontFamily}
        fontSize={layout.fontSize}
        fontStyle={element.fontWeight >= 700 ? "bold" : "normal"}
        letterSpacing={element.letterSpacing}
        lineHeight={layout.lineHeightPx / layout.fontSize}
        padding={element.padding}
        text={layout.lines.join("\n")}
        verticalAlign={element.verticalAlign}
      />
    );
  }
  if (element.type === "shape") {
    const fill =
      element.fill.kind === "solid" ? element.fill.color : element.fill.from;
    if (element.shape === "ellipse") {
      return (
        <Ellipse
          {...common}
          fill={fill}
          radiusX={element.width / 2}
          radiusY={element.height / 2}
        />
      );
    }
    if (element.shape === "line") {
      return (
        <Line
          {...common}
          fill={fill}
          points={[0, element.height / 2, element.width, element.height / 2]}
          stroke={fill}
          strokeWidth={Math.max(2, element.height)}
        />
      );
    }
    return (
      <Rect {...common} cornerRadius={element.cornerRadius} fill={fill} />
    );
  }
  if (element.type === "image") {
    return (
      <RemoteImage
        common={common}
        cornerRadius={element.cornerRadius}
        focusX={element.focusX}
        focusY={element.focusY}
        objectFit={element.objectFit}
        url={asset?.previewUrl ?? null}
      />
    );
  }
  if (element.type === "icon") {
    return (
      <Text
        {...common}
        align="center"
        fill={element.fill}
        fontSize={Math.min(element.width, element.height) * 0.72}
        text={iconGlyph(element.icon)}
        verticalAlign="middle"
      />
    );
  }
  if (element.type === "qr") {
    return (
      <QrImage
        background={element.background}
        common={common}
        foreground={element.foreground}
        value={element.value}
      />
    );
  }
  return (
    <>
      <Rect
        {...common}
        dash={[18, 12]}
        fill={element.fill}
        stroke={element.stroke}
        strokeWidth={3}
      />
      <Text
        {...common}
        align="center"
        fill={element.stroke}
        fontSize={Math.min(34, element.height * 0.12)}
        text={element.label}
        verticalAlign="middle"
      />
    </>
  );
}

function QrImage({
  background,
  common,
  foreground,
  value
}: {
  background: string;
  common: Record<string, unknown>;
  foreground: string;
  value: string;
}) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    let active = true;
    QRCode.toDataURL(value, {
      color: { dark: foreground, light: background },
      errorCorrectionLevel: "M",
      margin: 1,
      width: 640
    })
      .then((url) => {
        const next = new window.Image();
        next.onload = () => {
          if (active) setImage(next);
        };
        next.src = url;
      })
      .catch(() => setImage(null));
    return () => {
      active = false;
    };
  }, [background, foreground, value]);
  return image ? (
    <KonvaImage {...common} image={image} />
  ) : (
    <Rect {...common} fill={background} stroke={foreground} />
  );
}

function RemoteImage({
  common,
  cornerRadius,
  focusX,
  focusY,
  objectFit,
  url
}: {
  common: Record<string, unknown>;
  cornerRadius: number;
  focusX: number;
  focusY: number;
  objectFit: "contain" | "cover";
  url: string | null;
}) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!url) {
      setImage(null);
      return;
    }
    const nextImage = new window.Image();
    nextImage.crossOrigin = "anonymous";
    nextImage.onload = () => setImage(nextImage);
    nextImage.src = url;
    return () => {
      nextImage.onload = null;
    };
  }, [url]);
  if (!image) {
    return <Rect {...common} fill="#222222" stroke="#666666" />;
  }
  const width = Number(common.width);
  const height = Number(common.height);
  const scale =
    objectFit === "cover"
      ? Math.max(width / image.width, height / image.height)
      : Math.min(width / image.width, height / image.height);
  const cropWidth = width / scale;
  const cropHeight = height / scale;
  if (objectFit === "contain") {
    const fittedWidth = image.width * scale;
    const fittedHeight = image.height * scale;
    return (
      <KonvaImage
        {...common}
        cornerRadius={cornerRadius}
        height={fittedHeight}
        image={image}
        offsetX={fittedWidth / 2}
        offsetY={fittedHeight / 2}
        width={fittedWidth}
      />
    );
  }
  return (
    <KonvaImage
      {...common}
      cornerRadius={cornerRadius}
      crop={{
        height: cropHeight,
        width: cropWidth,
        x: (image.width - cropWidth) * focusX,
        y: (image.height - cropHeight) * focusY
      }}
      image={image}
    />
  );
}

function assetForElement(
  assets: StudioMediaAsset[],
  element: StudioElement
) {
  return element.type === "image"
    ? assets.find((asset) => asset.id === element.mediaAssetId) ?? null
    : null;
}

function gradientPoint(angle: number, width: number, height: number) {
  const radians = (angle * Math.PI) / 180;
  return {
    x: width / 2 + Math.cos(radians) * width / 2,
    y: height / 2 + Math.sin(radians) * height / 2
  };
}

function iconGlyph(icon: string) {
  const glyphs: Record<string, string> = {
    activity: "↗",
    calendar: "▦",
    clock: "◷",
    heart: "♥",
    image: "▣",
    info: "i",
    location: "⌖",
    megaphone: "◀",
    shield: "◇",
    star: "★",
    trophy: "♛",
    users: "●●"
  };
  return glyphs[icon] ?? "◆";
}

function snapCoordinate(value: number, size: number, artboardSize: number) {
  const candidates = [
    0,
    (artboardSize - size) / 2,
    artboardSize - size,
    Math.round(value / 8) * 8
  ];
  const nearest = candidates.reduce((best, candidate) =>
    Math.abs(candidate - value) < Math.abs(best - value) ? candidate : best
  );
  return Math.abs(nearest - value) <= 12 ? nearest : value;
}

function rectanglesIntersect(
  selection: { height: number; width: number; x: number; y: number },
  element: StudioElement
) {
  return !(
    element.x > selection.x + selection.width ||
    element.x + element.width < selection.x ||
    element.y > selection.y + selection.height ||
    element.y + element.height < selection.y
  );
}
