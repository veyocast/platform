import { readFile } from "node:fs/promises";
import {
  decryptSportlinkClientId,
  normalizeSportlinkBirthdays,
  SportlinkClient,
  SportlinkClientError
} from "@veyocast/integrations/server";
import { createConfiguredMediaWorkerClient } from "./worker-backend";
import { readMediaWorkerConfig } from "./worker-config";

/** Read-only operator probe, executed inside the exact deployed worker image.
 * Existing credentials and provider/member payloads never leave this process.
 */
const providerCodes = new Set([
  "SPORTLINK_CLIENT_ID_INVALID", "SPORTLINK_ARTICLE_NOT_ALLOWED", "SPORTLINK_ARGUMENT_INVALID",
  "SPORTLINK_NETWORK_ERROR", "SPORTLINK_CONTENT_TYPE_INVALID", "SPORTLINK_RESPONSE_INVALID",
  "SPORTLINK_TIMEOUT", "SPORTLINK_CONDITION_ERROR", "SPORTLINK_REQUIRED_ARGUMENT_MISSING",
  "SPORTLINK_TOKEN_INVALID", "SPORTLINK_SCOPE_INSUFFICIENT", "SPORTLINK_ARTICLE_NOT_FOUND",
  "SPORTLINK_SERVER_ERROR", "SPORTLINK_RATE_LIMITED", "SPORTLINK_RESPONSE_TOO_LARGE"
]);
class ProbeError extends Error {
  constructor(readonly code: string) { super(code); }
}
const emit = (value: Record<string, unknown>) => console.info(JSON.stringify(value));

