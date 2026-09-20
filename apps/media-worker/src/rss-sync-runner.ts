import {
  RssParseError,
  parseRssOrAtom
} from "@veyocast/integrations";
import {
  SafeRssFetchError,
  fetchSafeRss
} from "@veyocast/integrations/server";
import { createClient } from "@supabase/supabase-js";

import {
  prepareRssMediaArtifacts,
  type RssMediaArtifact
} from "./rss-media";

export type ClaimedRssSync = {
  dataSourceId: string;
  runId: string;
  sourceUrl: string;
  tenantId: string;
};

export type RssSyncRunResult =
  | { status: "idle" }
  | {
      dataSourceId: string;
      errorCode?: string;
      itemCount?: number;
      runId: string;
      status: "completed" | "failed";
    };

type RpcClient = {
  rpc(
    functionName: string,
    parameters: Record<string, unknown>
  ): Promise<{ data: unknown; error: { code?: string } | null }>;
  storage?: {
    from(bucket: string): {
      exists(path: string): Promise<{ data: boolean; error: { status?: number } | null }>;
      upload(
        path: string,
        bytes: Uint8Array,
        options: Record<string, unknown>
      ): Promise<{ error: { message?: string; statusCode?: string } | null }>;
    };
  };
};

export class SupabaseRssSyncBackend {
  private readonly client: RpcClient;

  constructor(
    supabaseUrl: string,
    serviceRoleKey: string,
    client?: RpcClient
  ) {
    this.client = client ?? createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    }) as unknown as RpcClient;
  }

  async claim(workerId: string, lockTimeoutSeconds: number) {
    const result = await this.client.rpc("claim_due_rss_sync_v1", {
      p_lock_timeout_seconds: lockTimeoutSeconds,
      p_worker_id: workerId
    });
    if (result.error) throw new Error("rss_sync_claim_failed");
    if (!Array.isArray(result.data) || !result.data.length) return null;
    return parseClaim(result.data[0]);
  }

  async complete(
    job: ClaimedRssSync,
    workerId: string,
    articles: unknown[],
    media: RssMediaArtifact[]
  ) {
    const result = await this.client.rpc("complete_scheduled_rss_sync_v2", {
      p_articles: articles,
      p_media_assets: media.map(toMediaPayload),
      p_run_id: job.runId,
      p_worker_id: workerId
    });
    if (result.error || !Number.isSafeInteger(Number(result.data))) {
      throw new Error("rss_sync_complete_failed");
    }
    return Number(result.data);
  }

  async uploadMedia(media: RssMediaArtifact[]) {
    if (!this.client.storage) throw new Error("rss_media_storage_unavailable");
    for (const artifact of media) {
      // These paths include a tenant-scoped identity derived from the bytes.
      // Re-uploading identical bytes invalidates the CDN for no content change.
      const bucket = this.client.storage.from("tenant-media");
      const existing = await bucket.exists(artifact.storagePath);
      if (existing.data) continue;
      if (existing.error && existing.error.status !== 404 && existing.error.status !== 400) {
        throw new Error("rss_media_lookup_failed");
      }
      const result = await bucket.upload(artifact.storagePath, artifact.bytes, {
          cacheControl: "31536000",
          contentType: artifact.mimeType,
          upsert: false
        });
      // A concurrent producer may have inserted the same immutable content.
      if (result.error && result.error.statusCode !== "409") throw new Error("rss_media_upload_failed");
    }
  }

  async fail(
    job: ClaimedRssSync,
    workerId: string,
    code: string,
    message: string
  ) {
    const result = await this.client.rpc("fail_scheduled_rss_sync_v1", {
      p_error_code: code.slice(0, 80),
      p_error_detail: message.replace(/[\r\n]+/g, " ").slice(0, 500),
      p_run_id: job.runId,
      p_worker_id: workerId
    });
    if (result.error) throw new Error("rss_sync_failure_report_failed");
  }
}

