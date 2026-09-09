"use client";

/* eslint-disable @next/next/no-img-element -- Player media uses short-lived immutable signed URLs. */

import {
  compileLedScoresCanvasScene,
  ledScoresCanvasDimensions,
  type LedScoresCanvasRenderLayer,
  type LedScoresCanvasScene,
  type LedScoresCanvasValues
} from "@veyocast/contracts";
import React, { useEffect, useMemo, useRef, useState } from "react";

import type {
  LedScoresCanvasScenePair,
  LedScoresOverlayAsset
} from "../_lib/ledscores-match-experience";
import type { FrozenPlayerTheme } from "./player-presentation-theme";
import styles from "./ledscores-canvas-scene.module.css";

export type LedScoresCanvasRendererValues = LedScoresCanvasValues;

export function selectLedScoresCanvasScene(
  pair: LedScoresCanvasScenePair,
  orientation: "landscape" | "portrait"
) {
  return pair[orientation];
}

export function LedScoresCanvasSceneRenderer({
  ariaLabel,
  assets,
  onBackgroundMediaError,
  orientation: orientationOverride,
  scene: scenePair,
  testId = "ledscores-canvas-scene",
  theme = null,
  values
}: {
  ariaLabel: string;
  assets: ReadonlyMap<string, LedScoresOverlayAsset>;
  onBackgroundMediaError?: () => void;
  orientation?: "landscape" | "portrait";
  scene: LedScoresCanvasScenePair;
  testId?: string;
  theme?: FrozenPlayerTheme | null;
  values: LedScoresCanvasRendererValues;
}) {
  const viewportOrientation = useViewportOrientation();
  const orientation = orientationOverride ?? viewportOrientation;
  const scene = selectLedScoresCanvasScene(scenePair, orientation);
  const layers = useMemo(
    () => compileLedScoresCanvasScene(scene, values),
    [scene, values]
  );
  const backgroundAsset = scene.background.kind === "media"
    ? assets.get(scene.background.mediaAssetId) ?? null
    : null;

  return (
    <section
      aria-label={ariaLabel}
      className={styles.root}
      data-design-revision={theme?.designRevision ?? "player-fallback"}
      data-motion-state={theme?.motionEnabled === false ? "off" : "on"}
      data-orientation={orientation}
      data-theme-mode={theme?.mode ?? "dark"}
      data-testid={testId}
      style={theme?.style}
    >
      <div
        className={styles.canvas}
        data-orientation={orientation}
        style={backgroundStyle(scene.background)}
      >
        {scene.background.kind === "media" && backgroundAsset ? (
          <CanvasMedia
            asset={backgroundAsset}
            className={styles.backgroundMedia}
            focusX={scene.background.focusX}
            onError={onBackgroundMediaError}
            focusY={scene.background.focusY}
            objectFit={scene.background.objectFit}
          />
        ) : null}
        {scene.background.kind === "media" && scene.background.overlayOpacity > 0 ? (
          <div
            aria-hidden="true"
            className={styles.backgroundOverlay}
            style={{
              backgroundColor: scene.background.overlayColor,
              opacity: scene.background.overlayOpacity
            }}
          />
        ) : null}
        {layers.map((layer) => (
          <CanvasLayer
            asset={layer.type === "image" && layer.mediaAssetId
              ? assets.get(layer.mediaAssetId) ?? null
              : null}
            key={layer.id}
            layer={layer}
            orientation={orientation}
          />
        ))}
      </div>
    </section>
  );
}

