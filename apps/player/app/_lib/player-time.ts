const postgresFractionPattern =
  /(\.\d{3})\d+(?=(?:z|[+-]\d{2}:?\d{2})$)/i;
const utcOffsetPattern = /\+00:00$/;

export function normalizePlayerTimestamp(value: string) {
  const normalized = value
    .trim()
    .replace(postgresFractionPattern, "$1")
    .replace(utcOffsetPattern, "Z");
  const timestamp = Date.parse(normalized);
  return Number.isFinite(timestamp)
    ? new Date(timestamp).toISOString()
    : null;
}

export function parsePlayerTimestamp(value: string) {
  const normalized = normalizePlayerTimestamp(value);
  return normalized ? Date.parse(normalized) : Number.NaN;
}
