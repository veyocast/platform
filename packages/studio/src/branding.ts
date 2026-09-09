import { studioPalette, studioRoyalCurrentPalette } from "./constants";
import {
  createRoyalCurrentPalette,
  normalizeClubHex,
  royalCurrentEditorialTokens,
  type RoyalCurrentMode
} from "./royal-current-theme";
import { parseStudioDocument, type StudioDocument, type StudioElement } from "./schema";

export type StudioBrandKit = Readonly<{
  background?: "club" | "neutral";
  logoMediaAssetId: string;
  mode?: RoyalCurrentMode;
  primaryColor: string;
  secondaryColor: string;
}>;

export type StudioResolvedBrandPalette = ReturnType<
  typeof resolveStudioBrandPalette
>;

export function resolveStudioBrandPalette(brand: StudioBrandKit) {
  const mode = brand.mode ?? "glass";
  const configuration = {
    background: brand.background ?? "club",
    primary: normalizeClubHex(brand.primaryColor) ?? "#2459ed",
    secondary: normalizeClubHex(brand.secondaryColor),
    version: 1 as const
  };
  const royal = createRoyalCurrentPalette(configuration, mode);
  const editorial = royalCurrentEditorialTokens(
    configuration,
    mode === "glass" ? "dark" : "light"
  );
  return {
    accent: royal["--accent"].toUpperCase(),
    accentSoft: royal["--accent-soft"].toUpperCase(),
    background: royal["--bg"].toUpperCase(),
    brandPrimary: royal["--brand-primary"].toUpperCase(),
    canvasEnd: royal["--canvas-end"].toUpperCase(),
    canvasStart: royal["--canvas-start"].toUpperCase(),
    danger: editorial.danger.toUpperCase(),
    deep: royal["--deep"].toUpperCase(),
    flowAccent: royal["--flow-accent"].toUpperCase(),
    ink: royal["--ink"].toUpperCase(),
    line: royal["--line"].toUpperCase(),
    muted: royal["--muted"].toUpperCase(),
    onAccent: royal["--on-accent"].toUpperCase(),
    ownBackground: royal["--own-bg"].toUpperCase(),
    ownInk: royal["--own-ink"].toUpperCase(),
    ownLine: royal["--own-line"].toUpperCase(),
    ownMuted: royal["--own-muted"].toUpperCase(),
    qrInk: editorial.qrInk.toUpperCase(),
    qrSurface: editorial.qrSurface.toUpperCase(),
    secondaryAccent: royal["--secondary-accent"].toUpperCase(),
    solidAccent: royal["--solid-accent"].toUpperCase(),
    success: editorial.success.toUpperCase(),
    surface: royal["--surface"].toUpperCase(),
    surfaceRaised: royal["--surface-2"].toUpperCase(),
    warning: editorial.warning.toUpperCase()
  } as const;
}

