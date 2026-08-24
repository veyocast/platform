import {
  interpolateStudioElement,
  layoutStudioText,
  parseStudioDocument,
  studioRendererVersion,
  type StudioDocument,
  type StudioElement,
  type StudioFontFamily
} from "@veyocast/studio";

export type StudioSvgAssetSource =
  | string
  | Readonly<{
      height: number;
      href: string;
      width: number;
    }>;
export type StudioSvgAssetSources = Readonly<
  Record<string, StudioSvgAssetSource>
>;

export type RenderStudioSvgInput = {
  assetSources?: StudioSvgAssetSources;
  document: StudioDocument;
  timeMs: number;
};

const rendererFontFamilies: Record<StudioFontFamily, string> = {
  "Inter Tight Variable": "Inter Tight",
  "Inter Variable": "Inter"
};

export class StudioSvgRenderError extends Error {
  constructor(
    readonly code:
      | "asset_source_missing"
      | "asset_source_unsafe"
      | "unsupported_element",
    message: string
  ) {
    super(message);
    this.name = "StudioSvgRenderError";
  }
}

export function renderStudioSvg({
  assetSources = {},
  document: unparsedDocument,
  timeMs
}: RenderStudioSvgInput) {
  const document = parseStudioDocument(unparsedDocument);
  const { height, width } = document.artboard;
  const elements = document.elements
    .map((element, order) => ({ element, order }))
    .sort((left, right) =>
      left.element.zIndex - right.element.zIndex || left.order - right.order
    );
  const frameTime = finiteTime(timeMs, document.motion.durationMs);
  const frameElements = elements.map(({ element }) => ({
    element,
    transform: interpolateStudioElement(
      element,
      frameTime,
      document.motion.durationMs
    )
  }));
  const definitions = [
    renderBackgroundDefinition(document),
    ...elements.flatMap(({ element }) => renderElementDefinitions(element)),
    ...frameElements.map(({ element, transform }) =>
      renderFrameClipDefinition(element, transform.clipProgress)
    )
  ].filter(Boolean).join("");
  const body = frameElements.map(({ element, transform }) => {
    if (transform.opacity <= 0) return "";
    const assetSource = assetSources[element.id];
    const rendered = renderElement(element, assetSource, transform.textProgress);
    const centerX = element.x + element.width / 2;
    const centerY = element.y + element.height / 2;
    const translationX = transform.x - element.x;
    const translationY = transform.y - element.y;
    const clip = transform.clipProgress < 1
      ? ` clip-path="url(#clip-${escapeAttribute(element.id)})"`
      : "";
    return [
      `<g opacity="${number(transform.opacity)}"`,
      ` transform="translate(${number(translationX)} ${number(translationY)})`,
      ` rotate(${number(element.rotation)} ${number(centerX)} ${number(centerY)})`,
      ` translate(${number(centerX)} ${number(centerY)})`,
      ` scale(${number(transform.scaleX)} ${number(transform.scaleY)})`,
      ` translate(${number(-centerX)} ${number(-centerY)})"${clip}>`,
      rendered,
      "</g>"
    ].join("");
  }).join("");

  return [
    `<svg xmlns="http://www.w3.org/2000/svg"`,
    ` xmlns:xlink="http://www.w3.org/1999/xlink"`,
    ` width="${width}" height="${height}"`,
    ` viewBox="0 0 ${width} ${height}"`,
    ` data-studio-renderer="${studioRendererVersion}"`,
    ` color-interpolation="sRGB" shape-rendering="geometricPrecision"`,
    ` text-rendering="geometricPrecision">`,
    definitions ? `<defs>${definitions}</defs>` : "",
    renderBackground(document),
    body,
    "</svg>"
  ].join("");
}

function renderFrameClipDefinition(
  element: StudioElement,
  clipProgress: number
) {
  if (clipProgress >= 1) return "";
  return [
    `<clipPath id="clip-${escapeAttribute(element.id)}">`,
    `<rect x="${number(element.x)}" y="${number(element.y)}"`,
    ` width="${number(element.width * clipProgress)}"`,
    ` height="${number(element.height)}"/>`,
    "</clipPath>"
  ].join("");
}

function renderBackground(document: StudioDocument) {
  const { background, height, width } = document.artboard;
  if (background.kind === "transparent") return "";
  const fill = background.kind === "solid"
    ? background.color
    : "url(#studio-background)";
  return `<rect width="${width}" height="${height}" fill="${fill}"/>`;
}

