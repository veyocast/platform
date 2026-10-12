import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { groupEnvironment, runBrowserGates, validateCaseExecution, validatePlayerInventory } from "./run-browser-gates.mjs";

const cwd = "/fixture";
const file = "tests/player/welcome.spec.ts";
function item(id = "first", titles = ["first case"], path = file) {
  return { id, project: "chromium", file: resolve(cwd, path), line: 7, column: 3,
    titlePath: ["", "chromium", path.slice(6), ...titles], expectedStatus: "passed", retries: 0 };
}
function report(cases = [item()]) {
  return { schemaVersion: 1, rootDir: resolve(cwd, "tests"), workers: 1,
    projects: [{ name: "chromium", retries: 0, repeatEach: 1 }], cases,
    started: [], results: [], errors: 0, status: "passed" };
}
function execution(source = item(), status = "passed", outcome = "expected") {
  return { ...report([source]), started: [source.id],
    results: [{ id: source.id, status, expectedStatus: "passed", retry: 0, outcome }] };
}
function fixture(fn) {
  const output = mkdtempSync(join(tmpdir(), "veyocast-browser-cases-"));
  try { return fn(output); } finally { rmSync(output, { recursive: true, force: true }); }
}
function mockRunner(output, { failAt = -1, exitCode = 41, alter = () => {}, env = {} } = {}) {
  const cases = [item(), item("second", ["nested group", "second case"]), item("third", ["third case"])];
  const calls = [];
  const execute = (command, args, options) => {
    calls.push({ command, args, options });
    if (args.includes("--list")) writeFileSync(options.env.PLAYWRIGHT_CASE_REPORT, JSON.stringify(report(cases)));
    else {
      // Real Playwright clears its output before loading the selection file.
      rmSync(args.find(x => x.startsWith("--output=")).slice(9), { recursive: true, force: true });
      assert.ok(readFileSync(args.find(x => x.startsWith("--test-list=")).slice(12), "utf8"));
      const index = calls.length - 2;
      if (index === failAt) return { status: exitCode };
      const value = execution(cases[index]); alter(value, index);
      writeFileSync(options.env.PLAYWRIGHT_CASE_REPORT, JSON.stringify(value));
    }
    return { status: 0 };
  };
  const run = () => runBrowserGates({ cwd, groups: { player: [file] }, execute, version: "1.61.1",
    env: { PLAYWRIGHT_GATE_GROUP: "player", PLAYWRIGHT_GATE_OUTPUT: output, ...env }, write: () => {} });
  return { run, calls, cases, closure: () => JSON.parse(readFileSync(join(output, "player", "case-closure.json"), "utf8")) };
}

test("ordered declaration identity survives nesting, same source locations and future cases", () => {
  const cases = [item("a", ["outer", "a"]), item("b", ["outer", "nested", "b"]), item("c", ["outer", "c"])];
  const inventory = validatePlayerInventory(report(cases), [file], cwd);
  assert.deepEqual(inventory.map(x => x.id), ["a", "b", "c"]);
  assert.equal(inventory[1].selection, "[chromium] › player/welcome.spec.ts:7:3 › outer › nested › b");
  const expanded = Array.from({ length: 300 }, (_, i) => item(`future-${i}`, [`case ${i}`]));
  assert.equal(validatePlayerInventory(report(expanded), [file], cwd).length, 300);
});

test("former sorted file order is preserved despite Playwright discovery traversal", () => {
  const first = "tests/player-offline/startup.spec.ts", second = file;
  const inventory = validatePlayerInventory(report([item(), item("offline", ["offline"], first)]), [first, second], cwd);
  assert.deepEqual(inventory.map(x => x.file), [first, second]);
});

test("duplicate IDs cannot silently lose a case", () => {
  assert.throws(() => validatePlayerInventory(report([item(), item("first", ["other"])]), [file], cwd), /PLAYER_CASE_INVALID/);
});

test("duplicate full titles cannot be disambiguated by line numbers", () => {
  assert.throws(() => validatePlayerInventory(report([item(), { ...item("other"), line: 80 }]), [file], cwd), /PLAYER_SELECTOR_AMBIGUOUS/);
});

test("a leaf title that is another case's suite prefix fails before execution", () => {
  assert.throws(() => validatePlayerInventory(report([item("a", ["outer"]), item("b", ["outer", "inner"])]), [file], cwd), /PLAYER_SELECTOR_AMBIGUOUS/);
  assert.equal(validatePlayerInventory(report([item("a", ["outer"]), item("b", ["outer longer"])]), [file], cwd).length, 2);
});

