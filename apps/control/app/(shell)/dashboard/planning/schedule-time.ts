const localDateTimePattern =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

type DateTimeParts = {
  day: number;
  hour: number;
  minute: number;
  month: number;
  second: number;
  year: number;
};

export function zonedLocalDateTimeToIso(localValue: string, timeZone: string) {
  const desired = parseLocalDateTime(localValue);
  const desiredEpoch = partsAsUtcEpoch(desired);
  let candidate = desiredEpoch;

  for (let iteration = 0; iteration < 3; iteration += 1) {
    const rendered = zonedParts(new Date(candidate), timeZone);
    const correction = desiredEpoch - partsAsUtcEpoch(rendered);
    candidate += correction;
    if (correction === 0) break;
  }

  const result = new Date(candidate);
  if (!sameParts(zonedParts(result, timeZone), desired)) {
    throw new Error("De gekozen lokale tijd bestaat niet in deze tijdzone.");
  }
  return result.toISOString();
}

export function isoToZonedDateTimeLocal(value: string, timeZone: string) {
  const parts = zonedParts(new Date(value), timeZone);
  return `${pad(parts.year, 4)}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}

function parseLocalDateTime(value: string): DateTimeParts {
  const match = localDateTimePattern.exec(value);
  if (!match) throw new Error("Vul een geldige datum en tijd in.");
  const parts = {
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    month: Number(match[2]),
    second: Number(match[6] ?? 0),
    year: Number(match[1])
  };
  const date = new Date(partsAsUtcEpoch(parts));
  if (
    date.getUTCFullYear() !== parts.year ||
    date.getUTCMonth() + 1 !== parts.month ||
    date.getUTCDate() !== parts.day ||
    date.getUTCHours() !== parts.hour ||
    date.getUTCMinutes() !== parts.minute
  ) {
    throw new Error("Vul een bestaande datum en tijd in.");
  }
  return parts;
}

function zonedParts(date: Date, timeZone: string): DateTimeParts {
  if (Number.isNaN(date.getTime())) throw new Error("De datum of tijd is ongeldig.");
  const formatter = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone,
    year: "numeric"
  });
  const values = Object.fromEntries(
    formatter.formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)])
  );
  return {
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    month: values.month,
    second: values.second,
    year: values.year
  };
}

function partsAsUtcEpoch(parts: DateTimeParts) {
  return Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );
}

function sameParts(left: DateTimeParts, right: DateTimeParts) {
  return left.year === right.year &&
    left.month === right.month &&
    left.day === right.day &&
    left.hour === right.hour &&
    left.minute === right.minute &&
    left.second === right.second;
}

function pad(value: number, length = 2) {
  return String(value).padStart(length, "0");
}