async function main() {
  const argumentsList = process.argv.slice(2);
  const [tenantId, releaseSha, environment, birthdayProbe] = argumentsList;
  if (argumentsList.length !== 4 || !tenantId || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(tenantId) ||
    !releaseSha || !/^[0-9a-f]{40}$/.test(releaseSha) || !["staging", "production"].includes(environment ?? "") ||
    !["enabled", "disabled"].includes(birthdayProbe ?? "") ||
    process.env.DEPLOYMENT_SHA !== releaseSha || process.env.VEYOCAST_ENVIRONMENT !== environment) {
    throw new ProbeError("PROBE_SCOPE_INVALID");
  }
  // An unhealthy but running worker is precisely a useful diagnostic target.
  // Require matching image scope, then report freshness without hiding evidence.
  let readinessFresh = false;
  try {
    const readiness: unknown = JSON.parse(await readFile("/tmp/veyocast-media-worker-ready.json", "utf8"));
    if (readiness && typeof readiness === "object" && !Array.isArray(readiness)) {
      const ready = readiness as Record<string, unknown>;
      if (ready.revision !== releaseSha || ready.environment !== environment) throw new ProbeError("PROBE_READINESS_SCOPE_INVALID");
      const age = typeof ready.lastPollAt === "number" ? Date.now() - ready.lastPollAt : Infinity;
      readinessFresh = age >= -5_000 && age <= 75_000;
    }
  } catch (error) {
    if (error instanceof ProbeError) throw error;
    // Missing/malformed readiness is reported, never printed as a raw exception.
  }
  const deadline = AbortSignal.timeout(45_000);
  let client: ReturnType<typeof createConfiguredMediaWorkerClient>;
  let encryptionKey: string | null;
  try {
    encryptionKey = readMediaWorkerConfig().sportlinkEncryptionKey;
    client = createConfiguredMediaWorkerClient((input, init) => fetch(input, {
      ...init, signal: init?.signal ? AbortSignal.any([init.signal, deadline]) : deadline
    }));
  } catch { throw new ProbeError("PROBE_WORKER_CONFIGURATION_INVALID"); }
  let diagnostic: unknown;
  try {
    const response = await client.rpc("get_live_integration_diagnostics_v1", { p_tenant_id: tenantId }).abortSignal(deadline);
    if (response.error) throw new ProbeError("PROBE_DIAGNOSTIC_READ_FAILED");
    diagnostic = response.data;
  } catch { throw new ProbeError("PROBE_DIAGNOSTIC_READ_FAILED"); }
  if (!diagnostic || typeof diagnostic !== "object" || Array.isArray(diagnostic) ||
    (diagnostic as Record<string, unknown>).schemaVersion !== 1 ||
    (diagnostic as Record<string, unknown>).tenantId !== tenantId) throw new ProbeError("PROBE_DIAGNOSTIC_INVALID");
  emit({ event: "live_integration_diagnostics", tenantId, releaseSha, environment, readinessFresh, diagnostic });
  if (birthdayProbe === "disabled") return;
  const sportlink = (diagnostic as Record<string, unknown>).sportlink;
  const allowedConnectionIds = Array.isArray(sportlink) ? sportlink.flatMap((row: unknown) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) return [];
    const connection = row as Record<string, unknown>;
    return connection.birthdayProbeAllowed === true && typeof connection.connectionId === "string" &&
      /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(connection.connectionId) ? [connection.connectionId] : [];
  }) : [];
  // The feature, connection privacy and enabled public_people policy must all
  // allow this probe before any credential row is selected or decrypted.
  if (!allowedConnectionIds.length) {
    emit({ event: "live_integration_birthday_probe", status: "unavailable", code: "PROBE_BIRTHDAY_MODULE_UNAVAILABLE" });
    return;
  }
  if (!encryptionKey) {
    emit({ event: "live_integration_birthday_probe", status: "unavailable", code: "PROBE_PROVIDER_CONFIGURATION_UNAVAILABLE" });
    return;
  }
  // The active-tenant RPC above authorized scope before any encrypted field is
  // read. Privacy-disabled connections are never probed or decrypted.
  const connections = await client.from("sportlink_connections")
    .select("id,encrypted_client_id,encryption_iv,encryption_tag,timezone")
    .eq("tenant_id", tenantId).eq("status", "active").eq("privacy_birthdays_enabled", true).in("id", allowedConnectionIds)
    .order("id").limit(5).abortSignal(deadline);
  if (connections.error) throw new ProbeError("PROBE_PROVIDER_CONNECTION_READ_FAILED");
  if (!connections.data?.length) {
    emit({ event: "live_integration_birthday_probe", status: "unavailable", code: "PROBE_BIRTHDAY_MODULE_UNAVAILABLE" });
    return;
  }
  for (const connection of connections.data) {
    let httpStatus: number | null = null;
    try {
      if (deadline.aborted) throw new ProbeError("PROBE_DEADLINE_EXCEEDED");
      let clientId: string;
      try {
        clientId = decryptSportlinkClientId({ ciphertext: connection.encrypted_client_id,
          iv: connection.encryption_iv, tag: connection.encryption_tag }, encryptionKey);
      } catch { throw new ProbeError("PROBE_PROVIDER_CONFIGURATION_INVALID"); }
      const provider = new SportlinkClient(clientId, { maxAttempts: 1, timeoutMs: 8_000,
        fetchImpl: async (input, init) => {
          const signals = [deadline, AbortSignal.timeout(8_000)];
          if (init?.signal) signals.push(init.signal);
          const response = await fetch(input, { ...init, signal: AbortSignal.any(signals) });
          httpStatus = response.status >= 100 && response.status <= 599 ? response.status : null;
          return response;
        } });
      const fetched = await provider.fetchArticle("verjaardagen", { aantaldagen: 21 });
      const normalized = normalizeSportlinkBirthdays(fetched.payload, {
        now: new Date(), maxDays: 21, timezone: connection.timezone
      });
      emit({ event: "live_integration_birthday_probe", connectionId: connection.id, status: "success", httpStatus,
        recordCount: normalized.recordCount, validCount: normalized.validCount, invalidCount: normalized.invalidCount,
        outOfWindowCount: normalized.outOfWindowCount, selectedCount: normalized.birthdays.length });
    } catch (error) {
      const code = deadline.aborted ? "PROBE_DEADLINE_EXCEEDED" : error instanceof ProbeError ? error.code
        : error instanceof SportlinkClientError && providerCodes.has(error.code) ? error.code : "PROBE_PROVIDER_FAILED";
      emit({ event: "live_integration_birthday_probe", connectionId: connection.id, status: "failed", code, httpStatus });
      process.exitCode = 1;
    }
  }
}

main().catch((error: unknown) => {
  emit({ event: "live_integration_probe_failed", code: error instanceof ProbeError ? error.code : "PROBE_FAILED" });
  process.exitCode = 1;
});
