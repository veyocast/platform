import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmod, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { URL } from "node:url";
import { DEPLOYMENT_CONCURRENCY_GROUP, validateDeploymentConcurrency } from "./deployment-concurrency-policy.mjs";

const workflowDirectory = new URL("../.github/workflows/", import.meta.url);
const workflowNames = (await readdir(workflowDirectory)).filter((name) => /\.ya?ml$/.test(name));
const workflows = Object.fromEntries(await Promise.all(workflowNames.map(async (name) => [name, await readFile(new URL(name, workflowDirectory), "utf8")])));
const writers = ["deploy.yml", "runner-disk-maintenance.yml", "recover-data-api.yml", "probe-publication-runtime.yml", "probe-runtime-database.yml"];
const retiredGroup = "deploy-veyocast-main";
const nextMain = "e".repeat(40);
const incidentSha = "bd5f1fb59254a4fd7d56e3a2974d82f39e0ef611";
const previousMain = "b623a458b2c711bb7b03e1866e857df10930ff36";

function changed(name, change) {
  const source = change(workflows[name]);
  assert.notEqual(source, workflows[name], "The negative fixture must change the actual workflow");
  return { ...workflows, [name]: source };
}

function assertRejected(values, code) {
  assert.throws(() => validateDeploymentConcurrency(values), { message: `DEPLOYMENT_CONCURRENCY_${code}` });
}

test("all actual deployment writers share the single reviewed epoch", () => {
  assert.equal(DEPLOYMENT_CONCURRENCY_GROUP, "deploy-veyocast-main-20261110");
  assert.equal(validateDeploymentConcurrency(workflows), true);
});

test("validation needs named workflow sources", () => {
  for (const input of [null, undefined, [], "workflow"]) assertRejected(input, "INPUT_INVALID");
  assertRejected({ ...workflows, "other.yml": null }, "SOURCE_INVALID");
});

for (const name of writers) {
  test(`${name}: omitting a deployment writer fails closed`, () => {
    const copy = { ...workflows };
    delete copy[name];
    assertRejected(copy, "MEMBER_MISSING");
  });

  test(`${name}: the retired group cannot split ownership`, () => {
    assertRejected(changed(name, (source) => source.replaceAll(DEPLOYMENT_CONCURRENCY_GROUP, retiredGroup)), "GROUP_INVALID");
  });

  test(`${name}: per-run and per-environment groups cannot split ownership`, () => {
    for (const group of ["deploy-veyocast-main-${{ github.run_id }}", "deploy-veyocast-main-${{ inputs.target_environment }}", "${{ github.sha }}", "${{ vars.DEPLOYMENT_CONCURRENCY_GROUP }}"]) {
      assertRejected(changed(name, (source) => source.replaceAll(DEPLOYMENT_CONCURRENCY_GROUP, group)), "GROUP_INVALID");
    }
  });

  test(`${name}: deployment work is never cancelled by a later run`, () => {
    for (const value of ["true", "${{ github.event_name == 'push' }}"]) {
      assertRejected(changed(name, (source) => source.replace("  cancel-in-progress: false", `  cancel-in-progress: ${value}`)), "GROUP_INVALID");
    }
  });

  test(`${name}: a job cannot override workflow concurrency`, () => {
    for (const key of ["concurrency", '"concurrency"', "'concurrency'"]) {
      assertRejected(changed(name, (source) => source.replace(/^( {2}[A-Za-z0-9_-]+:)\n/m, `$1\n    ${key}: ${DEPLOYMENT_CONCURRENCY_GROUP}\n`)), "JOB_OVERRIDE");
    }
    assertRejected(changed(name, (source) => source.replace("jobs:\n", "jobs:\n  hidden: { runs-on: ubuntu-latest, concurrency: independent, steps: [{ run: ':' }] }\n")), "JOB_OVERRIDE");
  });

  test(`${name}: missing, duplicate or shorthand root concurrency fails closed`, () => {
    assertRejected(changed(name, (source) => source.replace(/^concurrency:\n(?: {2}[^\n]*\n)+/m, "")), "ROOT_INVALID");
    assertRejected(changed(name, (source) => `${source}\nconcurrency:\n  group: ${DEPLOYMENT_CONCURRENCY_GROUP}\n  cancel-in-progress: false\n`), "ROOT_INVALID");
    assertRejected(changed(name, (source) => source.replace(/^concurrency:\n(?: {2}[^\n]*\n)+/m, `concurrency: ${DEPLOYMENT_CONCURRENCY_GROUP}\n`)), "ROOT_INVALID");
  });

  test(`${name}: additional queue settings and duplicate group keys need review`, () => {
    assertRejected(changed(name, (source) => source.replace("  cancel-in-progress: false", "  cancel-in-progress: false\n  queue: max")), "GROUP_INVALID");
    assertRejected(changed(name, (source) => source.replace("  cancel-in-progress: false", `  group: ${DEPLOYMENT_CONCURRENCY_GROUP}\n  cancel-in-progress: false`)), "GROUP_INVALID");
  });
}

