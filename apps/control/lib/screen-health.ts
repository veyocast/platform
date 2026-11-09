import { deriveScreenContactStatus } from "@veyocast/domain";
export { screenOnlineWindowMs, screenStaleWindowMs } from "@veyocast/domain";
export type { ScreenStatusKind as ScreenHealthKind } from "@veyocast/domain";
export type ScreenHealth = ReturnType<typeof deriveScreenHealth>;

/** Compatibility adapter: publication progress is independent of contact. */
export function deriveScreenHealth(input: {
  activeReleaseId?: string | null;
  desiredReleaseId?: string | null;
  deviceStatus?: string | null;
  lastSeenAt?: string | null;
  screenStatus: string;
}, now = new Date()) {
  return deriveScreenContactStatus(input, now.getTime());
}
