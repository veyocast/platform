export const defaultTenantTimeZone = "Europe/Amsterdam";

export const centralEuropeanTenantTimeZones = [
  { label: "Nederland · Amsterdam", value: "Europe/Amsterdam" },
  { label: "België · Brussel", value: "Europe/Brussels" },
  { label: "Frankrijk · Parijs", value: "Europe/Paris" }
] as const;

export function normalizeTenantTimeZone(value: string | null | undefined) {
  const candidate = value?.trim() || defaultTenantTimeZone;
  try {
    new Intl.DateTimeFormat("en", { timeZone: candidate }).format();
    return candidate;
  } catch {
    return defaultTenantTimeZone;
  }
}

export function formatTenantDateTime(
  value: string | Date | null,
  timeZone: string | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    dateStyle: "medium",
    timeStyle: "short"
  }
) {
  if (!value) return "Nog niet";
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return "Nog niet";
  return new Intl.DateTimeFormat("nl-NL", {
    ...options,
    timeZone: normalizeTenantTimeZone(timeZone)
  }).format(date);
}