for (const name of ["probe-publication-runtime.yml", "probe-runtime-database.yml"]) {
  test(`${name}: read-only diagnostics retain the original tenant/environment scope`, () => {
    const format = name === "probe-publication-runtime.yml" ? "probe-publication-runtime-{0}-{1}" : "probe-runtime-database-{0}-{1}";
    assert.ok(workflows[name].includes(`format('${format}', inputs.target_environment, inputs.tenant_id)`));
    for (const change of [
      (source) => source.replace("inputs.quiesce_worker &&", "!inputs.quiesce_worker &&"),
      (source) => source.replace(format, "probe-{0}"),
      (source) => source.replace("inputs.target_environment, inputs.tenant_id)", "inputs.target_environment, github.run_id)")
    ]) assertRejected(changed(name, change), "GROUP_INVALID");
  });
}

test("an unregistered workflow cannot join current, retired or differently cased deployment groups", () => {
  for (const group of [DEPLOYMENT_CONCURRENCY_GROUP, retiredGroup, "DEPLOY-VEYOCAST-MAIN", "deploy-veyocast-other-epoch"]) {
    for (const source of [
      `concurrency:\n  group: ${group}\n  cancel-in-progress: false\n`,
      `concurrency: ${group}\n`,
      `"concurrency": { group: '${group}' }\n`,
      `jobs:\n  unexpected:\n    concurrency:\n      group: ${group}\n      cancel-in-progress: false\n`,
      `jobs:\n  unexpected:\n    'concurrency': ${group}\n`,
      `jobs: { unexpected: { concurrency: ${group} } }\n`
    ]) assertRejected({ ...workflows, "unexpected-writer.yml": source }, "UNREGISTERED_WRITER");
  }
});

test("ordinary independent workflow groups and comments do not join deployment ownership", () => {
  const source = `# Retired concurrency: ${retiredGroup}\nconcurrency:\n  # group: ${retiredGroup}\n  group: independent-pr-\${{ github.ref }}\n  cancel-in-progress: true\n`;
  assert.equal(validateDeploymentConcurrency({ ...workflows, "independent.yml": source }), true);
});

test("an unregistered concurrency alias cannot hide a deployment group or merge", () => {
  for (const source of [
    `x-shared: &shared ${retiredGroup}\nconcurrency: *shared\n`,
    `x-shared: &shared ${DEPLOYMENT_CONCURRENCY_GROUP}\nconcurrency:\n  group: *shared\n`,
    `x-shared: &shared\n  group: ${retiredGroup}\nconcurrency:\n  <<: *shared\n`
  ]) assertRejected({ ...workflows, "aliased-writer.yml": source }, "UNREGISTERED_WRITER");
});

