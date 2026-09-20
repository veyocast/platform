export type RenderQueue = "media" | "studio" | "dynamic";
export type QueueHint = Record<RenderQueue, boolean>;

/** One small shared readiness read replaces three permanent empty claim loops.
 * Hints never grant a lease. Existing claim RPCs remain the authority; the
 * safety claim also reaps expired/cancelled leases when no new work arrives.
 */
export class QueueWakeup {
  private ready: QueueHint = { media: false, studio: false, dynamic: false };
  private safetyAt: QueueHintTimes = { media: 0, studio: 0, dynamic: 0 };
  private nextCheckAt = 0;
  private pending: Promise<void> | null = null;
  private failures = 0;
  private retryAfterUntil = 0;
  readonly counters = { hintRequests: 0, hintFailures: 0, emptyClaims: 0, workClaims: 0 };

  constructor(private readonly read: () => Promise<QueueHint>, private readonly options: {
    now?: () => number; random?: () => number; intervalMs?: number;
  } = {}) {}

  settled(queue: RenderQueue, status: string) {
    const work = status !== "idle";
    this.counters[work ? "workClaims" : "emptyClaims"] += 1;
    // Drain completed work immediately. Errors/retries wait for a fresh hint.
    this.ready[queue] = status === "completed";
  }

  async wait(queue: RenderQueue, signal: AbortSignal) {
    const now = this.options.now ?? Date.now;
    const random = this.options.random ?? Math.random;
    while (!signal.aborted) {
      const at = now();
      if (at < this.retryAfterUntil) {
        await queueDelay(Math.min(60_000, this.retryAfterUntil - at), signal);
        continue;
      }
      if (this.ready[queue] || at >= this.safetyAt[queue]) {
        this.ready[queue] = false;
        this.safetyAt[queue] = at + 55_000 + Math.floor(random() * 5_000);
        return;
      }
      if (at >= this.nextCheckAt) {
        if (!this.pending) {
          this.counters.hintRequests += 1;
          this.pending = this.read().then((hint) => {
            this.ready = hint;
            this.failures = 0;
          }, (error: unknown) => {
            this.failures = Math.min(5, this.failures + 1);
            this.counters.hintFailures += 1;
            const retry = (error as { retryAfterMs?: number } | null)?.retryAfterMs;
            if (typeof retry === "number" && Number.isFinite(retry) && retry > 0) this.retryAfterUntil = now() + retry;
          }).finally(() => {
            const interval = Math.max(4_000, this.options.intervalMs ?? 4_000);
            this.nextCheckAt = now() + Math.min(60_000, interval * 2 ** this.failures) + Math.floor(random() * 1_000);
            this.pending = null;
          });
        }
        await this.pending;
        continue;
      }
      await queueDelay(Math.max(1, Math.min(this.nextCheckAt, this.safetyAt[queue]) - at), signal);
    }
  }
}

type QueueHintTimes = Record<RenderQueue, number>;

export function queueDelay(milliseconds: number, signal: AbortSignal) {
  if (signal.aborted) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const timeout = setTimeout(finish, milliseconds);
    signal.addEventListener("abort", finish, { once: true });
    function finish() {
      clearTimeout(timeout);
      signal.removeEventListener("abort", finish);
      resolve();
    }
  });
}