function CanvasLayer({
  asset,
  layer,
  orientation
}: {
  asset: LedScoresOverlayAsset | null;
  layer: LedScoresCanvasRenderLayer;
  orientation: "landscape" | "portrait";
}) {
  const baseStyle = layerStyle(layer, orientation);
  if (layer.type === "text") {
    return (
      <div
        className={`${styles.layer} ${styles.textLayer}`}
        data-align={layer.align}
        data-animation={layer.animation}
        data-layer-id={layer.id}
        data-vertical-align={layer.verticalAlign}
        style={{
          ...baseStyle,
          backgroundColor: layer.backgroundColor ?? undefined,
          borderRadius: scaledLength(layer.cornerRadius, orientation),
          color: layer.fill,
          fontFamily: layer.fontFamily === "Inter Tight"
            ? "var(--vc-font-display)"
            : "var(--vc-font-body)",
          fontSize: scaledLength(layer.fontSize, orientation),
          fontWeight: layer.fontWeight,
          letterSpacing: `${layer.letterSpacing / Math.max(1, layer.fontSize)}em`,
          lineHeight: layer.lineHeight,
          padding: scaledLength(layer.padding, orientation)
        }}
      >
        {layer.resolvedText}
      </div>
    );
  }
  if (layer.type === "image") {
    const bindingUrl = layer.binding ? layer.resolvedUrl : null;
    const source = bindingUrl
      ? { mimeType: "image/webp" as const, url: bindingUrl }
      : asset;
    return (
      <div
        aria-hidden="true"
        className={`${styles.layer} ${styles.imageLayer}`}
        data-animation={layer.animation}
        data-layer-id={layer.id}
        style={{
          ...baseStyle,
          borderRadius: scaledLength(layer.cornerRadius, orientation)
        }}
      >
        {source ? (
          <CanvasMedia
            asset={source}
            focusX={layer.focusX}
            focusY={layer.focusY}
            objectFit={layer.objectFit}
          />
        ) : null}
      </div>
    );
  }
  if (layer.type === "shape") {
    const isLine = layer.shape === "line";
    return (
      <div
        aria-hidden="true"
        className={`${styles.layer} ${styles.shapeLayer}`}
        data-animation={layer.animation}
        data-layer-id={layer.id}
        data-shape={layer.shape}
        style={{
          ...baseStyle,
          backgroundColor: isLine ? "transparent" : layer.fill,
          borderColor: isLine ? "transparent" : layer.stroke ?? "transparent",
          borderRadius: layer.shape === "ellipse"
            ? "50%"
            : isLine
              ? 0
              : scaledLength(layer.cornerRadius, orientation),
          borderStyle: "solid",
          borderWidth: isLine ? 0 : scaledLength(layer.strokeWidth, orientation),
          "--canvas-line-color": layer.stroke ?? layer.fill,
          "--canvas-line-width": scaledLength(
            Math.max(2, layer.strokeWidth),
            orientation
          )
        } as React.CSSProperties}
      />
    );
  }
  return (
    <div
      className={`${styles.layer} ${styles.lineupLayer}`}
      data-animation={layer.animation}
      data-layer-id={layer.id}
      style={{
        ...baseStyle,
        "--canvas-lineup-accent": layer.accentColor,
        "--canvas-lineup-card": layer.cardColor,
        "--canvas-lineup-columns": layer.columns,
        "--canvas-lineup-gap": scaledLength(layer.gap, orientation),
        "--canvas-lineup-text": layer.textColor
      } as React.CSSProperties}
    >
      {layer.players.map((player, index) => (
        <article
          className={styles.lineupPlayer}
          key={player.id ?? `${player.name}:${player.number ?? index}`}
        >
          {layer.showPhoto ? (
            <div className={styles.lineupPhoto}>
              {player.photoUrl ? (
                <img alt="" aria-hidden="true" src={player.photoUrl} />
              ) : (
                <span aria-hidden="true">{initials(player.name)}</span>
              )}
            </div>
          ) : null}
          <div className={styles.lineupIdentity}>
            {layer.showNumber ? <b>{player.number ?? "—"}</b> : null}
            {layer.showName ? <strong>{player.name}</strong> : null}
          </div>
        </article>
      ))}
    </div>
  );
}

function CanvasMedia({
  asset,
  className,
  focusX,
  focusY,
  onError,
  objectFit
}: {
  asset: Pick<LedScoresOverlayAsset, "mimeType" | "url">;
  className?: string;
  focusX: number;
  focusY: number;
  onError?: () => void;
  objectFit: "contain" | "cover";
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const notifiedFailedUrlRef = useRef<string | null>(null);
  if (failedUrl === asset.url) return null;
  const handleError = () => {
    setFailedUrl(asset.url);
    if (notifiedFailedUrlRef.current === asset.url) return;
    notifiedFailedUrlRef.current = asset.url;
    onError?.();
  };
  const mediaStyle = {
    objectFit,
    objectPosition: `${focusX * 100}% ${focusY * 100}%`
  } as const;
  return asset.mimeType === "video/mp4" ? (
    <video
      aria-hidden="true"
      autoPlay
      className={className}
      controls={false}
      disablePictureInPicture
      loop
      muted
      onError={handleError}
      playsInline
      preload="auto"
      src={asset.url}
      style={mediaStyle}
    />
  ) : (
    <img
      alt=""
      aria-hidden="true"
      className={className}
      onError={handleError}
      src={asset.url}
      style={mediaStyle}
    />
  );
}

function backgroundStyle(
  background: LedScoresCanvasScene["background"]
): React.CSSProperties {
  if (background.kind === "solid") return { background: background.color };
  if (background.kind === "gradient") {
    return {
      background: `linear-gradient(${background.angle}deg, ${background.from}, ${background.to})`
    };
  }
  return { background: background.overlayColor };
}

function layerStyle(
  layer: LedScoresCanvasRenderLayer,
  orientation: "landscape" | "portrait"
): React.CSSProperties {
  const dimensions = ledScoresCanvasDimensions(orientation);
  return {
    height: `${layer.height / dimensions.height * 100}%`,
    left: `${layer.x / dimensions.width * 100}%`,
    opacity: layer.opacity,
    top: `${layer.y / dimensions.height * 100}%`,
    transform: `rotate(${layer.rotation}deg)`,
    width: `${layer.width / dimensions.width * 100}%`,
    zIndex: layer.zIndex
  };
}

function scaledLength(
  value: number,
  orientation: "landscape" | "portrait"
) {
  if (value === 0) return "0px";
  const dimensions = ledScoresCanvasDimensions(orientation);
  return `min(${value / dimensions.width * 100}vw, ${value / dimensions.height * 100}vh)`;
}

function useViewportOrientation() {
  const [orientation, setOrientation] = useState<"landscape" | "portrait">(
    () => typeof window !== "undefined" &&
      window.matchMedia("(orientation: portrait)").matches
      ? "portrait"
      : "landscape"
  );
  useEffect(() => {
    const query = window.matchMedia("(orientation: portrait)");
    const handleChange = (event: MediaQueryListEvent) => {
      setOrientation(event.matches ? "portrait" : "landscape");
    };
    if (typeof query.addEventListener === "function") {
      query.addEventListener("change", handleChange);
      return () => query.removeEventListener("change", handleChange);
    }
    query.addListener(handleChange);
    return () => query.removeListener(handleChange);
  }, []);
  return orientation;
}

function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase()).join("") || "VC";
}
