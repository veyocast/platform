import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import test from "node:test";
import { setImmediate } from "node:timers/promises";

import { capacityFailure, collectCapacityMetrics, sanitizeCapacityMetrics } from "./supabase-capacity-metrics.mjs";

const projectRef = "abcdefghijklmnopqrst", secret = "PRIVATE_SERVICE_KEY";
const modes = ["idle", "iowait", "irq", "nice", "softirq", "steal", "system", "user"];
const base = `supabase_project_ref="${projectRef}",service_type="db"`;
const input = extra => ({ projectRef, serviceRoleKey: secret, ...extra });
const metric = (name, value, extra = "") => `${name}{${base}${extra ? `,${extra}` : ""}} ${value}`;
function metrics(increment = 0, { cores = [0], omit = [], guest = 50000 } = {}) {
  const lines = [metric("node_memory_MemTotal_bytes", 1000), metric("node_memory_MemAvailable_bytes", 400),
    metric("node_memory_SwapTotal_bytes", 200), metric("node_memory_SwapFree_bytes", 100), metric("node_load1", 0.75),
    metric("node_filesystem_size_bytes", 2000, 'device="/dev/vda1",fstype="ext4",mountpoint="/"'),
    metric("node_filesystem_avail_bytes", 1000, 'device="/dev/vda1",fstype="ext4",mountpoint="/"')];
  for (const core of cores) for (const mode of modes) if (!omit.includes(mode)) {
    lines.push(metric("node_cpu_seconds_total", 100 + increment * (mode === "idle" ? 7 : 1), `cpu="${core}",mode="${mode}"`));
  }
  lines.push(metric("node_cpu_guest_seconds_total", guest, 'cpu="0",mode="user"'));
  return lines.join("\n");
}
function deps(bodies = [metrics(), metrics(1)], extra = {}) {
  let clock = Date.parse("2026-10-13T12:00:00.000Z"), calls = 0;
  return { now: () => clock, waitImpl: async (ms, signal) => { assert.equal(ms, 61000); assert.equal(signal.aborted, false); clock += ms; },
    fetchImpl: async (url, options) => {
      assert.equal(url, `https://${projectRef}.supabase.co/customer/v1/privileged/metrics`);
      assert.equal(options.method, "GET"); assert.equal(options.redirect, "error");
      assert.equal(options.headers.Authorization, `Basic ${Buffer.from(`service_role:${secret}`).toString("base64")}`);
      assert.equal(options.signal.aborted, false);
      const body = bodies[calls++]; assert.ok(body !== undefined, "No retries or third scrape");
      return typeof body === "string" ? new globalThis.Response(body) : body;
    }, ...extra };
}
const privateOutput = report => assert.doesNotMatch(JSON.stringify(report), /PRIVATE_|supabase\.co|abcdefghijklmnopqrst|\/dev\/vda|service_role:|node_cpu_seconds_total/);
const clone = value => JSON.parse(JSON.stringify(value));

test("two fixed authenticated GETs produce safe gauges and CPU fractions including iowait and steal", async () => {
  const report = await collectCapacityMetrics(input(), deps());
  assert.equal(report.status, "OBSERVED"); assert.equal(report.code, "CAPACITY_OBSERVED"); assert.equal(report.scrapes.length, 2);
  assert.equal(report.sampleIntervalMs, 61000); assert.equal(report.cpu.deltaSeconds, 14); assert.equal(report.cpu.fractions.idle, 0.5);
  assert.equal(report.cpu.fractions.iowait, 1 / 14); assert.equal(report.cpu.fractions.steal, 1 / 14);
  assert.equal(report.gauges.memoryAvailableBytes, 400); assert.equal(report.gauges.rootFilesystemSizeBytes, 2000);
  assert.deepEqual(sanitizeCapacityMetrics(report), report); privateOutput(report);
});

test("scope and key guards reject before fetch, wait or secret-bearing request", async () => {
  for (const patch of [{ projectRef: "PRIVATE_ENDPOINT" }, { projectRef: "a".repeat(19) }, { projectRef: `${projectRef}/other` },
    { serviceRoleKey: "" }, { serviceRoleKey: "PRIVATE_KEY\nredirect" }, { serviceRoleKey: "a".repeat(8193) }]) {
    let calls = 0;
    const report = await collectCapacityMetrics(input(patch), { fetchImpl: () => { calls++; }, waitImpl: () => { calls++; } });
    assert.equal(report.code, "CAPACITY_SCOPE_INVALID"); assert.equal(calls, 0); privateOutput(report);
  }
});

