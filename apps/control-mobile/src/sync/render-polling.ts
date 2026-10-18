export const syncRenderObservationMs = 120_000;
/** Only a live render receives bounded, backing-off status reads. */
export function syncRenderPollDelay(status: string | undefined, startedAt: number | null, now: number, allowed: boolean): number | false {
  if (!allowed || !["queued", "rendering"].includes(status ?? "") || startedAt === null || now - startedAt >= syncRenderObservationMs) return false;
  return Math.min(15_000, 4000 * 2 ** Math.floor(Math.max(0, now - startedAt) / 30_000));
}
