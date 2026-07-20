import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const workflowPath = fileURLToPath(
  new URL("../.github/workflows/deploy.yml", import.meta.url)
);
const workflow = await readFile(workflowPath, "utf8");

assertMatch(
  workflow,
  /^permissions:\n  contents: read\n/m,
  "De deployworkflow moet uitsluitend contents: read gebruiken."
);
assertEqual(
  [...workflow.matchAll(/^\s*permissions:/gm)].length,
  1,
  "Job-level of aanvullende permissions zijn niet toegestaan."
);
assertMatch(
  workflow,
  /^on:\n  push:\n    branches:\n      - main\n  workflow_dispatch:/m,
  "Alleen push naar main en workflow_dispatch mogen de deployworkflow starten."
);
assertNotMatch(
  workflow,
  /^\s*pull_request(?:_target)?:/m,
  "Pull requests mogen geen deployment starten."
);

const steps = readStepBlocks(workflow);
for (const step of steps) {
  const script = readRunScript(step);
  if (!script) continue;

  const result = spawnSync("bash", ["-n"], {
    encoding: "utf8",
    input: script
  });
  if (result.status !== 0) {
    const name = step.match(/^      - name: ([^\n]+)/m)?.[1] ?? "onbekend";
    fail(`Inline Bash-syntax is ongeldig in stap: ${name}.`);
  }
}

const checkoutSteps = steps.filter((step) =>
  step.includes("uses: actions/checkout@")
);
assertEqual(
  checkoutSteps.length,
  4,
  "Alle vier deployjobs moeten expliciet uitchecken."
);
for (const step of checkoutSteps) {
  assertMatch(
    step,
    /\n          fetch-depth: 0\n/,
    "Checkout moet de volledige historie ophalen."
  );
  assertMatch(
    step,
    /\n          persist-credentials: false\n/,
    "Checkoutcredentials mogen niet persistent blijven."
  );
}
assertMatch(
  checkoutSteps[0] ?? "",
  /\n          ref: main\n/,
  "Preflight moet de vertrouwde main-workflow uitchecken."
);

const cleanupSteps = steps.filter((step) =>
  step.includes("name: Remove stale workspace files")
);
assertEqual(cleanupSteps.length, 4, "Iedere checkout moet direct worden opgeschoond.");
for (const step of cleanupSteps) {
  assertMatch(
    step,
    /\n        run: git clean -ffdx\n*$/,
    "Cleanup moet beperkt blijven tot git clean."
  );
  assertNotMatch(
    step,
    /rm\s+-rf|\.git|git\s+config/i,
    "Cleanup mag checkout of Gitconfig niet wijzigen."
  );
}

const migrationToolingInstall =
  "pnpm --filter veyocast-platform install --frozen-lockfile --child-concurrency=1 --network-concurrency=8 --package-import-method=copy";
assertEqual(
  steps.filter((step) => readRunScript(step) === migrationToolingInstall).length,
  2,
  "Staging en production moeten uitsluitend de gepinde root-migratietooling met begrensde pnpm-concurrency installeren."
);

const remoteGitSteps = steps.filter(
  (step) =>
    step.includes("run:") &&
    (/(?:^|\n)\s*git\s+(?:fetch|ls-remote)\b/m.test(step) ||
      /(?:^|\n)\s*git\s+\\\n[\s\S]*?\n\s*(?:fetch|ls-remote)\s+\\/m.test(step) ||
      /(?:^|\n)\s*gh\s+api\b/m.test(step))
);
assertEqual(
  remoteGitSteps.length,
  2,
  "Alleen releaseautorisatie en production-stale-check mogen remote Git gebruiken."
);
assertEqual(
  [...workflow.matchAll(/\$\{\{ github\.token \}\}/g)].length,
  2,
  "Het jobtoken mag uitsluitend aan de twee remote Git-stappen worden verstrekt."
);
assertEqual(
  [...workflow.matchAll(/\$\{GH_TOKEN\}/g)].length,
  2,
  "GH_TOKEN mag uitsluitend in de twee afgeschermde headerconstructies worden gelezen."
);

