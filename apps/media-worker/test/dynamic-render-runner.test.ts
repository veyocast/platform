import { describe, expect, it, vi } from "vitest";

import {
  collectDynamicRenderAssetIds,
  type ClaimedDynamicRenderJob,
  type DynamicRenderBackend
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
  it("neemt bezoekerlogo's mee in de echte snapshotthumbnail", () => {
    const logoId = "50000000-0000-5000-8000-000000001291";
    expect(collectDynamicRenderAssetIds({
      sport: {
        items: [{ logoMediaAssetId: logoId, primary: "Bezoekers FC" }]
      }
    })).toContain(logoId);
  });

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

  it("gebruikt React-DOM primair en de immutable SVG-PNG als fallback", async () => {
    const backend = backendMock({
      ...job,
      snapshotData: { menu: { title: "Kantine" }, type: "menu" }
    });
    const fallback = {
      renderPng: vi.fn().mockResolvedValue(Buffer.from("fallback")),
      renderQrSvgDataUri: vi.fn(),
      renderRgba: vi.fn()
    };
    const reactDomRenderer = {
      renderPng: vi.fn().mockRejectedValue(new Error("chromium offline"))
    };
    const result = await runDynamicRenderOnce({
      backend,
      config: { lockTimeoutSeconds: 120, maxAttempts: 3, workerId: "worker-1" },
      reactDomRenderer: reactDomRenderer as never,
      renderer: fallback
    });

    expect(result.status).toBe("completed");
    expect(reactDomRenderer.renderPng).toHaveBeenCalledOnce();
    expect(fallback.renderPng).toHaveBeenCalledOnce();
  });

  it("maakt de prijslijstthumbnail met dezelfde 9-rijpaginering", async () => {
    const priceJob: ClaimedDynamicRenderJob = {
      ...job,
      css: ".bg{fill:#070a0e}",
      manifest: {
        allowedFields: [{ path: "priceList.title", required: true, type: "string" }],
        canvas: { height: 1080, width: 1920 },
        engine: "veyocast-safe-template-v1",
        maxCollectionItems: 100,
        schemaVersion: 1,
        slideType: "price_list"
      },
      markup: "<text>{{priceList.title}}</text>",
      snapshotData: {
        brand: { clubName: "Duindorp sv", primaryColor: "#315CFF" },
        priceList: {
          sections: [{
            column: "left",
            id: "drinks",
            name: "Dranken",
            order: 0,
            products: Array.from({ length: 10 }, (_, index) => ({
              description: "Koud",
              formattedPrice: "€ 2,50",
              id: `product-${index + 1}`,
              name: `Product ${index + 1}`
            }))
          }],
          title: "Prijslijst"
        }
      }
    };
    const backend = backendMock(priceJob);
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
    const renderInput = vi.mocked(renderer.renderPng).mock.calls[0]?.[0];
    expect(renderInput?.svg).toContain("Product 8");
    expect(renderInput?.svg).not.toContain("Product 9");
    expect(renderInput?.svg).toContain("1 / 2");
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
