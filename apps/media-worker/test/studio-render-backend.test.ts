import {
  createEmptyStudioDocument,
  parseStudioDocument
} from "@veyocast/studio";
import { describe, expect, it, vi } from "vitest";

import {
  parseClaimedStudioRenderJob,
  studioRenderArtifactPaths,
  SupabaseStudioRenderBackend,
  type StudioRenderRpcClient
} from "../src/studio-render-backend";

const ids = {
  job: "10000000-0000-4000-8000-000000000001",
  media: "20000000-0000-4000-8000-000000000002",
  project: "30000000-0000-4000-8000-000000000003",
  revision: "40000000-0000-4000-8000-000000000004",
  tenant: "50000000-0000-4000-8000-000000000005"
};
const document = createEmptyStudioDocument("landscape-hd", {
  durationMs: 10_000
});

describe("Studio render backend", () => {
  it("parses the immutable service claim and rejects geometry drift", () => {
    expect(parseClaimedStudioRenderJob(claimPayload())).toMatchObject({
      attemptCount: 1,
      designId: ids.project,
      document,
      jobId: ids.job,
      mediaAssetId: ids.media,
      outputType: "png",
      revisionId: ids.revision,
      sourceAssets: [],
      tenantId: ids.tenant
    });

    expect(() => parseClaimedStudioRenderJob({
      ...claimPayload(),
      width: 1080
    })).toThrowError(expect.objectContaining({
      code: "studio_claim_payload_invalid"
    }));
  });

  it("maps resolved revision assets to every referencing image element", () => {
    const sourceAssetId = "60000000-0000-4000-8000-000000000006";
    const withImage = parseStudioDocument({
      ...document,
      elements: [{
        alt: "Clublogo",
        cornerRadius: 0,
        focusX: 0.5,
        focusY: 0.5,
        height: 240,
        id: "club-logo",
        locked: false,
        mediaAssetId: sourceAssetId,
        name: "Clublogo",
        objectFit: "contain",
        opacity: 1,
        rotation: 0,
        type: "image",
        variant: "original",
        visible: true,
        width: 240,
        x: 100,
        y: 100,
        zIndex: 0
      }]
    });
    const parsed = parseClaimedStudioRenderJob({
      ...claimPayload(),
      assets_json: [{
        assetId: sourceAssetId,
        bucket: "tenant-media",
        checksumSha256: "c".repeat(64),
        durationSeconds: null,
        height: 512,
        mimeType: "image/png",
        path:
          `tenants/${ids.tenant}/assets/${sourceAssetId}/original/logo.png`,
        width: 512
      }],
      document_json: withImage
    });

    expect(parsed.assetManifest).toEqual([{
      checksumSha256: "c".repeat(64),
      elementId: "club-logo",
      mediaAssetId: sourceAssetId,
      mimeType: "image/png",
      storagePath:
        `tenants/${ids.tenant}/assets/${sourceAssetId}/original/logo.png`
    }]);
  });

  it("maps a validated player video variant to the immutable background element", () => {
    const sourceAssetId = "60000000-0000-4000-8000-000000000006";
    const withVideo = parseStudioDocument({
      ...document,
      artboard: {
        ...document.artboard,
        background: { kind: "transparent" }
      },
      elements: [{
        alt: "Stadionpubliek",
        focusX: 0.5,
        focusY: 0.5,
        height: 1080,
        id: "venue-video",
        locked: true,
        loop: true,
        mediaAssetId: sourceAssetId,
        muted: true,
        name: "Stadion · achtergrond",
        objectFit: "cover",
        opacity: 1,
        rotation: 0,
        startOffsetMs: 1_000,
        type: "video",
        variant: "player_1080p",
        visible: true,
        width: 1920,
        x: 0,
        y: 0,
        zIndex: 0
      }]
    });
    const path =
      `tenants/${ids.tenant}/assets/${sourceAssetId}/variants/player-1080p.mp4`;
    const parsed = parseClaimedStudioRenderJob({
      ...claimPayload(),
      assets_json: [{
        assetId: sourceAssetId,
        bucket: "tenant-media",
        checksumSha256: "d".repeat(64),
        durationSeconds: 12,
        height: 1080,
        mimeType: "video/mp4",
        path,
        width: 1920
      }],
      document_json: withVideo
    });
    expect(parsed.assetManifest).toEqual([{
      checksumSha256: "d".repeat(64),
      elementId: "venue-video",
      mediaAssetId: sourceAssetId,
      mimeType: "video/mp4",
      storagePath: path
    }]);
    expect(() => parseClaimedStudioRenderJob({
      ...claimPayload(),
      assets_json: [{
        assetId: sourceAssetId,
        bucket: "tenant-media",
        checksumSha256: "d".repeat(64),
        durationSeconds: null,
        height: 1080,
        mimeType: "video/mp4",
        path,
        width: 1920
      }],
      document_json: withVideo
    })).toThrowError(expect.objectContaining({
      code: "studio_claim_payload_invalid"
    }));
  });

  it("uses the exact claim and monotone status RPC contracts", async () => {
    const rpc = vi.fn<StudioRenderRpcClient["rpc"]>()
      .mockResolvedValueOnce({ data: [claimPayload()], error: null })
      .mockResolvedValueOnce({
        data: {
          cancelRequested: false,
          leaseValid: true,
          outcome: "updated",
          progress: 42,
          status: "rendering"
        },
        error: null
      });
    const backend = createBackend(rpc);

    const job = await backend.claimJob("worker:studio", 900, 3);
    expect(job?.jobId).toBe(ids.job);
    expect(rpc).toHaveBeenNthCalledWith(1, "claim_studio_render_job_v1", {
      p_lock_timeout_seconds: 900,
      p_max_attempts: 3,
      p_worker_id: "worker:studio"
    });

    await expect(backend.updateJob({
      jobId: ids.job,
      progress: 42.4,
      status: "rendering",
      workerId: "worker:studio"
    })).resolves.toEqual({ cancelRequested: false, leaseValid: true });
    expect(rpc).toHaveBeenNthCalledWith(2, "update_studio_render_job_v1", {
      p_job_id: ids.job,
      p_progress: 42,
      p_status: "rendering",
      p_worker_id: "worker:studio"
    });
  });

  it("stops safely when another worker owns the lease", async () => {
    const backend = createBackend(
      vi.fn<StudioRenderRpcClient["rpc"]>().mockResolvedValue({
        data: null,
        error: { code: "42501" }
      })
    );

    await expect(backend.updateJob({
      jobId: ids.job,
      progress: 50,
      status: "rendering",
      workerId: "worker:stale"
    })).resolves.toEqual({
      cancelRequested: false,
      leaseValid: false
    });
  });

  it("maps completion and failure to atomic service RPCs", async () => {
    const rpc = vi.fn<StudioRenderRpcClient["rpc"]>()
      .mockResolvedValueOnce({
        data: { mediaAssetId: ids.media, outcome: "completed" },
        error: null
      })
      .mockResolvedValueOnce({
        data: { attemptCount: 1, outcome: "queued", status: "queued" },
        error: null
      });
    const backend = createBackend(rpc);
    const outputStoragePath =
      `tenants/${ids.tenant}/assets/${ids.media}/variants/player-1080p.mp4`;

    await backend.completeJob({
      jobId: ids.job,
      outputStoragePath,
      posterStoragePath:
        `tenants/${ids.tenant}/assets/${ids.media}/variants/studio-poster.png`,
      result: {
        checksumSha256: "a".repeat(64),
        durationMs: 10_000,
        fileSizeBytes: 1_024,
        height: 1080,
        mimeType: "video/mp4",
        posterChecksumSha256: "b".repeat(64),
        posterFileSizeBytes: 256,
        width: 1920
      },
      workerId: "worker:studio"
    });
    expect(rpc).toHaveBeenNthCalledWith(1, "complete_studio_render_job_v1", {
      p_checksum_sha256: "a".repeat(64),
      p_duration_seconds: 10,
      p_file_size_bytes: 1_024,
      p_height: 1080,
      p_job_id: ids.job,
      p_mime_type: "video/mp4",
      p_poster_checksum_sha256: "b".repeat(64),
      p_poster_file_size_bytes: 256,
      p_poster_storage_path:
        `tenants/${ids.tenant}/assets/${ids.media}/variants/studio-poster.png`,
      p_storage_path: outputStoragePath,
      p_width: 1920,
      p_worker_id: "worker:studio"
    });

    await expect(backend.failJob({
      errorCode: "encoding_failed",
      errorMessage: "tijdelijk\nniet beschikbaar",
      jobId: ids.job,
      retryable: true,
      workerId: "worker:studio"
    })).resolves.toBe("queued");
    expect(rpc).toHaveBeenNthCalledWith(2, "fail_studio_render_job_v1", {
      p_error_code: "encoding_failed",
      p_error_detail: "tijdelijk niet beschikbaar",
      p_job_id: ids.job,
      p_retryable: true,
      p_worker_id: "worker:studio"
    });
  });

  it("builds one canonical tenant path per output kind", () => {
    expect(studioRenderArtifactPaths({
      mediaAssetId: ids.media,
      outputType: "png",
      tenantId: ids.tenant
    })).toEqual({
      output:
        `tenants/${ids.tenant}/assets/${ids.media}/original/studio-output.png`,
      poster:
        `tenants/${ids.tenant}/assets/${ids.media}/variants/studio-poster.png`
    });
    expect(studioRenderArtifactPaths({
      mediaAssetId: ids.media,
      outputType: "mp4",
      tenantId: ids.tenant
    }).output).toBe(
      `tenants/${ids.tenant}/assets/${ids.media}/variants/player-1080p.mp4`
    );
  });
});

function claimPayload() {
  return {
    assets_json: [],
    attempt_count: 1,
    document_json: document,
    duration_ms: 10_000,
    fps: 30,
    height: 1080,
    job_id: ids.job,
    output_kind: "png",
    planned_media_asset_id: ids.media,
    project_id: ids.project,
    revision_id: ids.revision,
    tenant_id: ids.tenant,
    width: 1920
  };
}

function createBackend(rpc: StudioRenderRpcClient["rpc"]) {
  return new SupabaseStudioRenderBackend(
    "https://project.supabase.co",
    "service-secret",
    { client: { rpc }, fetch: vi.fn() }
  );
}
