import { createReadStream, createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";

import {
  safeParseStudioDocument,
  studioRenderRequestSchema,
  type StudioRenderRequest,
  type StudioRenderResult,
  type StudioRenderStatus
} from "@veyocast/studio";
import { createClient } from "@supabase/supabase-js";

import { maxUploadBytes } from "./media-processing";

export const studioRenderStorageBucket = "tenant-media";
export const studioRenderStorageTimeoutMs = 15_000;

export type ClaimedStudioSourceAsset = {
  assetId: string;
  bucket: string;
  checksumSha256: string;
  durationSeconds: number | null;
  height: number | null;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  path: string;
  width: number | null;
};

export type ClaimedStudioRenderJob = StudioRenderRequest & {
  attemptCount: number;
  sourceAssets: ClaimedStudioSourceAsset[];
};

export type StudioRenderLeaseState = {
  cancelRequested: boolean;
  leaseValid: boolean;
};

export type UpdateStudioRenderJobInput = {
  jobId: string;
  progress: number;
  status: Extract<
    StudioRenderStatus,
    "preparing" | "rendering" | "encoding" | "uploading" | "creating_media"
  >;
  workerId: string;
};

export type CompleteStudioRenderJobInput = {
  jobId: string;
  outputStoragePath: string;
  posterStoragePath: string;
  result: StudioRenderResult;
  workerId: string;
};

export type FailStudioRenderJobInput = {
  errorCode: string;
  errorMessage: string;
  jobId: string;
  retryable: boolean;
  workerId: string;
};

export interface StudioRenderBackend {
  claimJob(
    workerId: string,
    lockTimeoutSeconds: number,
    maxAttempts: number
  ): Promise<ClaimedStudioRenderJob | null>;
  completeJob(input: CompleteStudioRenderJobInput): Promise<void>;
  downloadAsset(
    job: ClaimedStudioRenderJob,
    asset: ClaimedStudioSourceAsset,
    destinationPath: string
  ): Promise<void>;
  failJob(
    input: FailStudioRenderJobInput
  ): Promise<"cancelled" | "failed" | "queued">;
  updateJob(input: UpdateStudioRenderJobInput): Promise<StudioRenderLeaseState>;
  uploadArtifact(
    job: ClaimedStudioRenderJob,
    sourcePath: string,
    storagePath: string,
    mimeType: "image/png" | "video/mp4"
  ): Promise<void>;
}

export type StudioRenderRpcClient = {
  rpc(
    functionName: string,
    parameters: Record<string, unknown>
  ): Promise<{ data: unknown; error: { code?: string } | null }>;
};

type FetchImplementation = typeof fetch;

export class StudioRenderBackendError extends Error {
  constructor(
    readonly code: string,
    readonly retryable: boolean,
    message: string
  ) {
    super(message);
    this.name = "StudioRenderBackendError";
  }
}

export class SupabaseStudioRenderBackend implements StudioRenderBackend {
  private readonly client: StudioRenderRpcClient;
  private readonly fetchImplementation: FetchImplementation;
  private readonly storageTimeoutMs: number;

  constructor(
    private readonly supabaseUrl: string,
    private readonly serviceRoleKey: string,
    dependencies: {
      client?: StudioRenderRpcClient;
      fetch?: FetchImplementation;
      storageTimeoutMs?: number;
    } = {}
  ) {
    this.client = dependencies.client ?? createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    }) as unknown as StudioRenderRpcClient;
    this.fetchImplementation = dependencies.fetch ?? fetch;
    this.storageTimeoutMs =
      dependencies.storageTimeoutMs ?? studioRenderStorageTimeoutMs;
  }

  async claimJob(
    workerId: string,
    lockTimeoutSeconds: number,
    maxAttempts: number
  ): Promise<ClaimedStudioRenderJob | null> {
    const { data, error } = await this.client.rpc("claim_studio_render_job_v1", {
      p_lock_timeout_seconds: lockTimeoutSeconds,
      p_max_attempts: maxAttempts,
      p_worker_id: workerId
    });
    if (error) throw rpcError("studio_claim_failed", true, error.code);
    if (!Array.isArray(data) || data.length === 0) return null;
    return parseClaimedStudioRenderJob(data[0]);
  }

  async updateJob(input: UpdateStudioRenderJobInput) {
    const { data, error } = await this.client.rpc("update_studio_render_job_v1", {
      p_job_id: input.jobId,
      p_progress: clampProgress(input.progress),
      p_status: input.status,
      p_worker_id: input.workerId
    });
    if (error?.code === "42501") {
      return { cancelRequested: false, leaseValid: false };
    }
    if (error) throw rpcError("studio_update_failed", true, error.code);
    if (
      !isRecord(data) ||
      data.outcome !== "updated" ||
      typeof data.cancelRequested !== "boolean" ||
      typeof data.leaseValid !== "boolean"
    ) {
      throw new StudioRenderBackendError(
        "studio_update_payload_invalid",
        true,
        "Database gaf geen geldige Studio-statusbevestiging terug."
      );
    }
    return {
      cancelRequested: data.cancelRequested,
      leaseValid: data.leaseValid
    } as const;
  }

  async completeJob(input: CompleteStudioRenderJobInput) {
    const durationSeconds = input.result.mimeType === "video/mp4"
      ? input.result.durationMs / 1_000
      : null;
    const { data, error } = await this.client.rpc("complete_studio_render_job_v1", {
      p_checksum_sha256: input.result.checksumSha256,
      p_duration_seconds: durationSeconds,
      p_file_size_bytes: input.result.fileSizeBytes,
      p_height: input.result.height,
      p_job_id: input.jobId,
      p_mime_type: input.result.mimeType,
      p_poster_checksum_sha256: input.result.posterChecksumSha256,
      p_poster_file_size_bytes: input.result.posterFileSizeBytes,
      p_poster_storage_path: input.posterStoragePath,
      p_storage_path: input.outputStoragePath,
      p_width: input.result.width,
      p_worker_id: input.workerId
    });
    if (error?.code === "42501") {
      throw new StudioRenderBackendError(
        "studio_lease_lost",
        false,
        "Studio-renderlease is niet langer geldig."
      );
    }
    if (error) throw rpcError("studio_complete_failed", true, error.code);
    if (!isRecord(data) || data.outcome !== "completed") {
      throw new StudioRenderBackendError(
        "studio_complete_payload_invalid",
        true,
        "Database gaf geen geldige Studio-voltooiingsstatus terug."
      );
    }
  }

  async failJob(input: FailStudioRenderJobInput) {
    const { data, error } = await this.client.rpc("fail_studio_render_job_v1", {
      p_error_code: input.errorCode,
      p_error_detail: safeMessage(input.errorMessage, 240),
      p_job_id: input.jobId,
      p_retryable: input.retryable,
      p_worker_id: input.workerId
    });
    if (error) throw rpcError("studio_failure_report_failed", true, error.code);
    if (
      !isRecord(data) ||
      (data.outcome !== "cancelled" &&
        data.outcome !== "failed" &&
        data.outcome !== "queued")
    ) {
      throw new StudioRenderBackendError(
        "studio_failure_report_invalid",
        true,
        "Database gaf een ongeldige Studio-jobstatus terug."
      );
    }
    return data.outcome;
  }

  async downloadAsset(
    job: ClaimedStudioRenderJob,
    asset: ClaimedStudioSourceAsset,
    destinationPath: string
  ) {
    assertTenantAssetPath(job, asset.assetId, asset.path);
    const response = await this.storageRequest(
      this.storageObjectUrl(asset.bucket, asset.path),
      { method: "GET" },
      "studio_asset_download"
    );
    if (!response.body) {
      throw new StudioRenderBackendError(
        "studio_asset_download_empty",
        true,
        "Het Studio-bronbestand bevat geen downloadbare inhoud."
      );
    }
    const contentLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > maxUploadBytes) {
      throw new StudioRenderBackendError(
        "studio_asset_too_large",
        false,
        "Studio-bronbestand overschrijdt de maximale bestandsgrootte."
      );
    }
    try {
      const source = Readable.fromWeb(
        response.body as unknown as NodeReadableStream<Uint8Array>
      );
      let transferredBytes = 0;
      const limiter = new Transform({
        transform(chunk: Buffer, _encoding, callback) {
          transferredBytes += chunk.byteLength;
          if (transferredBytes > maxUploadBytes) {
            callback(new StudioRenderBackendError(
              "studio_asset_too_large",
              false,
              "Studio-bronbestand overschrijdt de maximale bestandsgrootte."
            ));
            return;
          }
          callback(null, chunk);
        }
      });
      await pipeline(
        source,
        limiter,
        createWriteStream(destinationPath, { flags: "wx" })
      );
    } catch (error) {
      if (error instanceof StudioRenderBackendError) throw error;
      throw new StudioRenderBackendError(
        "studio_asset_download_interrupted",
        true,
        "Download van een Studio-bronbestand werd onderbroken."
      );
    }
  }

  async uploadArtifact(
    job: ClaimedStudioRenderJob,
    sourcePath: string,
    storagePath: string,
    mimeType: "image/png" | "video/mp4"
  ) {
    assertTenantAssetPath(job, job.mediaAssetId, storagePath);
    const body = Readable.toWeb(createReadStream(sourcePath)) as unknown as BodyInit;
    await this.storageRequest(
      this.storageObjectUrl(studioRenderStorageBucket, storagePath),
      {
        body,
        duplex: "half",
        headers: {
          "cache-control": "max-age=31536000, immutable",
          "content-type": mimeType,
          "x-upsert": "true"
        },
        method: "POST"
      } satisfies RequestInit & { duplex: "half" },
      "studio_artifact_upload"
    );
  }

  private async storageRequest(
    url: string,
    init: RequestInit & { duplex?: "half" },
    code: "studio_artifact_upload" | "studio_asset_download"
  ) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.storageTimeoutMs);
    let response: Response;
    try {
      response = await this.fetchImplementation(url, {
        ...init,
        headers: {
          apikey: this.serviceRoleKey,
          authorization: `Bearer ${this.serviceRoleKey}`,
          ...init.headers
        },
        signal: controller.signal
      });
    } catch {
      throw new StudioRenderBackendError(
        `${code}_${controller.signal.aborted ? "timeout" : "network_failed"}`,
        true,
        controller.signal.aborted
          ? "Studio-storageoverdracht overschreed de tijdslimiet."
          : "Studio-storage was tijdelijk niet bereikbaar."
      );
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) {
      throw new StudioRenderBackendError(
        `${code}_failed`,
        response.status === 408 || response.status === 429 || response.status >= 500,
        `Studio-storageverzoek mislukte met status ${response.status}.`
      );
    }
    return response;
  }

  private storageObjectUrl(bucket: string, path: string) {
    const encodedBucket = encodeURIComponent(bucket);
    const encodedPath = path.split("/").map(encodeURIComponent).join("/");
    return `${this.supabaseUrl}/storage/v1/object/${encodedBucket}/${encodedPath}`;
  }
}

