const sensitiveKeyPattern = /(?:address|authorization|cookie|credential|database|display.?name|dsn|email|first.?name|full.?name|ip.?address|jwt|last.?name|password|phone|secret|signed|token|user.?agent|url)/i;
const bearerPattern = /bearer\s+[a-z0-9._~+-]+=*/gi;
const connectionStringPattern = /(?:mongodb(?:\+srv)?|mysql|postgres(?:ql)?):\/\/[^\s"']+/gi;
const jwtPattern = /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g;
const urlPattern = /https?:\/\/[^\s"']+/gi;
const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

export const redactedValue = "[REDACTED]";

export function redactObservabilityValue(value: unknown, key?: string): unknown {
  if (key && sensitiveKeyPattern.test(key)) return redactedValue;
  if (typeof value === "string") return redactString(value);
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => redactObservabilityValue(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, 50)
        .map(([entryKey, entryValue]) => [entryKey, redactObservabilityValue(entryValue, entryKey)])
    );
  }
  return value;
}

function redactString(value: string) {
  return value
    .replace(bearerPattern, redactedValue)
    .replace(connectionStringPattern, redactedValue)
    .replace(jwtPattern, redactedValue)
    .replace(urlPattern, redactedValue)
    .replace(emailPattern, redactedValue)
    .slice(0, 2_000);
}
