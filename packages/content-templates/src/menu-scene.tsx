"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties
} from "react";

import {
  type MenuDocumentV2,
  type MenuProductGroupPlacement,
  type MenuProductPlacement,
  type ThemeMode,
  type ThemePresentationSnapshot
} from "@veyocast/contracts";

import { freezeThemePresentation, themeCssVariables } from "./theme-catalog";
import styles from "./menu-scene.module.css";

import {menuSceneZones,MENU_SCENE_CONTENT_FIT_VERSION,type MenuFloatingBlock,menuSceneCanvases,resolveMenuSceneScale,resolveMenuScenePages,resolveProductTitleDensity,formatMenuMoney,resolveMenuProductPrice,resolveMenuGroupPrice,type MenuSceneAsset,type MenuSceneRow,type ResolvedMenuScenePage} from "./menu-scene-model";
export * from "./menu-scene-model";

export function MenuScene({
  alignment = "center",
  assets,
  document,
  onContentFit,
  onReady = () => undefined,
  orientation,
  pageIndex = 0,
  zoom = 1
}: {
  alignment?: "center" | "top";
  assets: Record<string, MenuSceneAsset>;
  document: MenuDocumentV2;
  onContentFit?: (overflow: boolean) => void;
  onReady?: () => void;
  orientation: keyof typeof menuSceneCanvases;
  pageIndex?: number;
  zoom?: number;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number | null>(null);
  const canvas = menuSceneCanvases[orientation];
  const pages = useMemo(
    () => resolveMenuScenePages(document, orientation),
    [document, orientation]
  );
  const page = pages[Math.min(Math.max(pageIndex, 0), Math.max(0, pages.length - 1))];
  const effectiveScale = scale === null ? null : scale * Math.min(2, Math.max(0.5, zoom));

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const update = () => {
      const width = viewport.clientWidth || viewport.parentElement?.clientWidth || 0;
      const height = viewport.clientHeight || viewport.parentElement?.clientHeight || 0;
      if (width < 1 || height < 1) return;
      setScale(resolveMenuSceneScale(
        { height, width },
        orientation
      ));
    };
    update();
    const observer = typeof ResizeObserver === "function"
      ? new ResizeObserver(update)
      : null;
    observer?.observe(viewport);
    if (viewport.parentElement) observer?.observe(viewport.parentElement);
    window.addEventListener("resize", update);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [canvas.height, canvas.width, orientation]);

  useEffect(() => {
    if (scale === null) return;
    let active = true;
    let frame = 0;
    const fonts = "fonts" in documentGlobal()
      ? documentGlobal().fonts.ready
      : Promise.resolve();
    void fonts.then(() => {
      if (!active) return;
      frame = window.requestAnimationFrame(() => active && onReady());
    });
    return () => {
      active = false;
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [onReady, scale]);

  return (
    <div className={styles.viewport} data-alignment={alignment} ref={viewportRef}>
      {page ? (
        <div
          className={styles.displayFrame}
          data-menu-scene-scale={effectiveScale ?? undefined}
          style={{
            height: effectiveScale === null ? 0 : canvas.height * effectiveScale,
            width: effectiveScale === null ? 0 : canvas.width * effectiveScale
          }}
        >
          <MenuSceneCanvas
            assets={assets}
            document={document}
            onContentFit={onContentFit}
            orientation={orientation}
            page={page}
            style={{
              height: canvas.height,
              opacity: effectiveScale === null ? 0 : 1,
              transform: `scale(${effectiveScale ?? 1})`,
              width: canvas.width
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

export function MenuSceneCanvas({
  assets,
  document,
  onContentFit,
  orientation,
  page,
  style,
  themeMode,
  themeOverrideStyle
}: {
  assets: Record<string, MenuSceneAsset>;
  document: MenuDocumentV2;
  onContentFit?: (overflow: boolean) => void;
  orientation: keyof typeof menuSceneCanvases;
  page: ResolvedMenuScenePage;
  style?: CSSProperties;
  themeMode?: ThemeMode;
  themeOverrideStyle?: CSSProperties;
}) {
  const canvasRef = useRef<HTMLElement>(null);
  const zones = menuSceneZones[orientation];
  const themePresentation = freezeMenuDocumentThemePresentation(document);
  const rootStyle = {
    ...themeCssVariables(themePresentation),
    ...themeOverrideStyle,
    ...style
  } as CSSProperties;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let active = true;
    let frame = 0;
    const fontsReady = "fonts" in documentGlobal()
      ? documentGlobal().fonts.ready
      : Promise.resolve();
    void fontsReady.then(() => {
      if (!active) return;
      frame = window.requestAnimationFrame(() => {
        if (!active) return;
        const columns = Array.from(canvas.querySelectorAll<HTMLElement>("[data-menu-column]"));
        const overflow = columns.some((column) => {
          const bounds = column.getBoundingClientRect();
          const rows = Array.from(column.querySelectorAll<HTMLElement>("[data-menu-row]"));
          const lastRow = rows.at(-1)?.getBoundingClientRect();
          return column.scrollHeight > column.clientHeight + 1 ||
            Boolean(lastRow && lastRow.bottom > bounds.bottom + 1);
        });
        canvas.dataset.menuContentFitVersion = MENU_SCENE_CONTENT_FIT_VERSION;
        canvas.dataset.menuContentMeasured = "true";
        canvas.dataset.menuContentOverflow = overflow ? "true" : "false";
        onContentFit?.(overflow);
      });
    });
    return () => {
      active = false;
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [document.id, document.updatedAt, onContentFit, orientation, page.id]);

  return (
    <section
      aria-label={document.title || "Menu"}
      className={styles.canvas}
      data-orientation={orientation}
      data-theme-id={document.theme.themeId}
      data-theme-mode={themeMode ?? document.theme.mode}
      data-theme-snapshot-version={themePresentation.snapshotVersion}
      ref={canvasRef}
      style={rootStyle}
    >
      <header className={styles.header} style={rectStyle(zones.header)}>
        <div>
          <span className={styles.kicker}>Menu</span>
          <h1>{document.title || "Menu"}</h1>
        </div>
        {document.theme.brand.logoAssetId && assets[document.theme.brand.logoAssetId] ? (
          <img
            alt=""
            className={styles.headerLogo}
            src={assets[document.theme.brand.logoAssetId]!.url}
          />
        ) : null}
      </header>
      <main className={styles.body} style={rectStyle(zones.body)}>
        <div
          className={styles.columns}
          data-column-count={page.columnCount}
          data-underfilled={page.underfilled || undefined}
        >
          <MenuColumn assets={assets} label={orientation === "portrait" ? "Menu-inhoud" : "Linkerkolom"} rows={page.columns.left} />
          {page.columns.right.length ? (
            <MenuColumn assets={assets} label="Rechterkolom" rows={page.columns.right} />
          ) : null}
        </div>
        {page.floatingBlocks.map((block) => (
          <FloatingBlock
            assets={assets}
            block={block}
            key={block.id}
            orientation={orientation}
          />
        ))}
      </main>
      <footer className={styles.footer} style={rectStyle(zones.footer)}>
        <span>Prijslijst</span>
        <span>{page.pageIndex + 1} / {page.pageCount}</span>
      </footer>
    </section>
  );
}

export function freezeMenuDocumentThemePresentation(
  document: Pick<MenuDocumentV2, "publication" | "theme" | "updatedAt">
): ThemePresentationSnapshot {
  return freezeThemePresentation({
    instant: document.publication?.publishedAt ?? document.updatedAt,
    selection: {
      accent: document.theme.brand.accent,
      categoryOverrides: [],
      modePolicy: { kind: "fixed", mode: document.theme.mode },
      ref: {
        catalog: "v2",
        id: document.theme.themeId,
        version: document.theme.themeVersion
      },
      support: document.theme.brand.support ?? null
    },
    timezone: "UTC"
  });
}

function MenuColumn({
  assets,
  label,
  rows
}: {
  assets: Record<string, MenuSceneAsset>;
  label: string;
  rows: MenuSceneRow[];
}) {
  return (
    <section aria-label={label} className={styles.column} data-menu-column>
      {rows.map((row) => {
        if (row.kind === "category") {
          return (
            <header className={styles.category} data-menu-row key={row.id}>
              <div>
                <h2>{row.label}{row.continuation ? " — vervolg" : ""}</h2>
                {row.subtitle ? <p>{row.subtitle}</p> : null}
              </div>
              <i aria-hidden="true" />
            </header>
          );
        }
        if (row.kind === "product") {
          return <ProductRow assets={assets} key={row.id} product={row.product} />;
        }
        return <ProductGroup assets={assets} group={row.group} key={row.id} />;
      })}
    </section>
  );
}

function ProductRow({
  assets,
  product
}: {
  assets: Record<string, MenuSceneAsset>;
  product: MenuProductPlacement;
}) {
  const assetId = product.mediaOverrideAssetId ?? product.snapshotFallback.imageAssetId;
  const asset = assetId ? assets[assetId] : null;
  const title = product.nameOverride ?? product.snapshotFallback.name;
  return (
    <article className={styles.product} data-available={product.snapshotFallback.available} data-menu-row>
      <MediaThumb asset={asset ?? null} label={product.snapshotFallback.name} />
      <span className={styles.productCopy}>
        <strong data-title-density={resolveProductTitleDensity(title)}>{title}</strong>
        {product.snapshotFallback.variantLabel ? (
          <small>{product.snapshotFallback.variantLabel}</small>
        ) : <small aria-hidden="true">&nbsp;</small>}
      </span>
      <b>{formatMenuMoney(resolveMenuProductPrice(product))}</b>
    </article>
  );
}

function ProductGroup({
  assets,
  group
}: {
  assets: Record<string, MenuSceneAsset>;
  group: MenuProductGroupPlacement;
}) {
  const linked = group.secondaryLineItems.filter(
    (line) => line.kind === "linked-product"
  );
  const availableLinked = linked.filter((line) => line.snapshotFallback.available);
  const visibleLines = group.secondaryLineItems.filter((line) =>
    line.kind === "free-text" ||
    !group.availabilityPolicy.hideUnavailableLinkedProducts ||
    line.snapshotFallback.available
  );
  const unavailable = group.availabilityPolicy.groupUnavailableWhenNoLinkedProducts &&
    linked.length > 0 && availableLinked.length === 0;
  const asset = group.imageAssetId ? assets[group.imageAssetId] : null;
  return (
    <article className={styles.productGroup} data-available={!unavailable} data-menu-row>
      <MediaThumb asset={asset ?? null} label={group.title} />
      <span className={styles.productCopy}>
        <strong data-title-density={resolveProductTitleDensity(group.title)}>{group.title}</strong>
        <small className={styles.groupLines} data-lines={group.display.maxLines}>
          {visibleLines.map((line, index) => (
            <span key={line.id}>
              {index > 0 ? separator(group.display.separator) : ""}
              {line.kind === "free-text"
                ? line.label
                : line.labelOverride ?? line.snapshotFallback.variantLabel ?? line.snapshotFallback.name}
              {group.pricePolicy === "separate" && line.kind === "linked-product"
                ? ` ${formatMenuMoney(line.snapshotFallback.price)}`
                : ""}
            </span>
          ))}
        </small>
      </span>
      <b>{resolveMenuGroupPrice(group)}</b>
    </article>
  );
}

function MediaThumb({ asset, label }: { asset: MenuSceneAsset | null; label: string }) {
  return (
    <span aria-hidden="true" className={styles.mediaThumb}>
      {asset ? (
        asset.kind === "video" ? (
          <MotionMedia
            ariaLabel={label}
            autoPlay
            loop
            posterUrl={asset.posterUrl}
            src={asset.url}
          />
        ) : <img alt="" src={asset.url} />
      ) : null}
    </span>
  );
}

function FloatingBlock({
  assets,
  block,
  orientation
}: {
  assets: Record<string, MenuSceneAsset>;
  block: MenuFloatingBlock;
  orientation: keyof typeof menuSceneCanvases;
}) {
  const layout = block.layout[orientation];
  const body = menuSceneZones[orientation].body;
  const style = {
    height: layout.h,
    left: layout.x - body.x,
    opacity: block.hidden ? 0 : undefined,
    top: layout.y - body.y,
    transform: `rotate(${layout.rotation}deg)`,
    width: layout.w
  } as CSSProperties;
  if (block.type === "text") {
    return <p className={styles.floatingText} data-role={block.role} style={style}>{block.text}</p>;
  }
  if (block.type === "promo") {
    return <aside className={styles.promo} style={style}><strong>{block.title}</strong>{block.body ? <p>{block.body}</p> : null}</aside>;
  }
  const asset = assets[block.assetId];
  if (!asset) return null;
  const appearance = (block.type === "image" || block.type === "video")
    ? block.orientationAppearance?.[orientation] ?? block.appearance
    : null;
  if (block.type === "video") {
    const posterUrl = block.playback.posterAssetId
      ? assets[block.playback.posterAssetId]?.url
      : asset.posterUrl;
    return (
      <MotionMedia
        autoPlay={block.playback.autoplay}
        className={styles.floatingMedia}
        endMs={block.playback.endMs ?? null}
        loop={block.playback.loop}
        posterUrl={posterUrl}
        src={asset.url}
        startMs={block.playback.startMs}
        style={{ ...style, objectFit: appearance!.fit, objectPosition: focal(appearance!.focalPoint) }}
      />
    );
  }
  if (block.type === "logo") {
    if (block.color.mode !== "original" && asset.mimeType === "image/svg+xml") {
      const token = block.color.token ?? "accent";
      const color = token === "support"
        ? "var(--vc-theme-support)"
        : token === "accent-ink"
          ? "var(--vc-theme-accent-ink)"
          : "var(--vc-theme-accent)";
      return (
        <span
          aria-label="Logo"
          className={styles.tintedLogo}
          role="img"
          style={{
            ...style,
            backgroundColor: block.color.custom ?? color,
            maskImage: `url(${JSON.stringify(asset.url)})`,
            WebkitMaskImage: `url(${JSON.stringify(asset.url)})`
          }}
        />
      );
    }
    return <img alt="" className={styles.floatingLogo} src={asset.url} style={style} />;
  }
  return (
    <figure className={styles.floatingFigure} style={style}>
      <img alt={block.alt ?? ""} src={asset.url} style={{ objectFit: appearance!.fit, objectPosition: focal(appearance!.focalPoint), opacity: appearance!.opacity }} />
      {block.caption ? <figcaption>{block.caption}</figcaption> : null}
    </figure>
  );
}

function MotionMedia({
  ariaLabel,
  autoPlay,
  className,
  endMs = null,
  loop,
  posterUrl,
  src,
  startMs = 0,
  style
}: {
  ariaLabel?: string;
  autoPlay: boolean;
  className?: string;
  endMs?: number | null;
  loop: boolean;
  posterUrl?: string;
  src: string;
  startMs?: number;
  style?: CSSProperties;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const startSeconds = startMs / 1_000;
    const endSeconds = endMs === null ? null : endMs / 1_000;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let active = true;
    let frame: number | null = null;
    const stopFragmentGuard = () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      frame = null;
    };
    const canGuardFragment = () => active && endSeconds !== null && autoPlay &&
      !document.hidden && !reducedMotion.matches && !video.paused && !video.ended;
    const seekToStart = () => {
      if (Number.isFinite(video.duration)) {
        video.currentTime = Math.min(startSeconds, Math.max(0, video.duration - 0.01));
      }
    };
    const syncPlayback = () => {
      if (document.hidden || reducedMotion.matches || !autoPlay) {
        stopFragmentGuard();
        video.pause();
        return;
      }
      void video.play().then(startFragmentGuard).catch(() => undefined);
    };
    const handleTimeUpdate = () => {
      if (endSeconds === null || video.currentTime < endSeconds) return;
      if (loop) {
        seekToStart();
        syncPlayback();
      } else {
        video.pause();
        video.currentTime = endSeconds;
      }
    };
    const handleEnded = () => {
      if (!loop) return;
      seekToStart();
      syncPlayback();
    };
    // Periodic timeupdate can arrive 250 ms apart. Check a playing, visible
    // fragment on each render frame as well, retaining the media events.
    function guardFragmentEnd() {
      frame = null;
      if (!canGuardFragment()) return;
      handleTimeUpdate();
      startFragmentGuard();
    }
    function startFragmentGuard() {
      if (frame === null && canGuardFragment()) {
        frame = window.requestAnimationFrame(guardFragmentEnd);
      }
    }
    const handleReducedMotion = () => syncPlayback();
    const handleVisibility = () => syncPlayback();

    video.addEventListener("loadedmetadata", seekToStart);
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("playing", startFragmentGuard);
    video.addEventListener("pause", stopFragmentGuard);
    video.addEventListener("ended", handleEnded);
    document.addEventListener("visibilitychange", handleVisibility);
    reducedMotion.addEventListener("change", handleReducedMotion);
    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) seekToStart();
    syncPlayback();
    return () => {
      active = false;
      stopFragmentGuard();
      video.removeEventListener("loadedmetadata", seekToStart);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("playing", startFragmentGuard);
      video.removeEventListener("pause", stopFragmentGuard);
      video.removeEventListener("ended", handleEnded);
      document.removeEventListener("visibilitychange", handleVisibility);
      reducedMotion.removeEventListener("change", handleReducedMotion);
    };
  }, [autoPlay, endMs, loop, src, startMs]);

  return (
    <>
      <video
        aria-label={ariaLabel}
        autoPlay={autoPlay}
        className={`${className ?? ""} ${styles.motionMedia}`.trim()}
        data-has-poster={posterUrl ? "true" : undefined}
        loop={loop}
        muted
        playsInline
        poster={posterUrl}
        ref={videoRef}
        src={src}
        style={style}
      />
      {posterUrl ? (
        <img
          alt=""
          aria-hidden="true"
          className={`${className ?? ""} ${styles.reducedMotionPoster}`.trim()}
          src={posterUrl}
          style={style}
        />
      ) : null}
    </>
  );
}

function separator(value: MenuProductGroupPlacement["display"]["separator"]) {
  if (value === "slash") return " / ";
  if (value === "comma") return ", ";
  return " · ";
}

function focal(point: { x: number; y: number }) {
  return `${Math.round(point.x * 100)}% ${Math.round(point.y * 100)}%`;
}

function rectStyle(rect: { h: number; w: number; x: number; y: number }): CSSProperties {
  return { height: rect.h, left: rect.x, top: rect.y, width: rect.w };
}

function documentGlobal() {
  return document;
}
