import { deriveScreenContactStatus, validScreenTimestamp } from "@veyocast/domain/screen-contact-status";
import type { MobileScreenSummary } from "@veyocast/contracts";

/** Re-evaluate stored contact against the current clock, including offline caches. */
export function mobileScreenStatus(screen: MobileScreenSummary, now = Date.now()) {
  const evidence = screen.statusEvidence;
  const health = deriveScreenContactStatus({
    screenStatus: evidence?.screenStatus ?? "active",
    deviceStatus: evidence ? evidence.deviceStatus : screen.status === "pairing" ? null : "paired",
    lastSeenAt: screen.lastSeenAt
  }, now);
  const validTime = (value: string | null | undefined) => validScreenTimestamp(value, now) === null ? null : value!;
  const reportedSourceAt = validTime(evidence?.reportedSourceAt);
  const sources = evidence?.sources?.map(source => ({...source, lastSuccessAt: validTime(source.lastSuccessAt), lastAttemptAt: validTime(source.lastAttemptAt), checkedAt: validTime(source.checkedAt)})) ?? [];
  return { ...health, publicationKind: evidence?.publicationKind ?? "unconfirmed",
    confirmedAt: validTime(evidence?.confirmedAt),
    desiredReleaseLabel: evidence?.desiredReleaseLabel ?? null,
    reportedSourceRevision: reportedSourceAt ? evidence?.reportedSourceRevision ?? null : null,
    reportedSourceAt, sources };
}