test("401 and 403 do not read raw bodies or retry authentication", async () => {
  for (const status of [401, 403]) {
    let canceled = 0;
    const response = { status, body: { cancel: async () => { canceled++; }, getReader: () => { throw new Error("PRIVATE_BODY_READ"); } } };
    const report = await collectCapacityMetrics(input(), deps([response]));
    assert.equal(report.code, "METRICS_AUTH_FAILED"); assert.equal(report.scrapes.length, 1); assert.equal(canceled, 1); privateOutput(report);
  }
});

test("redirects and non-200 responses fail closed without following or exposing locations", async () => {
  for (const response of [new globalThis.Response("PRIVATE_BODY", { status: 302, headers: { Location: "https://PRIVATE_HOST/" } }),
    { status: 200, redirected: true, body: null }, new globalThis.Response("PRIVATE_BODY", { status: 503 })]) {
    const report = await collectCapacityMetrics(input(), deps([response]));
    assert.equal(report.status, "UNPROVEN"); assert.equal(report.scrapes.length, 1); privateOutput(report);
  }
});

test("fetch exceptions including credential-bearing causes emit only fixed safe codes", async () => {
  const report = await collectCapacityMetrics(input(), deps([], { fetchImpl: async () => { throw new Error(`PRIVATE_ERROR ${secret} https://${projectRef}.supabase.co`); } }));
  assert.equal(report.code, "METRICS_FETCH_FAILED"); privateOutput(report);
});

test("content-length and streamed body limits cancel real streams before parsing", async () => {
  for (const declared of [true, false]) {
    let canceled = false;
    const stream = new globalThis.ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(1048577)); },
      cancel() { canceled = true; } });
    const response = new globalThis.Response(stream, { headers: declared ? { "content-length": "1048577" } : {} });
    const report = await collectCapacityMetrics(input(), deps([response]));
    assert.equal(report.code, "METRICS_BODY_TOO_LARGE"); await setImmediate(); assert.equal(canceled, true); privateOutput(report);
  }
});

test("invalid UTF8 and oversized line or line count are rejected", async () => {
  for (const body of [new globalThis.Response(new Uint8Array([255, 254])), "#" + "a".repeat(8192), "#\n".repeat(16384)]) {
    const report = await collectCapacityMetrics(input(), deps([body])); assert.equal(report.code, "METRICS_PARSE_FAILED"); privateOutput(report);
  }
});

test("known series require exact expected project, db service, labels and safe numeric values", async () => {
  for (const line of [metric("node_load1", 1).replace(projectRef, "uvwxyzabcdefghijklmn"), metric("node_load1", 1).replace('service_type="db"', 'service_type="api"'),
    metric("node_load1", 1, 'host="PRIVATE_HOST"'), metric("node_load1", "NaN"), metric("node_load1", "+Inf"), metric("node_load1", -1),
    metric("node_load1", 9007199254740992), metric("node_load1", 1, 'service_type="db"'), metric("node_load1", 1).replace('service_type="db"', 'service_type="PRIVATE\\nVALUE"')]) {
    const report = await collectCapacityMetrics(input(), deps([line])); assert.equal(report.code, "METRICS_PARSE_FAILED"); privateOutput(report);
  }
});

test("duplicate gauges, CPU modes, root mounts and mismatched root device pairs are rejected", async () => {
  const text = metrics();
  for (const duplicate of [metric("node_load1", 1), metric("node_cpu_seconds_total", 100, 'cpu="0",mode="idle"'),
    metric("node_filesystem_size_bytes", 2000, 'device="/dev/vdb1",fstype="ext4",mountpoint="/"')]) {
    assert.equal((await collectCapacityMetrics(input(), deps([`${text}\n${duplicate}`]))).code, "METRICS_PARSE_FAILED");
  }
  const mixed = text.replace('node_filesystem_avail_bytes{' + base + ',device="/dev/vda1"', 'node_filesystem_avail_bytes{' + base + ',device="/dev/vdb1"');
  assert.equal((await collectCapacityMetrics(input(), deps([mixed]))).code, "METRICS_PARSE_FAILED");
});

