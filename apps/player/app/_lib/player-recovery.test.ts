import { describe, expect, it } from "vitest";

import {
  planPlayerRecovery,
  playerReloadCooldownMs
} from "./player-recovery";

describe("player recovery policy", () => {
  const now = 1_700_000_000_000;

  it.each([
    [0, "RETRY_ITEM"],
    [1, "SKIP_ITEM"],
    [2, "RESTART_LOOP"],
    [3, "REINITIALIZE_PLAYER"],
    [4, "RESTORE_LAST_KNOWN_GOOD"],
    [5, "CONTROLLED_RELOAD"]
  ] as const)("kiest na %s opeenvolgende fouten %s", (consecutiveFailures, expected) => {
    expect(planPlayerRecovery({ consecutiveFailures, now, reloadTimestamps: [] })).toBe(expected);
  });

  it("voorkomt een oneindige reloadloop en laat oude reloads verjaren", () => {
    expect(planPlayerRecovery({
      consecutiveFailures: 6,
      now,
      reloadTimestamps: [now - 1_000, now - 2_000]
    })).toBe("REPORT_ERROR_AND_COOLDOWN");

    expect(planPlayerRecovery({
      consecutiveFailures: 6,
      now,
      reloadTimestamps: [now - playerReloadCooldownMs - 1, now - 2_000]
    })).toBe("CONTROLLED_RELOAD");
  });
});
