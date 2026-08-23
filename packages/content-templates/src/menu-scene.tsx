"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties
} from "react";

import {
  menuDocumentV2Schema,
  type MenuBlock,
  type MenuDocumentV2,
  type MenuMoney,
  type MenuProductGroupPlacement,
  type MenuProductPlacement
} from "@veyocast/contracts";

import { freezeThemePresentation, themeCssVariables } from "./theme-catalog";
import styles from "./menu-scene.module.css";

export const MENU_SCENE_RENDERER_VERSION = "2.0.0";
export const MENU_SCENE_CONTENT_FIT_VERSION = "dom-measured-2.0.0";

export const menuSceneCanvases = {
  landscape: { height: 1080, width: 1920 },
  portrait: { height: 1920, width: 1080 }
} as const;

export const menuSceneZones = {
  landscape: {
    body: { h: 704, w: 1728, x: 96, y: 248 },
    footer: { h: 48, w: 1728, x: 96, y: 984 },
    header: { h: 152, w: 1728, x: 96, y: 72 }
  },
  portrait: {
    body: { h: 1388, w: 936, x: 72, y: 348 },
    footer: { h: 64, w: 936, x: 72, y: 1760 },
    header: { h: 228, w: 936, x: 72, y: 96 }
  }
} as const;

export function resolveMenuSceneScale(
  stage: { height: number; width: number },
  orientation: keyof typeof menuSceneCanvases
) {
  const canvas = menuSceneCanvases[orientation];
  if (stage.width <= 0 || stage.height <= 0) return 0;
  return Math.min(stage.width / canvas.width, stage.height / canvas.height);
}

export type MenuSceneAsset = {
  kind: "animation" | "image" | "logo" | "video";
  mimeType?: string;
  posterUrl?: string;
  url: string;
};

export type MenuSceneRow =
  | { continuation: boolean; id: string; kind: "category"; label: string; subtitle: string }
  | { id: string; kind: "product"; product: MenuProductPlacement }
  | { group: MenuProductGroupPlacement; id: string; kind: "product-group" };

type MenuFlowBlock = Extract<MenuBlock, { type: "category" | "product-group" }>;
type MenuFloatingBlock = Exclude<MenuBlock, MenuFlowBlock>;

export type ResolvedMenuScenePage = {
  columnCount: 1 | 2;
  columns: { left: MenuSceneRow[]; right: MenuSceneRow[] };
  durationMs: number;
  floatingBlocks: MenuFloatingBlock[];
  id: string;
  pageCount: number;
  pageIndex: number;
  sourcePageId: string;
  underfilled: boolean;
};

