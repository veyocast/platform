export function isoToZonedLocal(iso: string, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    timeZone: timezone,
    year: "numeric"
  }).formatToParts(new Date(iso));
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}T${value("hour")}:${value("minute")}`;
}

export function zonedLocalToIso(value: string, timezone: string) {
  const [date = "", time = ""] = value.split("T");
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  if (![year, month, day, hour, minute].every(Number.isFinite)) {
    throw new Error("Ongeldige lokale datum en tijd.");
  }
  let instant = Date.UTC(year!, month! - 1, day!, hour!, minute!);
  const target = instant;
  for (let pass = 0; pass < 2; pass += 1) {
    const observed = isoToZonedLocal(new Date(instant).toISOString(), timezone);
    const [observedDate = "", observedTime = ""] = observed.split("T");
    const [observedYear, observedMonth, observedDay] =
      observedDate.split("-").map(Number);
    const [observedHour, observedMinute] = observedTime.split(":").map(Number);
    instant += target - Date.UTC(
      observedYear!,
      observedMonth! - 1,
      observedDay!,
      observedHour!,
      observedMinute!
    );
  }
  return new Date(instant).toISOString();
}
