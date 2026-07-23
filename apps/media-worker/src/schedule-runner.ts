import type { MediaWorkerBackend } from "./worker-backend";

export type ScheduleRunResult =
  | { appliedCount: number; evaluatedAt: string; status: "completed" }
  | { errorCode: string; evaluatedAt: string; status: "failed" };

export async function runScheduleOnce({
  backend,
  now = () => new Date()
}: {
  backend: Pick<MediaWorkerBackend, "applyDueSchedules">;
  now?: () => Date;
}): Promise<ScheduleRunResult> {
  const evaluatedAt = now();
  try {
    return {
      appliedCount: await backend.applyDueSchedules(evaluatedAt),
      evaluatedAt: evaluatedAt.toISOString(),
      status: "completed"
    };
  } catch (error) {
    return {
      errorCode:
        error instanceof Error &&
        "code" in error &&
        typeof error.code === "string"
          ? error.code
          : "schedule_apply_failed",
      evaluatedAt: evaluatedAt.toISOString(),
      status: "failed"
    };
  }
}

export async function runScheduleLoop({
  backend,
  intervalMs,
  onResult = () => undefined,
  signal
}: {
  backend: Pick<MediaWorkerBackend, "applyDueSchedules">;
  intervalMs: number;
  onResult?: (result: ScheduleRunResult) => void;
  signal: AbortSignal;
}) {
  while (!signal.aborted) {
    onResult(await runScheduleOnce({ backend }));
    await abortableDelay(intervalMs, signal);
  }
}

function abortableDelay(milliseconds: number, signal: AbortSignal) {
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