function renderBackgroundDefinition(document: StudioDocument) {
  const background = document.artboard.background;
  if (background.kind !== "linear-gradient") return "";
  return renderLinearGradient(
    "studio-background",
    background.from,
    background.to,
    background.angle
  );
}

function renderElementDefinitions(element: StudioElement) {
  const definitions: string[] = [];
  if ("shadow" in element && element.shadow) {
    definitions.push([
      `<filter id="shadow-${escapeAttribute(element.id)}"`,
      ` x="-50%" y="-50%" width="200%" height="200%"`,
      ` color-interpolation-filters="sRGB">`,
      `<feDropShadow dx="${number(element.shadow.offsetX)}"`,
      ` dy="${number(element.shadow.offsetY)}"`,
      ` stdDeviation="${number(element.shadow.blur / 2)}"`,
      ` flood-color="${escapeAttribute(element.shadow.color)}"`,
      ` flood-opacity="${number(element.shadow.opacity)}"/>`,
      "</filter>"
    ].join(""));
  }
  if (element.type === "shape" && element.fill.kind === "linear-gradient") {
    definitions.push(renderLinearGradient(
      `gradient-${element.id}`,
      element.fill.from,
      element.fill.to,
      element.fill.angle
    ));
  }
  if (element.type === "image") {
    definitions.push([
      `<clipPath id="image-${escapeAttribute(element.id)}">`,
      `<rect x="${number(element.x)}" y="${number(element.y)}"`,
      ` width="${number(element.width)}" height="${number(element.height)}"`,
      ` rx="${number(element.cornerRadius)}"/>`,
      "</clipPath>"
    ].join(""));
  }
  if (element.type === "video") return definitions;
  return definitions;
}

function renderElement(
  element: StudioElement,
  assetSource: StudioSvgAssetSource | undefined,
  textProgress: number
) {
  switch (element.type) {
    case "text":
      return renderText(element, textProgress);
    case "image":
      return renderImage(element, requireSafeAssetSource(element, assetSource));
    case "video":
      return "";
    case "shape":
      return renderShape(element);
    case "icon":
      return renderIcon(element);
    case "qr":
      return renderImage(element, requireSafeAssetSource(element, assetSource));
    case "placeholder":
      return renderPlaceholder(element);
    case "group":
      return "";
    default:
      throw new StudioSvgRenderError(
        "unsupported_element",
        "Studio-document bevat een niet-ondersteund element."
      );
  }
}

function renderText(
  element: Extract<StudioElement, { type: "text" }>,
  textProgress: number
) {
  const layout = layoutStudioText(element);
  let remainingCharacters = Math.ceil(
    Array.from(element.text).length * textProgress
  );
  const lines = layout.lines.map((line) => {
    const visible = Array.from(line)
      .slice(0, Math.max(0, remainingCharacters))
      .join("");
    remainingCharacters -= Array.from(line).length + 1;
    return visible;
  });
  const textAnchor = {
    center: "middle",
    left: "start",
    right: "end"
  }[element.align];
  const x = element.align === "center"
    ? element.x + element.width / 2
    : element.align === "right"
      ? element.x + element.width - element.padding
      : element.x + element.padding;
  const contentHeight = lines.length * layout.lineHeightPx;
  const y = element.verticalAlign === "middle"
    ? element.y + (element.height - contentHeight) / 2 + layout.fontSize
    : element.verticalAlign === "bottom"
      ? element.y + element.height - contentHeight + layout.fontSize - element.padding
      : element.y + layout.fontSize + element.padding;
  const background = element.backgroundColor
    ? `<rect x="${number(element.x)}" y="${number(element.y)}"` +
      ` width="${number(element.width)}" height="${number(element.height)}"` +
      ` rx="${number(element.cornerRadius)}"` +
      commonPresentationAttributes(element, element.backgroundColor) + "/>"
    : "";
  const tspans = lines.map((line, index) =>
    `<tspan x="${number(x)}" dy="${index === 0 ? "0" : number(layout.lineHeightPx)}">` +
    `${escapeText(line)}</tspan>`
  ).join("");
  return [
    background,
    `<text x="${number(x)}" y="${number(y)}"`,
    ` fill="${escapeAttribute(element.fill)}"`,
    ` font-family="${escapeAttribute(rendererFontFamilies[element.fontFamily])}"`,
    ` font-size="${number(layout.fontSize)}"`,
    ` font-weight="${element.fontWeight}"`,
    ` letter-spacing="${number(element.letterSpacing)}"`,
    ` text-anchor="${textAnchor}"`,
    element.shadow ? ` filter="url(#shadow-${escapeAttribute(element.id)})"` : "",
    ">",
    tspans,
    "</text>"
  ].join("");
}

