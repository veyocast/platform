import { Buffer } from "node:buffer";
import { performance } from "node:perf_hooks";
import process from "node:process";
import { clearTimeout, setTimeout } from "node:timers";
import { pathToFileURL } from "node:url";

// One incident, not a general checks/status editor or deployment entry point.
export const INCIDENT = Object.freeze({
  repository: "veyocast/platform",
  runId: 42669988139,
  sha: "bd5f1fb59254a4fd7d56e3a2974d82f39e0ef611",
  suiteId: 115569409941,
  jobId: 129343672973,
  appId: 15368,
  appSlug: "github-actions",
  workflowPath: ".github/workflows/deploy.yml",
  minimumAgeMs: 15 * 60_000,
  maximumAgeMs: 24 * 60 * 60_000
});

const SHA = /^[0-9a-f]{40}$/;
const API = "https://api.github.com";
const ROOT = `/repos/${INCIDENT.repository}`;
const RUN = `${ROOT}/actions/runs/${INCIDENT.runId}`;
const SUITE = `${ROOT}/check-suites/${INCIDENT.suiteId}`;
const JOBS = `${RUN}/jobs?per_page=100`;
const MAIN = `${ROOT}/commits/main`;
const MAX_BODY_BYTES = 262_144;
const MAX_REQUEST_MS = 5_000;
const MAX_OPERATION_MS = 60_000;
const STATES = new Set(["requested", "queued", "pending", "waiting", "in_progress", "completed"]);
const CONCLUSIONS = new Set(["success", "failure", "cancelled", "timed_out", "neutral", "skipped", "action_required", "stale", "startup_failure"]);

export class RecoveryFault extends Error {
  constructor(code, httpStatus) {
    super(code);
    this.name = "RecoveryFault";
    this.code = code;
    if (Number.isInteger(httpStatus)) this.httpStatus = httpStatus;
  }
}

function requireGuard(condition, code) {
  if (!condition) throw new RecoveryFault(code);
}

export function validateExecutionEnvironment(environment) {
  requireGuard(environment?.GITHUB_REPOSITORY === INCIDENT.repository, "REPOSITORY_MISMATCH");
  requireGuard(environment.GITHUB_REF === "refs/heads/main", "MAIN_REF_REQUIRED");
  requireGuard(environment.GITHUB_EVENT_NAME === "workflow_dispatch", "MANUAL_EVENT_REQUIRED");
  requireGuard(environment.RECOVER_STUCK_DEPLOY === "ROOT_NATIVE_REREQUEST", "EXPLICIT_GATE_REQUIRED");
  const executionSha = environment.GITHUB_SHA;
  requireGuard(typeof executionSha === "string" && SHA.test(executionSha) && executionSha !== INCIDENT.sha, "NEW_MAIN_SHA_REQUIRED");
  const token = environment.GITHUB_TOKEN;
  requireGuard(typeof token === "string" && /^[\x21-\x7e]{20,4096}$/.test(token), "TOKEN_REQUIRED");
  return { executionSha, token };
}

function validateAge(value, nowMs) {
  requireGuard(typeof value === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(value), "CREATION_TIME_INVALID");
  const createdAt = Date.parse(value);
  requireGuard(Number.isFinite(createdAt) && Number.isFinite(nowMs), "CREATION_TIME_INVALID");
  const age = nowMs - createdAt;
  requireGuard(age >= INCIDENT.minimumAgeMs && age <= INCIDENT.maximumAgeMs, "INCIDENT_AGE_OUT_OF_BOUNDS");
}

