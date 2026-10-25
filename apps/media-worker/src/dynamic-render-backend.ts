import {collectSyncSportMediaAssetIds} from '@veyocast/contracts';
import {
  dynamicTemplateManifestSchema,
  syncDynamicConfigurationSchema,
  syncSlideAssets,
  syncDomDescriptorMimeType,
  playerDynamicTemplateAssetSchema,
  type PlayerDynamicTemplateAsset,
  type SyncSlidePresentation,
  type DynamicTemplateManifest
} from "@veyocast/contracts";
import {createHash} from 'node:crypto';
import { createClient } from "@supabase/supabase-js";

export type ClaimedDynamicRenderJob = {
  publishedRefresh?: boolean;
  /** Present on the additive claim path; never inferred from another UUID. */
  templateVersionId?:string;
  templateSlug?:string;
  snapshotHash?:string;
  slideVersionId?:string;
  leaseToken?:string;
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
  dom?:{schemaVersion:2;mimeType:typeof syncDomDescriptorMimeType;durationMs:number;presentation:SyncSlidePresentation};
  sync?: {
    mimeType:'image/png'|'video/mp4';durationMs:number;presentation:SyncSlidePresentation;
    poster:{bytes:Uint8Array;byteLength:number;checksumSha256:string;storagePath:string};
  };
  byteLength: number;
  bytes: Uint8Array;
  checksumSha256: string;
  height: number;
  storagePath: string;
  width: number;
};

export interface DynamicRenderBackend {
  renewJob?(job:ClaimedDynamicRenderJob,workerId:string):Promise<boolean>;
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
      list?(prefix:string,options:{limit:number}):Promise<{data:Array<{name:string}>|null;error:unknown}>;
      remove?(paths:string[]):Promise<{error:unknown}>;
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
  private readonly binaryClient: DynamicRpcClient;