for (const step of remoteGitSteps) {
  assertMatch(
    step,
    /\n          GH_TOKEN: \$\{\{ github\.token \}\}\n/,
    "Iedere remote Git-stap moet het job-scoped github.token gebruiken."
  );
  assertMatch(
    step,
    /printf 'x-access-token:%s' "\$\{GH_TOKEN\}" \|\n\s+base64 \|\n\s+tr -d '\\n'/m,
    "Iedere remote Git-stap moet tijdelijk een Basic-authheader opbouwen."
  );
  assertMatch(
    step,
    /-c "http\.https:\/\/github\.com\/\.extraheader=AUTHORIZATION: basic \$\{auth_header\}"/,
    "De tijdelijke header moet uitsluitend via een command-scoped Gitconfig gelden."
  );
  assertMatch(
    step,
    /"\+refs\/heads\/main:refs\/remotes\/origin\/main"/,
    "De remote fetch moet uitsluitend de actuele main-ref verversen."
  );
  assertMatch(
    step,
    /\n          unset auth_header\n/,
    "De tijdelijke headervariabele moet direct worden gewist."
  );
  const loggingSurface = step.replace(
    `printf 'x-access-token:%s' "\${GH_TOKEN}" |`,
    ""
  );
  assertNotMatch(
    loggingSurface,
    /(?:echo|printf)[^\n]*(?:auth_header|GH_TOKEN|GITHUB_TOKEN)/i,
    "Credentialmateriaal mag niet naar logs worden geschreven."
  );
}

assertNotMatch(
  workflow,
  /\bset\s+-[^\n]*x\b/,
  "Shell tracing mag secrets niet loggen."
);
assertNotMatch(
  workflow,
  /gh\s+auth\s+login|credential\.helper|git\s+config\s+--global|~\/\.gitconfig|PERSONAL_ACCESS_TOKEN|DEPLOY_KEY|secrets\.GITHUB_TOKEN/i,
  "PAT's, deploy keys en machinebrede Gitcredentials zijn verboden."
);
assertNotMatch(
  workflow.replaceAll(`printf 'x-access-token:%s' "\${GH_TOKEN}" |`, ""),
  /(?:echo|printf)[^\n]*(?:auth_header|GH_TOKEN|GITHUB_TOKEN)/i,
  "Credentialmateriaal mag niet naar workflowlogs worden geschreven."
);
assertNotMatch(
  workflow,
  /(?:^|\n)\s*(?:printenv|env)(?:\s|$)/m,
  "De workflow mag de volledige environment niet loggen."
);

assertMatch(
  workflow,
  /\^\[0-9a-f\]\{40\}\$/,
  "Release-SHA moet exact 40 hextekens bevatten."
);
assertMatch(
  workflow,
  /git cat-file -e "\$\{release_sha\}\^\{commit\}"/,
  "De release-SHA moet lokaal als commit bestaan."
);
assertMatch(
  workflow,
  /git merge-base --is-ancestor "\$\{release_sha\}" origin\/main/,
  "Preflight moet bewijzen dat de release onderdeel is van main."
);
assertMatch(
  workflow,
  /\$\{DEPLOYMENT_MODE\} == release && \$\(git rev-parse origin\/main\) != "\$\{release_sha\}"/,
  "Een normale release moet de actuele main-SHA zijn."
);
assertMatch(
  workflow,
  /\$\{DEPLOYMENT_MODE\} == rollback && \$\{ROLLBACK_CONFIRMATION\} != ROLLBACK/,
  "Rollback moet expliciet met ROLLBACK worden bevestigd."
);
assertMatch(
  workflow,
  /\$\{DEPLOYMENT_MODE\} == rollback && \( -z \$\{DISPATCH_RELEASE_SHA\} \|\| \$\{release_sha\} == "\$\(git rev-parse origin\/main\)" \)/,
  "Rollback moet expliciet een oudere volledige SHA kiezen."
);
assertMatch(
  workflow,
  /name: Approve and deploy production[\s\S]*?needs: deploy-staging/,
  "Production mag uitsluitend de geverifieerde stagingrelease consumeren."
);
assertMatch(
  workflow,
  /\$\{DEPLOYMENT_MODE\} == release && \$\(git rev-parse origin\/main\) != "\$\{RELEASE_SHA\}"/,
  "Production moet een verouderde normale release weigeren."
);
assertMatch(
  workflow,
  /\$\{DEPLOYMENT_MODE\} == rollback \]\] && ! git merge-base --is-ancestor "\$\{RELEASE_SHA\}" origin\/main/,
  "Production moet rollback-SHA's buiten main weigeren."
);

function readStepBlocks(source) {
  return [
    ...source.matchAll(
      /^      - name: [^\n]+\n[\s\S]*?(?=^      - name: |(?![\s\S]))/gm
    )
  ].map((match) => match[0]);
}

function readRunScript(step) {
  const lines = step.split("\n");
  const runIndex = lines.findIndex((line) => line.startsWith("        run: "));
  if (runIndex < 0) return null;

  const declaration = lines[runIndex]?.slice("        run: ".length) ?? "";
  if (declaration !== "|") return declaration;

  return lines
    .slice(runIndex + 1)
    .map((line) => (line.startsWith("          ") ? line.slice(10) : line))
    .join("\n");
}

function assertMatch(value, pattern, message) {
  if (!pattern.test(value)) fail(message);
}

function assertNotMatch(value, pattern, message) {
  if (pattern.test(value)) fail(message);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    fail(`${message} Verwacht ${expected}, ontvangen ${actual}.`);
  }
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