export function validatePreflight({ run, suite, jobs, main, comparison }, { nowMs, executionSha }) {
  requireGuard(typeof executionSha === "string" && SHA.test(executionSha) && executionSha !== INCIDENT.sha, "NEW_MAIN_SHA_REQUIRED");
  requireGuard(run?.id === INCIDENT.runId && run.check_suite_id === INCIDENT.suiteId, "RUN_IDENTITY_MISMATCH");
  requireGuard(run.repository?.full_name === INCIDENT.repository && run.head_repository?.full_name === INCIDENT.repository, "RUN_REPOSITORY_MISMATCH");
  requireGuard(run.path === INCIDENT.workflowPath && run.event === "push" && run.head_branch === "main" && run.head_sha === INCIDENT.sha, "RUN_SCOPE_MISMATCH");
  requireGuard(run.status === "waiting" && run.conclusion === null, "RUN_NOT_UNSTARTED_WAITING");
  validateAge(run.created_at, nowMs);
  requireGuard(suite?.id === INCIDENT.suiteId && suite.head_sha === INCIDENT.sha && suite.head_branch === "main", "SUITE_IDENTITY_MISMATCH");
  requireGuard(suite.status === "waiting" && suite.conclusion === null && suite.rerequestable === true, "SUITE_NOT_REREQUESTABLE_WAITING");
  requireGuard(suite.app?.id === INCIDENT.appId && suite.app.slug === INCIDENT.appSlug, "SUITE_APP_MISMATCH");
  validateAge(suite.created_at, nowMs);
  requireGuard(jobs?.total_count === 1 && Array.isArray(jobs.jobs) && jobs.jobs.length === 1, "JOB_SET_MISMATCH");
  const job = jobs.jobs[0];
  requireGuard(job?.id === INCIDENT.jobId && job.run_id === INCIDENT.runId && job.name === "Preflight", "JOB_IDENTITY_MISMATCH");
  requireGuard(job.status === "waiting" && job.conclusion === null && Array.isArray(job.steps) && job.steps.length === 0, "JOB_HAS_EXECUTION");
  requireGuard((job.runner_id === null || job.runner_id === 0) && (job.runner_name === null || job.runner_name === ""), "JOB_HAS_RUNNER");
  requireGuard(main?.sha === executionSha, "MAIN_ADVANCED_OR_CHECKOUT_STALE");
  requireGuard(comparison?.status === "ahead" && comparison.base_commit?.sha === INCIDENT.sha && comparison.merge_base_commit?.sha === INCIDENT.sha, "INCIDENT_NOT_MAIN_ANCESTOR");
  return { runId: INCIDENT.runId, suiteId: INCIDENT.suiteId, jobId: INCIDENT.jobId, incidentSha: INCIDENT.sha, executionSha, zeroExecutedSteps: true };
}

function discard(response) {
  try { response.body?.cancel().catch(() => {}); } catch { /* Never print response/error bodies. */ }
}

async function readJson(response) {
  requireGuard(response.headers.get("content-type")?.split(";")[0].trim() === "application/json", "JSON_CONTENT_TYPE_REQUIRED");
  const declaredLength = response.headers.get("content-length");
  if (declaredLength !== null) requireGuard(/^\d+$/.test(declaredLength) && Number(declaredLength) <= MAX_BODY_BYTES, "RESPONSE_TOO_LARGE");
  requireGuard(response.body !== null, "JSON_BODY_REQUIRED");
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      requireGuard(size <= MAX_BODY_BYTES, "RESPONSE_TOO_LARGE");
      chunks.push(Buffer.from(value));
    }
    try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
    catch { throw new RecoveryFault("JSON_INVALID"); }
  } finally {
    reader.releaseLock();
  }
}

export function createGithubClient({ token, fetchImpl = globalThis.fetch, requestTimeoutMs = MAX_REQUEST_MS }) {
  requireGuard(typeof token === "string" && /^[\x21-\x7e]{20,4096}$/.test(token), "TOKEN_REQUIRED");
  requireGuard(typeof fetchImpl === "function", "FETCH_REQUIRED");
  requireGuard(Number.isInteger(requestTimeoutMs) && requestTimeoutMs >= 1 && requestTimeoutMs <= MAX_REQUEST_MS, "DEADLINE_INVALID");
  const startedAt = performance.now();
  let postAttempted = false;

  async function request(method, path) {
    const comparePath = new RegExp(`^${ROOT}/compare/${INCIDENT.sha}\\.\\.\\.[0-9a-f]{40}$`);
    requireGuard((method === "GET" && ([RUN, SUITE, JOBS, MAIN].includes(path) || comparePath.test(path))) || (method === "POST" && path === `${SUITE}/rerequest`), "ENDPOINT_NOT_ALLOWED");
    const remainingMs = Math.floor(MAX_OPERATION_MS - (performance.now() - startedAt));
    requireGuard(remainingMs > 0, "OPERATION_DEADLINE");
    const controller = new globalThis.AbortController();
    const url = API + path;
    let timer;
    let response;
    const operation = async () => {
      response = await fetchImpl(url, {
        method,
        redirect: "manual",
        signal: controller.signal,
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "X-GitHub-Api-Version": "2026-03-10",
          "User-Agent": "veyocast-fixed-native-deploy-rerequest"
        }
      });
      requireGuard(!response.redirected && (!response.url || response.url === url), "REDIRECT_REJECTED");
      requireGuard(response.status < 300 || response.status >= 400, "REDIRECT_REJECTED");
      if (response.status !== (method === "POST" ? 201 : 200)) throw new RecoveryFault("HTTP_REJECTED", response.status);
      return method === "POST" ? { httpStatus: 201 } : await readJson(response);
    };
    try {
      return await Promise.race([
        operation(),
        new Promise((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(new RecoveryFault("HTTP_DEADLINE"));
          }, Math.min(requestTimeoutMs, remainingMs));
        })
      ]);
    } catch (error) {
      if (error instanceof RecoveryFault) throw error;
      throw new RecoveryFault(controller.signal.aborted ? "HTTP_DEADLINE" : "NETWORK_FAILED");
    } finally {
      clearTimeout(timer);
      controller.abort();
      if (response) discard(response);
    }
  }

  return Object.freeze({
    getRun: () => request("GET", RUN),
    getSuite: () => request("GET", SUITE),
    getJobs: () => request("GET", JOBS),
    getMain: () => request("GET", MAIN),
    compareMain: (sha) => {
      requireGuard(typeof sha === "string" && SHA.test(sha) && sha !== INCIDENT.sha, "NEW_MAIN_SHA_REQUIRED");
      return request("GET", `${ROOT}/compare/${INCIDENT.sha}...${sha}`);
    },
    rerequest: async () => {
      requireGuard(!postAttempted, "REREQUEST_ALREADY_ATTEMPTED");
      // An ambiguous timeout must never cause this client to retry a mutation.
      postAttempted = true;
      try { return await request("POST", `${SUITE}/rerequest`); }
      catch (error) {
        if (error instanceof RecoveryFault && ["HTTP_DEADLINE", "NETWORK_FAILED"].includes(error.code)) throw new RecoveryFault("REREQUEST_OUTCOME_UNKNOWN");
        throw error;
      }
    }
  });
}

