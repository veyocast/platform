import { describe, expect, it } from "vitest";
import { syncSlidePresentationSchema, syncBackgroundScenes } from "@veyocast/contracts";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import sharp from "sharp";
import {
  buildSyncCaptureHtml,
  createSyncSlideCapture,
} from "../src/sync-dom-capture";

function input() {
  return syncSlidePresentationSchema.parse({
    schemaVersion: 1,
    rendererVersion: "sync-v1",
    sourceRevision: "8b1fdf1f8637dda23d48ecdaf08e0e5978e2707a",
    family: "fixtures",
    orientation: "landscape",
    theme: "fieldflow",
    name: "Programma",
    club: { name: "Club A" },
    title: "Ons programma",
    rows: Array.from({ length: 5 }, (_, index) => [
      `Club A ${index + 1}`,
      `Club B ${index + 1}`,
      "11:00",
      "2",
    ]),
    style: {},
  });
}
describe("Sync capture policy", () => {
  it("renders each selected photograph as the actual two-page Source background in both orientations", () => {
    for (const scene of syncBackgroundScenes) for (const orientation of ["landscape", "portrait"] as const) {
      const asset = scene[orientation], presentation = { ...input(), orientation, style: { ...input().style, background: "photo" as const, backgroundPosition: "right" as const, backgroundAsset: { kind: "system" as const, path: asset.path, checksumSha256: asset.sha256 } } };
      for (const page of [0, 1]) {
        const html = buildSyncCaptureHtml(presentation, {}, page);
        expect(html).toContain(asset.path); expect(html).toContain("background-position:right");
        expect(html).toContain("linear-gradient(90deg,rgba(6,19,45,.92),rgba(6,19,45,.3))");
        expect(html).toContain(page ? "Club A 5" : "Club A 1");
        expect(html).toContain("connect-src 'none'");
      }
    }
  });
  it("keeps Source markup, authored text escaping and a network-denying CSP", () => {
    const html = buildSyncCaptureHtml({
      ...input(),
      title: "<script>fetch('https://attacker.invalid')</script>",
    });
    expect(html).toContain("script-src 'none'");
    expect(html).toContain("connect-src 'none'");
    expect(html).toContain("frame-src 'none'");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("Club A 1");
    expect(html).not.toContain("Club A 5");
    expect(buildSyncCaptureHtml(input(), {}, 1)).toContain("Club A 5");
  });
  it("requires all referenced tenant images and refuses arbitrary image URLs", () => {
    const asset = {
        kind: "tenant" as const,
        mediaAssetId: "22600000-0000-4000-8000-000000000001",
        checksumSha256: "a".repeat(64),
      },
      presentation = {
        ...input(),
        club: { name: "Club A", tagline: "", logo: asset },
      };
    for (const sources of [
      {},
      { [asset.mediaAssetId]: "https://attacker.invalid/image.png" },
      { [asset.mediaAssetId]: "data:image/svg+xml;base64,PHN2Zy8+" },
    ])
      expect(() => buildSyncCaptureHtml(presentation, sources)).toThrowError(
        expect.objectContaining({ failureStage: "asset_integrity" }),
      );
  });
  it("refuses too-short page budgets before allocating a browser", async () => {
    await expect(
      createSyncSlideCapture({ presentation: input(), durationMs: 3000 }),
    ).rejects.toMatchObject({
      code: "studio_sites_capture_failed",
      failureStage: "document_load",
    });
    const controller = new AbortController();
    controller.abort();
    await expect(
      createSyncSlideCapture({
        presentation: input(),
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ code: "studio_sites_capture_failed" });
  });
});
describe.runIf(Boolean(process.env.SITES_CAPTURE_TEST_CHROMIUM))(
  "actual Sync Chromium capture",
  () => {
    for (const orientation of ["landscape", "portrait"] as const) for (const scene of syncBackgroundScenes) {
      it(`${scene.label} ${orientation}: captures the real approved photograph on every full binary page`, async () => {
        const asset = scene[orientation], base = input();
        const presentation = { ...base, orientation, style: { ...base.style, background: "photo" as const, backgroundPosition: "right" as const, backgroundAsset: { kind: "system" as const, path: asset.path, checksumSha256: asset.sha256 } } };
        const capture = await createSyncSlideCapture({ presentation, durationMs: 6000, executablePath: process.env.SITES_CAPTURE_TEST_CHROMIUM! });
        const baseline = await createSyncSlideCapture({ presentation: { ...base, orientation }, durationMs: 6000, executablePath: process.env.SITES_CAPTURE_TEST_CHROMIUM! });
        try {
          const first = await capture.renderPng(400), last = await capture.renderPng(5999);
          expect(await sharp(first).metadata()).toMatchObject({ width: orientation === "landscape" ? 1920 : 1080, height: orientation === "landscape" ? 1080 : 1920 });
          expect(first).not.toEqual(last); expect(first).not.toEqual(await baseline.renderPng(400)); expect(last).not.toEqual(await baseline.renderPng(5999));
          expect(await capture.renderPng(5999)).toEqual(last);
          const crop = { left: orientation === "landscape" ? 1780 : 940, top: 10, width: 40, height: 40 };
          expect(await sharp(first).extract(crop).raw().toBuffer()).toEqual(await sharp(last).extract(crop).raw().toBuffer());
        } finally { await capture.close(); await baseline.close(); }
      }, 45000);
    }
    it.each(["missing", "changed"])("refuses a %s gallery image before a binary can complete", async fault => {
      const directory = await mkdtemp(join(tmpdir(), "s238-capture-")), asset = syncBackgroundScenes[0].landscape, base = input();
      await symlink(resolve("../player/public/assets"), join(directory, "assets"));
      await mkdir(join(directory, "onzetrots/website-brush"), { recursive: true });
      if (fault === "changed") await writeFile(join(directory, asset.path), Buffer.alloc(asset.bytes, 1));
      const capture = await createSyncSlideCapture({ presentation: { ...base, style: { ...base.style, background: "photo", backgroundAsset: { kind: "system", path: asset.path, checksumSha256: asset.sha256 } } }, durationMs: 6000, publicDirectory: directory, executablePath: process.env.SITES_CAPTURE_TEST_CHROMIUM! });
      try { await expect(capture.renderPng(400)).rejects.toMatchObject({ code: "studio_sites_capture_failed" }); }
      finally { await capture.close(); await rm(directory, { recursive: true, force: true }); }
    }, 45000);
    it('captures the actual selected transition and settles to the unchanged full Source page',async()=>{
      const base=input(),still=await createSyncSlideCapture({presentation:base,durationMs:6000,executablePath:process.env.SITES_CAPTURE_TEST_CHROMIUM!}),animated=await createSyncSlideCapture({presentation:{...base,style:{...base.style,motion:'dynamisch'}},durationMs:6000,executablePath:process.env.SITES_CAPTURE_TEST_CHROMIUM!});
      try{
        const first=await animated.renderPng(0),middle=await animated.renderPng(200),settled=await animated.renderPng(400);
        expect(first).not.toEqual(middle);expect(middle).not.toEqual(settled);
        expect(settled).toEqual(await still.renderPng(400));
        expect(await animated.renderPng(1800)).toEqual(settled);
        expect(await animated.renderPng(3000)).toEqual(first);
        expect(await animated.renderPng(3400)).toEqual(await still.renderPng(3400));
      }finally{await animated.close();await still.close();}
    },60000);
    for (const orientation of ["landscape", "portrait"] as const)
      for (const theme of ["fieldflow", "onzetrots-tv"] as const)
        it(`${theme} ${orientation}: verified Source assets and both data pages`, async () => {
          const capture = await createSyncSlideCapture({
            presentation: {
              ...input(),
              orientation,
              theme,
              style: {
                ...input().style,
                background: theme === "onzetrots-tv" ? "clubmuur" : "stadium",
              },
            },
            durationMs: 12000,
            executablePath: process.env.SITES_CAPTURE_TEST_CHROMIUM!,
          });
          try {
            const first = await capture.renderPng(1200),
              second = await capture.renderPng(7200);
            expect(await sharp(first).metadata()).toMatchObject({
              width: orientation === "landscape" ? 1920 : 1080,
              height: orientation === "landscape" ? 1080 : 1920,
            });
            expect(first).not.toEqual(second);
            expect(await capture.renderPng(7200)).toEqual(second);
            expect((await capture.renderRgba(7200)).byteLength).toBe(
              1920 * 1080 * 4,
            );
          } finally {
            await capture.close();
          }
        }, 45000);
    it("fails closed when a frozen font or background file is absent", async () => {
      const capture = await createSyncSlideCapture({
        presentation: input(),
        publicDirectory: "/tmp/s226-deliberately-missing-source-assets",
        executablePath: process.env.SITES_CAPTURE_TEST_CHROMIUM!,
      });
      try {
        await expect(capture.renderPng(1200)).rejects.toMatchObject({
          code: "studio_sites_capture_failed",
        });
      } finally {
        await capture.close();
      }
    }, 45000);
  },
);
