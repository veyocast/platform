import { queueDelay } from "./queue-wakeup";

/** Runtime backend failures retry locally; startup validation stays outside
 * this supervisor. No provider/render queue may take the other queues down. */
export async function superviseWorkerTask({ run, signal, onFailure }: {
  run: () => Promise<unknown>;
  signal: AbortSignal;
  onFailure: () => void;
}) {
  let failures = 0;
  while (!signal.aborted) {
    try {
      await run();
      if (signal.aborted) return;
    } catch {
      if (signal.aborted) return;
    }
    failures = Math.min(7, failures + 1);
    try { onFailure(); } catch { /* Logging cannot terminate retry supervision. */ }
    await queueDelay(Math.min(60_000, 1_000 * 2 ** (failures - 1)), signal);
  }
}

export async function runWorkerTaskGroup({
  controller,
  onDraining,
  tasks,
  onDrainTimeout,
  drainTimeoutMs = 20_000
}: {
  controller: AbortController;
  onDraining: () => void;
  tasks: ReadonlyArray<Promise<unknown>>;
  onDrainTimeout?: () => void;
  drainTimeoutMs?: number;
}) {
  let stopWaiting: (() => void) | undefined;
  const stopping = new Promise<void>((resolve) => {
    stopWaiting = () => resolve();
    if (controller.signal.aborted) resolve();
    else controller.signal.addEventListener("abort", stopWaiting, { once: true });
  });
  try {
    await Promise.race([Promise.all(tasks), stopping]);
  } finally {
    if (stopWaiting) controller.signal.removeEventListener("abort", stopWaiting);
    controller.abort();
    try { onDraining(); } catch { /* Diagnostics cannot prevent shutdown. */ }
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        Promise.allSettled(tasks),
        new Promise<void>((resolve) => {
          timer = setTimeout(() => {
            try { onDrainTimeout?.(); } catch { /* The deadline still completes. */ }
            resolve();
          }, drainTimeoutMs);
        })
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
