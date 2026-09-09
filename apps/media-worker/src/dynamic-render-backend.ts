import {
  dynamicTemplateManifestSchema,
  playerDynamicTemplateAssetSchema,
  type PlayerDynamicTemplateAsset,
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
    const ids = collectDynamicRenderAssetIds(job.snapshotData);
    if (!ids.length) return {};
    const mediaAssets = await this.assetClient
      .from("media_assets")
      .select("id, kind")
      .eq("tenant_id", job.tenantId)
      .eq("status", "ready")
      .in("id", ids);
    if (mediaAssets.error) throw assetResolutionFailure();
    const tenantAssets = (mediaAssets.data ?? []) as DynamicMediaAssetRow[];
    const tenantAssetIds = tenantAssets.map((asset) => asset.id);
    const providerAssetIds = ids.filter((id) => !tenantAssetIds.includes(id));
    const [variants, providerVersions] = await Promise.all([
      tenantAssetIds.length
        ? this.assetClient
            .from("media_variants")
            .select("asset_id, variant_type, storage_bucket, storage_path, mime_type, file_size_bytes, checksum_sha256")
            .eq("tenant_id", job.tenantId)
            .in("variant_type", ["original", "player_1080p", "thumbnail"])
            .in("asset_id", tenantAssetIds)
        : Promise.resolve({ data: [], error: null }),
      providerAssetIds.length
        ? this.assetClient
            .from("provider_asset_versions")
            .select("id, storage_bucket, storage_path, mime_type, file_size_bytes, checksum_sha256")
            .in("id", providerAssetIds)
        : Promise.resolve({ data: [], error: null })
    ]);
    if (variants.error || providerVersions.error) throw assetResolutionFailure();
    return resolveDynamicRenderAssets({
      mediaAssets: tenantAssets,
      providerVersions: (providerVersions.data ?? []) as DynamicProviderAssetRow[],
      signUrl: async (asset) => {
        const signed = await this.assetClient!.storage
          .from(asset.storage_bucket)
          .createSignedUrl(asset.storage_path, 300);
        return signed.error ? null : signed.data?.signedUrl ?? null;
      },
      variants: (variants.data ?? []) as DynamicVariantRow[]
    });
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

type DynamicMediaAssetRow = {
  id: string;
  kind: string;
};

type DynamicStorageAssetRow = {
  checksum_sha256: string;
  file_size_bytes: number;
  mime_type: string;
  storage_bucket: string;
  storage_path: string;
};

type DynamicVariantRow = DynamicStorageAssetRow & {
  asset_id: string;
  variant_type: string;
};

type DynamicProviderAssetRow = DynamicStorageAssetRow & {
  id: string;
};

export async function resolveDynamicRenderAssets({
  mediaAssets,
  providerVersions,
  signUrl,
  variants
}: {
  mediaAssets: DynamicMediaAssetRow[];
  providerVersions: DynamicProviderAssetRow[];
  signUrl: (asset: DynamicStorageAssetRow) => Promise<string | null>;
  variants: DynamicVariantRow[];
}): Promise<Record<string, PlayerDynamicTemplateAsset>> {
  const entries = await Promise.all(mediaAssets.map(async (asset) => {
    const isVideo = asset.kind === "video";
    const delivery = variants.find((variant) =>
      variant.asset_id === asset.id &&
      variant.variant_type === (isVideo ? "player_1080p" : "original")
    );
    const poster = isVideo
      ? variants.find((variant) =>
          variant.asset_id === asset.id && variant.variant_type === "thumbnail"
        )
      : null;
    if (!delivery || (isVideo && !poster)) return null;
    const [url, posterUrl] = await Promise.all([
      signUrl(delivery),
      poster ? signUrl(poster) : Promise.resolve(null)
    ]);
    if (!url || (poster && !posterUrl)) return null;
    const parsed = playerDynamicTemplateAssetSchema.safeParse({
      bytes: Number(delivery.file_size_bytes),
      checksumSha256: delivery.checksum_sha256,
      mimeType: delivery.mime_type,
      ...(poster ? {
        posterBytes: Number(poster.file_size_bytes),
        posterChecksumSha256: poster.checksum_sha256,
        posterMimeType: "image/png",
        posterUrl
      } : {}),
      url
    });
    return parsed.success ? [asset.id, parsed.data] as const : null;
  }));
  const providerEntries = await Promise.all(providerVersions.map(async (asset) => {
    const url = await signUrl(asset);
    if (!url) return null;
    const parsed = playerDynamicTemplateAssetSchema.safeParse({
      bytes: Number(asset.file_size_bytes),
      checksumSha256: asset.checksum_sha256,
      mimeType: asset.mime_type,
      url
    });
    return parsed.success ? [asset.id, parsed.data] as const : null;
  }));
  return Object.fromEntries(
    [...entries, ...providerEntries].filter((entry) => entry !== null)
  );
}

function assetResolutionFailure() {
  return new DynamicRenderBackendError(
    "dynamic_asset_resolution_failed",
    true,
    "Thumbnailassets konden tijdelijk niet worden opgelost."
  );
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

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function collectDynamicRenderAssetIds(snapshot: unknown) {
  if (!isRecord(snapshot)) return [];
  const ids = new Set<string>();
  const add = (value: unknown) => {
    if (typeof value === "string" && uuidPattern.test(value)) ids.add(value);
  };
  const brand = isRecord(snapshot.brand) ? snapshot.brand : null;
  add(brand?.logoMediaAssetId);
  const menu = isRecord(snapshot.menu) ? snapshot.menu : null;
  collectMenuProductAssets(menu, add);
  collectMenuProductAssets(isRecord(snapshot.data) ? snapshot.data : null, add);
  const priceList = isRecord(snapshot.priceList) ? snapshot.priceList : null;
  if (Array.isArray(priceList?.sections)) {
    for (const sectionValue of priceList.sections.slice(0, 40)) {
      const section = isRecord(sectionValue) ? sectionValue : null;
      if (!Array.isArray(section?.products)) continue;
      for (const productValue of section.products.slice(0, 100)) {
        const product = isRecord(productValue) ? productValue : null;
        if (product?.photoVisible === true) add(product.imageMediaAssetId);
      }
    }
  }
  collectMenuDocumentAssets(snapshot.menuDocument, add);
  collectMenuDocumentAssets(priceList?.menuDocument, add);
  const news = isRecord(snapshot.news) ? snapshot.news : null;
  add(news?.providerLogoMediaAssetId);
  if (Array.isArray(news?.articles)) {
    for (const item of news.articles) if (isRecord(item)) {
      add(item.heroMediaAssetId);
      add(item.qrMediaAssetId);
    }
  }
  const sport = isRecord(snapshot.sport) ? snapshot.sport : null;
  const arrivalConfig = isRecord(sport?.arrivalConfig) ? sport.arrivalConfig : null;
  if (arrivalConfig?.showSponsor === true) add(arrivalConfig.sponsorMediaAssetId);
  if (Array.isArray(sport?.items)) {
    for (const item of sport.items) if (isRecord(item)) {
      add(item.logoMediaAssetId);
      add(item.homeLogoMediaAssetId);
      add(item.awayLogoMediaAssetId);
      add(item.photoMediaAssetId);
    }
  }
  const sportConfiguration = isRecord(sport?.configuration)
    ? sport.configuration
    : null;
  const sportPresentation = isRecord(sportConfiguration?.presentation)
    ? sportConfiguration.presentation
    : null;
  add(sportPresentation?.backgroundMediaAssetId);
  return [...ids].slice(0, 201);
}

function collectMenuProductAssets(
  menu: Record<string, unknown> | null,
  add: (value: unknown) => void
) {
  if (Array.isArray(menu?.products)) {
    for (const item of menu.products.slice(0, 100)) {
      if (isRecord(item)) add(item.imageMediaAssetId);
    }
  }
  if (!Array.isArray(menu?.categories)) return;
  for (const categoryValue of menu.categories.slice(0, 20)) {
    const category = isRecord(categoryValue) ? categoryValue : null;
    if (!Array.isArray(category?.products)) continue;
    for (const productValue of category.products.slice(0, 100)) {
      if (isRecord(productValue)) add(productValue.imageMediaAssetId);
    }
  }
}

function collectMenuDocumentAssets(
  value: unknown,
  add: (value: unknown) => void
) {
  const document = isRecord(value) ? value : null;
  if (!Array.isArray(document?.assets)) return;
  for (const assetValue of document.assets.slice(0, 100)) {
    if (isRecord(assetValue)) add(assetValue.assetId);
  }
}