test("delimiter, newline and trimming ambiguity are rejected", () => {
  for (const title of ["a › b", "a > b", "a\nb", "a\rb", " leading", "trailing ", "", "a\u0000b"]) {
    assert.throws(() => validatePlayerInventory(report([item("a", [title])]), [file], cwd), /PLAYER_SELECTOR_AMBIGUOUS/);
  }
});

test("file closure rejects missing, unknown and repeated specs", () => {
  assert.throws(() => validatePlayerInventory(report(), [file, "tests/player/extra.spec.ts"], cwd), /PLAYER_FILE_CLOSURE_INVALID/);
  assert.throws(() => validatePlayerInventory(report([item("a", ["a"], "tests/control/private.spec.ts")]), [file], cwd), /PLAYER_CASE_INVALID/);
  assert.throws(() => validatePlayerInventory(report(), [file, file], cwd), /PLAYER_FILE_DUPLICATE/);
});

test("project, workers, retries, repetitions and discovery errors fail closed", () => {
  for (const change of [r => r.workers = 2, r => r.projects[0].name = "webkit", r => r.projects[0].retries = 1,
    r => r.projects[0].repeatEach = 2, r => r.errors = 1, r => r.rootDir = "/elsewhere", r => r.cases = []]) {
    const r = report(); change(r);
    assert.throws(() => validatePlayerInventory(r, [file], cwd), /PLAYER_INVENTORY_INVALID/);
  }
});

test("reported title path must bind the actual file and original project", () => {
  for (const path of [["", "chromium", "player/other.spec.ts", "a"], ["", "firefox", "player/welcome.spec.ts", "a"]]) {
    assert.throws(() => validatePlayerInventory(report([{ ...item(), titlePath: path }]), [file], cwd), /PLAYER_(CASE_INVALID|SELECTOR_AMBIGUOUS)/);
  }
});

test("execution closure requires precisely the original case, started and completed once", () => {
  const original = validatePlayerInventory(report(), [file], cwd)[0];
  for (const change of [r => r.cases.push(item("second", ["second"])), r => r.started = [],
    r => r.started.push("first"), r => r.results = [], r => r.results.push(r.results[0]), r => r.cases[0].line = 8]) {
    const r = execution(); change(r);
    assert.throws(() => validateCaseExecution(r, original, cwd), /PLAYER_CASE_CLOSURE_INVALID/);
  }
});

test("retries, flaky outcomes, wrong IDs and fixture errors never become success", () => {
  const original = validatePlayerInventory(report(), [file], cwd)[0];
  for (const change of [r => r.results[0].retry = 1, r => r.results[0].outcome = "flaky",
    r => r.results[0].id = "other", r => r.results[0].status = "timedOut", r => r.status = "failed", r => r.errors = 1,
    r => r.results[0].status = "failed", r => r.results[0].expectedStatus = "failed",
    r => r.results[0].outcome = "skipped", r => { r.results[0].status = "skipped"; r.results[0].expectedStatus = "skipped"; }]) {
    const r = execution(); change(r);
    assert.throws(() => validateCaseExecution(r, original, cwd), /PLAYER_(CASE_RESULT_INVALID|CASE_CLOSURE_INVALID|INVENTORY_INVALID)/);
  }
});

test("original explicit runtime skips and expected failures retain Playwright outcomes", () => {
  const original = validatePlayerInventory(report(), [file], cwd)[0];
  const skipped = execution(item(), "skipped", "skipped"); skipped.results[0].expectedStatus = "skipped";
  assert.equal(validateCaseExecution(skipped, original, cwd).status, "skipped");
  const expectedFailure = execution(item(), "failed", "expected"); expectedFailure.results[0].expectedStatus = "failed";
  assert.equal(validateCaseExecution(expectedFailure, original, cwd).outcome, "expected");
});

test("each case invokes a fresh pinned CLI with unchanged browser, workers and budgets", () => fixture(output => {
  const f = mockRunner(output); assert.equal(f.run(), 0); assert.equal(f.calls.length, 4);
  for (const call of f.calls) {
    assert.equal(call.command, "pnpm");
    assert.deepEqual(call.args.slice(0, 3), ["exec", "playwright", "test"]);
    for (const arg of ["--project=chromium", "--workers=1", "--timeout=60000"]) assert.ok(call.args.includes(arg));
    assert.equal(call.options.stdio, "inherit");
    assert.equal(call.args.some(x => /channel|retries|update-snapshots|ignore-snapshots|pass-with-no-tests/.test(x)), false);
  }
  const selected = f.calls.slice(1).map(call => readFileSync(call.args.find(x => x.startsWith("--test-list=")).slice(12), "utf8"));
  for (const call of f.calls.slice(1)) {
    assert.ok(call.args.some(x => x.startsWith("--reporter=list,")));
    assert.equal(call.args.some(x => x.startsWith("--add-reporter")), false);
  }
  assert.equal(new Set(selected).size, 3);
  assert.deepEqual(f.closure().executions.map(x => x.id), ["first", "second", "third"]);
  assert.equal(f.closure().complete, true);
}));