export function studioRenderArtifactPaths(
  request: Pick<
    StudioRenderRequest,
    "mediaAssetId" | "outputType" | "tenantId"
  >
) {
  const root =
    `tenants/${request.tenantId}/assets/${request.mediaAssetId}`;
  return {
    output: request.outputType === "mp4"
      ? `${root}/variants/player-1080p.mp4`
      : `${root}/original/studio-output.png`,
    poster: `${root}/variants/studio-poster.png`
  } as const;
}

export function parseClaimedStudioRenderJob(
  value: unknown
): ClaimedStudioRenderJob {
  if (!isRecord(value)) throw invalidClaim();
  const sourceAssets = parseSourceAssets(value.assets_json);
  const parsedDocument = safeParseStudioDocument(value.document_json);
  if (!parsedDocument.success) throw invalidClaim();
  const document = parsedDocument.data;
  const assetsById = new Map(sourceAssets.map((asset) => [asset.assetId, asset]));
  const assetManifest = document.elements.flatMap((element) => {
    if (element.type !== "image") return [];
    const asset = assetsById.get(element.mediaAssetId);
    return asset
      ? [{
        checksumSha256: asset.checksumSha256,
        elementId: element.id,
        mediaAssetId: asset.assetId,
        mimeType: asset.mimeType,
        storagePath: asset.path
      }]
      : [];
  });
  const request = studioRenderRequestSchema.safeParse({
    assetManifest,
    designId: value.project_id,
    document,
    jobId: value.job_id,
    mediaAssetId: value.planned_media_asset_id,
    outputType: value.output_kind,
    revisionId: value.revision_id,
    tenantId: value.tenant_id
  });
  const attemptCount = Number(value.attempt_count);
  const width = Number(value.width);
  const height = Number(value.height);
  const durationMs = Number(value.duration_ms);
  const fps = Number(value.fps);
  const allImagesResolved = document.elements.every(
    (element) => element.type !== "image" || assetsById.has(element.mediaAssetId)
  );
  if (
    !request.success ||
    !allImagesResolved ||
    !Number.isSafeInteger(attemptCount) ||
    attemptCount < 1 ||
    width !== document.artboard.width ||
    height !== document.artboard.height ||
    durationMs !== document.motion.durationMs ||
    fps !== document.motion.fps
  ) {
    throw invalidClaim();
  }
  return { ...request.data, attemptCount, sourceAssets };
}

