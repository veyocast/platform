import React from "react";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { chromium, type Browser, type Page } from "playwright-core";
import sharp from "sharp";
import {
  syncSlideAssets,
  syncSlidePresentationSchema,
  syncSystemAssets,
  syncSlideTransition,
  type SyncSlidePresentation,
} from "@veyocast/contracts";
import {
  SyncSlideStaticView,
  syncSlidePages,
} from "@veyocast/content-templates/sync-slide-static-view";
import type { StudioSvgAssetSources } from "./studio-render-svg";
import {
  captureSettledSitesRaster,
  loadSitesCaptureFonts,
  sitesCaptureBrowserArgs,
  SitesDomCaptureError,
  type SitesStudioCapture,
  type SitesCaptureFailureStage,
} from "./sites-dom-capture";

const origin = "http://sync-render.invalid";
const files = new Map(
  syncSystemAssets.map((asset) => [asset.path as string, asset]),
);
const publicDirectoryDefault = fileURLToPath(
  new URL("../../player/public/", import.meta.url),
);
const maximumAssetBytes = 24 * 1024 * 1024,
  maximumSessionBytes = 96 * 1024 * 1024;

/** Capture-only inline image transport. Public Player markup still forbids data URIs. */
export function buildSyncCaptureHtml(
  presentation: SyncSlidePresentation,
  assetSources: StudioSvgAssetSources = {},
  page = 0,
): string {
  const input = syncSlidePresentationSchema.parse(presentation);
  let totalBytes = 0;
  const sources = new Map<string, string>();
  for (const asset of syncSlideAssets(input)) {
    if (asset.kind !== "tenant") continue;
    const source = assetSources[asset.mediaAssetId],
      href = typeof source === "string" ? source : source?.href;
    if (
      !href ||
      !/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(href) ||
      Buffer.byteLength(href) > (maximumAssetBytes * 4) / 3 + 128
    )
      throw new SitesDomCaptureError("asset_integrity");
    totalBytes += Buffer.byteLength(href);
    if (totalBytes > (maximumSessionBytes * 4) / 3 + 1024)
      throw new SitesDomCaptureError("asset_integrity");
    sources.set(asset.mediaAssetId, href);
  }
  const markup = renderToStaticMarkup(
    <SyncSlideStaticView
      presentation={input}
      page={page}
      resolveAsset={(asset) =>
        asset.kind === "system" ? asset.path : sources.get(asset.mediaAssetId)
      }
    />,
  );
  return `<!doctype html><html lang="nl"><head><meta charset="utf-8"><base href="${origin}/"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src ${origin} data:; font-src ${origin}; script-src 'none'; frame-src 'none'; connect-src 'none'; object-src 'none'; base-uri ${origin}"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden}.sync-slide-root,.sync-slide-motion{width:100%;height:100%}</style></head><body><div class="sync-slide-motion">${markup}</div></body></html>`;
}

