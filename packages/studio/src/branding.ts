import { studioPalette } from "./constants";
import { parseStudioDocument, type StudioDocument, type StudioElement } from "./schema";

export type StudioBrandKit = Readonly<{
  logoMediaAssetId: string;
  primaryColor: string;
  secondaryColor: string;
}>;

export function applyStudioBrandKit(
  document: StudioDocument,
  brand: StudioBrandKit
): StudioDocument {
  const colors = new Map([
    [studioPalette.electricOrange.toUpperCase(), brand.primaryColor.toUpperCase()],
    [studioPalette.warmOrange.toUpperCase(), brand.secondaryColor.toUpperCase()]
  ]);
  const replaceColor = (color: string) =>
    colors.get(color.toUpperCase()) ?? color.toUpperCase();

  return parseStudioDocument({
    ...document,
    artboard: {
      ...document.artboard,
      background:
        document.artboard.background.kind === "linear-gradient"
          ? {
              ...document.artboard.background,
              from: replaceColor(document.artboard.background.from),
              to: replaceColor(document.artboard.background.to)
            }
          : document.artboard.background.kind === "solid"
            ? {
                ...document.artboard.background,
                color: replaceColor(document.artboard.background.color)
              }
            : document.artboard.background
    },
    elements: document.elements.map((element) =>
      applyBrandToElement(element, brand.logoMediaAssetId, replaceColor)
    ),
    metadata: {
      ...document.metadata,
      tenantBrandApplied: true
    }
  });
}

function applyBrandToElement(
  element: StudioElement,
  logoMediaAssetId: string,
  replaceColor: (color: string) => string
): StudioElement {
  if (element.type === "placeholder" && element.slot === "tenant-logo") {
    return {
      alt: "Clublogo",
      cornerRadius: 0,
      focusX: 0.5,
      focusY: 0.5,
      groupId: element.groupId,
      height: element.height,
      id: element.id,
      locked: element.locked,
      mediaAssetId: logoMediaAssetId,
      name: element.name,
      objectFit: "contain",
      opacity: element.opacity,
      rotation: element.rotation,
      timing: element.timing,
      type: "image",
      variant: "original",
      visible: element.visible,
      width: element.width,
      x: element.x,
      y: element.y,
      zIndex: element.zIndex
    };
  }

  switch (element.type) {
    case "text":
      return {
        ...element,
        ...brandStyle(element, replaceColor),
        backgroundColor: element.backgroundColor
          ? replaceColor(element.backgroundColor)
          : undefined,
        fill: replaceColor(element.fill)
      };
    case "shape":
      return {
        ...element,
        ...brandStyle(element, replaceColor),
        fill:
          element.fill.kind === "solid"
            ? { ...element.fill, color: replaceColor(element.fill.color) }
            : {
                ...element.fill,
                from: replaceColor(element.fill.from),
                to: replaceColor(element.fill.to)
              }
      };
    case "icon":
      return { ...element, fill: replaceColor(element.fill) };
    case "qr":
      return {
        ...element,
        background: replaceColor(element.background),
        foreground: replaceColor(element.foreground)
      };
    case "placeholder":
      return {
        ...element,
        fill: replaceColor(element.fill),
        stroke: replaceColor(element.stroke)
      };
    case "image":
      return { ...element, ...brandStyle(element, replaceColor) };
    case "video":
      return element;
    case "group":
      return element;
  }
}

function brandStyle(
  element: Extract<StudioElement, { type: "image" | "shape" | "text" }>,
  replaceColor: (color: string) => string
) {
  return {
    ...(element.border
      ? {
          border: {
            ...element.border,
            color: replaceColor(element.border.color)
          }
        }
      : {}),
    ...(element.shadow
      ? {
          shadow: {
            ...element.shadow,
            color: replaceColor(element.shadow.color)
          }
        }
      : {})
  };
}