export function applyStudioBrandKit(
  document: StudioDocument,
  brand: StudioBrandKit
): StudioDocument {
  const resolved = resolveStudioBrandPalette(brand);
  const replaceColor = createStudioColorResolver(resolved);

  return parseStudioDocument({
    ...document,
    artboard: {
      ...document.artboard,
      background:
        document.artboard.background.kind === "linear-gradient"
          ? {
              ...document.artboard.background,
              from: replaceColor(document.artboard.background.from, "canvas-start"),
              to: replaceColor(document.artboard.background.to, "canvas-end")
            }
          : document.artboard.background.kind === "solid"
            ? {
                ...document.artboard.background,
                color: replaceColor(document.artboard.background.color, "background")
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
  replaceColor: (color: string, hint?: string) => string
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
          ? replaceColor(element.backgroundColor, element.id)
          : undefined,
        fill: replaceColor(element.fill, element.id)
      };
    case "shape":
      return {
        ...element,
        ...brandStyle(element, replaceColor),
        fill:
          element.fill.kind === "solid"
            ? { ...element.fill, color: replaceColor(element.fill.color, element.id) }
            : {
                ...element.fill,
                from: replaceColor(element.fill.from, `${element.id}-from`),
                to: replaceColor(element.fill.to, `${element.id}-to`)
              }
      };
    case "icon":
      return { ...element, fill: replaceColor(element.fill, element.id) };
    case "qr":
      return {
        ...element,
        background: replaceColor(element.background, "qr-surface"),
        foreground: replaceColor(element.foreground, "qr-ink")
      };
    case "placeholder":
      return {
        ...element,
        fill: replaceColor(element.fill, `${element.id}-surface`),
        stroke: replaceColor(element.stroke, `${element.id}-accent`)
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
  replaceColor: (color: string, hint?: string) => string
) {
  return {
    ...(element.border
      ? {
          border: {
            ...element.border,
            color: replaceColor(element.border.color, `${element.id}-line`)
          }
        }
      : {}),
    ...(element.shadow
      ? {
          shadow: {
            ...element.shadow,
            color: replaceColor(element.shadow.color, `${element.id}-shadow`)
          }
        }
      : {})
  };
}

function createStudioColorResolver(resolved: StudioResolvedBrandPalette) {
  const semanticColors = new Map<string, string>([
    [studioRoyalCurrentPalette.accent.toUpperCase(), resolved.accent],
    [studioRoyalCurrentPalette.accentSoft.toUpperCase(), resolved.accentSoft],
    [studioRoyalCurrentPalette.background.toUpperCase(), resolved.background],
    [studioRoyalCurrentPalette.canvasEnd.toUpperCase(), resolved.canvasEnd],
    [studioRoyalCurrentPalette.canvasStart.toUpperCase(), resolved.canvasStart],
    [studioRoyalCurrentPalette.danger.toUpperCase(), resolved.danger],
    [studioRoyalCurrentPalette.deep.toUpperCase(), resolved.deep],
    [studioRoyalCurrentPalette.ink.toUpperCase(), resolved.ink],
    [studioRoyalCurrentPalette.line.toUpperCase(), resolved.line],
    [studioRoyalCurrentPalette.muted.toUpperCase(), resolved.muted],
    [studioRoyalCurrentPalette.onAccent.toUpperCase(), resolved.onAccent],
    [studioRoyalCurrentPalette.ownBackground.toUpperCase(), resolved.ownBackground],
    [studioRoyalCurrentPalette.ownInk.toUpperCase(), resolved.ownInk],
    [studioRoyalCurrentPalette.ownLine.toUpperCase(), resolved.ownLine],
    [studioRoyalCurrentPalette.ownMuted.toUpperCase(), resolved.ownMuted],
    [studioRoyalCurrentPalette.qrInk.toUpperCase(), resolved.qrInk],
    [studioRoyalCurrentPalette.qrSurface.toUpperCase(), resolved.qrSurface],
    [studioRoyalCurrentPalette.success.toUpperCase(), resolved.success],
    [studioRoyalCurrentPalette.surface.toUpperCase(), resolved.surface],
    [studioRoyalCurrentPalette.surfaceRaised.toUpperCase(), resolved.surfaceRaised],
    [studioRoyalCurrentPalette.warning.toUpperCase(), resolved.warning],
    [studioPalette.electricOrange.toUpperCase(), resolved.solidAccent],
    [studioPalette.fieldflowOrange.toUpperCase(), resolved.solidAccent],
    [studioPalette.fieldflowPetrol.toUpperCase(), resolved.background],
    [studioPalette.fieldflowDarkPetrol.toUpperCase(), resolved.deep],
    [studioPalette.fieldflowCloud.toUpperCase(), resolved.ink],
    [studioPalette.warmOrange.toUpperCase(), resolved.flowAccent],
    [studioPalette.fieldflowGreen.toUpperCase(), resolved.flowAccent]
  ]);

  return (color: string, hint = "") => {
    const source = color.toUpperCase();
    if (hint.includes("qr-surface")) return resolved.qrSurface;
    if (hint.includes("qr-ink")) return resolved.qrInk;
    if (hint.includes("canvas-start")) return resolved.canvasStart;
    if (hint.includes("canvas-end")) return resolved.canvasEnd;
    if (hint.includes("flow-")) {
      return source.endsWith("00")
        ? `${resolved.flowAccent.slice(0, 7)}00`
        : resolved.flowAccent;
    }
    if (hint === "accent-block") return resolved.solidAccent;
    return semanticColors.get(source) ?? source;
  };
}