function renderImage(
  element: Extract<StudioElement, { type: "image" | "qr" }>,
  source: StudioSvgAssetSource
) {
  const isQr = element.type === "qr";
  const href = typeof source === "string" ? source : source.href;
  const geometry = !isQr && typeof source !== "string"
    ? fittedImageGeometry(element, source)
    : {
      height: element.height,
      width: element.width,
      x: element.x,
      y: element.y
    };
  const image = [
    `<image x="${number(geometry.x)}" y="${number(geometry.y)}"`,
    ` width="${number(geometry.width)}" height="${number(geometry.height)}"`,
    ` href="${escapeAttribute(href)}"`,
    ` preserveAspectRatio="${isQr ? "xMidYMid meet" : "none"}"`,
    isQr ? "" : ` clip-path="url(#image-${escapeAttribute(element.id)})"`,
    isQr || !element.shadow
      ? ""
      : ` filter="url(#shadow-${escapeAttribute(element.id)})"`,
    "/>"
  ].join("");
  const border = !isQr && element.border
    ? [
      `<rect x="${number(element.x)}" y="${number(element.y)}"`,
      ` width="${number(element.width)}" height="${number(element.height)}"`,
      ` rx="${number(element.cornerRadius)}" fill="none"`,
      ` stroke="${escapeAttribute(element.border.color)}"`,
      ` stroke-width="${number(element.border.width)}"/>`
    ].join("")
    : "";
  return image + border;
}

function renderShape(element: Extract<StudioElement, { type: "shape" }>) {
  const fill = element.fill.kind === "solid"
    ? element.fill.color
    : `url(#gradient-${escapeAttribute(element.id)})`;
  const presentation = commonPresentationAttributes(element, fill);
  if (element.shape === "ellipse") {
    return [
      `<ellipse cx="${number(element.x + element.width / 2)}"`,
      ` cy="${number(element.y + element.height / 2)}"`,
      ` rx="${number(element.width / 2)}"`,
      ` ry="${number(element.height / 2)}"${presentation}/>`
    ].join("");
  }
  if (element.shape === "line") {
    const stroke = element.border?.color ?? (
      element.fill.kind === "solid" ? element.fill.color : "#0A0A0A"
    );
    const strokeWidth = element.border?.width ?? Math.max(1, element.height);
    return [
      `<line x1="${number(element.x)}"`,
      ` y1="${number(element.y + element.height / 2)}"`,
      ` x2="${number(element.x + element.width)}"`,
      ` y2="${number(element.y + element.height / 2)}"`,
      ` stroke="${escapeAttribute(stroke)}"`,
      ` stroke-width="${number(strokeWidth)}" stroke-linecap="round"`,
      element.shadow ? ` filter="url(#shadow-${escapeAttribute(element.id)})"` : "",
      "/>"
    ].join("");
  }
  return [
    `<rect x="${number(element.x)}" y="${number(element.y)}"`,
    ` width="${number(element.width)}" height="${number(element.height)}"`,
    ` rx="${number(element.cornerRadius)}"${presentation}/>`
  ].join("");
}

function renderIcon(element: Extract<StudioElement, { type: "icon" }>) {
  const glyph = iconGlyph(element.icon);
  const scaleX = element.width / 24;
  const scaleY = element.height / 24;
  return [
    `<g transform="translate(${number(element.x)} ${number(element.y)})`,
    ` scale(${number(scaleX)} ${number(scaleY)})"`,
    ` fill="${escapeAttribute(element.fill)}"`,
    element.strokeWidth > 0
      ? ` stroke="${escapeAttribute(element.fill)}" stroke-width="${number(element.strokeWidth / Math.max(scaleX, scaleY))}"`
      : "",
    ">",
    glyph,
    "</g>"
  ].join("");
}

function renderPlaceholder(
  element: Extract<StudioElement, { type: "placeholder" }>
) {
  return [
    `<rect x="${number(element.x)}" y="${number(element.y)}"`,
    ` width="${number(element.width)}" height="${number(element.height)}"`,
    ` fill="${escapeAttribute(element.fill)}"`,
    ` stroke="${escapeAttribute(element.stroke)}" stroke-width="2"`,
    ` stroke-dasharray="12 8"/>`,
    `<text x="${number(element.x + element.width / 2)}"`,
    ` y="${number(element.y + element.height / 2)}"`,
    ` fill="${escapeAttribute(element.stroke)}" font-family="Inter"`,
    ` font-size="${number(Math.min(36, element.height / 5))}"`,
    ` font-weight="600" text-anchor="middle" dominant-baseline="middle">`,
    escapeText(element.label),
    "</text>"
  ].join("");
}

