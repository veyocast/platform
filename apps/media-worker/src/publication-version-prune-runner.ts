import type { createConfiguredMediaWorkerClient } from "./worker-backend";
import { queueDelay } from "./queue-wakeup";

export type PublicationVersionPruneClient = Pick<
  ReturnType<typeof createConfiguredMediaWorkerClient>,
  "rpc"
>;

export type PublicationVersionPruneRunResult =
  | { status: "completed" | "idle" }
  | { errorCode: string; status: "failed" };

/** The service-only RPC owns reference checks and deletion transactions.
 * This runner retries queued retention work; it never deletes records itself
 * or copies database response details into operational diagnostics.
 */
export class PublicationVersionPruneRunner {
  constructor(private readonly client: PublicationVersionPruneClient) {}

  async runOnce(signal?: AbortSignal): Promise<PublicationVersionPruneRunResult> {
    if (signal?.aborted) return { status: "idle" };
    let errorCode = "publication_version_prune_failed";
    try {
      const result = await this.client.rpc("prune_queued_publication_versions_v1", { p_limit: 25 });
      if (result.error) throw new Error(errorCode);
      errorCode = "publication_version_prune_response_invalid";
      if (!isRecord(result.data) || (result.data.status !== "completed" && result.data.status !== "idle")) {
        throw new Error(errorCode);
      }
      return { status: result.data.status };
    } catch {
      return { errorCode, status: "failed" };
    }
  }

  async loop({
    intervalMs = 1_000,
    onSettled = () => undefined,
    signal,
    waitForWork
  }: {
    intervalMs?: number;
    onSettled?: (result: PublicationVersionPruneRunResult) => void;
    signal: AbortSignal;
    waitForWork?: (signal: AbortSignal) => Promise<void>;
  }) {
    const baseDelayMs = Number.isFinite(intervalMs) ? Math.min(60_000, Math.max(25, intervalMs)) : 1_000;
    let failures = 0;
    const settle = (result: PublicationVersionPruneRunResult) => {
      try { onSettled(result); }
      catch { /* Diagnostics must not stop durable retention retries. */ }
    };
    while (!signal.aborted) {
      let result: PublicationVersionPruneRunResult;
      try {
        if (waitForWork) await waitForWork(signal);
        if (signal.aborted) break;
        result = await this.runOnce(signal);
      } catch {
        if (signal.aborted) break;
        result = { errorCode: "publication_version_prune_wait_failed", status: "failed" };
      }
      settle(result);
      if (result.status === "failed") {
        failures = Math.min(12, failures + 1);
        await queueDelay(Math.min(60_000, baseDelayMs * 2 ** (failures - 1)), signal);
      } else {
        failures = 0;
        if (result.status === "idle" && !waitForWork) await queueDelay(baseDelayMs, signal);
      }
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
