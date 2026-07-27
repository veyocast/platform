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
  signal
}: {
  backend: DynamicRenderBackend;
  config: {
    lockTimeoutSeconds: number;
    maxAttempts: number;
    workerId: string;
  };
  renderer: StudioExternalRenderer;
  signal?: AbortSignal;
}): Promise<DynamicRenderRunResult> {
  const job = await backend.claimJob(
    config.workerId,
    config.lockTimeoutSeconds,
    config.maxAttempts
  );
  if (!job) return { status: "idle" };
  try {
    if (signal?.aborted) {
      throw new DynamicRenderBackendError(
        "dynamic_render_cancelled",
        true,
        "Dynamische render is tijdens afsluiten onderbroken."
      );
    }
    const svg = renderDynamicTemplate(
      { css: job.css, manifest: job.manifest, markup: job.markup },
      job.snapshotData
    );
    const bytes = await renderer.renderPng({
      height: job.manifest.canvas.height,
      signal,
      svg,
      width: job.manifest.canvas.width
    });
    const artifact = {
      byteLength: bytes.byteLength,
      bytes,
      checksumSha256: createHash("sha256").update(bytes).digest("hex"),
      height: job.manifest.canvas.height,
      storagePath: dynamicRenderStoragePath(job),
      width: job.manifest.canvas.width
    };
    await backend.uploadArtifact(job, artifact);
    await backend.completeJob(job, config.workerId, artifact);
    return {
      jobId: job.jobId,
      mediaAssetId: job.outputMediaAssetId,
      status: "completed"
    };
  } catch (error) {
    const failure = classifyDynamicRenderFailure(error);
    if (failure.code === "dynamic_render_lease_lost") {
      return failedResult(job, failure.code, "lease_lost");
    }
    const status = await backend.failJob(job, config.workerId, failure);
    return failedResult(
      job,
      failure.code,
      status === "queued" ? "retry_scheduled" : "failed"
    );
  }
}

export async function runDynamicRenderLoop({
  backend,
  config,
  intervalMs,
  onResult = () => undefined,
  renderer,
  signal
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
  signal: AbortSignal;
}) {
  while (!signal.aborted) {
    const result = await runDynamicRenderOnce({
      backend,
      config,
      renderer,
      signal
    });
    onResult(result);
    if (result.status === "idle") {
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
