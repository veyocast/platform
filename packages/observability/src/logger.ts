import { randomUUID } from "node:crypto";

import { isObservabilityEvent, type ObservabilityEvent } from "./catalog";
import { redactObservabilityValue } from "./redaction";

export type LogLevel = "debug" | "error" | "info" | "warn";
export type LogWriter = (line: string) => void;

export type LoggerContext = Readonly<{
  correlationId?: string;
  environment: string;
  revision: string;
  service: string;
}>;

export type EventFields = Readonly<Record<string, unknown>>;

export function createCorrelationId(value?: string) {
  return value && /^[a-zA-Z0-9_-]{8,80}$/.test(value) ? value : randomUUID();
}

export function createStructuredLogger(
  context: LoggerContext,
  writer: LogWriter = (line) => process.stdout.write(`${line}\n`)
) {
  const base = {
    correlation_id: createCorrelationId(context.correlationId),
    environment: boundedLabel(context.environment),
    revision: boundedLabel(context.revision, 64),
    service: boundedLabel(context.service)
  };

  function write(level: LogLevel, event: ObservabilityEvent, fields: EventFields = {}) {
    if (!isObservabilityEvent(event)) throw new Error(`Unknown observability event: ${event}`);
    writer(JSON.stringify({
      ...base,
      event,
      fields: redactObservabilityValue(fields),
      level,
      timestamp: new Date().toISOString()
    }));
  }

  return {
    debug: (event: ObservabilityEvent, fields?: EventFields) => write("debug", event, fields),
    error: (event: ObservabilityEvent, fields?: EventFields) => write("error", event, fields),
    info: (event: ObservabilityEvent, fields?: EventFields) => write("info", event, fields),
    warn: (event: ObservabilityEvent, fields?: EventFields) => write("warn", event, fields),
    withCorrelation(correlationId?: string) {
      return createStructuredLogger({ ...context, correlationId: createCorrelationId(correlationId) }, writer);
    }
  };
}

function boundedLabel(value: string, maxLength = 80) {
  return value.replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, maxLength) || "unknown";
}
