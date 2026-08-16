import { describe, expect, it, vi } from "vitest";

import { runWorkerTaskGroup } from "../src/worker-lifecycle";

describe("media worker task lifecycle", () => {
  it("drains every parallel task and preserves the fatal failure", async () => {
    const controller = new AbortController();
    const fatalFailure = new Error("queue loop failed");
    const onDraining = vi.fn();
    let parallelTaskSettled = false;

    const parallelTask = new Promise<void>((resolve) => {
      controller.signal.addEventListener("abort", () => {
        parallelTaskSettled = true;
        resolve();
      }, { once: true });
    });

    await expect(runWorkerTaskGroup({
      controller,
      onDraining,
      tasks: [Promise.reject(fatalFailure), parallelTask]
    })).rejects.toBe(fatalFailure);

    expect(onDraining).toHaveBeenCalledOnce();
    expect(controller.signal.aborted).toBe(true);
    expect(parallelTaskSettled).toBe(true);
  });
});
