import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, relative, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

// The public reporter API retains declaration order when tests and nested
// suites are interleaved. The built-in JSON reporter separates those entries.
export const caseReporter = `import { writeFileSync } from "node:fs";
import process from "node:process";
export default class CaseReporter {
  state = { schemaVersion: 1, cases: [], started: [], results: [], errors: 0, status: null };
  printsToStdio() { return false; }
  save() { writeFileSync(process.env.PLAYWRIGHT_CASE_REPORT, JSON.stringify(this.state, null, 2), { mode: 0o600 }); }
  onBegin(config, suite) {
    this.state.rootDir = config.rootDir; this.state.workers = config.workers;
    this.state.projects = config.projects.map(p => ({ name: p.name, retries: p.retries, repeatEach: p.repeatEach }));
    this.state.cases = suite.allTests().map(t => ({ id: t.id, project: t.parent.project().name,
      file: t.location.file, line: t.location.line, column: t.location.column,
      titlePath: t.titlePath(), expectedStatus: t.expectedStatus, retries: t.retries })); this.save();
  }
  onTestBegin(test) { this.state.started.push(test.id); this.save(); }
  onTestEnd(test, result) {
    this.state.results.push({ id: test.id, status: result.status, expectedStatus: test.expectedStatus,
      retry: result.retry, outcome: test.outcome() }); this.save();
  }
  onError() { this.state.errors++; this.save(); }
  onEnd(result) { this.state.status = result.status; this.save(); }
}
`;

function fail(code) { throw new Error(code); }
function specs(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? specs(join(directory, entry.name))
      : entry.name.endsWith(".spec.ts") ? [join(directory, entry.name)] : []);
}

export function discoverGateGroups() {
  const suites = ["a11y", "control", "e2e", "player", "player-offline"]
    .flatMap(directory => specs(join("tests", directory))).sort();
  const crossApp = new Set(["tests/e2e/pilot-readiness.spec.ts", "tests/e2e/deployment-readiness.spec.ts"]);
  const livePlayer = new Set(["tests/e2e/live-pilot.spec.ts", "tests/e2e/sites-publisher-live.spec.ts"]);
  const groups = { control: [], player: [], marketing: [], cross: [] };
  for (const file of suites) {
    if (crossApp.has(file) || livePlayer.has(file)) groups.cross.push(file);
    else if (file.startsWith("tests/player") || file.startsWith("tests/a11y/player-")) groups.player.push(file);
    else if (/^tests\/(?:a11y|e2e)\/marketing-/u.test(file) || file === "tests/e2e/privacy-pages.spec.ts") groups.marketing.push(file);
    else groups.control.push(file);
  }
  return groups;
}

function component(value) {
  return typeof value === "string" && value.length > 0 && value.trim() === value
    && !value.includes("\0") && !/[\r\n\u203a>]/u.test(value);
}

export function validatePlayerInventory(report, files, cwd = process.cwd()) {
  const rootDir = resolve(cwd, "tests");
  if (report?.schemaVersion !== 1 || report.rootDir !== rootDir || report.workers !== 1
    || report.errors !== 0 || !Array.isArray(report.projects) || report.projects.length !== 1
    || report.projects[0].name !== "chromium" || report.projects[0].retries !== 0
    || report.projects[0].repeatEach !== 1 || !Array.isArray(report.cases) || !report.cases.length) fail("PLAYER_INVENTORY_INVALID");
  const expectedFiles = files.map(file => resolve(cwd, file));
  if (new Set(expectedFiles).size !== files.length) fail("PLAYER_FILE_DUPLICATE");
  const ids = new Set(), seenFiles = [], inventory = [];
  for (const item of report.cases) {
    if (!item || typeof item.id !== "string" || !item.id || ids.has(item.id)
      || item.project !== "chromium" || !expectedFiles.includes(item.file)
      || !Number.isSafeInteger(item.line) || item.line < 1 || !Number.isSafeInteger(item.column) || item.column < 1
      || !["passed", "failed", "skipped"].includes(item.expectedStatus) || item.retries !== 0
      || !Array.isArray(item.titlePath) || item.titlePath.length < 4
      || item.titlePath[0] !== "" || item.titlePath[1] !== "chromium") fail("PLAYER_CASE_INVALID");
    ids.add(item.id);
    const file = relative(rootDir, item.file).replaceAll("\\", "/");
    const titles = item.titlePath.slice(3);
    if (!component(file) || file.startsWith("../") || item.titlePath[2] !== file
      || titles.some(title => !component(title))) fail("PLAYER_SELECTOR_AMBIGUOUS");
    if (seenFiles.at(-1) !== item.file) seenFiles.push(item.file);
    inventory.push({ ...item, file: relative(cwd, item.file).replaceAll("\\", "/"), titles,
      selection: `[chromium] › ${file}:${item.line}:${item.column} › ${titles.join(" › ")}` });
  }
  if (seenFiles.length !== expectedFiles.length || expectedFiles.some(file => !seenFiles.includes(file))) fail("PLAYER_FILE_CLOSURE_INVALID");
  // Pinned Playwright ignores locations and matches title arrays as a prefix.
  // Every entry must select exactly one original case before any case runs.
  for (const item of inventory) {
    const matches = inventory.filter(other => other.file === item.file
      && item.titles.length <= other.titles.length
      && item.titles.every((title, index) => title === other.titles[index]));
    if (matches.length !== 1) fail("PLAYER_SELECTOR_AMBIGUOUS");
  }
  // The former runner visits sorted spec paths. A single discovery invocation
  // uses Playwright's directory traversal order instead; retain the former
  // file order and the reporter's original declaration order within each file.
  return files.flatMap(file => inventory.filter(item => item.file === file));
}

