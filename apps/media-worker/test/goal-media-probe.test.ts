import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { inspectGoalMedia } from "../src/goal-media-probe";
import type { VideoProbe } from "../src/video-normalization";

const tenantId = "10000000-0000-4000-8000-000000000001";
const assetId = "20000000-0000-4000-8000-000000000002";
const bytes = Buffer.from("000000086d6f6f76000000086d646174", "hex");
const asset = {
  storage_bucket: "tenant-media",
  storage_path: `tenants/${tenantId}/assets/${assetId}/original/goal.mp4`,
  checksum_sha256: createHash("sha256").update(bytes).digest("hex"),
  mime_type: "video/mp4"
};
const metadata: VideoProbe = {
  audioCodec: null, durationSeconds: 15, formatNames: ["mp4"], framesPerSecond: 24,
  height: 1080, width: 1920, pixelFormat: "yuv420p", rotationDegrees: 0, videoCodec: "h264"
};

describe("protected goal media inspection", () => {
  it.each([0, 90, 270])("reports the actual uploaded raster and display rotation %s independently", async (rotationDegrees) => {
    let inspectedPath = "";
    const result = await inspectGoalMedia({ tenantId, assetId, asset, orientation: "portrait",
      download: async () => new Blob([bytes]),
      probe: async (path) => {
        inspectedPath = path;
        expect(await readFile(path)).toEqual(bytes);
        return { ...metadata, rotationDegrees };
      }
    });
    expect(result).toMatchObject({
      checksum: asset.checksum_sha256, rasterMatchesSlot: false,
      displayMatchesSlot: rotationDegrees !== 0,
      displayWidth: rotationDegrees === 0 ? 1920 : 1080,
      displayHeight: rotationDegrees === 0 ? 1080 : 1920, fastStart: true
    });
    expect(JSON.stringify(result)).not.toContain("tenants/");
    await expect(access(inspectedPath)).rejects.toThrow();
  });

  it("does not substitute the original for a published variant", async () => {
    const files = new Map([
      [asset.storage_path, bytes],
      [`tenants/${tenantId}/assets/${assetId}/variants/player-1080p.mp4`, Buffer.from("published")]
    ]);
    const download = vi.fn(async (_bucket: string, path: string) => new Blob([files.get(path)!]));
    for (const [path, sourceBytes] of files) {
      const result = await inspectGoalMedia({ tenantId, assetId, orientation: "landscape", download,
        asset: { ...asset, storage_path: path, checksum_sha256: createHash("sha256").update(sourceBytes).digest("hex") },
        probe: async () => metadata
      });
      expect(result.checksum).toBe(createHash("sha256").update(sourceBytes).digest("hex"));
    }
    expect(download.mock.calls.map((call) => call[1])).toEqual([...files.keys()]);
  });

  it("includes sample aspect ratio when interpreting the original display orientation", async () => {
    const result = await inspectGoalMedia({ tenantId, assetId, asset, orientation: "portrait",
      download: async () => new Blob([bytes]),
      probe: async () => ({ ...metadata, sampleAspectRatio: "81:256" })
    });
    expect(result).toMatchObject({ rasterMatchesSlot: false, displayMatchesSlot: true,
      displayWidth: 607.5, displayHeight: 1080 });
  });

  it.each([
    { storage_bucket: "other" },
    { storage_path: `tenants/other/assets/${assetId}/original/goal.mp4` },
    { storage_path: `tenants/${tenantId}/assets/other/original/goal.mp4` },
    { storage_path: `tenants/${tenantId}/assets/${assetId}/../goal.mp4` }
  ])("rejects out-of-scope storage before downloading", async (overrides) => {
    const download = vi.fn();
    await expect(inspectGoalMedia({ tenantId, assetId, asset: { ...asset, ...overrides },
      orientation: "portrait", download })).rejects.toThrow("ASSET_SCOPE_INVALID");
    expect(download).not.toHaveBeenCalled();
  });

  it("rejects changed bytes before probing", async () => {
    const probe = vi.fn();
    await expect(inspectGoalMedia({ tenantId, assetId, asset, orientation: "portrait", probe,
      download: async () => new Blob(["changed"]) })).rejects.toThrow("ASSET_CHECKSUM_FAILED");
    expect(probe).not.toHaveBeenCalled();
  });

  it("cleans up an original even when its decoder fails", async () => {
    let inspectedPath = "";
    await expect(inspectGoalMedia({ tenantId, assetId, asset, orientation: "portrait",
      download: async () => new Blob([bytes]),
      probe: async (path) => { inspectedPath = path; throw new Error("decoder failed"); }
    })).rejects.toThrow("decoder failed");
    await expect(access(inspectedPath)).rejects.toThrow();
  });
});
