export async function runWorkerTaskGroup({
  controller,
  onDraining,
  tasks
}: {
  controller: AbortController;
  onDraining: () => void;
  tasks: ReadonlyArray<Promise<unknown>>;
}) {
  try {
    await Promise.all(tasks);
  } finally {
    onDraining();
    controller.abort();
    await Promise.allSettled(tasks);
  }
}
