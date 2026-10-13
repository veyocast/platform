import { Buffer } from "node:buffer";
import { setTimeout as delay } from "node:timers/promises";
import { clearTimeout, setTimeout } from "node:timers";

const MODES = ["idle", "iowait", "irq", "nice", "softirq", "steal", "system", "user"];
const GAUGES = {
  node_memory_MemTotal_bytes: "memoryTotalBytes",
  node_memory_MemAvailable_bytes: "memoryAvailableBytes",
  node_memory_SwapTotal_bytes: "swapTotalBytes",
  node_memory_SwapFree_bytes: "swapFreeBytes",
  node_load1: "load1"
};
const GAUGE_KEYS = [...Object.values(GAUGES), "rootFilesystemSizeBytes", "rootFilesystemAvailableBytes"];
const LIMITS = { maxScrapes: 2, requestTimeoutMs: 10000, maxBodyBytes: 1048576, sampleWaitMs: 61000,
  maxLines: 16384, maxLineBytes: 8192, maxLabels: 5, maxCpuCores: 128 };
const LIMITATIONS = ["read_only_capacity_not_runtime_or_integration_acceptance", "metrics_names_and_labels_are_beta_missing_values_unknown",
  "cpu_fractions_of_exported_counter_deltas_not_historical_outage", "guest_already_in_user_and_nice_not_added",
  "iowait_and_steal_separate_not_cpu_health_verdict", "root_filesystem_only_not_database_volume_capacity",
  "no_compute_tier_capacity_limit_or_cause_inferred", "scrapes_not_atomic_with_sql_or_public_health"];
const SCRAPE_CODES = ["METRICS_OBSERVED", "METRICS_AUTH_FAILED", "METRICS_HTTP_FAILED", "METRICS_REDIRECT_REJECTED",
  "METRICS_TIMEOUT", "METRICS_ABORTED", "METRICS_BODY_TOO_LARGE", "METRICS_PARSE_FAILED", "METRICS_FETCH_FAILED"];
const CAPACITY_CODES = ["CAPACITY_OBSERVED", "CAPACITY_PARTIAL", "CAPACITY_UNPROVEN", "CAPACITY_SCOPE_INVALID", "CAPACITY_ABORTED", ...SCRAPE_CODES.slice(1)];
const CPU_CODES = ["CPU_UNAVAILABLE", "CPU_MISSING_SERIES", "CPU_SERIES_MISMATCH", "CPU_COUNTER_RESET", "CPU_ZERO_DELTA", "CPU_INTERVAL_UNPROVEN", "CPU_DELTA_OBSERVED"];
const emptyGauges = () => Object.fromEntries(GAUGE_KEYS.map(key => [key, null]));
const unknownCpu = (code = "CPU_UNAVAILABLE", coreCount = 0) => ({ status: "UNKNOWN", code, coreCount, deltaSeconds: null, fractions: null, guestExcluded: true });
const failure = code => Object.assign(new Error("CAPACITY_FIXED_FAILURE"), { capacityCode: code });
const number = value => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER;
const integer = value => number(value) && Number.isInteger(value);
const exactKeys = (value, keys) => value !== null && typeof value === "object" && !Array.isArray(value)
  && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const timestamp = value => typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;

export function capacityFailure(code = "CAPACITY_UNPROVEN") {
  return { schemaVersion: 1, status: "UNPROVEN", code: CAPACITY_CODES.includes(code) && code !== "CAPACITY_OBSERVED" && code !== "CAPACITY_PARTIAL" ? code : "CAPACITY_UNPROVEN",
    scrapes: [], sampleIntervalMs: null, gauges: emptyGauges(), cpu: unknownCpu(), limits: { ...LIMITS }, limitations: [...LIMITATIONS] };
}

function validateGauges(value) {
  if (!exactKeys(value, GAUGE_KEYS) || !GAUGE_KEYS.every(key => value[key] === null || (key === "load1" ? number(value[key]) : integer(value[key])))) return false;
  for (const [total, free] of [["memoryTotalBytes", "memoryAvailableBytes"], ["swapTotalBytes", "swapFreeBytes"],
    ["rootFilesystemSizeBytes", "rootFilesystemAvailableBytes"]]) {
    if (value[total] !== null && value[free] !== null && value[free] > value[total]) return false;
  }
  return true;
}

