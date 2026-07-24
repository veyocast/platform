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
    "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2"
  ),
  require.resolve(
    "@fontsource-variable/inter-tight/files/inter-tight-latin-wght-normal.woff2"
  )
];

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
  return new Resvg(svg, {
    fitTo: { mode: "original" },
    font: {
      defaultFontFamily: "Inter Variable",
      fontFiles: studioFontFiles,
      loadSystemFonts: false
    }
  }).render().asPng();
}