export async function runRssSyncOnce({
  backend,
  lockTimeoutSeconds,
  workerId
}: {
  backend: SupabaseRssSyncBackend;
  lockTimeoutSeconds: number;
  workerId: string;
}): Promise<RssSyncRunResult> {
  const job = await backend.claim(workerId, lockTimeoutSeconds);
  if (!job) return { status: "idle" };
  try {
    const response = await fetchSafeRss(job.sourceUrl);
    const feed = parseRssOrAtom(response.body, response.finalUrl);
    const media = await prepareRssMediaArtifacts(job, feed);
    await backend.uploadMedia(media);
    const heroAssetByExternalId = new Map(
      media.flatMap((asset) =>
        asset.role === "article_hero" && asset.externalId
          ? [[asset.externalId, asset.assetId] as const]
          : []
      )
    );
    const qrAssetByExternalId = new Map(
      media.flatMap((asset) =>
        asset.role === "article_qr" && asset.externalId
          ? [[asset.externalId, asset.assetId] as const]
          : []
      )
    );
    const articles = feed.articles.map((article) => ({
      ...article,
      heroMediaAssetId:
        heroAssetByExternalId.get(article.externalId) ?? null,
      qrMediaAssetId:
        qrAssetByExternalId.get(article.externalId) ?? null
    }));
    const itemCount = await backend.complete(
      job,
      workerId,
      articles,
      media
    );
    return {
      dataSourceId: job.dataSourceId,
      itemCount,
      runId: job.runId,
      status: "completed"
    };
  } catch (error) {
    const failure = classifyRssSyncFailure(error);
    await backend.fail(job, workerId, failure.code, failure.message);
    return {
      dataSourceId: job.dataSourceId,
      errorCode: failure.code,
      runId: job.runId,
      status: "failed"
    };
  }
}

export async function runRssSyncLoop({
  backend,
  intervalMs,
  lockTimeoutSeconds,
  onResult = () => undefined,
  signal,
  workerId
}: {
  backend: SupabaseRssSyncBackend;
  intervalMs: number;
  lockTimeoutSeconds: number;
  onResult?: (result: RssSyncRunResult) => void;
  signal: AbortSignal;
  workerId: string;
}) {
  while (!signal.aborted) {
    const result = await runRssSyncOnce({
      backend,
      lockTimeoutSeconds,
      workerId
    });
    onResult(result);
    if (result.status === "idle") await abortableDelay(intervalMs, signal);
  }
}

function toMediaPayload(artifact: RssMediaArtifact) {
  return {
    assetId: artifact.assetId,
    checksumSha256: artifact.checksumSha256,
    externalId: artifact.externalId,
    fileSizeBytes: artifact.fileSizeBytes,
    height: artifact.height,
    mimeType: artifact.mimeType,
    role: artifact.role,
    storagePath: artifact.storagePath,
    title: artifact.title,
    width: artifact.width
  };
}

function parseClaim(value: unknown): ClaimedRssSync {
  if (
    !isRecord(value) ||
    typeof value.run_id !== "string" ||
    typeof value.tenant_id !== "string" ||
    typeof value.data_source_id !== "string" ||
    typeof value.source_url !== "string"
  ) {
    throw new Error("rss_sync_claim_invalid");
  }
  return {
    dataSourceId: value.data_source_id,
    runId: value.run_id,
    sourceUrl: value.source_url,
    tenantId: value.tenant_id
  };
}

function classifyRssSyncFailure(error: unknown) {
  if (error instanceof SafeRssFetchError || error instanceof RssParseError) {
    return { code: error.code, message: error.message };
  }
  return {
    code: "rss_sync_internal_error",
    message: "De periodieke RSS-sync is door een interne fout onderbroken."
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function abortableDelay(milliseconds: number, signal: AbortSignal) {
  if (signal.aborted) return;
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(resolve, milliseconds);
    signal.addEventListener("abort", () => {
      clearTimeout(timeout);
      resolve();
    }, { once: true });
  });
}
