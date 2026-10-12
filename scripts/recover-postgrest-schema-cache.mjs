import { Buffer } from "node:buffer";
import { constants } from "node:fs";
import { open, rm } from "node:fs/promises";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import process from "node:process";
import { clearTimeout, setTimeout } from "node:timers";
import { pathToFileURL } from "node:url";

import {
  createSqlAdapter,
  diagnosticDatabaseConfig,
  probeRuntimeDatabase
} from "./probe-runtime-database.mjs";

const TENANT = "7526e17f-c819-431c-a05d-4ef5f16ea1c0";
const SHA = /^[0-9a-f]{40}$/;
const REPORT_NAME = "data-api-recovery.json";

export function schemaReloadSql() {
  return `WITH notification AS MATERIALIZED (
    SELECT pg_catalog.pg_notify('pgrst', 'reload schema')
    WHERE EXISTS (SELECT 1 FROM public.tenants
      WHERE id='${TENANT}'::uuid AND status='active')
  ) SELECT count(*)::integer AS notification_count FROM notification;\n`;
}

function validNotification(result) {
  if (!result?.ok || result.timedOut || result.tooLarge || typeof result.stdout !== "string"
      || Buffer.byteLength(result.stdout) > 65_536) return false;
  // This single fixed scalar needs no general JSON coercion. Reject duplicate
  // keys, extra rows/fields and string/boolean counts before claiming delivery.
  return /^\s*\[\s*\{\s*"notification_count"\s*:\s*1\s*\}\s*\]\s*$/.test(result.stdout);
}

export async function recoverSchemaCache({ operation, expectedRuntimeSha, environment = process.env }, {
  probe = probeRuntimeDatabase,
  executeSql = createSqlAdapter(),
  operationSignal,
  notificationDeadlineMs = 20_000,
  now = () => new Date()
} = {}) {
  const started = performance.now();
  const observed = { schemaVersion: 1, event: "data_api_schema_cache_recovery",
    completionScope: "fixed_database_api_read_not_authenticated_ui_or_full_task_acceptance" };
  const finish = (code, exitCode = 1) => ({ exitCode, report: { ...observed,
    code, observedAt: now().toISOString(), elapsedMs: Math.round(performance.now() - started) } });
  if (environment.GITHUB_REF !== "refs/heads/main" || !SHA.test(environment.GITHUB_SHA ?? "")
      || !SHA.test(expectedRuntimeSha ?? "") || !["diagnose", "reload"].includes(operation)
      || !Number.isInteger(notificationDeadlineMs) || notificationDeadlineMs < 1 || notificationDeadlineMs > 20_000
      || (operationSignal !== undefined && !(operationSignal instanceof globalThis.AbortSignal))) {
    return finish("RECOVERY_SCOPE_INVALID", 2);
  }
  Object.assign(observed, { operation, workflowSha: environment.GITHUB_SHA,
    runtimeSha: expectedRuntimeSha, tenantId: TENANT });
  if (operationSignal?.aborted) return finish("RECOVERY_CANCELLED");
  const input = { environment, targetEnvironment: "production", expectedRuntimeSha, tenantId: TENANT };
  try {
    const before = await probe(input, { operationSignal });
    observed.before = before.report;
    if (operationSignal?.aborted) return finish("RECOVERY_CANCELLED");
    if (before.exitCode === 0 && before.report.code === "DATABASE_READY") {
      observed.action = { notificationCount: 0, code: "NOT_REQUIRED" };
      return finish("DATABASE_API_ALREADY_READY", 0);
    }
    if (operation === "diagnose") return finish("DATABASE_API_UNPROVEN");
    if (before.report.sql?.code !== "SQL_READY" || before.report.sql.tenantActive !== true
        || before.report.rest?.httpStatus !== 503 || before.report.rest.databaseCode !== "PGRST002") {
      return finish("SCHEMA_CACHE_FAILURE_UNCONFIRMED");
    }
    const config = diagnosticDatabaseConfig(environment.SUPABASE_DB_URL, environment.PGCONNECT_TIMEOUT,
      environment.SUPABASE_PROJECT_REF, environment);
    const notificationController = new globalThis.AbortController();
    const aborted = () => notificationController.abort();
    operationSignal?.addEventListener("abort", aborted, { once: true });
    const timer = setTimeout(aborted, notificationDeadlineMs);
    let result;
    try {
      if (operationSignal?.aborted) notificationController.abort();
      result = await executeSql({ databaseUrl: config.databaseUrl, sql: schemaReloadSql(),
        signal: notificationController.signal });
    } finally {
      clearTimeout(timer);
      operationSignal?.removeEventListener("abort", aborted);
    }
    observed.action = { notificationCount: validNotification(result) ? 1 : null,
      code: notificationController.signal.aborted ? "NOTIFICATION_INTERRUPTED"
        : validNotification(result) ? "SCHEMA_RELOAD_REQUESTED" : "NOTIFICATION_UNPROVEN" };
    if (operationSignal?.aborted) return finish("RECOVERY_CANCELLED");
    if (notificationController.signal.aborted || !validNotification(result)) return finish("SCHEMA_RELOAD_UNPROVEN");
    const after = await probe(input, { operationSignal });
    observed.after = after.report;
    if (operationSignal?.aborted) return finish("RECOVERY_CANCELLED");
    return finish(after.exitCode === 0 && after.report.code === "DATABASE_READY"
      ? "DATABASE_API_READ_READY" : "SCHEMA_RELOAD_REQUESTED_API_UNPROVEN", after.exitCode === 0
      && after.report.code === "DATABASE_READY" ? 0 : 1);
  } catch {
    return finish(operationSignal?.aborted ? "RECOVERY_CANCELLED" : "RECOVERY_FAILED");
  }
}

export async function recoveryCli({ argv = process.argv.slice(2), environment = process.env,
  stdout = process.stdout, recover = recoverSchemaCache } = {}) {
  if (argv.length !== 2) return 2;
  const controller = new globalThis.AbortController();
  const abort = () => controller.abort();
  const timer = setTimeout(abort, 180_000);
  process.once("SIGINT", abort);
  process.once("SIGTERM", abort);
  try {
    const result = await recover({ operation: argv[0], expectedRuntimeSha: argv[1], environment },
      { operationSignal: controller.signal });
    if (environment.RUNNER_TEMP) {
      const path = join(environment.RUNNER_TEMP, REPORT_NAME);
      await rm(path, { force: true });
      const handle = await open(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
      try { await handle.writeFile(JSON.stringify(result.report) + "\n"); } finally { await handle.close(); }
    }
    stdout.write(JSON.stringify(result.report) + "\n");
    return controller.signal.aborted ? 1 : result.exitCode;
  } finally {
    clearTimeout(timer);
    process.removeListener("SIGINT", abort);
    process.removeListener("SIGTERM", abort);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await recoveryCli();
}