function state(value) { return STATES.has(value) ? value : "unknown"; }
function conclusion(value) { return value === null ? null : CONCLUSIONS.has(value) ? value : "unknown"; }
function safeReadback(run, suite, jobs) {
  return {
    run: { id: run?.id === INCIDENT.runId ? run.id : null, status: state(run?.status), conclusion: conclusion(run?.conclusion), runAttempt: Number.isSafeInteger(run?.run_attempt) && run.run_attempt > 0 ? run.run_attempt : null },
    suite: { id: suite?.id === INCIDENT.suiteId ? suite.id : null, status: state(suite?.status), conclusion: conclusion(suite?.conclusion) },
    jobs: { totalCount: Number.isSafeInteger(jobs?.total_count) ? jobs.total_count : null, fixedPreflight: Array.isArray(jobs?.jobs) ? jobs.jobs.filter((job) => job.id === INCIDENT.jobId).map((job) => ({ id: INCIDENT.jobId, status: state(job.status), conclusion: conclusion(job.conclusion), stepCount: Array.isArray(job.steps) ? job.steps.length : null, runnerAssigned: job.runner_id !== null && job.runner_id !== 0 })) : [] }
  };
}

export async function recoverStuckDeploy({ environment, fetchImpl, nowMs = Date.now, requestTimeoutMs }) {
  const { executionSha, token } = validateExecutionEnvironment(environment);
  const client = createGithubClient({ token, fetchImpl, requestTimeoutMs });
  const [run, suite, jobs, main, comparison] = await Promise.all([client.getRun(), client.getSuite(), client.getJobs(), client.getMain(), client.compareMain(executionSha)]);
  validatePreflight({ run, suite, jobs, main, comparison }, { nowMs: nowMs(), executionSha });
  // The native API has no conditional-write/CAS parameter. Recheck the complete
  // zero-execution scope and current main immediately before the single POST.
  const [freshRun, freshSuite, freshJobs, freshMain] = await Promise.all([client.getRun(), client.getSuite(), client.getJobs(), client.getMain()]);
  const verified = validatePreflight({ run: freshRun, suite: freshSuite, jobs: freshJobs, main: freshMain, comparison }, { nowMs: nowMs(), executionSha });
  const requested = await client.rerequest();
  let readback;
  try {
    readback = safeReadback(...await Promise.all([client.getRun(), client.getSuite(), client.getJobs()]));
  } catch (error) {
    readback = { available: false, code: error instanceof RecoveryFault ? error.code : "READBACK_FAILED" };
  }
  return { event: "native_suite_rerequest_requested", ...verified, ...requested, recoveryProven: false, atomicFenceAvailable: false, readback };
}

export async function runCli(args, environment, { write = (value) => process.stdout.write(value), fetchImpl, nowMs, requestTimeoutMs } = {}) {
  requireGuard(Array.isArray(args) && (args.length === 0 || (args.length === 1 && args[0] === "--execute")), "ARGUMENTS_INVALID");
  if (args.length === 0) {
    const result = { event: "native_suite_rerequest_validate_only", incident: INCIDENT, externalAccess: false, environmentRead: false, recoveryProven: false };
    write(`${JSON.stringify(result)}\n`);
    return result;
  }
  const result = await recoverStuckDeploy({ environment, fetchImpl, nowMs, requestTimeoutMs });
  write(`${JSON.stringify(result)}\n`);
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  runCli(args, args.length === 1 && args[0] === "--execute" ? process.env : undefined).catch((error) => {
    const safe = { event: "native_suite_rerequest_not_confirmed", code: error instanceof RecoveryFault ? error.code : "UNEXPECTED_FAILURE", recoveryProven: false };
    if (error instanceof RecoveryFault && error.httpStatus !== undefined) safe.httpStatus = error.httpStatus;
    process.stderr.write(`${JSON.stringify(safe)}\n`);
    process.exitCode = 1;
  });
}
