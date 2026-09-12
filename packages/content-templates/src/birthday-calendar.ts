/** Calendar authority is the snapshot timezone, never the Player's UTC day.
 * Self-contained for inclusion in the trusted Static LG bundle.
 */
export function birthdayCalendarDay(instant: number, timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      year: "numeric", month: "2-digit", day: "2-digit", timeZone: timezone
    }).formatToParts(new Date(instant));
    return ["year", "month", "day"].map(function (type) {
      const part = parts.find(function (value) { return value.type === type; });
      return part ? part.value : "";
    }).join("-");
  } catch { return ""; }
}
