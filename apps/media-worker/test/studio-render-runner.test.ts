import { createEmptyStudioDocument } from "@veyocast/studio";
import { describe, expect, it, vi } from "vitest";

import type {
  ClaimedStudioRenderJob,
  StudioRenderBackend
} from "../src/studio-render-backend";
import type { StudioExternalRenderer } from "../src/studio-render-image";
import {
  runStudioRenderLoop,
  runStudioRenderOnce
} from "../src/studio-render-runner";

const job: ClaimedStudioRenderJob = {
  assetManifest: [],
  attemptCount: 1,
  designId: "10000000-0000-4000-8000-000000000001",
  document: createEmptyStudioDocument("landscape-hd", {
    background: "#141414"
  }),
  jobId: "20000000-0000-4000-8000-000000000002",
  mediaAssetId: "30000000-0000-4000-8000-000000000003",
  outputType: "png",
  revisionId: "40000000-0000-4000-8000-000000000004",
  sourceAssets: [],
  tenantId: "50000000-0000-4000-8000-000000000005"
};
const config = {
  lockTimeoutSeconds: 900,
  maxAttempts: 3,
  workerId: "worker:studio"
};

describe("Studio render runner", () => {
  it("moves a PNG render through atomic states and canonical media paths", async () => {
    const backend = createBackend();
    const renderer = createRenderer();

    await expect(runStudioRenderOnce({
      backend,
      config,
      renderer
    })).resolves.toEqual({
      jobId: job.jobId,
      mediaAssetId: job.mediaAssetId,
      status: "completed"
    });

    expect(backend.updateJob.mock.calls.map(([input]) => input.status)).toEqual([
      "preparing",
      "rendering",
      "uploading",
      "creating_media"
    ]);
    expect(backend.uploadArtifact).toHaveBeenNthCalledWith(
      1,
      job,
      expect.stringMatching(/studio-output\.png$/),
      `tenants/${job.tenantId}/assets/${job.mediaAssetId}/original/studio-output.png`,
      "image/png"
    );
    expect(backend.uploadArtifact).toHaveBeenNthCalledWith(
      2,
      job,
      expect.stringMatching(/studio-poster\.png$/),
      `tenants/${job.tenantId}/assets/${job.mediaAssetId}/variants/studio-poster.png`,
      "image/png"
    );
    expect(backend.completeJob).toHaveBeenCalledWith(expect.objectContaining({
      result: expect.objectContaining({
        durationMs: 0,
        height: 1080,
        mimeType: "image/png",
        width: 1920
      })
    }));
  });

  it("honours a database cancellation before expensive rendering", async () => {
    const backend = createBackend();
    backend.updateJob.mockResolvedValueOnce({
      cancelRequested: true,
      leaseValid: true
    });
    backend.failJob.mockResolvedValue("cancelled");
    const renderer = createRenderer();

    await expect(runStudioRenderOnce({
      backend,
      config,
      renderer
    })).resolves.toMatchObject({
      errorCode: "render_cancelled",
      status: "cancelled"
    });
    expect(renderer.renderPng).not.toHaveBeenCalled();
    expect(backend.failJob).toHaveBeenCalledWith(expect.objectContaining({
      errorCode: "render_cancelled",
      retryable: false
    }));
  });

  it("polls until aborted without starting parallel Studio renders", async () => {
    const controller = new AbortController();
    const backend = createBackend();
    backend.claimJob
      .mockResolvedValueOnce(null)
      .mockImplementationOnce(() => {
        controller.abort();
        return Promise.resolve(null);
      });
    const results: string[] = [];

    await runStudioRenderLoop({
      backend,
      config,
      intervalMs: 1,
      onResult: (result) => results.push(result.status),
      renderer: createRenderer(),
      signal: controller.signal
    });

    expect(results).toEqual(["idle", "idle"]);
    expect(backend.claimJob).toHaveBeenCalledTimes(2);
  });
});

function createBackend() {
  return {
    claimJob: vi.fn().mockResolvedValue(job),
    completeJob: vi.fn().mockResolvedValue(undefined),
    downloadAsset: vi.fn().mockResolvedValue(undefined),
    failJob: vi.fn().mockResolvedValue("failed"),
    updateJob: vi.fn().mockResolvedValue({
      cancelRequested: false,
      leaseValid: true
    }),
    uploadArtifact: vi.fn().mockResolvedValue(undefined)
  } satisfies StudioRenderBackend;
}

function createRenderer() {
  return {
    renderPng: vi.fn().mockResolvedValue(fakePng(1920, 1080)),
    renderRgba: vi.fn()
  } satisfies StudioExternalRenderer;
}

function fakePng(width: number, height: number) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("sRGB", Buffer.from([0])),
    chunk("IDAT", Buffer.from([0])),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

function chunk(type: string, data: Buffer) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const payload = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(payload));
  return Buffer.concat([
    length,
    payload,
    crc
  ]);
}

function crc32(value: Uint8Array) {
  let crc = 0xffff_ffff;
  for (const byte of value) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb8_8320 : 0);
    }
  }
  return (crc ^ 0xffff_ffff) >>> 0;
}