// Strict projection rejects arbitrary nested keys, free strings, and inconsistent successful verdicts.
export function sanitizeCapacityMetrics(value) {
  const reject = () => capacityFailure();
  if (!exactKeys(value, ["schemaVersion", "status", "code", "scrapes", "sampleIntervalMs", "gauges", "cpu", "limits", "limitations"])
    || value.schemaVersion !== 1 || !["OBSERVED", "PARTIAL", "UNPROVEN"].includes(value.status) || !CAPACITY_CODES.includes(value.code)
    || !Array.isArray(value.scrapes) || value.scrapes.length > 2 || !validateGauges(value.gauges)
    || !exactKeys(value.limits, Object.keys(LIMITS)) || Object.keys(LIMITS).some(key => value.limits[key] !== LIMITS[key])
    || !Array.isArray(value.limitations) || JSON.stringify(value.limitations) !== JSON.stringify(LIMITATIONS)) return reject();
  for (const scrape of value.scrapes) {
    if (!exactKeys(scrape, ["status", "code", "httpStatus", "observedAt"]) || !SCRAPE_CODES.includes(scrape.code)
      || scrape.status !== (scrape.code === "METRICS_OBSERVED" ? "OBSERVED" : "UNPROVEN")
      || !(scrape.httpStatus === null || (Number.isInteger(scrape.httpStatus) && scrape.httpStatus >= 100 && scrape.httpStatus <= 599))
      || !timestamp(scrape.observedAt) || (scrape.code === "METRICS_OBSERVED" && scrape.httpStatus !== 200)) return reject();
  }
  if (!(value.sampleIntervalMs === null || integer(value.sampleIntervalMs))
    || (value.scrapes.length !== 2 && value.sampleIntervalMs !== null)
    || (value.scrapes.length === 2 && value.sampleIntervalMs !== Math.max(0, Date.parse(value.scrapes[1].observedAt) - Date.parse(value.scrapes[0].observedAt)))) return reject();
  const cpu = value.cpu;
  if (!exactKeys(cpu, ["status", "code", "coreCount", "deltaSeconds", "fractions", "guestExcluded"]) || cpu.guestExcluded !== true
    || !CPU_CODES.includes(cpu.code) || !Number.isInteger(cpu.coreCount) || cpu.coreCount < 0 || cpu.coreCount > 128) return reject();
  if (cpu.status === "OBSERVED") {
    if (cpu.code !== "CPU_DELTA_OBSERVED" || cpu.coreCount === 0 || !number(cpu.deltaSeconds) || cpu.deltaSeconds <= 0
      || !exactKeys(cpu.fractions, MODES) || MODES.some(mode => !number(cpu.fractions[mode]) || cpu.fractions[mode] > 1)
      || Math.abs(MODES.reduce((sum, mode) => sum + cpu.fractions[mode], 0) - 1) > 1e-9
      || value.scrapes.length !== 2 || value.scrapes.some(scrape => scrape.code !== "METRICS_OBSERVED") || value.sampleIntervalMs < 61000) return reject();
  } else if (cpu.status !== "UNKNOWN" || cpu.code === "CPU_DELTA_OBSERVED" || cpu.deltaSeconds !== null || cpu.fractions !== null) return reject();
  const observed = value.scrapes.some(scrape => scrape.code === "METRICS_OBSERVED");
  const useful = GAUGE_KEYS.some(key => value.gauges[key] !== null) || cpu.status === "OBSERVED";
  const complete = value.scrapes.length === 2 && value.scrapes.every(scrape => scrape.code === "METRICS_OBSERVED")
    && GAUGE_KEYS.every(key => value.gauges[key] !== null) && cpu.status === "OBSERVED";
  const expected = complete ? "OBSERVED" : observed && useful ? "PARTIAL" : "UNPROVEN";
  if (value.status !== expected || (expected === "OBSERVED" && value.code !== "CAPACITY_OBSERVED")
    || (expected === "PARTIAL" && value.code !== "CAPACITY_PARTIAL")
    || (expected === "UNPROVEN" && ["CAPACITY_OBSERVED", "CAPACITY_PARTIAL"].includes(value.code))
    || (!observed && useful)) return reject();
  return structuredCopy(value);
}