export function resolveMenuScenePages(
  value: unknown,
  orientation: keyof typeof menuSceneCanvases
): ResolvedMenuScenePage[] {
  const parsed = menuDocumentV2Schema.safeParse(value);
  if (!parsed.success) return [];
  const result: Omit<ResolvedMenuScenePage, "pageCount" | "pageIndex">[] = [];
  for (const page of [...parsed.data.pages].sort(
    (left, right) => left.order - right.order || left.id.localeCompare(right.id)
  )) {
    const flowing = page.blocks.filter(
      (block): block is MenuFlowBlock =>
        block.type === "category" || block.type === "product-group"
    );
    const floatingBlocks = page.blocks.filter(
      (block): block is MenuFloatingBlock =>
        block.type !== "category" && block.type !== "product-group"
    );
    const columnCount = orientation === "landscape"
      ? 2
      : page.portraitColumns ?? (usesTwoPortraitColumns(flowing) ? 2 : 1);
    const byColumn = orientation === "portrait" && columnCount === 1
      ? { left: flowing, right: [] }
      : {
          left: flowing.filter((block) => blockColumn(block, orientation) === "left"),
          right: flowing.filter((block) => blockColumn(block, orientation) === "right")
        };
    const left = paginateColumn(
      byColumn.left,
      orientation,
      firstPageCapacity(floatingBlocks, orientation, "left")
    );
    const right = paginateColumn(
      byColumn.right,
      orientation,
      firstPageCapacity(floatingBlocks, orientation, "right")
    );
    const derivedCount = Math.max(1, left.length, right.length);
    for (let index = 0; index < derivedCount; index += 1) {
      const activeFloatingBlocks = index === 0
        ? floatingBlocks.filter((block) => !block.hidden)
        : [];
      result.push({
        columnCount,
        columns: { left: left[index] ?? [], right: right[index] ?? [] },
        durationMs: page.durationMs ?? 8_000,
        floatingBlocks: index === 0 ? floatingBlocks : [],
        id: `${page.id}:scene:${index}`,
        sourcePageId: page.id,
        underfilled: orientation === "portrait" && activeFloatingBlocks.length === 0 &&
          rowCost(left[index] ?? []) < 14
      });
    }
  }
  return result.map((page, pageIndex) => ({
    ...page,
    pageCount: result.length,
    pageIndex
  }));
}

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
  style
}: {
  assets: Record<string, MenuSceneAsset>;
  document: MenuDocumentV2;
  onContentFit?: (overflow: boolean) => void;
  orientation: keyof typeof menuSceneCanvases;
  page: ResolvedMenuScenePage;
  style?: CSSProperties;
}) {
  const canvasRef = useRef<HTMLElement>(null);
  const zones = menuSceneZones[orientation];
  const themePresentation = freezeThemePresentation({
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
  const rootStyle = {
    ...themeCssVariables(themePresentation),
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
      data-theme-mode={document.theme.mode}
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
  return (
    <article className={styles.product} data-available={product.snapshotFallback.available} data-menu-row>
      <MediaThumb asset={asset ?? null} label={product.snapshotFallback.name} />
      <span className={styles.productCopy}>
        <strong>{product.nameOverride ?? product.snapshotFallback.name}</strong>
        {product.snapshotFallback.variantLabel ? (
          <small>{product.snapshotFallback.variantLabel}</small>
        ) : <small aria-hidden="true">&nbsp;</small>}
      </span>
      <b>{formatMenuMoney(product.snapshotFallback.price)}</b>
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
        <strong>{group.title}</strong>
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
    const seekToStart = () => {
      if (Number.isFinite(video.duration)) {
        video.currentTime = Math.min(startSeconds, Math.max(0, video.duration - 0.01));
      }
    };
    const syncPlayback = () => {
      if (document.hidden || reducedMotion.matches || !autoPlay) {
        video.pause();
        return;
      }
      void video.play().catch(() => undefined);
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
    const handleReducedMotion = () => syncPlayback();
    const handleVisibility = () => syncPlayback();

    video.addEventListener("loadedmetadata", seekToStart);
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("ended", handleEnded);
    document.addEventListener("visibilitychange", handleVisibility);
    reducedMotion.addEventListener("change", handleReducedMotion);
    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) seekToStart();
    syncPlayback();
    return () => {
      video.removeEventListener("loadedmetadata", seekToStart);
      video.removeEventListener("timeupdate", handleTimeUpdate);
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

export function resolveMenuGroupPrice(group: MenuProductGroupPlacement) {
  const linkedPrices = group.secondaryLineItems.flatMap((line) =>
    line.kind === "linked-product" && line.snapshotFallback.available
      ? [line.snapshotFallback.price]
      : []
  );
  if (group.pricePolicy === "separate") return "";
  if (group.pricePolicy === "shared") {
    return group.sharedPrice ? formatMenuMoney(group.sharedPrice) : "";
  }
  const lowest = linkedPrices.reduce<MenuMoney | null>((current, price) => {
    if (!current || price.amountMinor < current.amountMinor) return price;
    return current;
  }, null);
  return lowest ? `Vanaf ${formatMenuMoney(lowest)}` : "";
}

export function formatMenuMoney(money: MenuMoney) {
  try {
    return new Intl.NumberFormat("nl-NL", {
      currency: money.currency,
      style: "currency"
    }).format(money.amountMinor / 100);
  } catch {
    return `${money.currency} ${(money.amountMinor / 100).toFixed(2)}`;
  }
}

function paginateColumn(
  blocks: MenuFlowBlock[],
  orientation: keyof typeof menuSceneCanvases,
  reservedFirstPageCapacity?: number
) {
  const capacity = orientation === "portrait" ? 22 : 8;
  const headingCost = orientation === "portrait" ? 2 : 1;
  const pages: MenuSceneRow[][] = [];
  let current: MenuSceneRow[] = [];
  let used = 0;
  let pageCapacity = Math.min(capacity, reservedFirstPageCapacity ?? capacity);
  const flush = () => {
    if (current.length) pages.push(current);
    current = [];
    used = 0;
    pageCapacity = capacity;
  };

  for (const block of [...blocks].sort(
    (left, right) => left.order - right.order || left.id.localeCompare(right.id)
  )) {
    if (block.type === "product-group") {
      const cost = groupCost(block.group);
      if (used + cost > pageCapacity) flush();
      current.push({ group: block.group, id: block.id, kind: "product-group" });
      used += cost;
      continue;
    }
    const nodes = [...block.productNodes].sort(
      (left, right) => left.order - right.order || left.id.localeCompare(right.id)
    );
    if (!nodes.length) continue;
    let offset = 0;
    let continuation = false;
    while (offset < nodes.length) {
      const remaining = pageCapacity - used;
      const minimumNodeCount = Math.min(3, nodes.length - offset);
      const minimumCost = headingCost + nodes
        .slice(offset, offset + minimumNodeCount)
        .reduce((total, node) => total + nodeCost(node), 0);
      if (used > 0 && remaining < minimumCost) {
        flush();
        continue;
      }
      current.push({
        continuation,
        id: `${block.id}:${continuation ? "continuation" : "category"}:${pages.length}`,
        kind: "category",
        label: block.labelOverride ?? block.source.sourceName,
        subtitle: block.subtitle ?? ""
      });
      used += headingCost;
      const startOffset = offset;
      while (offset < nodes.length) {
        const node = nodes[offset]!;
        const cost = nodeCost(node);
        if (used + cost > pageCapacity) break;
        current.push(node.kind === "product"
          ? { id: node.id, kind: "product", product: node }
          : { group: node, id: node.id, kind: "product-group" });
        used += cost;
        offset += 1;
      }
      const remainder = nodes.length - offset;
      if (remainder > 0 && remainder < 3 && offset - startOffset > 3) {
        const moveCount = 3 - remainder;
        current.splice(-moveCount, moveCount);
        offset -= moveCount;
        used = rowCost(current, orientation);
      }
      if (offset < nodes.length) {
        flush();
        continuation = true;
      }
    }
  }
  flush();
  return pages;
}

function firstPageCapacity(
  blocks: MenuFloatingBlock[],
  orientation: keyof typeof menuSceneCanvases,
  column: "left" | "right"
) {
  const base = orientation === "portrait" ? 22 : 8;
  const body = menuSceneZones[orientation].body;
  const columnWidth = orientation === "portrait"
    ? body.w
    : (body.w - 36) / 2;
  const columnLeft = orientation === "portrait" || column === "left"
    ? body.x
    : body.x + columnWidth + 36;
  const columnRight = columnLeft + columnWidth;
  const firstBlockTop = blocks.reduce<number>((top, block) => {
    if (block.hidden) return top;
    const layout = block.layout[orientation];
    const blockRight = layout.x + layout.w;
    if (blockRight <= columnLeft || layout.x >= columnRight) return top;
    return Math.min(top, layout.y - body.y);
  }, body.h);
  if (firstBlockTop >= body.h) return base;
  const rowHeight = orientation === "portrait" ? 62 : 78;
  const reserved = Math.floor(Math.max(0, firstBlockTop - 24) / rowHeight);
  return Math.max(3, Math.min(base, reserved));
}

function groupCost(group: MenuProductGroupPlacement) {
  const titleLines = Math.max(1, Math.ceil(group.title.length / 40));
  return Math.max(group.display.maxLines, titleLines + group.display.maxLines - 1);
}

function nodeCost(node: MenuProductPlacement | MenuProductGroupPlacement) {
  if (node.kind === "product-group") return groupCost(node);
  const name = node.nameOverride ?? node.snapshotFallback.name;
  const nameLines = Math.max(1, Math.ceil(name.length / 42));
  const metaLines = node.snapshotFallback.variantLabel ? 1 : 0;
  return Math.max(1, Math.ceil((nameLines * 30 + metaLines * 20 + 12) / 62));
}

function rowCost(
  rows: MenuSceneRow[],
  orientation: keyof typeof menuSceneCanvases = "portrait"
) {
  const headingCost = orientation === "portrait" ? 2 : 1;
  return rows.reduce((total, row) => total + (
    row.kind === "category"
      ? headingCost
      : row.kind === "product-group"
        ? groupCost(row.group)
        : nodeCost(row.product)
  ), 0);
}

function blockColumn(
  block: MenuFlowBlock,
  orientation: keyof typeof menuSceneCanvases
) {
  const layout = block.layout[orientation];
  return layout.x + layout.w / 2 <= menuSceneCanvases[orientation].width / 2
    ? "left"
    : "right";
}

function usesTwoPortraitColumns(blocks: MenuFlowBlock[]) {
  return blocks.some((block) => block.layout.portrait.w < 700);
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
