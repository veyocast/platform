/** Clock-based projection of a frozen match row. Historical rows without an
 * absolute kickoff keep their published behavior; no browser-local date guess. */
export function sportMatchBelongsOnSlide(
  slideType: string,
  item: { kickoffAt?: unknown; status?: unknown },
  nowMs: number
): boolean {
  if (slideType !== "sport_program" && slideType !== "sport_results") return true;
  if (typeof item.kickoffAt !== "string" || !item.kickoffAt) return true;
  // eslint-disable-next-line no-var -- Serialized into the existing ES5 LG runtime.
  var kickoff = Date.parse(item.kickoffAt);
  if (!isFinite(kickoff)) return true;
  if (slideType === "sport_program") return kickoff > nowMs;
  return kickoff <= nowMs && item.status !== "cancelled" && item.status !== "postponed";
}
