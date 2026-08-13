import {
  dynamicTemplateManifestSchema,
  type DynamicTemplateManifest
} from "@veyocast/contracts";
import type { PlayerDynamicTemplateAsset } from "@veyocast/contracts";
import { createClient } from "@supabase/supabase-js";

export type ClaimedDynamicRenderJob = {
  css: string;
  jobId: string;
  manifest: DynamicTemplateManifest;
  markup: string;
  orientation: "landscape" | "portrait";
  outputMediaAssetId: string;
  slideName: string;
  snapshotData: unknown;
  snapshotId: string;
  tenantId: string;
};

export type DynamicRenderArtifact = {
  byteLength: number;
  bytes: Uint8Array;
  checksumSha256: string;
  height: number;
  storagePath: string;
  width: number;
};

export interface DynamicRenderBackend {
  claimJob(
    workerId: string,
    lockTimeoutSeconds: number,
    maxAttempts: number
  ): Promise<ClaimedDynamicRenderJob | null>;
  resolveAssets?(
    job: ClaimedDynamicRenderJob
  ): Promise<Record<string, PlayerDynamicTemplateAsset>>;
  completeJob(
    job: ClaimedDynamicRenderJob,
    workerId: string,
    artifact: Omit<DynamicRenderArtifact, "bytes">
  ): Promise<void>;
  failJob(
    job: ClaimedDynamicRenderJob,
    workerId: string,
    failure: { code: string; message: string; retryable: boolean }
  ): Promise<"failed" | "queued">;
  uploadArtifact(
    job: ClaimedDynamicRenderJob,
    artifact: DynamicRenderArtifact
  ): Promise<void>;
}

type DynamicRpcClient = {
  rpc(
    functionName: string,
    parameters: Record<string, unknown>
  ): Promise<{ data: unknown; error: { code?: string } | null }>;
  storage: {
    from(bucket: string): {
      upload(
        path: string,
        bytes: Uint8Array,
        options: Record<string, unknown>
      ): Promise<{ error: { message?: string } | null }>;
    };
  };
};

export class DynamicRenderBackendError extends Error {
  constructor(
    readonly code: string,
    readonly retryable: boolean,
    message: string
  ) {
    super(message);
    this.name = "DynamicRenderBackendError";
  }
}

export class SupabaseDynamicRenderBackend implements DynamicRenderBackend {
  private readonly client: DynamicRpcClient;
  private readonly assetClient: ReturnType<typeof createClient> | null;

  constructor(
    supabaseUrl: string,
    serviceRoleKey: string,
    client?: DynamicRpcClient
  ) {
    this.client = client ?? createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    }) as unknown as DynamicRpcClient;
    this.assetClient = client ? null : createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
  }

  async resolveAssets(job: ClaimedDynamicRenderJob) {
    if (!this.assetClient) return {};
    const ids = collectAssetIds(job.snapshotData);
    if (!ids.length) return {};
    const variants = await this.assetClient
      .from("media_variants")
      .select("asset_id, storage_bucket, storage_path, mime_type, file_size_bytes, checksum_sha256")
      .eq("tenant_id", job.tenantId)
      .eq("variant_type", "original")
      .in("asset_id", ids);
    if (variants.error) throw new DynamicRenderBackendError(
      "dynamic_asset_resolution_failed",
      true,
      "Thumbnailassets konden tijdelijk niet worden opgelost."
    );
    const rows = (variants.data ?? []) as unknown as Array<{
      asset_id: string;
      checksum_sha256: string;
      file_size_bytes: number;
      mime_type: string;
      storage_bucket: string;
      storage_path: string;
    }>;
    const entries = await Promise.all(rows.map(async (variant) => {
      const signed = await this.assetClient!.storage
        .from(variant.storage_bucket)
        .createSignedUrl(variant.storage_path, 300);
      if (signed.error || !signed.data.signedUrl) return null;
      const mimeType = variant.mime_type;
      if (!["image/jpeg", "image/png", "image/webp"].includes(mimeType)) return null;
      return [variant.asset_id, {
        bytes: variant.file_size_bytes,
        checksumSha256: variant.checksum_sha256,
        mimeType,
        url: signed.data.signedUrl
      }] as const;
    }));
    return Object.fromEntries(entries.filter((entry) => entry !== null)) as Record<
      string,
      PlayerDynamicTemplateAsset
    >;
  }

  async claimJob(
    workerId: string,
    lockTimeoutSeconds: number,
    maxAttempts: number
  ) {
    const { data, error } = await this.client.rpc(
      "claim_dynamic_render_job_v1",
      {
        p_lock_timeout_seconds: lockTimeoutSeconds,
        p_max_attempts: maxAttempts,
        p_worker_id: workerId
      }
    );
    if (error) {
      throw new DynamicRenderBackendError(
        "dynamic_claim_failed",
        true,
        `Dynamische renderjob kon niet worden geclaimd (${error.code ?? "database_error"}).`
      );
    }
    if (!Array.isArray(data) || data.length === 0) return null;
    return parseClaimedDynamicRenderJob(data[0]);
  }

  async uploadArtifact(
    job: ClaimedDynamicRenderJob,
    artifact: DynamicRenderArtifact
  ) {
    assertArtifactPath(job, artifact.storagePath);
    const { error } = await this.client.storage
      .from("tenant-media")
      .upload(artifact.storagePath, artifact.bytes, {
        cacheControl: "31536000",
        contentType: "image/png",
        upsert: true
      });
    if (error) {
      throw new DynamicRenderBackendError(
        "dynamic_artifact_upload_failed",
        true,
        "De dynamische PNG kon tijdelijk niet naar mediaopslag worden geschreven."
      );
    }
  }

  async completeJob(
    job: ClaimedDynamicRenderJob,
    workerId: string,
    artifact: Omit<DynamicRenderArtifact, "bytes">
  ) {
    const { error } = await this.client.rpc(
      "complete_dynamic_render_job_v1",
      {
        p_checksum_sha256: artifact.checksumSha256,
        p_file_size_bytes: artifact.byteLength,
        p_height: artifact.height,
        p_job_id: job.jobId,
        p_storage_path: artifact.storagePath,
        p_width: artifact.width,
        p_worker_id: workerId
      }
    );
    if (error) {
      throw new DynamicRenderBackendError(
        error.code === "55000"
          ? "dynamic_render_lease_lost"
          : "dynamic_complete_failed",
        error.code !== "55000",
        "De dynamische renderstatus kon niet veilig worden voltooid."
      );
    }
  }

  async failJob(
    job: ClaimedDynamicRenderJob,
    workerId: string,
    failure: { code: string; message: string; retryable: boolean }
  ) {
    const { data, error } = await this.client.rpc(
      "fail_dynamic_render_job_v1",
      {
        p_error_code: failure.code.slice(0, 80),
        p_error_detail: failure.message.replace(/[\r\n]+/g, " ").slice(0, 500),
        p_job_id: job.jobId,
        p_retryable: failure.retryable,
        p_worker_id: workerId
      }
    );
    if (error || (data !== "queued" && data !== "failed")) {
      throw new DynamicRenderBackendError(
        "dynamic_failure_report_failed",
        true,
        "De mislukte dynamische render kon niet worden geregistreerd."
      );
    }
    return data;
  }
}

