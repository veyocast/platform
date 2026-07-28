import { describe, expect, it, vi } from "vitest";

import type {
  ClaimedDynamicRenderJob,
  DynamicRenderBackend
} from "../src/dynamic-render-backend";
import { runDynamicRenderOnce } from "../src/dynamic-render-runner";

const job: ClaimedDynamicRenderJob = {
  css: ".title{fill:#111}",
  jobId: "3da36dd4-f01e-4860-9ee8-51b522cf4115",
  manifest: {
    allowedFields: [
      { path: "menu.title", required: true, type: "string" }
    ],
    canvas: { height: 1080, width: 1920 },
    engine: "veyocast-safe-template-v1",
    maxCollectionItems: 20,
    schemaVersion: 1,
    slideType: "menu"
  },
  markup: '<text class="title">{{menu.title}}</text>',
  orientation: "landscape",
  outputMediaAssetId: "3c772cb0-ed5b-43b3-b085-22fab24943a2",
  slideName: "Menu",
  snapshotData: { menu: { title: "Kantine" } },
  snapshotId: "5f02f609-f9d5-4cec-85de-8ff0a9fb0272",
  tenantId: "731e1d87-ec25-42df-bdee-6843e1b3b20a"
};

describe("dynamic render worker", () => {
  it("rendert, uploadt en voltooit exact één immutable PNG", async () => {
    const backend = backendMock(job);
    const renderer = {
      renderPng: vi.fn().mockResolvedValue(Buffer.from("png")),
      renderQrSvgDataUri: vi.fn(),
      renderRgba: vi.fn()
    };
    const result = await runDynamicRenderOnce({
      backend,
      config: { lockTimeoutSeconds: 120, maxAttempts: 3, workerId: "worker-1" },
      renderer
    });

    expect(result.status).toBe("completed");
    expect(renderer.renderPng).toHaveBeenCalledWith(
      expect.objectContaining({ height: 1080, width: 1920 })
    );
    expect(backend.uploadArtifact).toHaveBeenCalledOnce();
    expect(backend.completeJob).toHaveBeenCalledOnce();
    expect(backend.failJob).not.toHaveBeenCalled();
  });

  it("markeert onveilige templates definitief mislukt", async () => {
    const unsafeJob = { ...job, markup: "<script>alert(1)</script>" };
    const backend = backendMock(unsafeJob);
    vi.mocked(backend.failJob).mockResolvedValue("failed");
    const result = await runDynamicRenderOnce({
      backend,
      config: { lockTimeoutSeconds: 120, maxAttempts: 3, workerId: "worker-1" },
      renderer: {
        renderPng: vi.fn(),
        renderQrSvgDataUri: vi.fn(),
        renderRgba: vi.fn()
      }
    });

    expect(result).toMatchObject({
      errorCode: "template_invalid_markup",
      status: "failed"
    });
    expect(backend.failJob).toHaveBeenCalledWith(
      unsafeJob,
      "worker-1",
      expect.objectContaining({ retryable: false })
    );
  });
});

function backendMock(
  claimed: ClaimedDynamicRenderJob | null
): DynamicRenderBackend {
  return {
    claimJob: vi.fn().mockResolvedValue(claimed),
    completeJob: vi.fn().mockResolvedValue(undefined),
    failJob: vi.fn().mockResolvedValue("queued"),
    uploadArtifact: vi.fn().mockResolvedValue(undefined)
  };
}