function structuredCopy(value) { return JSON.parse(JSON.stringify(value)); }

function labels(text) {
  const parsed = new Map(); let rest = text;
  while (rest.length) {
    const match = /^([a-zA-Z_][a-zA-Z0-9_]*)="([^"\\\r\n]*)"(?:,|$)/.exec(rest);
    if (!match || parsed.has(match[1]) || parsed.size >= LIMITS.maxLabels || match[2].length > 256) throw failure("METRICS_PARSE_FAILED");
    parsed.set(match[1], match[2]); rest = rest.slice(match[0].length);
  }
  return parsed;
}

function parseMetrics(text, projectRef) {
  const gauges = emptyGauges(), cores = new Map(), seen = new Set(); let rootDevice;
  const lines = text.split("\n");
  if (lines.length > LIMITS.maxLines) throw failure("METRICS_PARSE_FAILED");
  for (const line of lines) {
    if (Buffer.byteLength(line) > LIMITS.maxLineBytes) throw failure("METRICS_PARSE_FAILED");
    if (!line || line.startsWith("#")) continue;
    const name = /^([a-zA-Z_:][a-zA-Z0-9_:]*)/.exec(line)?.[1];
    const disk = name === "node_filesystem_size_bytes" || name === "node_filesystem_avail_bytes";
    if (!Object.hasOwn(GAUGES, name ?? "") && name !== "node_cpu_seconds_total" && !disk) continue;
    const match = /^([a-zA-Z_:][a-zA-Z0-9_:]*)\{(.*)\} ([+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)\r?$/.exec(line);
    if (!match) throw failure("METRICS_PARSE_FAILED");
    const fields = labels(match[2]), numeric = Number(match[3]);
    const expected = name === "node_cpu_seconds_total" ? ["supabase_project_ref", "service_type", "cpu", "mode"]
      : disk ? ["supabase_project_ref", "service_type", "device", "fstype", "mountpoint"] : ["supabase_project_ref", "service_type"];
    if (fields.size !== expected.length || expected.some(key => !fields.has(key)) || fields.get("supabase_project_ref") !== projectRef
      || fields.get("service_type") !== "db" || !number(numeric)) throw failure("METRICS_PARSE_FAILED");
    if (disk) {
      // Only the documented root ext4 mount is classified; device labels are discarded.
      if (fields.get("mountpoint") !== "/" || fields.get("fstype") !== "ext4") continue;
      if (!/^\/?[a-zA-Z0-9_./:-]{1,256}$/.test(fields.get("device")) || !integer(numeric)) throw failure("METRICS_PARSE_FAILED");
      if (rootDevice !== undefined && rootDevice !== fields.get("device")) throw failure("METRICS_PARSE_FAILED");
      rootDevice = fields.get("device");
      const key = name === "node_filesystem_size_bytes" ? "rootFilesystemSizeBytes" : "rootFilesystemAvailableBytes";
      if (seen.has(key)) throw failure("METRICS_PARSE_FAILED"); seen.add(key); gauges[key] = numeric;
    } else if (name === "node_cpu_seconds_total") {
      const core = fields.get("cpu"), mode = fields.get("mode");
      if (!/^(?:0|[1-9]\d{0,2})$/.test(core) || Number(core) > 127 || !MODES.includes(mode)) throw failure("METRICS_PARSE_FAILED");
      if (!cores.has(core)) cores.set(core, new Map());
      if (cores.get(core).has(mode) || cores.size > 128) throw failure("METRICS_PARSE_FAILED");
      cores.get(core).set(mode, numeric);
    } else {
      const key = GAUGES[name];
      if (seen.has(key) || (name !== "node_load1" && !integer(numeric))) throw failure("METRICS_PARSE_FAILED");
      seen.add(key); gauges[key] = numeric;
    }
  }
  if (!validateGauges(gauges)) throw failure("METRICS_PARSE_FAILED");
  return { gauges, cores };
}

function compareCpu(first, second, intervalMs) {
  if (!first || !second) return unknownCpu();
  const size = second.cores.size;
  if (!size || !first.cores.size || [...first.cores.values(), ...second.cores.values()].some(core => core.size !== MODES.length)) return unknownCpu("CPU_MISSING_SERIES", size);
  if (first.cores.size !== size || [...second.cores.keys()].some(core => !first.cores.has(core))) return unknownCpu("CPU_SERIES_MISMATCH", size);
  if (intervalMs < 61000) return unknownCpu("CPU_INTERVAL_UNPROVEN", size);
  const deltas = Object.fromEntries(MODES.map(mode => [mode, 0]));
  for (const [id, core] of second.cores) {
    let coreDelta = 0;
    for (const mode of MODES) {
      const delta = core.get(mode) - first.cores.get(id).get(mode);
      if (delta < 0) return unknownCpu("CPU_COUNTER_RESET", size);
      deltas[mode] += delta; coreDelta += delta;
    }
    if (coreDelta === 0) return unknownCpu("CPU_ZERO_DELTA", size);
  }
  const total = MODES.reduce((sum, mode) => sum + deltas[mode], 0);
  if (!number(total) || total <= 0) return unknownCpu("CPU_ZERO_DELTA", size);
  return { status: "OBSERVED", code: "CPU_DELTA_OBSERVED", coreCount: size, deltaSeconds: total,
    fractions: Object.fromEntries(MODES.map(mode => [mode, deltas[mode] / total])), guestExcluded: true };
}

async function abortable(promise, signal) {
  if (signal.aborted) throw failure("METRICS_ABORTED");
  let listener;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      listener = () => reject(failure("METRICS_ABORTED")); signal.addEventListener("abort", listener, { once: true });
    })]);
  } finally { if (listener) signal.removeEventListener("abort", listener); }
}