export function dynamicRenderStoragePath(
  job: Pick<ClaimedDynamicRenderJob, "outputMediaAssetId" | "tenantId">
) {
  return `tenants/${job.tenantId}/assets/${job.outputMediaAssetId}/dynamic-slide.png`;
}

export function parseClaimedDynamicRenderJob(
  value: unknown
): ClaimedDynamicRenderJob {
  if (!isRecord(value)) throw invalidClaim();
  const manifest = dynamicTemplateManifestSchema.safeParse(value.manifest_json);
  const orientation = value.orientation;
  if (
    !manifest.success ||
    typeof value.job_id !== "string" ||
    typeof value.tenant_id !== "string" ||
    typeof value.snapshot_id !== "string" ||
    typeof value.output_media_asset_id !== "string" ||
    typeof value.slide_name !== "string" ||
    typeof value.markup !== "string" ||
    typeof value.css !== "string" ||
    (orientation !== "landscape" && orientation !== "portrait")
  ) {
    throw invalidClaim();
  }
  return {
    css: value.css,
    jobId: value.job_id,
    manifest: manifest.data,
    markup: value.markup,
    orientation,
    outputMediaAssetId: value.output_media_asset_id,
    slideName: value.slide_name,
    snapshotData: value.snapshot_data_json,
    snapshotId: value.snapshot_id,
    tenantId: value.tenant_id
  };
}

function assertArtifactPath(
  job: ClaimedDynamicRenderJob,
  storagePath: string
) {
  if (storagePath !== dynamicRenderStoragePath(job)) {
    throw new DynamicRenderBackendError(
      "dynamic_storage_path_invalid",
      false,
      "Het dynamische renderpad valt buiten de verwachte tenantresource."
    );
  }
}

function invalidClaim(): never {
  throw new DynamicRenderBackendError(
    "dynamic_claim_payload_invalid",
    false,
    "Database gaf een ongeldige dynamische renderjob terug."
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function collectAssetIds(snapshot: unknown) {
  if (!isRecord(snapshot)) return [];
  const ids = new Set<string>();
  const add = (value: unknown) => {
    if (typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value)) ids.add(value);
  };
  const brand = isRecord(snapshot.brand) ? snapshot.brand : null;
  add(brand?.logoMediaAssetId);
  const menu = isRecord(snapshot.menu) ? snapshot.menu : null;
  if (Array.isArray(menu?.products)) {
    for (const item of menu.products) if (isRecord(item)) add(item.imageMediaAssetId);
  }
  const news = isRecord(snapshot.news) ? snapshot.news : null;
  add(news?.providerLogoMediaAssetId);
  if (Array.isArray(news?.articles)) {
    for (const item of news.articles) if (isRecord(item)) {
      add(item.heroMediaAssetId);
      add(item.qrMediaAssetId);
    }
  }
  return [...ids].slice(0, 51);
}
