import type { createConfiguredMediaWorkerClient } from "./worker-backend";
import { queueDelay } from "./queue-wakeup";

export type PublishedDataRefreshClient = Pick<
  ReturnType<typeof createConfiguredMediaWorkerClient>,
  "rpc"
>;

export type PublishedDataRefreshRunResult =
  | { status: "idle" }
  | { snapshotId: string; status: "completed" | "retry"; tenantId: string }
  | { errorCode: string; snapshotId?: string; status: "failed"; tenantId?: string };

type ClaimedRefresh = { leaseToken: string; snapshotId: string; tenantId: string };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Refreshes database-backed published data only. The database owns the lease,
 * generation guard and retry queue; this runner never fetches provider data or
 * creates slide/playlist versions. Its client is the existing worker client.
 */
export class PublishedDataRefreshRunner {
  constructor(
    private readonly client: PublishedDataRefreshClient,
    private readonly options: { leaseSeconds?: number; workerId: string }
  ) {}

  async runOnce(signal?: AbortSignal): Promise<PublishedDataRefreshRunResult> {
    if (signal?.aborted) return { status: "idle" };
    let job: ClaimedRefresh | null = null;
    let errorCode = "published_data_refresh_claim_failed";
    try {
      const claim = await this.client.rpc("claim_published_data_refresh_v1", {
        p_lease_seconds: this.options.leaseSeconds ?? 60,
        p_worker_id: this.options.workerId
      });
      if (claim.error) throw new Error(errorCode);
      if (claim.data === null) return { status: "idle" };
      errorCode = "published_data_refresh_claim_invalid";
      job = parseClaim(claim.data);
      if (signal?.aborted) {
        errorCode = "published_data_refresh_cancelled";
        throw new Error(errorCode);
      }

      errorCode = "published_data_refresh_complete_failed";
      const complete = await this.client.rpc("complete_published_data_refresh_v1", leaseParameters(job));
      if (complete.error) throw new Error(errorCode);
      errorCode = "published_data_refresh_completion_invalid";
      if (!isRecord(complete.data) || (complete.data.status !== "completed" && complete.data.status !== "retry")) {
        throw new Error(errorCode);
      }
      return {
        snapshotId: job.snapshotId,
        status: complete.data.status,
        tenantId: job.tenantId
      };
    } catch {
      if (job) {
        try {
          await this.client.rpc("fail_published_data_refresh_v1", {
            ...leaseParameters(job),
            p_error_code: errorCode
          });
        } catch {
          // If failure recording also loses the database, the durable queue
          // remains recoverable when its existing lease expires.
        }
      }
      // Never copy database messages, details or credentials into diagnostics.
      return {
        errorCode,
        ...(job ? { snapshotId: job.snapshotId, tenantId: job.tenantId } : {}),
        status: "failed"
      };
    }
  }

  async loop({
    intervalMs = 1_000,
    onSettled = () => undefined,
    signal,
    waitForWork
  }: {
    intervalMs?: number;
    onSettled?: (result: PublishedDataRefreshRunResult) => void;
    signal: AbortSignal;
    waitForWork?: (signal: AbortSignal) => Promise<void>;
  }) {
    const delayMs = Number.isFinite(intervalMs) ? Math.min(60_000, Math.max(25, intervalMs)) : 1_000;
    while (!signal.aborted) {
      if (waitForWork) {
        try {
          await waitForWork(signal);
        } catch {
          if (signal.aborted) break;
          onSettled({ errorCode: "published_data_refresh_wait_failed", status: "failed" });
          await queueDelay(delayMs, signal);
          continue;
        }
      }
      if (signal.aborted) break;
      const result = await this.runOnce(signal);
      onSettled(result);
      if (result.status !== "completed" && (!waitForWork || result.status === "failed")) {
        await queueDelay(delayMs, signal);
      }
    }
  }
}

function parseClaim(data: unknown): ClaimedRefresh {
  if (!isRecord(data) || ![data.tenantId, data.snapshotId, data.leaseToken]
    .every((value) => typeof value === "string" && uuidPattern.test(value))) {
    throw new Error("published_data_refresh_claim_invalid");
  }
  return {
    leaseToken: data.leaseToken as string,
    snapshotId: data.snapshotId as string,
    tenantId: data.tenantId as string
  };
}

function leaseParameters(job: ClaimedRefresh) {
  return {
    p_lease_token: job.leaseToken,
    p_snapshot_id: job.snapshotId,
    p_tenant_id: job.tenantId
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