test("memory, swap and root filesystem bounds reject invalid available/total or fractional bytes", async () => {
  for (const text of [metrics().replace("} 400", "} 1001"), metrics().replace("} 100\nnode_load1", "} 201\nnode_load1"),
    metrics().replace('mountpoint="/"} 1000', 'mountpoint="/"} 2001'), metrics().replace("} 400", "} 0.5")]) {
    assert.equal((await collectCapacityMetrics(input(), deps([text]))).code, "METRICS_PARSE_FAILED");
  }
});

test("missing gauges remain null and unfamiliar mounts never become a database volume claim", async () => {
  const body = metric("node_load1", 0) + "\n" + metric("node_filesystem_size_bytes", 5000, 'device="PRIVATE_DEVICE",fstype="ext4",mountpoint="/data"');
  const report = await collectCapacityMetrics(input(), deps([body, body]));
  assert.equal(report.status, "PARTIAL"); assert.equal(report.gauges.load1, 0); assert.equal(report.gauges.memoryTotalBytes, null);
  assert.equal(report.gauges.rootFilesystemSizeBytes, null); assert.equal(report.cpu.status, "UNKNOWN"); privateOutput(report);
});

test("guest counters are excluded from user/nice totals and do not inflate denominator", async () => {
  const report = await collectCapacityMetrics(input(), deps([metrics(0, { guest: 1 }), metrics(1, { guest: 1000000000 })]));
  assert.equal(report.cpu.deltaSeconds, 14); assert.equal(report.cpu.fractions.user, 1 / 14); assert.equal(report.cpu.guestExcluded, true);
  const invalid = metrics().replace('mode="user"', 'mode="guest"');
  assert.equal((await collectCapacityMetrics(input(), deps([invalid]))).code, "METRICS_PARSE_FAILED");
});

test("zero delta, missing modes, counter reset and mismatched core sets cannot report CPU success", async () => {
  const cases = [[metrics(), metrics(), "CPU_ZERO_DELTA"], [metrics(0, { omit: ["steal"] }), metrics(1), "CPU_MISSING_SERIES"],
    [metrics(), metrics(1).replace('mode="user"} 101', 'mode="user"} 99'), "CPU_COUNTER_RESET"],
    [metrics(), metrics(1, { cores: [1] }), "CPU_SERIES_MISMATCH"]];
  for (const [first, second, code] of cases) {
    const report = await collectCapacityMetrics(input(), deps([first, second])); assert.equal(report.cpu.code, code);
    assert.equal(report.cpu.status, "UNKNOWN"); assert.equal(report.cpu.fractions, null); assert.equal(report.status, "PARTIAL"); privateOutput(report);
  }
});

test("128 cores are bounded and one stale core prevents aggregate CPU success", async () => {
  const cores = Array.from({ length: 128 }, (_, index) => index);
  const report = await collectCapacityMetrics(input(), deps([metrics(0, { cores }), metrics(1, { cores })]));
  assert.equal(report.cpu.coreCount, 128); assert.equal(report.cpu.status, "OBSERVED");
  const invalid = metrics() + "\n" + metric("node_cpu_seconds_total", 0, 'cpu="128",mode="idle"');
  assert.equal((await collectCapacityMetrics(input(), deps([invalid]))).code, "METRICS_PARSE_FAILED");
  const second = metrics(1, { cores: [0] }) + "\n" + modes.map(mode => metric("node_cpu_seconds_total", 100, `cpu="1",mode="${mode}"`)).join("\n");
  assert.equal((await collectCapacityMetrics(input(), deps([metrics(0, { cores: [0, 1] }), second]))).cpu.code, "CPU_ZERO_DELTA");
});

test("wall time shorter than refresh cadence remains unknown despite positive counters", async () => {
  const report = await collectCapacityMetrics(input(), deps(undefined, { waitImpl: async () => {} }));
  assert.equal(report.sampleIntervalMs, 0); assert.equal(report.cpu.code, "CPU_INTERVAL_UNPROVEN"); assert.equal(report.status, "PARTIAL");
});

test("second request failure preserves first numeric observation but cannot become complete", async () => {
  const report = await collectCapacityMetrics(input(), deps([metrics(), new globalThis.Response("PRIVATE_BODY", { status: 503 })]));
  assert.equal(report.status, "PARTIAL"); assert.equal(report.cpu.code, "CPU_UNAVAILABLE"); assert.equal(report.scrapes[1].code, "METRICS_HTTP_FAILED");
  assert.equal(report.gauges.memoryTotalBytes, 1000); privateOutput(report);
});

