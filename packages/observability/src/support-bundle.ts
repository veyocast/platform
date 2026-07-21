export type SupportBundleInput = Readonly<{
  appVersion: string;
  environment: string;
  events: readonly Readonly<{ code: string; occurredAt: string; result: string }>[];
  generatedAt?: string;
  releaseIds: readonly string[];
  revision: string;
  service: string;
  window: Readonly<{ from: string; to: string }>;
}>;

export type SupportBundle = Readonly<{
  app_version: string;
  environment: string;
  events: readonly Readonly<{ code: string; occurred_at: string; result: string }>[];
  generated_at: string;
  release_ids: readonly string[];
  revision: string;
  schema_version: 1;
  service: string;
  window: Readonly<{ from: string; to: string }>;
}>;

export function createSupportBundle(input: SupportBundleInput): SupportBundle {
  return {
    app_version: bounded(input.appVersion),
    environment: bounded(input.environment),
    events: input.events.slice(0, 200).map((event) => ({
      code: eventCode(event.code),
      occurred_at: iso(event.occurredAt),
      result: eventResult(event.result)
    })),
    generated_at: iso(input.generatedAt ?? new Date().toISOString()),
    release_ids: [...new Set(input.releaseIds.filter(isUuid))].slice(0, 100),
    revision: bounded(input.revision, 64),
    schema_version: 1,
    service: bounded(input.service),
    window: { from: iso(input.window.from), to: iso(input.window.to) }
  };
}

function bounded(value: string, maxLength = 80) {
  return value.replace(/[^a-zA-Z0-9_.:-]/g, "_").slice(0, maxLength) || "unknown";
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function eventCode(value: string) {
  return /^[a-z][a-z0-9_.-]{1,119}$/.test(value) ? value : "unknown_event";
}

function eventResult(value: string) {
  return ["denied", "failed", "success"].includes(value) ? value : "unknown";
}

function iso(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) throw new Error("Support bundle bevat een ongeldige tijd.");
  return date.toISOString();
}
