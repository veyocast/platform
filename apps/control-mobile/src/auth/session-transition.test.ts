import { expect, it, vi } from "vitest";
import { applyNativeSessionTransition } from "./session-transition";

it("keeps the next account hidden after a failed purge and retries that purge on its refresh", async () => {
  const actor = { current: "account-a" as string | null };
  const next = { user: { id: "account-b" } };
  const boundary = {
    hide: vi.fn(), cancelQueries: vi.fn(async () => undefined), clearQueries: vi.fn(),
    clearTenantCaches: vi.fn<() => Promise<void>>().mockRejectedValueOnce(Error("local-storage-failed")).mockResolvedValueOnce(undefined),
    publish: vi.fn(),
  };
  await expect(applyNativeSessionTransition(actor, next, boundary)).rejects.toThrow("local-storage-failed");
  expect(actor.current).toBe("account-a");
  expect(boundary.publish).not.toHaveBeenCalled();
  await applyNativeSessionTransition(actor, next, boundary);
  expect(boundary.clearTenantCaches).toHaveBeenCalledTimes(2);
  expect(actor.current).toBe("account-b");
  expect(boundary.publish).toHaveBeenCalledExactlyOnceWith(next);
});
