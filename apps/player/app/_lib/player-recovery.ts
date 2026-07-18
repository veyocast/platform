export const playerReloadCooldownMs = 15 * 60 * 1_000;
export const playerReloadLimit = 2;

export type PlayerRecoveryAction =
  | "RETRY_ITEM"
  | "SKIP_ITEM"
  | "RESTART_LOOP"
  | "REINITIALIZE_PLAYER"
  | "RESTORE_LAST_KNOWN_GOOD"
  | "CONTROLLED_RELOAD"
  | "REPORT_ERROR_AND_COOLDOWN";

export type PlayerRecoveryContext = {
  consecutiveFailures: number;
  reloadTimestamps: number[];
  now: number;
};

export function planPlayerRecovery({
  consecutiveFailures,
  reloadTimestamps,
  now
}: PlayerRecoveryContext): PlayerRecoveryAction {
  if (consecutiveFailures <= 0) return "RETRY_ITEM";
  if (consecutiveFailures === 1) return "SKIP_ITEM";
  if (consecutiveFailures === 2) return "RESTART_LOOP";
  if (consecutiveFailures === 3) return "REINITIALIZE_PLAYER";
  if (consecutiveFailures === 4) return "RESTORE_LAST_KNOWN_GOOD";

  const recentReloads = reloadTimestamps.filter(
    (timestamp) => timestamp > now - playerReloadCooldownMs && timestamp <= now
  );
  return recentReloads.length < playerReloadLimit
    ? "CONTROLLED_RELOAD"
    : "REPORT_ERROR_AND_COOLDOWN";
}
