import { createReadStream, createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";

import { createClient } from "@supabase/supabase-js";

export type ClaimedMediaJob = {
  assetId: string;
  attemptCount: number;
  fileSizeBytes: number;
  jobId: string;
  mimeType: string;
  originalFileName: string;
  storageBucket: string;
  storagePath: string;
  tenantId: string;
};

export type CompleteMediaJobInput = {
  assetId: string;
  durationSeconds: number;
  height: number;
  jobId: string;
  originalChecksum: string;
  playerChecksum: string;
  playerSizeBytes: number;
  playerStoragePath: string;
  width: number;
  workerId: string;
};

export type FailMediaJobInput = {
  errorCode: string;
  errorMessage: string;
  jobId: string;
  maxAttempts: number;
  retryable: boolean;
  workerId: string;
};

export interface MediaWorkerBackend {
  applyDueSchedules(evaluatedAt: Date): Promise<number>;
  claimJob(
    workerId: string,
    lockTimeoutSeconds: number,
    maxAttempts: number
  ): Promise<ClaimedMediaJob | null>;
  completeJob(input: CompleteMediaJobInput): Promise<void>;
  downloadOriginal(job: ClaimedMediaJob, destinationPath: string): Promise<void>;
  failJob(input: FailMediaJobInput): Promise<"failed" | "queued">;
  uploadPlayerVariant(
    job: ClaimedMediaJob,
    sourcePath: string,
    storagePath: string
  ): Promise<void>;
}

export class WorkerBackendError extends Error {
  constructor(
    readonly code: string,
    readonly retryable: boolean,
    message: string
  ) {
    super(message);
    this.name = "WorkerBackendError";
  }
}

export type WorkerRpcClient = {
  rpc(
    functionName: string,
    parameters: Record<string, unknown>
  ): Promise<{ data: unknown; error: { code?: string } | null }>;
};
type FetchImplementation = typeof fetch;
export const storageTransferTimeoutMs = 8_000;

export class SupabaseMediaWorkerBackend implements MediaWorkerBackend {
  private readonly client: WorkerRpcClient;
  private readonly fetchImplementation: FetchImplementation;

  constructor(
    private readonly supabaseUrl: string,
    private readonly serviceRoleKey: string,
    dependencies: {
      client?: WorkerRpcClient;
      fetch?: FetchImplementation;
      storageTimeoutMs?: number;
    } = {}
  ) {
    this.client = dependencies.client ?? createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    }) as unknown as WorkerRpcClient;
    this.fetchImplementation = dependencies.fetch ?? fetch;
    this.storageTimeoutMs = dependencies.storageTimeoutMs ?? storageTransferTimeoutMs;
  }

  private readonly storageTimeoutMs: number;

  async applyDueSchedules(evaluatedAt: Date) {
    const { data, error } = await this.client.rpc("apply_due_content_schedules_v1", {
      p_now: evaluatedAt.toISOString()
    });
    if (error) {
      throw new WorkerBackendError(
        "schedule_apply_failed",
        true,
        `Kon geplande content niet evalueren (${error.code ?? "database_error"}).`
      );
    }
    const appliedCount = typeof data === "number" ? data : Number(data);
    if (!Number.isSafeInteger(appliedCount) || appliedCount < 0) {
      throw new WorkerBackendError(
        "schedule_apply_invalid",
        false,
        "Database gaf een ongeldig aantal toegepaste planningen terug."
      );
    }
    return appliedCount;
  }

  async claimJob(
    workerId: string,
    lockTimeoutSeconds: number,
    maxAttempts: number
  ): Promise<ClaimedMediaJob | null> {
    const { data, error } = await this.client.rpc("claim_media_processing_job", {
      p_lock_timeout_seconds: lockTimeoutSeconds,
      p_max_attempts: maxAttempts,
      p_worker_id: workerId
    });
    if (error) {
      throw new WorkerBackendError(
        "claim_failed",
        true,
        `Kon geen mediajob claimen (${error.code ?? "database_error"}).`
      );
    }
    if (!Array.isArray(data) || data.length === 0) return null;
    return parseClaimedJob(data[0]);
  }

  async completeJob(input: CompleteMediaJobInput) {
    const { error } = await this.client.rpc("complete_media_processing_job", {
      p_duration_seconds: input.durationSeconds,
      p_height: input.height,
      p_job_id: input.jobId,
      p_original_checksum_sha256: input.originalChecksum,
      p_player_checksum_sha256: input.playerChecksum,
      p_player_file_size_bytes: input.playerSizeBytes,
      p_player_storage_path: input.playerStoragePath,
      p_width: input.width,
      p_worker_id: input.workerId
    });
    if (error) {
      throw new WorkerBackendError(
        "complete_failed",
        true,
        `Kon mediajob niet afronden (${error.code ?? "database_error"}).`
      );
    }
  }

  async failJob(input: FailMediaJobInput) {
    const { data, error } = await this.client.rpc("fail_media_processing_job", {
      p_error_code: input.errorCode,
      p_error_message: input.errorMessage,
      p_job_id: input.jobId,
      p_max_attempts: input.maxAttempts,
      p_retryable: input.retryable,
      p_worker_id: input.workerId
    });
    if (error) {
      throw new WorkerBackendError(
        "failure_report_failed",
        true,
        `Kon jobfout niet registreren (${error.code ?? "database_error"}).`
      );
    }
    if (data !== "queued" && data !== "failed") {
      throw new WorkerBackendError(
        "failure_report_invalid",
        true,
        "Database gaf een ongeldige jobstatus terug."
      );
    }
    return data;
  }

  async downloadOriginal(job: ClaimedMediaJob, destinationPath: string) {
    const signal = AbortSignal.timeout(this.storageTimeoutMs);
    let response: Response;
    try {
      response = await this.fetchImplementation(
        this.storageObjectUrl(job.storageBucket, job.storagePath),
        { headers: this.storageHeaders(), signal }
      );
    } catch {
      throw storageRequestError("source_download", signal.aborted);
    }
    if (!response.ok || !response.body) {
      throw storageError("source_download_failed", response.status);
    }
    try {
      const source = Readable.fromWeb(
        response.body as unknown as NodeReadableStream<Uint8Array>
      );
      await pipeline(source, createWriteStream(destinationPath, { flags: "wx" }));
    } catch {
      if (signal.aborted) throw storageRequestError("source_download", true);
      throw new WorkerBackendError(
        "source_download_failed",
        true,
        "Download van het bronbestand werd onderbroken."
      );
    }
  }

  async uploadPlayerVariant(
    job: ClaimedMediaJob,
    sourcePath: string,
    storagePath: string
  ) {
    const signal = AbortSignal.timeout(this.storageTimeoutMs);
    const request = {
      body: Readable.toWeb(createReadStream(sourcePath)) as unknown as BodyInit,
      duplex: "half",
      headers: {
        ...this.storageHeaders(),
        "cache-control": "max-age=31536000",
        "content-type": "video/mp4",
        "x-upsert": "true"
      },
      method: "POST",
      signal
    } satisfies RequestInit & { duplex: "half" };
    let response: Response;
    try {
      response = await this.fetchImplementation(
        this.storageObjectUrl(job.storageBucket, storagePath),
        request
      );
    } catch {
      throw storageRequestError("player_upload", signal.aborted);
    }
    if (!response.ok) {
      throw storageError("player_upload_failed", response.status);
    }
  }

  private storageHeaders() {
    return {
      apikey: this.serviceRoleKey,
      authorization: `Bearer ${this.serviceRoleKey}`
    };
  }

  private storageObjectUrl(bucket: string, path: string) {
    const encodedBucket = encodeURIComponent(bucket);
    const encodedPath = path.split("/").map(encodeURIComponent).join("/");
    return `${this.supabaseUrl}/storage/v1/object/${encodedBucket}/${encodedPath}`;
  }
}