function readReport(path) {
  try { return JSON.parse(readFileSync(path, "utf8")); } catch { fail("PLAYER_REPORT_INVALID"); }
}

export function validateCaseExecution(report, item, cwd = process.cwd()) {
  const actual = validatePlayerInventory(report, [item.file], cwd);
  if (actual.length !== 1 || JSON.stringify(actual[0]) !== JSON.stringify(item)
    || report.status !== "passed" || !Array.isArray(report.started) || report.started.length !== 1 || report.started[0] !== item.id
    || !Array.isArray(report.results) || report.results.length !== 1) fail("PLAYER_CASE_CLOSURE_INVALID");
  const result = report.results[0];
  if (result.id !== item.id || result.retry !== 0 || !["passed", "failed", "skipped"].includes(result.status)
    || !["expected", "skipped"].includes(result.outcome)
    || !["passed", "failed", "skipped"].includes(result.expectedStatus)
    || result.status !== result.expectedStatus
    || (result.outcome === "skipped") !== (result.status === "skipped")) fail("PLAYER_CASE_RESULT_INVALID");
  return result;
}

export function groupEnvironment(group, env) {
  return { ...env,
    PLAYWRIGHT_APPS: group === "cross" ? "control,marketing,player" : group,
    PLAYWRIGHT_PRODUCTION_SERVERS: group === "player" || group === "marketing" ? "1" : "0",
    PLAYWRIGHT_TURBOPACK: group === "control" || group === "cross" ? "1" : "0",
    NODE_OPTIONS: env.NODE_OPTIONS ?? (group === "control" ? "--max-old-space-size=3072" : "--max-old-space-size=2048") };
}