  constructor(
    supabaseUrl: string,
    serviceRoleKey: string,
    client?: DynamicRpcClient,
    private readonly queueProfile:'all'|'dom'|'legacy'='all'
  ) {
    this.client = client ?? createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    }) as unknown as DynamicRpcClient;
    this.assetClient = client ? null : createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    this.binaryClient=client??createClient(supabaseUrl,serviceRoleKey,{
      auth:{autoRefreshToken:false,persistSession:false},
      global:{fetch:(input,init)=>fetch(input,{...init,signal:init?.signal?AbortSignal.any([init.signal,AbortSignal.timeout(15_000)]):AbortSignal.timeout(15_000)})},
    }) as unknown as DynamicRpcClient;
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
      this.queueProfile==='dom'?"claim_sync_dom_ready_job_v2":this.queueProfile==='legacy'?"claim_dynamic_render_job_v3":"claim_dynamic_render_job_v4",
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
    if(isRecord(data[0])&&data[0].cleanup_only===true){
      await this.cleanupRetiredBinary(data[0],workerId);
      return null;
    }
    const job=parseClaimedDynamicRenderJob(data[0]);
    if(!job.leaseToken)throw invalidClaim();
    return job;
  }

  async renewJob(job:ClaimedDynamicRenderJob,workerId:string){
    const {data,error}=await(job.publishedRefresh?this.binaryClient:this.client).rpc(job.publishedRefresh?'renew_sync_binary_render_v1':'renew_dynamic_render_lease_v2',job.publishedRefresh?{p_tenant_id:job.tenantId,p_snapshot_id:job.snapshotId,p_worker_id:workerId,p_lease_token:job.leaseToken}:{p_job_id:job.jobId,p_worker_id:workerId,p_lease_token:job.leaseToken});
    if(error)throw new DynamicRenderBackendError('dynamic_lease_renewal_failed',true,'De renderopdracht kon tijdelijk niet worden verlengd.');
    return data===true;
  }

  async uploadArtifact(
    job: ClaimedDynamicRenderJob,
    artifact: DynamicRenderArtifact
  ) {
    assertArtifactPath(job, artifact.storagePath,artifact.dom?.mimeType??artifact.sync?.mimeType,artifact.checksumSha256);
    if(artifact.dom){
      if(job.publishedRefresh||artifact.byteLength>550000)throw invalidClaim();
      assertSourceArtifactBytes(artifact.bytes,artifact.byteLength,artifact.checksumSha256);
    }
    if(job.publishedRefresh){
      if(!artifact.sync||artifact.byteLength>64*1024*1024||artifact.sync.poster.byteLength>16*1024*1024)throw new DynamicRenderBackendError('binary_cache_artifact_budget_exceeded',false,'De volledige uitvoer past niet binnen het begrensde Player-cachebudget. De laatste goede uitzending blijft behouden.');
      await this.clearBinarySlot(job.tenantId,job.outputMediaAssetId,job);
    }
    if(artifact.sync){
      assertSourceArtifactBytes(artifact.bytes,artifact.byteLength,artifact.checksumSha256);
      const poster=artifact.sync.poster;
      assertArtifactPath(job,poster.storagePath,'image/png',poster.checksumSha256);
      assertSourceArtifactBytes(poster.bytes,poster.byteLength,poster.checksumSha256);
      // Refresh paths include a never-reused lease UUID as well as the SHA.
      // Even identical bytes from a later attempt have a different name.
      if(poster.storagePath!==artifact.storagePath)await this.uploadBytes(poster.storagePath,poster.bytes,'image/png',job.publishedRefresh);
    }
    await this.uploadBytes(artifact.storagePath,artifact.bytes,artifact.dom?.mimeType??artifact.sync?.mimeType??'image/png',job.publishedRefresh);
  }

  private async uploadBytes(path:string,bytes:Uint8Array,mimeType:string,publishedRefresh=false){
    const { error } = await (publishedRefresh?this.binaryClient:this.client).storage
      .from("tenant-media")
      .upload(path, bytes, {
        cacheControl: "31536000",
        contentType: mimeType,
        upsert: true
      });
    if (error) {
      throw new DynamicRenderBackendError(
        "dynamic_artifact_upload_failed",
        true,
        "De volledige dynamische weergave kon tijdelijk niet naar mediaopslag worden geschreven."
      );
    }
  }

  async completeJob(
    job: ClaimedDynamicRenderJob,
    workerId: string,
    artifact: Omit<DynamicRenderArtifact, "bytes">
  ) {
    const { error } = await (job.publishedRefresh?this.binaryClient:this.client).rpc(
      job.publishedRefresh?"complete_sync_binary_render_v1":artifact.dom?"complete_dynamic_dom_job_v2":"complete_dynamic_render_job_v2",
      {
        ...(job.publishedRefresh?{p_tenant_id:job.tenantId,p_snapshot_id:job.snapshotId}:{p_job_id:job.jobId}),
        p_worker_id: workerId,
        p_lease_token:job.leaseToken,
        p_artifact:{byteLength:artifact.byteLength,checksumSha256:artifact.checksumSha256,height:artifact.height,width:artifact.width,storagePath:artifact.storagePath,
          ...(artifact.dom??{}),...(artifact.sync?{mimeType:artifact.sync.mimeType,durationMs:artifact.sync.durationMs,presentation:artifact.sync.presentation,poster:{byteLength:artifact.sync.poster.byteLength,checksumSha256:artifact.sync.poster.checksumSha256,storagePath:artifact.sync.poster.storagePath}}:{})}
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
    const { data, error } = await (job.publishedRefresh?this.binaryClient:this.client).rpc(
      job.publishedRefresh?"fail_sync_binary_render_v1":"fail_dynamic_render_job_v2",
      {
        p_error_code: failure.code.slice(0, 80),
        ...(job.publishedRefresh?{p_tenant_id:job.tenantId,p_snapshot_id:job.snapshotId}:{p_error_detail:failure.message.replace(/[\r\n]+/g, " ").slice(0,500),p_job_id:job.jobId}),
        p_lease_token:job.leaseToken,
        p_retryable: failure.retryable,
        p_worker_id: workerId
      }
    );
    if (error || (data !== "queued" && data !== "failed")) {
      throw new DynamicRenderBackendError(
        error?.code==='55000'?'dynamic_render_lease_lost':"dynamic_failure_report_failed",
        error?.code!=='55000',
        "De mislukte dynamische render kon niet worden geregistreerd."
      );
    }
    return data;
  }

  private async clearBinarySlot(tenantId:string,slotId:string,job?:ClaimedDynamicRenderJob){
    if(!uuidPattern.test(tenantId)||!uuidPattern.test(slotId))throw invalidClaim();
    const prefix=`tenants/${tenantId}/assets/${slotId}/sync-dynamic`,bucket=this.binaryClient.storage.from('tenant-media');
    if(!bucket.list||!bucket.remove)throw new DynamicRenderBackendError('binary_cleanup_unavailable',true,'De begrensde Player-cache kan tijdelijk niet worden gecontroleerd.');
    // Only the inactive server-owned slot is eligible. It has no Media row and
    // cannot be an upload destination for a browser. Unexpected entries fail
    // closed; no recursive/bucket deletion or tenant-wide listing is used.
    const result=await bucket.list(prefix,{limit:100});
    if(result.error||!result.data||result.data.length>=100||result.data.some(file=>!/^(?:[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}-)?[a-f0-9]{64}\.(png|mp4)$/.test(file.name)))throw new DynamicRenderBackendError('binary_storage_cleanup_failed',true,'De oude cachebestanden konden niet veilig worden gecontroleerd.');
    // Capture first, validate second. A stalled listing may see a successor's
    // current files, in which case validation must reject before deletion.
    // After successful validation, a future successor's unique names cannot
    // be in this immutable deletion set, even if this worker pauses again.
    if(job){
      const checked=await this.binaryClient.rpc('validate_sync_binary_storage_v1',{p_tenant_id:tenantId,p_snapshot_id:job.snapshotId,p_lease_token:job.leaseToken,p_slot_id:slotId});
      if(checked.error||checked.data!==true)throw new DynamicRenderBackendError('dynamic_render_lease_lost',false,'De renderopdracht is door een andere poging overgenomen.');
    }
    if(result.data.length){const removed=await bucket.remove(result.data.map(file=>prefix+'/'+file.name));if(removed.error)throw new DynamicRenderBackendError('binary_storage_cleanup_failed',true,'De oude cachebestanden konden tijdelijk niet worden verwijderd.');}
  }

  private async cleanupRetiredBinary(value:Record<string,unknown>,workerId:string){
    if(![value.tenant_id,value.snapshot_id,value.lease_token].every(id=>typeof id==='string'&&uuidPattern.test(id))||!Array.isArray(value.slot_ids)||value.slot_ids.length!==3||value.slot_ids.some(id=>typeof id!=='string'||!uuidPattern.test(id)))throw invalidClaim();
    const args={p_tenant_id:value.tenant_id,p_snapshot_id:value.snapshot_id,p_worker_id:workerId,p_lease_token:value.lease_token};
    try{
      for(const slot of value.slot_ids)await this.clearBinarySlot(value.tenant_id as string,slot);
      const result=await this.binaryClient.rpc('finish_sync_binary_cleanup_v1',{...args,p_success:true});
      if(result.error||result.data!==true)throw new DynamicRenderBackendError('dynamic_render_lease_lost',false,'De oude cache is door een andere poging overgenomen.');
    }catch(error){await this.binaryClient.rpc('finish_sync_binary_cleanup_v1',{...args,p_success:false}).catch(()=>undefined);throw error;}
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
  job: Pick<ClaimedDynamicRenderJob, "outputMediaAssetId" | "tenantId" | "publishedRefresh" | "leaseToken">,
  mimeType?:'image/png'|'video/mp4'|typeof syncDomDescriptorMimeType,checksumSha256?:string,
) {
  if(mimeType){
    if(!checksumSha256||!/^[a-f0-9]{64}$/.test(checksumSha256))throw new DynamicRenderBackendError('dynamic_storage_path_invalid',false,'Het gecontroleerde bronbestand mist een geldige checksum.');
    if(job.publishedRefresh&&(!job.leaseToken||!uuidPattern.test(job.leaseToken)))throw invalidClaim();
    return `tenants/${job.tenantId}/assets/${job.outputMediaAssetId}/${mimeType===syncDomDescriptorMimeType?'sync-dom':'sync-dynamic'}/${job.publishedRefresh?job.leaseToken+'-':''}${checksumSha256}.${mimeType===syncDomDescriptorMimeType?'json':mimeType==='video/mp4'?'mp4':'png'}`;
  }
  return `tenants/${job.tenantId}/assets/${job.outputMediaAssetId}/dynamic-slide.png`;
}

export function parseClaimedDynamicRenderJob(
  value: unknown
): ClaimedDynamicRenderJob {
  if (!isRecord(value)) throw invalidClaim();
  if(value.published_refresh!==undefined&&(value.published_refresh!==true||value.job_id!==value.snapshot_id||![value.tenant_id,value.snapshot_id,value.output_media_asset_id].every(id=>typeof id==='string'&&uuidPattern.test(id))))throw invalidClaim();
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
    ...(value.published_refresh===true?{publishedRefresh:true}:{}),
    ...parseModernClaimIdentity(value),
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
  storagePath: string,mimeType?:'image/png'|'video/mp4'|typeof syncDomDescriptorMimeType,checksumSha256?:string,
) {
  if (storagePath !== dynamicRenderStoragePath(job,mimeType,checksumSha256)) {
    throw new DynamicRenderBackendError(
      "dynamic_storage_path_invalid",
      false,
      "Het dynamische renderpad valt buiten de verwachte tenantresource."
    );
  }
}

function assertSourceArtifactBytes(bytes:Uint8Array,length:number,sha:string){
 if(bytes.byteLength!==length||createHash('sha256').update(bytes).digest('hex')!==sha)throw new DynamicRenderBackendError('sync_dynamic_artifact_integrity_invalid',false,'De volledige bronweergave kon niet worden geverifieerd.');
}
function parseModernClaimIdentity(value:Record<string,unknown>){
 const fields=['template_version_id','template_slug','source_revision_hash','dynamic_slide_version_id','lease_token'];
 if(!fields.some(field=>value[field]!==undefined))return {};
 if(![value.template_version_id,value.dynamic_slide_version_id,value.lease_token].every(id=>typeof id==='string'&&uuidPattern.test(id))||typeof value.template_slug!=='string'||!value.template_slug||typeof value.source_revision_hash!=='string'||!/^[a-f0-9]{64}$/.test(value.source_revision_hash))throw invalidClaim();
 return {templateVersionId:value.template_version_id as string,templateSlug:value.template_slug,snapshotHash:value.source_revision_hash,slideVersionId:value.dynamic_slide_version_id as string,leaseToken:value.lease_token as string};
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
  const sync=syncDynamicConfigurationSchema.safeParse(snapshot.syncConfiguration);
  if(sync.success)for(const asset of syncSlideAssets(sync.data.seed))if(asset.kind==='tenant')add(asset.mediaAssetId);
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
  for(const id of collectSyncSportMediaAssetIds(snapshot))add(id);
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