function storageError(code: string, status: number) {
  const retryable = status === 408 || status === 429 || status >= 500;
  return new WorkerBackendError(
    code,
    retryable,
    `Storageverzoek mislukte met status ${status}.`
  );
}

function storageRequestError(
  phase: "player_upload" | "source_download",
  timedOut: boolean
) {
  return new WorkerBackendError(
    `${phase}_${timedOut ? "timeout" : "network_failed"}`,
    !timedOut,
    timedOut
      ? "Storageoverdracht overschreed de tijdslimiet."
      : "Storage was tijdelijk niet bereikbaar."
  );
}

function parseClaimedJob(value: unknown): ClaimedMediaJob {
  if (!isRecord(value)) throw invalidClaim();
  const fileSizeBytes = Number(value.file_size_bytes);
  const attemptCount = Number(value.attempt_count);
  const strings = {
    assetId: value.asset_id,
    jobId: value.job_id,
    mimeType: value.mime_type,
    originalFileName: value.original_file_name,
    storageBucket: value.storage_bucket,
    storagePath: value.storage_path,
    tenantId: value.tenant_id
  };
  if (
    !Object.values(strings).every((entry) => typeof entry === "string" && entry.length > 0) ||
    !Number.isSafeInteger(fileSizeBytes) ||
    fileSizeBytes <= 0 ||
    !Number.isInteger(attemptCount) ||
    attemptCount <= 0
  ) {
    throw invalidClaim();
  }
  return { ...strings, attemptCount, fileSizeBytes } as ClaimedMediaJob;
}

function invalidClaim() {
  return new WorkerBackendError(
    "claim_payload_invalid",
    false,
    "Database gaf een ongeldige mediajob terug."
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