async function scrape(projectRef, serviceRoleKey, signal, fetchImpl, now) {
  const controller = new globalThis.AbortController(); let timedOut = false, reader, body, httpStatus = null;
  const abort = () => controller.abort(); signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, LIMITS.requestTimeoutMs);
  let parsed, code = "METRICS_FETCH_FAILED";
  try {
    if (signal?.aborted) controller.abort();
    const response = await abortable(Promise.resolve().then(() => {
      if (controller.signal.aborted) throw failure("METRICS_ABORTED");
      return fetchImpl(`https://${projectRef}.supabase.co/customer/v1/privileged/metrics`, {
      method: "GET", redirect: "error", signal: controller.signal,
      headers: { Authorization: `Basic ${Buffer.from(`service_role:${serviceRoleKey}`).toString("base64")}`, Accept: "text/plain" }
    }); }), controller.signal);
    body = response.body;
    httpStatus = Number.isInteger(response.status) && response.status >= 100 && response.status <= 599 ? response.status : null;
    if (response.redirected || (httpStatus >= 300 && httpStatus < 400)) throw failure("METRICS_REDIRECT_REJECTED");
    if (httpStatus === 401 || httpStatus === 403) throw failure("METRICS_AUTH_FAILED");
    if (httpStatus !== 200) throw failure("METRICS_HTTP_FAILED");
    const length = response.headers?.get("content-length");
    if (length !== null && length !== undefined && (!/^\d+$/.test(length) || Number(length) > LIMITS.maxBodyBytes)) throw failure("METRICS_BODY_TOO_LARGE");
    if (!response.body || typeof response.body.getReader !== "function") throw failure("METRICS_PARSE_FAILED");
    reader = response.body.getReader(); const chunks = []; let bytes = 0;
    while (true) {
      const part = await abortable(reader.read(), controller.signal);
      if (part.done) break;
      if (!(part.value instanceof Uint8Array)) throw failure("METRICS_PARSE_FAILED");
      bytes += part.value.byteLength;
      if (bytes > LIMITS.maxBodyBytes) throw failure("METRICS_BODY_TOO_LARGE");
      chunks.push(Buffer.from(part.value));
    }
    let text;
    try { text = new globalThis.TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)); }
    catch { throw failure("METRICS_PARSE_FAILED"); }
    parsed = parseMetrics(text, projectRef); code = "METRICS_OBSERVED";
  } catch (error) {
    code = timedOut ? "METRICS_TIMEOUT" : signal?.aborted ? "METRICS_ABORTED"
      : SCRAPE_CODES.includes(error?.capacityCode) ? error.capacityCode : "METRICS_FETCH_FAILED";
  } finally {
    clearTimeout(timer); signal?.removeEventListener("abort", abort); controller.abort();
    const release = () => { try { reader?.releaseLock(); } catch { /* No raw cleanup errors. */ } };
    try { Promise.resolve(reader ? reader.cancel() : body?.cancel()).catch(() => {}).finally(release); } catch { release(); }
  }
  const observedAt = new Date(now()).toISOString();
  return { summary: { status: code === "METRICS_OBSERVED" ? "OBSERVED" : "UNPROVEN", code, httpStatus, observedAt }, parsed };
}

