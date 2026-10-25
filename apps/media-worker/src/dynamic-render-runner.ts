import { createHash } from "node:crypto";

import {
  DynamicTemplateError,
  renderDynamicTemplate
} from "@veyocast/integrations";

import {
  DynamicRenderBackendError,
  dynamicRenderStoragePath,
  type ClaimedDynamicRenderJob,
  type DynamicRenderBackend
} from "./dynamic-render-backend";
import type { StudioExternalRenderer } from "./studio-render-image";
import type { ReactDomDynamicThumbnailRenderer } from "./dynamic-react-thumbnail";
import {renderSyncDynamicArtifact,prepareSyncDynamicDescriptor} from './sync-dynamic-render';
import {createDynamicRenderLease} from './dynamic-render-lease';
import {prepareMenuDomDescriptor}from'./menu-dom-render';

export type DynamicRenderRunResult =
  | { status: "idle" }
  | {
      errorCode?: string;
      jobId: string;
      mediaAssetId: string;
      status: "completed" | "failed" | "lease_lost" | "retry_scheduled";
    };

export async function runDynamicRenderOnce({
  backend,
  config,
  renderer,
  reactDomRenderer,
  signal,
  sourceRenderer=renderSyncDynamicArtifact,
  storageOrigin=process.env.SUPABASE_URL,
}: {
  backend: DynamicRenderBackend;
  config: {
    lockTimeoutSeconds: number;
    maxAttempts: number;
    workerId: string;
  };
  renderer: StudioExternalRenderer;
  reactDomRenderer?: Pick<ReactDomDynamicThumbnailRenderer,'renderPng'>;
  signal?: AbortSignal;
  sourceRenderer?:typeof renderSyncDynamicArtifact;
  storageOrigin?:string;
}): Promise<DynamicRenderRunResult> {
  const job = await backend.claimJob(
    config.workerId,
    config.lockTimeoutSeconds,
    config.maxAttempts
  );
  if (!job) return { status: "idle" };
  const lease=createDynamicRenderLease(backend,job,config,signal);
  try {
    await lease.begin();
    signal=lease.signal;
    if (signal?.aborted) {
      throw new DynamicRenderBackendError(
        "dynamic_render_cancelled",
        true,
        "Dynamische render is tijdens afsluiten onderbroken."
      );
    }
    const requiresSource=Boolean(job.snapshotData&&typeof job.snapshotData==='object'&&Object.hasOwn(job.snapshotData,'syncConfiguration'));
    if(requiresSource){
      if(!job.leaseToken||!backend.renewJob)throw new DynamicRenderBackendError('sync_dynamic_lease_unavailable',false,'De gekoppelde bronweergave vereist een actuele beveiligde renderopdracht.');
      const assets=await backend.resolveAssets?.(job)??{};
      if(!job.publishedRefresh&&(job.snapshotData as Record<string,unknown>).syncPlaybackProtocol===2){
        const prepared=prepareSyncDynamicDescriptor({job,assets});
        const artifact={...prepared,storagePath:dynamicRenderStoragePath(job,prepared.dom.mimeType,prepared.checksumSha256)};
        await lease.check();await backend.uploadArtifact(job,artifact);await lease.prepareCompletion();
        await backend.completeJob(job,config.workerId,artifact);
        return {jobId:job.jobId,mediaAssetId:job.outputMediaAssetId,status:'completed'};
      }
      const rendered=await sourceRenderer({job,renderer,assets,storageOrigin,signal});
      const artifact={bytes:rendered.bytes,byteLength:rendered.byteLength,checksumSha256:rendered.checksumSha256,height:rendered.height,width:rendered.width,storagePath:dynamicRenderStoragePath(job,rendered.mimeType,rendered.checksumSha256),sync:{mimeType:rendered.mimeType,durationMs:rendered.durationMs,presentation:rendered.presentation,poster:{...rendered.poster,storagePath:dynamicRenderStoragePath(job,'image/png',rendered.poster.checksumSha256)}}};
      await lease.check();
      await backend.uploadArtifact(job,artifact);
      await lease.prepareCompletion();
      await backend.completeJob(job,config.workerId,artifact);
      return {jobId:job.jobId,mediaAssetId:job.outputMediaAssetId,status:'completed'};
    }
    const menuV2=Boolean(job.snapshotData&&typeof job.snapshotData==='object'&&(job.snapshotData as Record<string,unknown>).syncPlaybackProtocol===2);
    if(menuV2&&(!job.leaseToken||!backend.renewJob))throw new DynamicRenderBackendError('menu_dom_lease_unavailable',false,'De menuweergave vereist een actuele beveiligde opdracht.');
    if(menuV2&&!job.publishedRefresh){
      const prepared=prepareMenuDomDescriptor(job,await backend.resolveAssets?.(job)??{});
      const artifact={...prepared,storagePath:dynamicRenderStoragePath(job,prepared.menuDom.mimeType,prepared.checksumSha256)};
      await lease.check();await backend.uploadArtifact(job,artifact);await lease.prepareCompletion();await backend.completeJob(job,config.workerId,artifact);
      return{jobId:job.jobId,mediaAssetId:job.outputMediaAssetId,status:'completed'};
    }
    const requiresSites=Boolean(job.snapshotData&&typeof job.snapshotData==='object'&&(
      (job.snapshotData as Record<string,unknown>).sitesConfiguration||
      ((job.snapshotData as {menuDocument?:{sitesConfiguration?:unknown}}).menuDocument?.sitesConfiguration)
      ||(job.snapshotData as {priceList?:{menuDocument?:{sitesConfiguration?:unknown}}}).priceList?.menuDocument?.sitesConfiguration
      ||(job.snapshotData as {themePresentation?:{selection?:{ref?:{id?:string}}}}).themePresentation?.selection?.ref?.id==='onzetrots-tv'
    ));
    if(requiresSites&&!reactDomRenderer)throw new DynamicRenderBackendError('dynamic_sites_renderer_unavailable',true,'De gedeelde slide-renderer is niet beschikbaar. De laatste goede slide blijft behouden.');
    let bytes: Uint8Array | null = null;
    if (reactDomRenderer) {
      try {
        bytes = await reactDomRenderer.renderPng({
          assets: await backend.resolveAssets?.(job) ?? {},
          job,
          signal
        });
      } catch (error) {
        if(requiresSites)throw error;
        bytes = null;
      }
    }
    if (!bytes) {
      const svg = renderDynamicTemplate(
        { css: job.css, manifest: job.manifest, markup: job.markup },
        job.snapshotData
      );
      bytes = await renderer.renderPng({
        height: job.manifest.canvas.height,
        signal,
        svg,
        width: job.manifest.canvas.width
      });
    }
    const menuBinary=menuV2?{...prepareMenuDomDescriptor(job,await backend.resolveAssets?.(job)??{}).menuDom,mimeType:'image/png' as const}:undefined;
    const checksumSha256=createHash('sha256').update(bytes).digest('hex');
    const artifact = {
      byteLength: bytes.byteLength,
      bytes,
      checksumSha256,
      height: job.manifest.canvas.height,
      storagePath: menuBinary?dynamicRenderStoragePath(job,'image/png',checksumSha256):dynamicRenderStoragePath(job),
      ...(menuBinary?{menuBinary}:{}),
      width: job.manifest.canvas.width
    };
    await backend.uploadArtifact(job, artifact);
    await lease.prepareCompletion();
    await backend.completeJob(job, config.workerId, artifact);
    return {
      jobId: job.jobId,
      mediaAssetId: job.outputMediaAssetId,
      status: "completed"
    };
  } catch (error) {
    await lease.stop();
    const failure = classifyDynamicRenderFailure(lease.error??error);
    if (failure.code === "dynamic_render_lease_lost") {
      return failedResult(job, failure.code, "lease_lost");
    }
    let status:'failed'|'queued';
    try{status=await backend.failJob(job, config.workerId, failure);}catch(reportError){if(reportError instanceof DynamicRenderBackendError&&reportError.code==='dynamic_render_lease_lost')return failedResult(job,reportError.code,'lease_lost');throw reportError;}
    return failedResult(
      job,
      failure.code,
      status === "queued" ? "retry_scheduled" : "failed"
    );
  }finally{
    await lease.stop();
  }
}