export function runBrowserGates({ env = process.env, groups = discoverGateGroups(), execute = spawnSync,
  cwd = process.cwd(), write = value => process.stdout.write(value), version } = {}) {
  const selected = env.PLAYWRIGHT_GATE_GROUP?.split(",") ?? Object.keys(groups);
  if (!selected.length || selected.some(group => !Object.hasOwn(groups, group)) || new Set(selected).size !== selected.length) fail("BROWSER_GROUP_INVALID");
  const results = resolve(cwd, env.PLAYWRIGHT_GATE_OUTPUT ?? join(env.RUNNER_TEMP ?? "/tmp", "veyocast-browser-gates"));
  const commonArgs = ["--project=chromium", "--workers=1", "--timeout=60000"];
  for (const group of selected) {
    const childEnv = groupEnvironment(group, env);
    if (group !== "player") {
      const output = join(results, group, "batch-1");
      mkdirSync(output, { recursive: true });
      write(`Browser gate: ${group}; batch 1/1; ${groups[group].length} spec files.\n`);
      const child = execute("pnpm", ["exec", "playwright", "test", ...groups[group], ...commonArgs, `--output=${output}`], { cwd, stdio: "inherit", env: childEnv });
      if (child.status !== 0) return child.status ?? 1;
      continue;
    }
    const output = join(results, "player");
    mkdirSync(output, { recursive: true });
    const closure = { schemaVersion: 1, cliVersion: "1.61.1", files: groups.player, caseCount: null,
      inventory: [], executions: [], complete: false };
    const closurePath = join(output, "case-closure.json");
    const save = () => writeFileSync(closurePath, JSON.stringify(closure, null, 2), { mode: 0o600 });
    save();
    if (!groups.player.length) fail("PLAYER_INVENTORY_INVALID");
    if ((version ?? createRequire(import.meta.url)("@playwright/test/package.json").version) !== "1.61.1") fail("PLAYER_CLI_VERSION_INVALID");
    const reporter = join(output, "case-reporter.mjs"), discoveryReport = join(output, "discovery.json");
    writeFileSync(reporter, caseReporter, { mode: 0o600 });
    writeFileSync(discoveryReport, "null", { mode: 0o600 });
    const listed = execute("pnpm", ["exec", "playwright", "test", ...groups.player, ...commonArgs,
      "--list", `--reporter=${reporter}`, `--output=${join(output, "discovery-artifacts")}`], { cwd, stdio: "inherit", env: { ...childEnv, PLAYWRIGHT_CASE_REPORT: discoveryReport } });
    if (listed.status !== 0) return listed.status ?? 1;
    const discovery = readReport(discoveryReport);
    if (discovery.status !== "passed" || !Array.isArray(discovery.started) || discovery.started.length
      || !Array.isArray(discovery.results) || discovery.results.length) fail("PLAYER_DISCOVERY_INVALID");
    const inventory = validatePlayerInventory(discovery, groups.player, cwd);
    closure.caseCount = inventory.length; closure.inventory = inventory;
    save();
    write(`Browser gate: player; inventory ${inventory.length} cases; ${groups.player.length} spec files.\n`);
    for (const [index, item] of inventory.entries()) {
      const caseOutput = join(output, `case-${index + 1}`);
      mkdirSync(caseOutput, { recursive: true });
      const selector = join(caseOutput, "test-list.txt"), caseReport = join(caseOutput, "execution.json");
      writeFileSync(selector, `${item.selection}\n`, { mode: 0o600 });
      writeFileSync(caseReport, "null", { mode: 0o600 });
      const execution = { index: index + 1, id: item.id, file: item.file, invoked: true, exitCode: null, result: null };
      closure.executions.push(execution); save();
      write(`Browser gate: player; case ${index + 1}/${inventory.length}; ${item.file}:${item.line}:${item.column}; ${item.id}.\n`);
      const isolatedEnv = { ...childEnv, PLAYWRIGHT_CASE_REPORT: caseReport };
      // Keep original opt-in hook bodies; give each aggregate a distinct path.
      for (const [key, enabled, fallback] of [
        ["SITES_PLAYER_ROUTE_EVIDENCE_DIRECTORY", "VEYOCAST_SITES_PLAYER_ORIGINAL_ROUTES", "/dev/shm/veyocast-s191-original-player-routes"],
        ["SITES_PLAYER_OPERATION_EVIDENCE_DIRECTORY", "VEYOCAST_SITES_PLAYER_ORIGINAL_OPERATIONS", "/dev/shm/veyocast-s191-original-player-operations"]
      ]) if (env[enabled] === "1") isolatedEnv[key] = join(env[key] ?? fallback, `case-${index + 1}`);
      const child = execute("pnpm", ["exec", "playwright", "test", item.file, ...commonArgs,
        `--test-list=${selector}`, `--reporter=list,${reporter}`, `--output=${join(caseOutput, "artifacts")}`], { cwd, stdio: "inherit", env: isolatedEnv });
      execution.exitCode = child.status ?? 1; save();
      if (child.status !== 0) return child.status ?? 1;
      execution.result = validateCaseExecution(readReport(caseReport), item, cwd); save();
    }
    closure.complete = true; save();
    write(`Browser gate: player; completed ${inventory.length}/${inventory.length} original cases; ${groups.player.length} spec files.\n`);
  }
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = runBrowserGates(); }
  catch (error) { process.stderr.write(`${error instanceof Error && /^[A-Z_]+$/u.test(error.message) ? error.message : "BROWSER_GATE_FAILED"}\n`); process.exitCode = 1; }
}
