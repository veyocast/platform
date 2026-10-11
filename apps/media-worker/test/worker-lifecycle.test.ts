import { afterEach, describe, expect, it, vi } from "vitest";

import { runWorkerTaskGroup, superviseWorkerTask } from "../src/worker-lifecycle";

afterEach(() => vi.useRealTimers());

describe("media worker task lifecycle", () => {
  it.each([false, true])("bounds shutdown with a pending task when abort is already set: %s", async (alreadyAborted) => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const onDraining = vi.fn();
    const onDrainTimeout = vi.fn();
    if (alreadyAborted) controller.abort();
    const group = runWorkerTaskGroup({
      controller, onDraining, onDrainTimeout, drainTimeoutMs: 20_000,
      tasks: [new Promise(() => undefined)]
    });
    if (!alreadyAborted) controller.abort();
    await vi.advanceTimersByTimeAsync(19_999);
    expect(onDraining).toHaveBeenCalledOnce();
    expect(onDrainTimeout).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await group;
    expect(onDrainTimeout).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("bounds a hanging drain so the existing container restart policy can recover", async () => {
    vi.useFakeTimers();
    const onDrainTimeout = vi.fn();
    // A fatal task enters draining even when another task ignores abort.
    const failure = new Error("backend unavailable");
    const fatal = runWorkerTaskGroup({controller:new AbortController(),onDraining:vi.fn(),onDrainTimeout,
      drainTimeoutMs:20_000,tasks:[Promise.reject(failure),new Promise(()=>undefined)]});
    const assertion = expect(fatal).rejects.toBe(failure);
    await vi.advanceTimersByTimeAsync(20_000);
    await assertion;
    expect(onDrainTimeout).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps other queues alive during repeated runtime outages and backs off before recovery", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const failure = vi.fn();
    const run = vi.fn().mockRejectedValueOnce(new Error("claim unavailable"))
      .mockRejectedValueOnce(new Error("claim still unavailable"))
      .mockImplementation(() => new Promise<void>((resolve) => {
        controller.signal.addEventListener("abort",()=>resolve(),{once:true});
      }));
    const task = superviseWorkerTask({run,signal:controller.signal,onFailure:failure});
    await vi.advanceTimersByTimeAsync(2_999);
    expect(run).toHaveBeenCalledTimes(2);
    expect(controller.signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(run).toHaveBeenCalledTimes(3);
    controller.abort(); await task;
    expect(failure).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });
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
