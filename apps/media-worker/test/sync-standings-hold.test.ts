import { beforeAll, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { chromium, type CDPSession, type Page } from "playwright-core";
import { syncSlideMinimumDurationMs, syncSlidePresentationSchema, syncSlideRendererAssets } from "@veyocast/contracts";
import { createSyncSlideCapture, hasStaticSyncStandingsCaptureImages } from "../src/sync-dom-capture";

const animatedPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAACGFjVEwAAAACAAAAAPONk3AAAAAaZmNUTAAAAAAAAAACAAAAAgAAAAAAAAAAAAEACgAA6FTcAAAAABFJREFUeJxj+M/A8B+EGWAMAEfKB/lnWW63AAAAGmZjVEwAAAABAAAAAgAAAAIAAAAAAAAAAAABAAoAAHMnNtQAAAAUZmRBVAAAAAJ4nGNgYPj/H4KhDAA/0gf51gDBTQAAAABJRU5ErkJggg==", "base64");
const mediaAssetId = "29600000-0000-4000-8000-000000000001";
const checksum = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
function input() {
  return syncSlidePresentationSchema.parse({
    schemaVersion: 1, rendererVersion: "sync-onzetrots-v9", sourceRevision: "5ba52a657d6d16ad103ba2fb43b8db18aa83715a",
    family: "standings", orientation: "landscape", theme: "onzetrots-tv", name: "Eigen volledige ranglijst", title: "De ranglijst",
    club: { name: "Eigen club" }, rows: Array.from({ length: 14 }, (_, index) => [String(index + 1), `Eigen team ${index + 1}`, "12", String(40 - index)]),
    rowsPerPage: 6, ownRowIndexes: [5], style: { motion: "rustig" }, visual: { schemaVersion: 1, mode: "light", scrollSpeed: "normal", panelOpacity: 94 },
  });
}
function withImage(bytes: Buffer) {
  const presentation = input();
  presentation.club.logo = { kind: "tenant", mediaAssetId, checksumSha256: checksum(bytes) };
  return presentation;
}
function riffChunk(name: string, bytes: Buffer) {
  const header = Buffer.alloc(8); header.write(name); header.writeUInt32LE(bytes.length, 4);
  return Buffer.concat([header, bytes, ...(bytes.length % 2 ? [Buffer.alloc(1)] : [])]);
}
async function animatedWebp() {
  const stills = await Promise.all(["#ff0000", "#0000ff"].map(background => sharp({ create: { width: 2, height: 2, channels: 4, background } }).webp({ lossless: true }).toBuffer()));
  const extended = Buffer.alloc(10); extended[0] = 2; extended.writeUIntLE(1, 4, 3); extended.writeUIntLE(1, 7, 3);
  const frames = stills.map(bytes => {
    const header = Buffer.alloc(16); header.writeUIntLE(1, 6, 3); header.writeUIntLE(1, 9, 3); header.writeUIntLE(100, 12, 3);
    return riffChunk("ANMF", Buffer.concat([header, bytes.subarray(12)]));
  });
  const body = Buffer.concat([Buffer.from("WEBP"), riffChunk("VP8X", extended), riffChunk("ANIM", Buffer.alloc(6)), ...frames]);
  const header = Buffer.alloc(8); header.write("RIFF"); header.writeUInt32LE(body.length, 4);
  return Buffer.concat([header, body]);
}
let systemBytes: Map<string, Buffer>, staticPng: Buffer, webp: Buffer;
beforeAll(async () => {
  systemBytes = new Map(await Promise.all(syncSlideRendererAssets(input()).filter(asset => asset.mimeType.startsWith("image/")).map(async asset => [asset.path, await readFile(fileURLToPath(new URL(`../../player/public${asset.path}`, import.meta.url)))] as const)));
  staticPng = await sharp({ create: { width: 2, height: 2, channels: 4, background: "#ff0000" } }).png().toBuffer();
  webp = await animatedWebp();
});

describe("verified standings image clocks", () => {
  it("accepts actual pinned built-in bytes and checksum-bound static tenant PNG", async () => {
    expect(await hasStaticSyncStandingsCaptureImages(input(), {}, systemBytes)).toBe(true);
    expect(await hasStaticSyncStandingsCaptureImages(withImage(staticPng), { [mediaAssetId]: `data:image/png;base64,${staticPng.toString("base64")}` }, systemBytes)).toBe(true);
  });
  it("retains normal capture for a missing or changed pinned built-in", async () => {
    const [path, original] = systemBytes.entries().next().value!;
    const missing = new Map(systemBytes); missing.delete(path);
    const changed = new Map(systemBytes); changed.set(path, Buffer.from(original).fill(0, 0, 1));
    expect(await hasStaticSyncStandingsCaptureImages(input(), {}, missing)).toBe(false);
    expect(await hasStaticSyncStandingsCaptureImages(input(), {}, changed)).toBe(false);
  });
  it("retains normal capture for unknown, unverified or undecodable tenant image bytes", async () => {
    const presentation = withImage(staticPng), invalid = Buffer.from("not a raster");
    expect(await hasStaticSyncStandingsCaptureImages(presentation, {}, systemBytes)).toBe(false);
    expect(await hasStaticSyncStandingsCaptureImages(presentation, { [mediaAssetId]: "https://example.invalid/image.png" }, systemBytes)).toBe(false);
    expect(await hasStaticSyncStandingsCaptureImages(presentation, { [mediaAssetId]: `data:image/png;base64,${animatedPng.toString("base64")}` }, systemBytes)).toBe(false);
    expect(await hasStaticSyncStandingsCaptureImages(withImage(invalid), { [mediaAssetId]: `data:image/png;base64,${invalid.toString("base64")}` }, systemBytes)).toBe(false);
  });
  it("detects real two-frame APNG and WebP instead of assuming a raster MIME is static", async () => {
    expect(animatedPng.readUInt32BE(animatedPng.indexOf(Buffer.from("acTL")) + 4)).toBe(2);
    expect((await sharp(webp, { animated: true }).metadata()).pages).toBe(2);
    for (const [mime, bytes] of [["png", animatedPng], ["webp", webp]] as const)
      expect(await hasStaticSyncStandingsCaptureImages(withImage(bytes), { [mediaAssetId]: `data:image/${mime};base64,${bytes.toString("base64")}` }, systemBytes)).toBe(false);
  });
  it("keeps other Source families and historical renderer profiles on their existing paths", async () => {
    expect(await hasStaticSyncStandingsCaptureImages({ ...input(), family: "period-standings" }, {}, systemBytes)).toBe(false);
    const historical = syncSlidePresentationSchema.parse({ schemaVersion: 1, rendererVersion: "sync-v1", sourceRevision: "8b1fdf1f8637dda23d48ecdaf08e0e5978e2707a", family: "standings", orientation: "landscape", theme: "onzetrots-tv", name: "Historische ranglijst", title: "De ranglijst", club: { name: "Eigen club" }, rows: [], style: {} });
    expect(await hasStaticSyncStandingsCaptureImages(historical, {}, systemBytes)).toBe(false);
  });
});

describe.runIf(Boolean(process.env.SITES_CAPTURE_TEST_CHROMIUM))("actual native standings holds", () => {
  for (const mode of ["static", "unfinished", "infinite", "apng", "webp"] as const) {
    it(`${mode}: preserves complete frames and only reuses proven finished static holds`, async () => {
      let actualPage: Page | undefined;
      const sessions: CDPSession[] = [], launch = chromium.launch.bind(chromium);
      const spy = vi.spyOn(chromium, "launch").mockImplementation(async options => {
        const browser = await launch(options), newPage = browser.newPage.bind(browser);
        vi.spyOn(browser, "newPage").mockImplementation(async options => {
          const page = actualPage = await newPage(options), context = page.context(), connect = context.newCDPSession.bind(context);
          vi.spyOn(context, "newCDPSession").mockImplementation(async target => {
            const session = await connect(target); vi.spyOn(session, "send"); sessions.push(session); return session;
          });
          if (mode === "unfinished" || mode === "infinite") {
            const setContent = page.setContent.bind(page);
            vi.spyOn(page, "setContent").mockImplementation(async (...args) => {
              await setContent(...args);
              await page.evaluate(mode => document.querySelector(".rank-panel")?.animate([{ opacity: .5 }, { opacity: 1 }], { duration: mode === "unfinished" ? 120000 : 1000, iterations: mode === "infinite" ? Infinity : 1, fill: "both" }), mode);
            });
          }
          return page;
        });
        return browser;
      });
      const animated = mode === "apng" ? animatedPng : mode === "webp" ? webp : undefined;
      const presentation = animated ? withImage(animated) : input();
      const assetSources: Record<string, string> = animated ? { [mediaAssetId]: `data:image/${mode === "apng" ? "png" : "webp"};base64,${animated.toString("base64")}` } : {};
      let capture: Awaited<ReturnType<typeof createSyncSlideCapture>> | undefined;
      const screenshots = () => sessions.reduce((count, session) => count + vi.mocked(session.send).mock.calls.filter(([method]) => method === "Page.captureScreenshot").length, 0);
      try {
        capture = await createSyncSlideCapture({ presentation, assetSources, durationMs: syncSlideMinimumDurationMs(presentation), executablePath: process.env.SITES_CAPTURE_TEST_CHROMIUM! });
        await capture.renderRgba(0);
        const range = await actualPage!.evaluate(() => { const list = document.querySelector<HTMLElement>("[data-ot-rank-list]")!; return list.scrollHeight - list.clientHeight; });
        expect(range).toBeGreaterThan(0);
        const start = 2500 + range / 30 * 1000, end = start + 2500;
        await capture.renderRgba(start - 1000 / 30);
        const first = await capture.renderRgba(start), afterFirst = screenshots();
        const middle = await capture.renderRgba(start + 1000);
        if (mode === "static") {
          expect(middle).toBe(first); expect(screenshots()).toBe(afterFirst);
          expect(await capture.renderRgba(end)).toBe(first); expect(screenshots()).toBe(afterFirst);
          expect(checksum(await capture.renderRgba(end + 1000 / 30))).not.toBe(checksum(first)); expect(screenshots()).toBe(afterFirst + 1);
          const fresh = await capture.renderRgba(start);
          expect(fresh).not.toBe(first); expect(screenshots()).toBe(afterFirst + 2);
          expect(await capture.renderRgba(start + 1000)).toBe(fresh); expect(screenshots()).toBe(afterFirst + 2);
          await capture.renderRgba(1200); expect(screenshots()).toBe(afterFirst + 3);
          await capture.renderRgba(start); expect(screenshots()).toBe(afterFirst + 4);
        } else expect(screenshots()).toBe(afterFirst + 1);
      } finally { await capture?.close(); spy.mockRestore(); }
    }, 60000);
  }
});