export async function collectCapacityMetrics({ projectRef, serviceRoleKey, signal } = {},
  { fetchImpl = globalThis.fetch, waitImpl = (ms, activeSignal) => delay(ms, undefined, { signal: activeSignal }), now = Date.now } = {}) {
  if (typeof projectRef !== "string" || !/^[a-z0-9]{20}$/.test(projectRef) || typeof serviceRoleKey !== "string"
    || serviceRoleKey.length < 1 || serviceRoleKey.length > 8192
    || [...serviceRoleKey].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) return capacityFailure("CAPACITY_SCOPE_INVALID");
  if (signal?.aborted) return capacityFailure("CAPACITY_ABORTED");
  const report = capacityFailure();
  try {
    const first = await scrape(projectRef, serviceRoleKey, signal, fetchImpl, now); report.scrapes.push(first.summary);
    if (!first.parsed) { report.code = first.summary.code; return sanitizeCapacityMetrics(report); }
    report.gauges = first.parsed.gauges;
    const waitSignal = signal ?? new globalThis.AbortController().signal;
    try { await abortable(Promise.resolve().then(() => waitImpl(LIMITS.sampleWaitMs, waitSignal)), waitSignal); }
    catch { report.code = "CAPACITY_ABORTED"; report.status = GAUGE_KEYS.some(key => report.gauges[key] !== null) ? "PARTIAL" : "UNPROVEN";
      if (report.status === "PARTIAL") report.code = "CAPACITY_PARTIAL"; return sanitizeCapacityMetrics(report); }
    const second = await scrape(projectRef, serviceRoleKey, signal, fetchImpl, now); report.scrapes.push(second.summary);
    report.sampleIntervalMs = Math.max(0, Date.parse(second.summary.observedAt) - Date.parse(first.summary.observedAt));
    if (second.parsed) report.gauges = second.parsed.gauges;
    report.cpu = compareCpu(first.parsed, second.parsed, report.sampleIntervalMs);
    const useful = GAUGE_KEYS.some(key => report.gauges[key] !== null) || report.cpu.status === "OBSERVED";
    const complete = second.parsed && GAUGE_KEYS.every(key => report.gauges[key] !== null) && report.cpu.status === "OBSERVED";
    report.status = complete ? "OBSERVED" : useful ? "PARTIAL" : "UNPROVEN";
    report.code = complete ? "CAPACITY_OBSERVED" : useful ? "CAPACITY_PARTIAL" : second.summary.code === "METRICS_OBSERVED" ? "CAPACITY_UNPROVEN" : second.summary.code;
    return sanitizeCapacityMetrics(report);
  } catch { return capacityFailure(signal?.aborted ? "CAPACITY_ABORTED" : "CAPACITY_UNPROVEN"); }
}