export async function runDynamicRenderLoop({
  backend,
  config,
  intervalMs,
  onResult = () => undefined,
  renderer,
  reactDomRenderer,
  signal,
  waitForWork
}: {
  backend: DynamicRenderBackend;
  config: {
    lockTimeoutSeconds: number;
    maxAttempts: number;
    workerId: string;
  };
  intervalMs: number;
  onResult?: (result: DynamicRenderRunResult) => void;
  renderer: StudioExternalRenderer;
  reactDomRenderer?: Pick<ReactDomDynamicThumbnailRenderer,'renderPng'>;
  signal: AbortSignal;
  waitForWork?: (signal: AbortSignal) => Promise<void>;
}) {
  while (!signal.aborted) {
    if (waitForWork) await waitForWork(signal);
    if (signal.aborted) break;
    const result = await runDynamicRenderOnce({
      backend,
      config,
      renderer,
      reactDomRenderer,
      signal
    });
    onResult(result);
    if (result.status === "idle" && !waitForWork) {
      await abortableDelay(intervalMs, signal);
    }
  }
}

export function classifyDynamicRenderFailure(error: unknown): {
  code: string;
  message: string;
  retryable: boolean;
} {
  if (error instanceof DynamicTemplateError) {
    return { code: error.code, message: error.message, retryable: false };
  }
  if (error instanceof DynamicRenderBackendError) {
    return {
      code: error.code,
      message: error.message,
      retryable: error.retryable
    };
  }
  return {
    code: "dynamic_render_internal_error",
    message: "Dynamische render is door een interne workerfout onderbroken.",
    retryable: true
  };
}

function failedResult(
  job: ClaimedDynamicRenderJob,
  errorCode: string,
  status: "failed" | "lease_lost" | "retry_scheduled"
): DynamicRenderRunResult {
  return {
    errorCode,
    jobId: job.jobId,
    mediaAssetId: job.outputMediaAssetId,
    status
  };
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
