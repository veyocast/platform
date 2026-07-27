import {
  dynamicTemplateManifestSchema,
  type DynamicTemplateManifest
} from "@veyocast/contracts";
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

  constructor(
    supabaseUrl: string,
    serviceRoleKey: string,
    client?: DynamicRpcClient
  ) {
    this.client = client ?? createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    }) as unknown as DynamicRpcClient;
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
