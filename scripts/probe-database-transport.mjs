import { lookup as nativeLookup } from "node:dns";
import { connect as nativeConnect } from "node:net";
import { performance } from "node:perf_hooks";
import process from "node:process";
import { Buffer } from "node:buffer";
import { clearTimeout, setTimeout } from "node:timers";
import { checkServerIdentity, connect as nativeTlsConnect } from "node:tls";
import { pathToFileURL, URL } from "node:url";

const MAX_DEADLINE_MS = 15_000;
const STAGES = { dns: 3_000, tcp: 3_000, postgres_ssl_request: 2_000, tls: 5_000 };
const TLS_MODES = new Set(["prefer", "require", "verify-ca", "verify-full"]);
const CERTIFICATE_ERRORS = new Set([
  "CERT_HAS_EXPIRED", "CERT_NOT_YET_VALID", "DEPTH_ZERO_SELF_SIGNED_CERT",
  "SELF_SIGNED_CERT_IN_CHAIN", "UNABLE_TO_GET_ISSUER_CERT",
  "UNABLE_TO_GET_ISSUER_CERT_LOCALLY", "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "CERT_SIGNATURE_FAILURE", "CERT_REVOKED", "INVALID_CA"
]);
const UNSUPPORTED_ENV = [
  "PGSERVICE", "PGSERVICEFILE", "PGHOSTADDR", "PGSSLMODE", "PGSSLROOTCERT",
  "PGSSLCERT", "PGSSLKEY", "PGSSLPASSWORD", "PGOPTIONS"
];

class DiagnosticFault extends Error {
  constructor(code, unsupported = false) {
    super(code);
    this.code = code;
    this.unsupported = unsupported;
  }
}

// This deliberately supports less than libpq. Never silently approximate a
// multi-host/service/client-certificate DSN or a requested plaintext policy.
function transportTarget(value, environment) {
  if (typeof value !== "string" || !value || value.length > 16_384 || /\s/.test(value)) {
    throw new DiagnosticFault("CONFIG_INVALID", true);
  }
  if (UNSUPPORTED_ENV.some((key) => environment[key])) {
    throw new DiagnosticFault("CONFIG_UNSUPPORTED", true);
  }
  let url;
  try {
    url = new URL(value);
    decodeURIComponent(url.username);
    decodeURIComponent(url.password);
    decodeURIComponent(url.pathname);
  } catch {
    throw new DiagnosticFault("CONFIG_INVALID", true);
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol) || url.hash) {
    throw new DiagnosticFault("CONFIG_UNSUPPORTED", true);
  }
  // DNS hostnames only: sockets, literal IPs and comma-separated hosts need
  // different identity/route semantics and are outside this diagnostic.
  const hostname = url.hostname;
  if (!hostname || hostname.length > 253 || !/^[a-zA-Z0-9.-]+$/.test(hostname)
    || hostname.split(".").some((label) => !/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/.test(label))
    || /^\d+(?:\.\d+){3}$/.test(hostname)) {
    throw new DiagnosticFault("CONFIG_UNSUPPORTED", true);
  }
  const port = url.port ? Number(url.port) : 5432;
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new DiagnosticFault("CONFIG_INVALID", true);
  }
  const seen = new Set();
  for (const [key, setting] of url.searchParams) {
    if (seen.has(key) || !["sslmode", "connect_timeout"].includes(key)) {
      throw new DiagnosticFault("CONFIG_UNSUPPORTED", true);
    }
    seen.add(key);
    if (key === "sslmode" && !TLS_MODES.has(setting)) {
      throw new DiagnosticFault("CONFIG_UNSUPPORTED", true);
    }
    if (key === "connect_timeout" && !/^\d+$/.test(setting)) {
      throw new DiagnosticFault("CONFIG_INVALID", true);
    }
  }
  return { hostname, port };
}

function errorCode(error) {
  try {
    return typeof error?.code === "string" ? error.code : undefined;
  } catch {
    return undefined;
  }
}

function safeCode(stage, error) {
  const code = errorCode(error);
  if (stage === "dns") {
    if (code === "ENOTFOUND") return "DNS_NOT_FOUND";
    if (code === "EAI_AGAIN") return "DNS_TEMPORARY_FAILURE";
    return "DNS_FAILED";
  }
  if (stage === "tcp") {
    if (code === "ECONNREFUSED") return "TCP_REFUSED";
    if (["ENETUNREACH", "EHOSTUNREACH"].includes(code)) return "TCP_UNREACHABLE";
    if (code === "ETIMEDOUT") return "TCP_TIMEOUT";
    if (code === "ECONNRESET") return "TCP_RESET";
    return "TCP_FAILED";
  }
  if (stage === "tls") {
    if (code === "ERR_TLS_CERT_ALTNAME_INVALID") return "TLS_IDENTITY_FAILED";
    if (CERTIFICATE_ERRORS.has(code)) return "TLS_CERTIFICATE_FAILED";
    if (code === "ETIMEDOUT") return "TLS_TIMEOUT";
    if (code === "ECONNRESET") return "TLS_CONNECTION_CLOSED";
    return "TLS_HANDSHAKE_FAILED";
  }
  return "POSTGRES_SSL_FAILED";
}

const elapsed = (start) => Math.max(0, Math.round(performance.now() - start));

/**
 * Lower-layer evidence only. No PostgreSQL StartupMessage, credentials, queries
 * or database changes. TLS verifies the certificate and original DNS hostname
 * independently of the CLI's policy. Success does not prove auth/pool/query
 * readiness, and one native hostname connection does not cover every route.
 * The injected transports are for local tests; the CLI always uses Node builtins.
 */
