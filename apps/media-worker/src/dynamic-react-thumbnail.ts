import { createHash } from "node:crypto";

import { chromium } from "playwright-core";

import {
  playerDynamicTemplatePayloadSchema,
  type PlayerDynamicTemplateAsset,
  type PlayerDynamicTemplatePayload
} from "@veyocast/contracts";

import {
  DynamicRenderBackendError,
  type ClaimedDynamicRenderJob
} from "./dynamic-render-backend";

export class ReactDomDynamicThumbnailRenderer {
  constructor(
    private readonly playerUrl: string,
    private readonly executablePath = process.env.CHROMIUM_EXECUTABLE_PATH ??
      "/usr/bin/chromium"
  ) {}

  async renderPng({
    assets,
    job,
    signal
  }: {
    assets: Record<string, PlayerDynamicTemplateAsset>;
    job: ClaimedDynamicRenderJob;
    signal?: AbortSignal;
  }) {
    const payload = buildThumbnailPayload(job, assets);
    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
    if (encoded.length > 1_500_000) throw renderFailure("payload_too_large");
    const target = new URL("/thumbnail", this.playerUrl);
    target.hash = new URLSearchParams({ payload: encoded }).toString();
    const browser = await chromium.launch({
      args: ["--disable-dev-shm-usage", "--no-sandbox"],
      executablePath: this.executablePath,
      headless: true
    });
    try {
      const page = await browser.newPage({
        deviceScaleFactor: 1,
        viewport: {
          height: job.manifest.canvas.height,
          width: job.manifest.canvas.width
        }
      });
      const abort = () => page.close().catch(() => undefined);
      signal?.addEventListener("abort", abort, { once: true });
      try {
        await page.goto(target.toString(), {
          timeout: 30_000,
          waitUntil: "domcontentloaded"
        });
        await page.waitForFunction(
          () => document.documentElement.dataset.thumbnailReady === "true",
          undefined,
          { timeout: 30_000 }
        );
        const bytes = await page.screenshot({ animations: "disabled", type: "png" });
        return new Uint8Array(bytes);
      } finally {
        signal?.removeEventListener("abort", abort);
        await page.close().catch(() => undefined);
      }
    } catch (error) {
      if (error instanceof DynamicRenderBackendError) throw error;
      throw renderFailure("browser_capture_failed");
    } finally {
      await browser.close().catch(() => undefined);
    }
  }
}

export function buildThumbnailPayload(
  job: ClaimedDynamicRenderJob,
  assets: Record<string, PlayerDynamicTemplateAsset> = {}
): PlayerDynamicTemplatePayload {
  const data = isRecord(job.snapshotData) ? job.snapshotData : {};
  const slideType = readSlideType(data.type);
  return playerDynamicTemplatePayloadSchema.parse({
    ...(Object.keys(assets).length ? { assets } : {}),
    data,
    orientation: job.orientation,
    schemaVersion: 1,
    slideType,
    snapshotHash: createHash("sha256")
      .update(JSON.stringify(data))
      .digest("hex"),
    snapshotId: job.snapshotId,
    templateSlug: `editorial-arena-${String(slideType).replaceAll("_", "-")}-${job.orientation}`,
    templateVersionId: job.snapshotId
  });
}

function readSlideType(value: unknown) {
  if ([
    "menu",
    "news",
    "sport_program",
    "sport_results",
    "sport_standing"
  ].includes(String(value))) {
    return value;
  }
  throw renderFailure("unsupported_slide_type");
}

function renderFailure(reason: string) {
  return new DynamicRenderBackendError(
    `dynamic_react_thumbnail_${reason}`,
    true,
    "De React-DOM-thumbnailcapture is tijdelijk niet beschikbaar."
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