function parseSourceAssets(value: unknown): ClaimedStudioSourceAsset[] {
  if (!Array.isArray(value)) throw invalidClaim();
  return value.map((entry) => {
    if (!isRecord(entry)) throw invalidClaim();
    const mimeType = entry.mimeType;
    const checksumSha256 = entry.checksumSha256;
    if (
      typeof entry.assetId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        .test(entry.assetId) ||
      entry.bucket !== studioRenderStorageBucket ||
      typeof entry.path !== "string" ||
      entry.path.length < 1 ||
      entry.path.length > 1_024 ||
      (mimeType !== "image/jpeg" &&
        mimeType !== "image/png" &&
        mimeType !== "image/webp") ||
      typeof checksumSha256 !== "string" ||
      !/^[a-f0-9]{64}$/.test(checksumSha256)
    ) {
      throw invalidClaim();
    }
    const width = nullableInteger(entry.width);
    const height = nullableInteger(entry.height);
    if ((width !== null && width <= 0) || (height !== null && height <= 0)) {
      throw invalidClaim();
    }
    return {
      assetId: entry.assetId,
      bucket: entry.bucket,
      checksumSha256,
      durationSeconds: nullableNumber(entry.durationSeconds),
      height,
      mimeType,
      path: entry.path,
      width
    };
  });
}