test("unknown dynamic groups must have a provably independent literal prefix", () => {
  for (const group of [
    "${{ vars.GROUP }}",
    "${{ format('{0}-{1}-main-20261110','deploy','veyocast') }}",
    "deploy-${{ vars.GROUP }}",
    "dePloY-${{ vars.GROUP }}",
    "dep${{ vars.GROUP }}",
    "'${{ vars.GROUP }}'",
    '"${{ vars.GROUP }}"'
  ]) {
    for (const key of ["concurrency", '"concurrency"', "'concurrency'"]) {
      assertRejected({ ...workflows, "dynamic-writer.yml": `${key}: ${group}\n` }, "UNREGISTERED_WRITER");
      for (const groupKey of ["group", '"group"', "'group'"]) {
        assertRejected({ ...workflows, "dynamic-writer.yml": `${key}:\n  ${groupKey}: ${group}\n  cancel-in-progress: false\n` }, "UNREGISTERED_WRITER");
      }
    }
  }
});

test("unknown literal prefixes can safely preserve independent dynamic suffixes", () => {
  for (const group of ["ordinary-${{ vars.GROUP }}", "pr-gates-${{ github.ref }}", "'ordinary-${{ vars.GROUP }}'", '"ordinary-${{ vars.GROUP }}"', "independent-fixed-group"]) {
    for (const key of ["concurrency", '"concurrency"', "'concurrency'"]) {
      assert.equal(validateDeploymentConcurrency({ ...workflows, "independent-dynamic.yml": `${key}: ${group}\n` }), true);
      assert.equal(validateDeploymentConcurrency({ ...workflows, "independent-dynamic.yml": `${key}:\n  'group': ${group}\n  cancel-in-progress: true\n` }), true);
    }
  }
});

test("unknown flow mappings, folded scalars and escaped prefixes require review", () => {
  for (const group of ["{ group: independent }", ">-", "|-", '"\\u0064eploy-\\u0076eyocast-main-20261110"']) {
    assertRejected({ ...workflows, "opaque-writer.yml": `concurrency: ${group}\n` }, "UNREGISTERED_WRITER");
  }
});

test("valid escaped YAML keys cannot hide an unknown concurrency writer", () => {
  for (const key of [String.raw`"\u0063oncurrency"`, String.raw`"concur\u0072ency"`]) {
    assert.equal(JSON.parse(key), "concurrency", "JSON escapes are also valid YAML double-quoted key escapes");
    for (const source of [
      `${key}:\n  group: ${DEPLOYMENT_CONCURRENCY_GROUP}\n  cancel-in-progress: false\n`,
      `{ ${key}: { group: '${DEPLOYMENT_CONCURRENCY_GROUP}' } }\n`,
      `jobs:\n  hidden:\n    ${key}: ${DEPLOYMENT_CONCURRENCY_GROUP}\n`
    ]) assertRejected({ ...workflows, "escaped-writer.yml": source }, "OPAQUE_KEY");
  }
});

test("escaped YAML job keys cannot bypass registered writer override checks", () => {
  for (const name of writers) {
    assertRejected(changed(name, (source) => source.replace("jobs:\n", String.raw`jobs:
  hidden: { runs-on: ubuntu-latest, "\u0063oncurrency": independent, steps: [{ run: ':' }] }
`)), "OPAQUE_KEY");
  }
});

test("explicit and multiline mapping keys require a readable source contract", () => {
  for (const source of [
    `? concurrency\n: ${DEPLOYMENT_CONCURRENCY_GROUP}\n`,
    `? "concur\\\n  rency"\n: ${DEPLOYMENT_CONCURRENCY_GROUP}\n`,
    `"ordinary\\\n  key": independent\n`
  ]) assertRejected({ ...workflows, "opaque-key.yml": source }, "OPAQUE_KEY");
});

