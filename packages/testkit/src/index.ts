export function expectDefined<T>(
  value: T,
  label: string
): asserts value is NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error(`${label} must be defined`);
  }
}

export function createStableTestId(prefix: string, value: string) {
  const normalizedValue = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return `${prefix}-${normalizedValue}`;
}