test("pre-abort makes no request and cancellation during wait prevents second request", async () => {
  const controller = new globalThis.AbortController(); controller.abort(); let calls = 0;
  assert.equal((await collectCapacityMetrics(input({ signal: controller.signal }), { fetchImpl: async () => { calls++; } })).code, "CAPACITY_ABORTED");
  assert.equal(calls, 0);
  const active = new globalThis.AbortController();
  const options = deps([metrics()], { waitImpl: async () => { active.abort(); await new Promise(() => {}); } });
  const report = await collectCapacityMetrics(input({ signal: active.signal }), options);
  assert.equal(report.scrapes.length, 1); assert.equal(report.status, "PARTIAL"); assert.equal(report.cpu.status, "UNKNOWN"); privateOutput(report);
});

test("abort while native stream is pending cancels its reader and request signal", async () => {
  const controller = new globalThis.AbortController(); let fetchedSignal, canceled = false, began;
  const started = new Promise(resolve => { began = resolve; });
  const stream = new globalThis.ReadableStream({ pull() { began(); return new Promise(() => {}); }, cancel() { canceled = true; } });
  const reportPromise = collectCapacityMetrics(input({ signal: controller.signal }), deps([], { fetchImpl: async (_, options) => {
    fetchedSignal = options.signal; return new globalThis.Response(stream);
  } }));
  await started; await setImmediate(); controller.abort();
  const report = await reportPromise; await setImmediate();
  assert.equal(report.code, "METRICS_ABORTED"); assert.equal(canceled, true); assert.equal(fetchedSignal.aborted, true); privateOutput(report);
});

test("fixed real 10-second request deadline bounds a fetch adapter that never resolves", async () => {
  let started, requestSignal; const began = new Promise(resolve => { started = resolve; });
  const result = collectCapacityMetrics(input(), deps([], { fetchImpl: async (_, options) => {
    requestSignal = options.signal; started(); return new Promise(() => {});
  } }));
  await began; assert.equal(requestSignal.aborted, false); const report = await result;
  assert.equal(report.code, "METRICS_TIMEOUT"); assert.equal(requestSignal.aborted, true); privateOutput(report);
});

test("abort between scheduling and credentialed fetch makes no request", async () => {
  const controller = new globalThis.AbortController(); let calls = 0;
  const promise = collectCapacityMetrics(input({ signal: controller.signal }), deps([], { fetchImpl: async () => { calls++; } }));
  controller.abort(); const report = await promise;
  assert.equal(calls, 0); assert.equal(report.code, "METRICS_ABORTED"); privateOutput(report);
});

test("completed and malformed streamed responses release native reader locks", async () => {
  for (const text of [metrics(), metric("node_load1", "NaN")]) {
    const response = new globalThis.Response(text), stream = response.body;
    const report = await collectCapacityMetrics(input(), deps([response, new globalThis.Response(metrics(1))]));
    await setImmediate(); assert.equal(stream.locked, false);
    if (text === metrics()) assert.equal(report.status, "OBSERVED"); else assert.equal(report.code, "METRICS_PARSE_FAILED");
    privateOutput(report);
  }
});

test("sanitizer rejects unknown nested fields, private scalars, dishonest success and malformed limits", async () => {
  const valid = await collectCapacityMetrics(input(), deps());
  for (const mutate of [r => { r.message = secret; }, r => { r.cpu.message = secret; }, r => { r.gauges.load1 = secret; },
    r => { r.scrapes[0].observedAt = secret; }, r => { r.cpu.fractions.user = 2; }, r => { r.cpu.fractions.user = NaN; },
    r => { r.cpu.deltaSeconds = 0; }, r => { r.scrapes[0].httpStatus = 503; }, r => { r.limits.requestTimeoutMs = 60000; },
    r => { r.sampleIntervalMs = 1; }, r => { r.limitations.push(secret); }, r => { r.gauges.memoryAvailableBytes = 1001; }]) {
    const corrupted = clone(valid); mutate(corrupted); const safe = sanitizeCapacityMetrics(corrupted);
    assert.equal(safe.status, "UNPROVEN"); assert.equal(safe.code, "CAPACITY_UNPROVEN"); privateOutput(safe);
  }
  assert.deepEqual(sanitizeCapacityMetrics(capacityFailure()), capacityFailure());
  assert.equal(capacityFailure(secret).code, "CAPACITY_UNPROVEN");
  assert.equal(capacityFailure("CAPACITY_OBSERVED").status, "UNPROVEN");
});