test("a fatal assertion exit is preserved and later original cases never run", () => fixture(output => {
  const f = mockRunner(output, { failAt: 1 }); assert.equal(f.run(), 41);
  assert.equal(f.calls.length, 3); assert.equal(f.closure().complete, false);
  assert.equal(f.closure().executions.at(-1).exitCode, 41);
}));

test("a native crash with no exit status remains fatal without retry", () => fixture(output => {
  const f = mockRunner(output, { failAt: 0, exitCode: null }); assert.equal(f.run(), 1);
  assert.equal(f.calls.length, 2); assert.equal(f.closure().complete, false);
}));

test("successful child exit cannot hide incorrect case selection", () => fixture(output => {
  const f = mockRunner(output, { alter: r => r.started = [] });
  assert.throws(() => f.run(), /PLAYER_CASE_CLOSURE_INVALID/);
  assert.equal(f.calls.length, 2); assert.equal(f.closure().complete, false);
}));

test("failed discovery prevents every test invocation", () => fixture(output => {
  const previous = mockRunner(output); assert.equal(previous.run(), 0);
  let calls = 0;
  const status = runBrowserGates({ cwd, groups: { player: [file] }, version: "1.61.1", write: () => {},
    env: { PLAYWRIGHT_GATE_GROUP: "player", PLAYWRIGHT_GATE_OUTPUT: output }, execute: () => { calls++; return { status: 23 }; } });
  assert.equal(status, 23); assert.equal(calls, 1);
  assert.equal(previous.closure().complete, false);
  assert.deepEqual(previous.closure().executions, []);
}));

test("incompatible pinned CLI and duplicate group selections fail before child launch", () => fixture(output => {
  let calls = 0;
  const base = { cwd, groups: { player: [file] }, write: () => {}, execute: () => { calls++; },
    env: { PLAYWRIGHT_GATE_GROUP: "player", PLAYWRIGHT_GATE_OUTPUT: output } };
  assert.throws(() => runBrowserGates({ ...base, version: "1.62.0" }), /PLAYER_CLI_VERSION_INVALID/);
  assert.throws(() => runBrowserGates({ ...base, env: { ...base.env, PLAYWRIGHT_GATE_GROUP: "player,player" } }), /BROWSER_GROUP_INVALID/);
  assert.equal(calls, 0);
}));

test("other groups retain one original complete invocation and environment", () => fixture(output => {
  const calls = [];
  const status = runBrowserGates({ cwd, groups: { control: ["tests/control/a.spec.ts", "tests/control/b.spec.ts"], cross: ["tests/e2e/x.spec.ts"] },
    env: { PLAYWRIGHT_GATE_GROUP: "control,cross", PLAYWRIGHT_GATE_OUTPUT: output }, write: () => {},
    execute: (command, args, options) => { calls.push({ command, args, options }); return { status: 0 }; } });
  assert.equal(status, 0); assert.equal(calls.length, 2);
  assert.deepEqual(calls[0].args.slice(3, 5), ["tests/control/a.spec.ts", "tests/control/b.spec.ts"]);
  assert.equal(calls[0].options.env.NODE_OPTIONS, "--max-old-space-size=3072");
  assert.equal(calls[1].options.env.PLAYWRIGHT_APPS, "control,marketing,player");
  assert.equal(groupEnvironment("player", { NODE_OPTIONS: "explicit" }).NODE_OPTIONS, "explicit");
}));

test("optional original evidence hooks keep distinct per-case directories", () => fixture(output => {
  const f = mockRunner(output, { env: { VEYOCAST_SITES_PLAYER_ORIGINAL_ROUTES: "1",
    SITES_PLAYER_ROUTE_EVIDENCE_DIRECTORY: "/original-evidence", VEYOCAST_SITES_PLAYER_ORIGINAL_OPERATIONS: "1" } });
  assert.equal(f.run(), 0);
  assert.deepEqual(f.calls.slice(1).map(x => x.options.env.SITES_PLAYER_ROUTE_EVIDENCE_DIRECTORY),
    ["/original-evidence/case-1", "/original-evidence/case-2", "/original-evidence/case-3"]);
  assert.equal(new Set(f.calls.slice(1).map(x => x.options.env.SITES_PLAYER_OPERATION_EVIDENCE_DIRECTORY)).size, 3);
}));