function commonPresentationAttributes(
  element: Extract<StudioElement, { type: "shape" | "text" }>,
  fill: string
) {
  return [
    ` fill="${escapeAttribute(fill)}"`,
    element.border
      ? ` stroke="${escapeAttribute(element.border.color)}"` +
        ` stroke-width="${number(element.border.width)}"`
      : "",
    element.shadow ? ` filter="url(#shadow-${escapeAttribute(element.id)})"` : ""
  ].join("");
}

function renderLinearGradient(
  id: string,
  from: string,
  to: string,
  angle: number
) {
  const radians = ((angle - 90) * Math.PI) / 180;
  const x = Math.cos(radians);
  const y = Math.sin(radians);
  const x1 = 0.5 - x / 2;
  const y1 = 0.5 - y / 2;
  const x2 = 0.5 + x / 2;
  const y2 = 0.5 + y / 2;
  return [
    `<linearGradient id="${escapeAttribute(id)}"`,
    ` x1="${number(x1)}" y1="${number(y1)}"`,
    ` x2="${number(x2)}" y2="${number(y2)}">`,
    `<stop offset="0" stop-color="${escapeAttribute(from)}"/>`,
    `<stop offset="1" stop-color="${escapeAttribute(to)}"/>`,
    "</linearGradient>"
  ].join("");
}

function fittedImageGeometry(
  element: Extract<StudioElement, { type: "image" }>,
  source: Readonly<{ height: number; width: number }>
) {
  const scale = element.objectFit === "cover"
    ? Math.max(element.width / source.width, element.height / source.height)
    : Math.min(element.width / source.width, element.height / source.height);
  const width = source.width * scale;
  const height = source.height * scale;
  const overflowX = width - element.width;
  const overflowY = height - element.height;
  return {
    height,
    width,
    x: element.x - overflowX * element.focusX,
    y: element.y - overflowY * element.focusY
  };
}

function requireSafeAssetSource(
  element: StudioElement,
  source?: StudioSvgAssetSource
) {
  if (!source) {
    throw new StudioSvgRenderError(
      "asset_source_missing",
      `Renderbron ontbreekt voor Studio-element ${element.id}.`
    );
  }
  const href = typeof source === "string" ? source : source.href;
  if (
    !href.startsWith("data:image/") ||
    (typeof source !== "string" &&
      (!Number.isFinite(source.width) ||
        source.width <= 0 ||
        !Number.isFinite(source.height) ||
        source.height <= 0))
  ) {
    throw new StudioSvgRenderError(
      "asset_source_unsafe",
      `Renderbron voor Studio-element ${element.id} gebruikt een onveilige URL.`
    );
  }
  return source;
}

function iconGlyph(icon: Extract<StudioElement, { type: "icon" }>["icon"]) {
  if (icon === "star") {
    return '<path d="M12 2.5l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3.1-5.8 3.1 1.1-6.5-4.7-4.6 6.5-.9z"/>';
  }
  if (icon === "heart") {
    return '<path d="M12 21s-8-4.8-8-11a4.5 4.5 0 018-2.8A4.5 4.5 0 0120 10c0 6.2-8 11-8 11z"/>';
  }
  if (icon === "clock") {
    return '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2" fill="none" stroke="currentColor" stroke-width="2"/>';
  }
  if (icon === "calendar") {
    return '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4" fill="none" stroke="currentColor" stroke-width="2"/>';
  }
  if (icon === "location") {
    return '<path d="M12 22s7-7 7-13A7 7 0 105 9c0 6 7 13 7 13z"/><circle cx="12" cy="9" r="2.5" fill="currentColor"/>';
  }
  return '<rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="12" cy="12" r="4" fill="currentColor"/>';
}

function finiteTime(timeMs: number, durationMs: number) {
  if (!Number.isFinite(timeMs)) return 0;
  return Math.min(durationMs, Math.max(0, timeMs));
}

function number(value: number) {
  const normalized = Math.abs(value) < 0.000_5 ? 0 : value;
  return normalized.toFixed(3).replace(/\.?0+$/, "");
}

function escapeText(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeAttribute(value: string) {
  return escapeText(value)
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