function preflightBody(source) {
  const lines = source.split("\n");
  const start = lines.indexOf("      - name: Resolve and authorize release");
  assert.ok(start >= 0, "The actual authorization step must exist");
  const rest = lines.slice(start + 1);
  const next = rest.findIndex((line) => /^ {6}- /.test(line));
  const step = next < 0 ? rest : rest.slice(0, next);
  const run = step.indexOf("        run: |");
  assert.ok(run >= 0, "The actual authorization shell must exist");
  const body = step.slice(run + 1).map((line) => {
    assert.ok(!line.trim() || line.startsWith("          "), "Only the existing inline shell body is executed");
    return line.slice(10);
  }).join("\n");
  assert.doesNotMatch(body, /\$\{\{/);
  return body;
}

async function authorizeRelease({ requestedSha, mode = "release", dispatchedSha = "", confirmation = "", ancestor = true }) {
  const directory = await mkdtemp(join(tmpdir(), "veyocast-deployment-fence-"));
  try {
    const outputPath = join(directory, "output");
    const gitPath = join(directory, "git");
    await writeFile(outputPath, "");
    await writeFile(gitPath, `#!/bin/sh\ncase "$*" in\n  *' fetch '*) exit 0 ;;\n  'cat-file -e '*) exit 0 ;;\n  'merge-base --is-ancestor '*) [ "$TEST_IS_ANCESTOR" = true ] ;;\n  'rev-parse origin/main') printf '%s\\n' "$TEST_CURRENT_MAIN" ;;\n  *) printf 'UNEXPECTED_GIT_OPERATION\\n' >&2; exit 97 ;;\nesac\n`);
    await chmod(gitPath, 0o700);
    const result = spawnSync("/bin/bash", ["-c", preflightBody(workflows["deploy.yml"])], {
      cwd: directory,
      encoding: "utf8",
      timeout: 5_000,
      env: {
        PATH: `${directory}:/usr/bin:/bin`,
        GH_TOKEN: "fixture-not-a-real-token",
        GITHUB_OUTPUT: outputPath,
        REQUESTED_RELEASE_SHA: requestedSha,
        DEPLOYMENT_MODE: mode,
        DISPATCH_RELEASE_SHA: dispatchedSha,
        ROLLBACK_CONFIRMATION: confirmation,
        TEST_CURRENT_MAIN: nextMain,
        TEST_IS_ANCESTOR: String(ancestor)
      }
    });
    assert.equal(result.error, undefined);
    assert.equal(result.signal, null);
    return { status: result.status, stderr: result.stderr, output: await readFile(outputPath, "utf8") };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

for (const sha of [incidentSha, previousMain]) {
  test(`actual release preflight rejects dormant normal deployment ${sha.slice(0, 7)} after main advances`, async () => {
    const result = await authorizeRelease({ requestedSha: sha });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Een normale release moet de actuele main-SHA zijn/);
    assert.equal(result.output, "", "A stale run cannot authorize downstream build or deployment");
  });
}

test("actual release preflight accepts only the new current main", async () => {
  const result = await authorizeRelease({ requestedSha: nextMain });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.output, `release_sha=${nextMain}\n`);
});

test("actual rollback preflight preserves explicit confirmation and older release requirements", async () => {
  for (const parameters of [
    { requestedSha: previousMain, mode: "rollback", dispatchedSha: previousMain },
    { requestedSha: previousMain, mode: "rollback", confirmation: "ROLLBACK" },
    { requestedSha: nextMain, mode: "rollback", dispatchedSha: nextMain, confirmation: "ROLLBACK" }
  ]) {
    const result = await authorizeRelease(parameters);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /rollback vereist/);
    assert.equal(result.output, "");
  }
  const accepted = await authorizeRelease({ requestedSha: previousMain, mode: "rollback", dispatchedSha: previousMain, confirmation: "ROLLBACK" });
  assert.equal(accepted.status, 0, accepted.stderr);
  assert.equal(accepted.output, `release_sha=${previousMain}\n`);
});

test("actual preflight rejects a release or rollback outside main ancestry", async () => {
  for (const mode of ["release", "rollback"]) {
    const result = await authorizeRelease({ requestedSha: previousMain, mode, dispatchedSha: previousMain, confirmation: "ROLLBACK", ancestor: false });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Alleen releases uit main zijn toegestaan/);
    assert.equal(result.output, "");
  }
});
