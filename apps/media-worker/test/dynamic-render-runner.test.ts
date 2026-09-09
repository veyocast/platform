import { describe, expect, it, vi } from "vitest";

import { editorialArenaActiveSlideTypes } from "@veyocast/contracts";

import {
  collectDynamicRenderAssetIds,
  resolveDynamicRenderAssets,
  type ClaimedDynamicRenderJob,
  type DynamicRenderBackend
} from "../src/dynamic-render-backend";
import { buildThumbnailPayload } from "../src/dynamic-react-thumbnail";
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
  it("bouwt React-DOM-thumbnails voor iedere gedeelde Editorial Arena-slide", () => {
    for (const slideType of editorialArenaActiveSlideTypes) {
      expect(buildThumbnailPayload({
        ...job,
        snapshotData: { type: slideType }
      })).toMatchObject({
        slideType,
        templateSlug: `editorial-arena-${slideType.replaceAll("_", "-")}-landscape`
      });
    }
  });

  it("laat de afzonderlijke LED-renderer niet door de Editorial Arena-capture lopen", () => {
    expect(() => buildThumbnailPayload({
      ...job,
      snapshotData: { type: "ledscores_live_match" }
    })).toThrow(expect.objectContaining({
      code: "dynamic_react_thumbnail_unsupported_slide_type"
    }));
  });

  it("neemt bezoekerlogo's mee in de echte snapshotthumbnail", () => {
    const logoId = "50000000-0000-5000-8000-000000001291";
    const homeLogoId = "50000000-0000-5000-8000-000000001292";
    const awayLogoId = "50000000-0000-5000-8000-000000001293";
    expect(collectDynamicRenderAssetIds({
      sport: {
        items: [{
          awayLogoMediaAssetId: awayLogoId,
          homeLogoMediaAssetId: homeLogoId,
          logoMediaAssetId: logoId,
          primary: "Bezoekers FC"
        }]
      }
    })).toEqual(expect.arrayContaining([logoId, homeLogoId, awayLogoId]));
  });

  it("neemt een zichtbare aankomstsponsor op in de renderassets", () => {
    const sponsorId = "50000000-0000-5000-8000-000000001294";
    expect(collectDynamicRenderAssetIds({
      sport: {
        arrivalConfig: {
          showSponsor: true,
          sponsorMediaAssetId: sponsorId
        },
        items: []
      }
    })).toContain(sponsorId);
    expect(collectDynamicRenderAssetIds({
      sport: {
        arrivalConfig: {
          showSponsor: false,
          sponsorMediaAssetId: sponsorId
        },
        items: []
      }
    })).not.toContain(sponsorId);
  });

  it("verzamelt zichtbare prijsfoto's en MenuDocument.v2-assets uit beide snapshotvormen", () => {
    const visiblePricePhoto = "50000000-0000-4000-8000-000000001301";
    const hiddenPricePhoto = "50000000-0000-4000-8000-000000001302";
    const rootMenuAsset = "50000000-0000-4000-8000-000000001303";
    const nestedMenuAsset = "50000000-0000-4000-8000-000000001304";
    const canonicalMenuAsset = "50000000-0000-4000-8000-000000001305";

    const ids = collectDynamicRenderAssetIds({
      data: {
        categories: [{
          products: [{ imageMediaAssetId: canonicalMenuAsset }]
        }]
      },
      menuDocument: { assets: [{ assetId: rootMenuAsset }] },
      priceList: {
        menuDocument: { assets: [{ assetId: nestedMenuAsset }] },
        sections: [{
          products: [
            { imageMediaAssetId: visiblePricePhoto, photoVisible: true },
            { imageMediaAssetId: hiddenPricePhoto, photoVisible: false }
          ]
        }]
      }
    });

    expect(ids).toEqual(expect.arrayContaining([
      canonicalMenuAsset,
      nestedMenuAsset,
      rootMenuAsset,
      visiblePricePhoto
    ]));
    expect(ids).not.toContain(hiddenPricePhoto);
  });

  it("selecteert statische originelen en genormaliseerde video met verplichte poster", async () => {
    const imageId = "50000000-0000-4000-8000-000000001311";
    const videoId = "50000000-0000-4000-8000-000000001312";
    const providerId = "50000000-0000-4000-8000-000000001313";
    const unsupportedBinaryId = "50000000-0000-4000-8000-000000001314";
    const hash = "a".repeat(64);
    const resolved = await resolveDynamicRenderAssets({
      mediaAssets: [
        { id: imageId, kind: "image" },
        { id: videoId, kind: "video" }
      ],
      providerVersions: [
        {
          checksum_sha256: hash,
          file_size_bytes: 123,
          id: providerId,
          mime_type: "image/png",
          storage_bucket: "provider-assets",
          storage_path: "logos/provider.png"
        },
        {
          checksum_sha256: hash,
          file_size_bytes: 456,
          id: unsupportedBinaryId,
          mime_type: "font/woff2",
          storage_bucket: "provider-assets",
          storage_path: "fonts/remote.woff2"
        }
      ],
      signUrl: async (asset) => `https://storage.example/${asset.storage_path}`,
      variants: [
        {
          asset_id: imageId,
          checksum_sha256: hash,
          file_size_bytes: 111,
          mime_type: "image/svg+xml",
          storage_bucket: "tenant-media",
          storage_path: "image.svg",
          variant_type: "original"
        },
        {
          asset_id: videoId,
          checksum_sha256: hash,
          file_size_bytes: 999,
          mime_type: "video/webm",
          storage_bucket: "tenant-media",
          storage_path: "original.webm",
          variant_type: "original"
        },
        {
          asset_id: videoId,
          checksum_sha256: "b".repeat(64),
          file_size_bytes: 888,
          mime_type: "video/mp4",
          storage_bucket: "tenant-media",
          storage_path: "player.mp4",
          variant_type: "player_1080p"
        },
        {
          asset_id: videoId,
          checksum_sha256: "c".repeat(64),
          file_size_bytes: 222,
          mime_type: "image/png",
          storage_bucket: "tenant-media",
          storage_path: "poster.png",
          variant_type: "thumbnail"
        }
      ]
    });

    expect(resolved[imageId]).toMatchObject({
      mimeType: "image/svg+xml",
      url: "https://storage.example/image.svg"
    });
    expect(resolved[videoId]).toMatchObject({
      mimeType: "video/mp4",
      posterMimeType: "image/png",
      posterUrl: "https://storage.example/poster.png",
      url: "https://storage.example/player.mp4"
    });
    expect(resolved[providerId]?.mimeType).toBe("image/png");
    expect(resolved).not.toHaveProperty(unsupportedBinaryId);
  });

  it("neemt video zonder immutable PNG-poster niet in de thumbnailpayload op", async () => {
    const videoId = "50000000-0000-4000-8000-000000001321";
    const resolved = await resolveDynamicRenderAssets({
      mediaAssets: [{ id: videoId, kind: "video" }],
      providerVersions: [],
      signUrl: async (asset) => `https://storage.example/${asset.storage_path}`,
      variants: [{
        asset_id: videoId,
        checksum_sha256: "a".repeat(64),
        file_size_bytes: 888,
        mime_type: "video/mp4",
        storage_bucket: "tenant-media",
        storage_path: "player.mp4",
        variant_type: "player_1080p"
      }]
    });

    expect(resolved).not.toHaveProperty(videoId);
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