function assertTenantAssetPath(
  job: Pick<ClaimedStudioRenderJob, "tenantId">,
  assetId: string,
  storagePath: string
) {
  const expectedRoot = `tenants/${job.tenantId}/assets/${assetId}/`;
  if (!storagePath.startsWith(expectedRoot) || storagePath.includes("..")) {
    throw new StudioRenderBackendError(
      "studio_storage_path_invalid",
      false,
      "Studio-storagepad valt buiten de verwachte tenantresource."
    );
  }
}

function invalidClaim(): never {
  throw new StudioRenderBackendError(
    "studio_claim_payload_invalid",
    false,
    "Database gaf een ongeldige Studio-renderjob terug."
  );
}

function rpcError(code: string, retryable: boolean, databaseCode?: string) {
  return new StudioRenderBackendError(
    code,
    retryable,
    `Studio-renderstatus kon niet worden bijgewerkt (${databaseCode ?? "database_error"}).`
  );
}

function clampProgress(progress: number) {
  if (!Number.isFinite(progress)) return 0;
  return Math.round(Math.min(99, Math.max(0, progress)));
}

function safeMessage(message: string, length: number) {
  return message.replace(/[\r\n]+/g, " ").slice(0, length);
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw invalidClaim();
  return number;
}

function nullableInteger(value: unknown) {
  const number = nullableNumber(value);
  if (number !== null && !Number.isSafeInteger(number)) throw invalidClaim();
  return number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