export async function probeDatabaseTransport(databaseUrl, {
  environment = process.env,
  deadlineMs = MAX_DEADLINE_MS,
  lookup = nativeLookup,
  connect = nativeConnect,
  startTls = nativeTlsConnect
} = {}) {
  const started = performance.now();
  const stages = [];
  let socket;
  let tlsSocket;
  const report = (status, code) => ({
    schemaVersion: 1,
    event: "database_transport_diagnostic",
    mode: "read_only_no_authentication",
    tlsPolicy: "strict_verification_independent_of_cli",
    routeScope: "native_hostname_connection_attempt",
    status,
    code,
    elapsedMs: elapsed(started),
    stages
  });
  const step = async (stage, operation) => {
    const stageStarted = performance.now();
    const remaining = deadlineMs - (stageStarted - started);
    const timeoutCode = remaining <= STAGES[stage] ? "DEADLINE_EXCEEDED" : `${stage.toUpperCase()}_TIMEOUT`;
    try {
      if (remaining <= 0) throw new DiagnosticFault("DEADLINE_EXCEEDED");
      await new Promise((resolve, reject) => {
        let done = false;
        let cleanup = () => {};
        const finish = (error) => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          cleanup();
          if (error) reject(error);
          else resolve();
        };
        const timer = setTimeout(() => finish(new DiagnosticFault(timeoutCode)), Math.min(remaining, STAGES[stage]));
        try {
          cleanup = operation(() => finish(), (error) => finish(error)) ?? cleanup;
          if (done) cleanup();
        } catch (error) {
          finish(error);
        }
      });
      stages.push({ stage, status: "passed", code: "OK", elapsedMs: elapsed(stageStarted) });
    } catch (error) {
      const fault = error instanceof DiagnosticFault ? error : new DiagnosticFault(safeCode(stage, error));
      stages.push({ stage, status: fault.unsupported ? "unsupported" : "failed", code: fault.code, elapsedMs: elapsed(stageStarted) });
      throw fault;
    }
  };
  try {
    if (!Number.isInteger(deadlineMs) || deadlineMs < 1 || deadlineMs > MAX_DEADLINE_MS) {
      throw new DiagnosticFault("CONFIG_INVALID", true);
    }
    const { hostname, port } = transportTarget(databaseUrl, environment);
    await step("dns", (pass, fail) => {
      lookup(hostname, { all: true }, (error, addresses) => {
        if (error) fail(error);
        else if (!Array.isArray(addresses) || !addresses.length) fail(new DiagnosticFault("DNS_NO_ADDRESSES"));
        else pass();
      });
    });
    await step("tcp", (pass, fail) => {
      socket = connect({ host: hostname, port });
      // Keep a non-printing error handler across stage transitions; an error
      // between listeners must never become an uncaught raw Node exception.
      socket.on("error", () => {});
      const closed = () => fail(new DiagnosticFault("TCP_CONNECTION_CLOSED"));
      const connected = () => { socket.pause(); pass(); };
      socket.once("error", fail);
      socket.once("close", closed);
      socket.once("connect", connected);
      return () => { socket.off("error", fail); socket.off("close", closed); socket.off("connect", connected); };
    });
    await step("postgres_ssl_request", (pass, fail) => {
      const response = (bytes) => {
        socket.pause();
        if (bytes.length !== 1) fail(new DiagnosticFault("POSTGRES_SSL_RESPONSE_INVALID"));
        else if (bytes[0] === 78) fail(new DiagnosticFault("POSTGRES_TLS_UNAVAILABLE", true));
        else if (bytes[0] !== 83) fail(new DiagnosticFault("POSTGRES_SSL_RESPONSE_INVALID"));
        else pass();
      };
      const closed = () => fail(new DiagnosticFault("POSTGRES_SSL_CONNECTION_CLOSED"));
      socket.once("data", response);
      socket.once("error", fail);
      socket.once("close", closed);
      const request = Buffer.alloc(8);
      request.writeUInt32BE(8, 0);
      request.writeUInt32BE(80_877_103, 4);
      socket.write(request, (error) => { if (error) fail(error); });
      socket.resume();
      return () => { socket.off("data", response); socket.off("error", fail); socket.off("close", closed); };
    });
    await step("tls", (pass, fail) => {
      tlsSocket = startTls({ socket, servername: hostname, rejectUnauthorized: true, checkServerIdentity });
      tlsSocket.on("error", () => {});
      const secured = () => {
        if (tlsSocket.authorized !== true) fail(new DiagnosticFault("TLS_VERIFICATION_FAILED"));
        else pass();
      };
      const closed = () => fail(new DiagnosticFault("TLS_CONNECTION_CLOSED"));
      tlsSocket.once("secureConnect", secured);
      tlsSocket.once("error", fail);
      tlsSocket.once("close", closed);
      tlsSocket.resume();
      return () => { tlsSocket.off("secureConnect", secured); tlsSocket.off("error", fail); tlsSocket.off("close", closed); };
    });
    return report("passed", "TRANSPORT_PASSED_AUTH_UNTESTED");
  } catch (error) {
    const fault = error instanceof DiagnosticFault ? error : new DiagnosticFault("DIAGNOSTIC_FAILED");
    return report(fault.unsupported ? "unsupported" : "failed", fault.code);
  } finally {
    tlsSocket?.destroy();
    socket?.destroy();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await probeDatabaseTransport(process.argv.length === 2 ? process.env.SUPABASE_DB_URL : undefined);
  // Native DNS lookup cannot be cancelled. Explicitly end this standalone CLI
  // after its bounded result so an outstanding resolver cannot extend runtime.
  process.stdout.write(`${JSON.stringify(result)}\n`, () => process.exit(result.status === "passed" ? 0 : result.status === "unsupported" ? 2 : 1));
}
