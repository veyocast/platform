import { createRequire } from "node:module";

import { Resvg } from "@resvg/resvg-js";
import QRCode from "qrcode";
import sharp from "sharp";

import {
  StudioImageRenderError,
  throwIfAborted,
  type StudioExternalRenderer
} from "./studio-render-image";

const require = createRequire(import.meta.url);
const studioFontFiles = [
  require.resolve(
    "@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf"
  ),
  require.resolve(
    "@expo-google-fonts/inter/500Medium/Inter_500Medium.ttf"
  ),
  require.resolve(
    "@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.ttf"
  ),
  require.resolve(
    "@expo-google-fonts/inter/700Bold/Inter_700Bold.ttf"
  ),
  require.resolve(
    "@expo-google-fonts/inter/800ExtraBold/Inter_800ExtraBold.ttf"
  ),
  require.resolve(
    "@expo-google-fonts/inter-tight/400Regular/InterTight_400Regular.ttf"
  ),
  require.resolve(
    "@expo-google-fonts/inter-tight/500Medium/InterTight_500Medium.ttf"
  ),
  require.resolve(
    "@expo-google-fonts/inter-tight/600SemiBold/InterTight_600SemiBold.ttf"
  ),
  require.resolve(
    "@expo-google-fonts/inter-tight/700Bold/InterTight_700Bold.ttf"
  ),
  require.resolve(
    "@expo-google-fonts/inter-tight/800ExtraBold/InterTight_800ExtraBold.ttf"
  ),
  require.resolve(
    "@expo-google-fonts/manrope/400Regular/Manrope_400Regular.ttf"
  ),
  require.resolve(
    "@expo-google-fonts/manrope/500Medium/Manrope_500Medium.ttf"
  ),
  require.resolve(
    "@expo-google-fonts/manrope/600SemiBold/Manrope_600SemiBold.ttf"
  ),
  require.resolve(
    "@expo-google-fonts/manrope/700Bold/Manrope_700Bold.ttf"
  ),
  require.resolve(
    "@expo-google-fonts/manrope/800ExtraBold/Manrope_800ExtraBold.ttf"
  ),
  require.resolve(
    "@expo-google-fonts/roboto/400Regular/Roboto_400Regular.ttf"
  ),
  require.resolve(
    "@expo-google-fonts/roboto/500Medium/Roboto_500Medium.ttf"
  ),
  require.resolve(
    "@expo-google-fonts/roboto/700Bold/Roboto_700Bold.ttf"
  ),
  require.resolve(
    "@expo-google-fonts/roboto/900Black/Roboto_900Black.ttf"
  )
];
const studioFontFamilies = ["Inter", "Inter Tight", "Manrope", "Roboto"] as const;
let studioFontsValidated = false;

export class ResvgSharpStudioRenderer implements StudioExternalRenderer {
  async renderPng(input: {
    height: number;
    signal?: AbortSignal;
    svg: string;
    width: number;
  }) {
    throwIfAborted(input.signal);
    const raster = renderSvg(input.svg);
    const output = await sharp(raster, { failOn: "error" })
      .resize(input.width, input.height, {
        fit: "fill",
        kernel: sharp.kernel.lanczos3
      })
      .withIccProfile("srgb")
      .png({
        adaptiveFiltering: false,
        compressionLevel: 9,
        palette: false,
        progressive: false
      })
      .toBuffer();
    throwIfAborted(input.signal);
    return output;
  }

  async renderRgba(input: {
    height: number;
    signal?: AbortSignal;
    svg: string;
    width: number;
  }) {
    throwIfAborted(input.signal);
    const raster = renderSvg(input.svg);
    const { data, info } = await sharp(raster, { failOn: "error" })
      .resize(input.width, input.height, {
        fit: "fill",
        kernel: sharp.kernel.lanczos3
      })
      .ensureAlpha()
      .raw({ depth: "uchar" })
      .toBuffer({ resolveWithObject: true });
    throwIfAborted(input.signal);
    if (
      info.width !== input.width ||
      info.height !== input.height ||
      info.channels !== 4 ||
      data.byteLength !== input.width * input.height * 4
    ) {
      throw new StudioImageRenderError(
        "renderer_output_invalid",
        "Externe Studio-renderer leverde geen exact RGBA-frame op."
      );
    }
    return data;
  }

  async renderQrSvgDataUri(input: {
    background: string;
    errorCorrection: "H" | "L" | "M" | "Q";
    foreground: string;
    value: string;
  }) {
    const svg = await QRCode.toString(input.value, {
      color: {
        dark: input.foreground,
        light: input.background
      },
      errorCorrectionLevel: input.errorCorrection,
      margin: 0,
      type: "svg"
    });
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  }
}

function renderSvg(svg: string) {
  validateStudioRendererFonts();
  return createResvg(svg).render().asPng();
}

export function validateStudioRendererFonts() {
  if (studioFontsValidated) return;

  for (const family of studioFontFamilies) {
    const probe = createResvg(
      [
        '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="48">',
        `<text x="4" y="37" fill="#FFFFFF" font-family="${family}"`,
        ' font-size="32" font-weight="700">VeyoCast</text>',
        "</svg>"
      ].join(""),
      "__VeyoCastMissingFont__"
    ).render();
    const hasVisibleGlyph = probe.pixels.some(
      (channel, index) => index % 4 === 3 && channel > 0
    );
    if (!hasVisibleGlyph) {
      throw new StudioImageRenderError(
        "renderer_font_unavailable",
        `Studio-renderer kan het verplichte lettertype ${family} niet laden.`
      );
    }
  }

  studioFontsValidated = true;
}

function createResvg(svg: string, defaultFontFamily = "Inter") {
  return new Resvg(svg, {
    fitTo: { mode: "original" },
    font: {
      defaultFontFamily,
      fontFiles: studioFontFiles,
      loadSystemFonts: false
    }
  });
}
