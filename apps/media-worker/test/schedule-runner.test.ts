import { describe, expect, it, vi } from "vitest";

import { runScheduleLoop, runScheduleOnce } from "../src/schedule-runner";

describe("publisher schedule runner", () => {
  it("evaluates one stable timestamp and reports the applied count", async () => {
    const applyDueSchedules = vi.fn().mockResolvedValue(2);
    const now = () => new Date("2026-07-23T14:05:00.000Z");

    await expect(runScheduleOnce({
      backend: { applyDueSchedules },
      now
    })).resolves.toEqual({
      appliedCount: 2,
      evaluatedAt: "2026-07-23T14:05:00.000Z",
      status: "completed"
    });
    expect(applyDueSchedules).toHaveBeenCalledWith(now());
  });

  it("isolates transient evaluation failures from the worker process", async () => {
    const failure = Object.assign(new Error("database unavailable"), {
      code: "schedule_apply_failed"
    });

    await expect(runScheduleOnce({
      backend: { applyDueSchedules: vi.fn().mockRejectedValue(failure) },
      now: () => new Date("2026-07-23T14:05:00.000Z")
    })).resolves.toEqual({
      errorCode: "schedule_apply_failed",
      evaluatedAt: "2026-07-23T14:05:00.000Z",
      status: "failed"
    });
  });

  it("stops an idle loop immediately when its signal is aborted", async () => {
    const controller = new AbortController();
    const applyDueSchedules = vi.fn().mockImplementation(async () => {
      controller.abort();
      return 0;
    });
    const onResult = vi.fn();

    await runScheduleLoop({
      backend: { applyDueSchedules },
      intervalMs: 15_000,
      onResult,
      signal: controller.signal
    });

    expect(applyDueSchedules).toHaveBeenCalledTimes(1);
    expect(onResult).toHaveBeenCalledWith(expect.objectContaining({
      appliedCount: 0,
      status: "completed"
    }));
  });
});