/** Exact Source DOM/CSS capture, with a verified local asset allowlist and no provider access. */
export async function createSyncSlideCapture({
  presentation,
  durationMs = 12000,
  assetSources = {},
  signal,
  publicDirectory = publicDirectoryDefault,
  executablePath = process.env.CHROMIUM_EXECUTABLE_PATH ?? "/usr/bin/chromium",
}: {
  presentation: SyncSlidePresentation;
  durationMs?: number;
  assetSources?: StudioSvgAssetSources;
  signal?: AbortSignal;
  publicDirectory?: string;
  executablePath?: string;
}): Promise<SitesStudioCapture> {
  const input = syncSlidePresentationSchema.parse(presentation),
    pages = syncSlidePages(input),
    transition=syncSlideTransition(input),
    pageMs = durationMs / pages;
  if (
    !Number.isInteger(durationMs) ||
    durationMs < 3000 ||
    durationMs > 120000 ||
    pageMs < 3000 ||
    signal?.aborted
  )
    throw new SitesDomCaptureError("document_load");
  // Check all supplied references before allocating a browser.
  buildSyncCaptureHtml(input, assetSources);
  const browser: Browser = await chromium.launch({
    args: [...sitesCaptureBrowserArgs],
    executablePath,
    headless: true,
    timeout: 15000,
  });
  const close = () => browser.close().catch(() => undefined),
    onAbort = () => {
      void close();
    };
  if (signal?.aborted) {
    await close();
    throw new SitesDomCaptureError("document_load");
  }
  signal?.addEventListener("abort", onAbort, { once: true });
  const deadline = setTimeout(
    () => {
      void close();
    },
    Math.min(300000, 60000 + durationMs * 2),
  );
  try {
    const page: Page = await browser.newPage({
      viewport:
        input.orientation === "portrait"
          ? { width: 1080, height: 1920 }
          : { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
    });
    const cache = new Map<string, Buffer>();
    let requests = 0,
      totalBytes = 0,
      assetFailed = false,
      currentPage = -1,
      currentTransitionTime=-1,
      settledPng:Buffer|undefined,
      png: Buffer | undefined,
      rgba: Buffer | undefined;
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url()),
        asset = files.get(url.pathname);
      if (
        ++requests > 1000 ||
        url.origin !== origin ||
        url.search ||
        !asset ||
        asset.bytes > maximumAssetBytes
      ) {
        assetFailed = true;
        await route.abort();
        return;
      }
      try {
        let bytes = cache.get(asset.path);
        if (!bytes) {
          bytes = await readFile(resolve(publicDirectory, asset.path.slice(1)));
          if (
            bytes.byteLength !== asset.bytes ||
            createHash("sha256").update(bytes).digest("hex") !== asset.sha256
          )
            throw new SitesDomCaptureError("asset_integrity");
          totalBytes += bytes.byteLength;
          if (totalBytes > maximumSessionBytes)
            throw new SitesDomCaptureError("asset_integrity");
          cache.set(asset.path, bytes);
        }
        await route.fulfill({
          body: bytes,
          contentType: asset.mimeType,
          status: 200,
        });
      } catch {
        assetFailed = true;
        await route.abort();
      }
    });
    page.on("pageerror", () => {
      assetFailed = true;
    });
    let failureStage: SitesCaptureFailureStage = "document_load";
    const capture = async (timeMs: number) => {
      if (signal?.aborted || !Number.isFinite(timeMs))
        throw new SitesDomCaptureError("raster_capture");
      const target = Math.min(
        pages - 1,
        Math.max(0, Math.floor(timeMs / pageMs)),
      );
      const transitionTime=transition?Math.min(transition.durationMs,Math.max(0,timeMs-target*pageMs)):0;
      if (currentPage === target && currentTransitionTime===transitionTime && png) return png;
      if(currentPage!==target){
      failureStage = "document_load";
      await page.setContent(buildSyncCaptureHtml(input, assetSources, target), {
        waitUntil: "domcontentloaded",
        timeout: 15000,
      });
      failureStage = "font_load";
      await loadSitesCaptureFonts(page);
      failureStage = "dependency_decode";
      await page.evaluate(async () => {
        await Promise.all([...document.images].map((image) => image.decode()));
        document.getAnimations().forEach((animation) => {
          animation.pause();
          animation.currentTime = 0;
        });
      });
      if (assetFailed) throw new SitesDomCaptureError("asset_integrity");
      failureStage = "raster_capture";
      settledPng = await captureSettledSitesRaster(page);
      if (assetFailed) throw new SitesDomCaptureError("asset_integrity");
      currentPage = target;
      }
      if(transition&&transitionTime<transition.durationMs){
        await page.evaluate(({transition,time})=>{
          const element=document.querySelector<HTMLElement>('.sync-slide-motion');
          if(!element)throw Error('Sync motion surface missing');
          let animation=element.getAnimations()[0];
          if(!animation)animation=element.animate([{opacity:0,transform:`translateY(${transition.offsetPx}px)`},{opacity:1,transform:'translateY(0px)'}],{duration:transition.durationMs,easing:transition.easing,fill:'both'});
          animation.pause();animation.currentTime=time;
        },{transition,time:transitionTime});
        await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
        png=await page.screenshot({type:'png',timeout:15000});
      }else{
        // Reusing the settled raster also avoids one compositor capture for
        // every unchanged frame of the remaining page duration.
        png=settledPng;
      }
      if(!png)throw new SitesDomCaptureError('raster_capture');
      currentTransitionTime=transitionTime;
      rgba = undefined;
      return png;
    };
    const safeFailure = (error: unknown) =>
      error instanceof SitesDomCaptureError
        ? error
        : new SitesDomCaptureError(failureStage);
    return {
      renderPng: async (time) => {
        try {
          return await sharp(await capture(time))
            .toColourspace("srgb")
            .withIccProfile("srgb")
            .png()
            .toBuffer();
        } catch (error) {
          throw safeFailure(error);
        }
      },
      renderRgba: async (time) => {
        try {
          const bytes = await capture(time);
          rgba ??= await sharp(bytes).ensureAlpha().raw().toBuffer();
          return rgba;
        } catch (error) {
          throw safeFailure(error);
        }
      },
      close: async () => {
        clearTimeout(deadline);
        signal?.removeEventListener("abort", onAbort);
        await close();
      },
    };
  } catch (error) {
    clearTimeout(deadline);
    signal?.removeEventListener("abort", onAbort);
    await close();
    if (error instanceof SitesDomCaptureError) throw error;
    throw new SitesDomCaptureError("document_load");
  }
}
