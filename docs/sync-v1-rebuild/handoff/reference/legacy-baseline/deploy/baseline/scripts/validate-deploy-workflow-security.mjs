import { spawnSync } from "node:child_process";
import console from "node:console";
import process from "node:process";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath, URL } from "node:url";
import { validateRunnerToolchains } from "./runner-toolchain-policy.mjs";

const workflowPath = fileURLToPath(
  new URL("../.github/workflows/deploy.yml", import.meta.url)
);
const workflow = await readFile(workflowPath, "utf8");
const workflowDirectory = new URL("../.github/workflows/", import.meta.url);
const workflowNames = (await readdir(workflowDirectory)).filter((name) => /\.ya?ml$/.test(name));
const allWorkflows = await Promise.all(workflowNames.map((name) => readFile(new URL(name, workflowDirectory), "utf8")));
validateRunnerToolchains(allWorkflows);

assertMatch(
  workflow,
  /^permissions:\n {2}contents: read\n/m,
  "De deployworkflow moet uitsluitend contents: read gebruiken."
);
assertEqual(
  [...workflow.matchAll(/^\s*permissions:/gm)].length,
  1,
  "Job-level of aanvullende permissions zijn niet toegestaan."
);
assertMatch(
  workflow,
  /^on:\n {2}push:\n {4}branches:\n {6}- main\n {2}workflow_dispatch:/m,
  "Alleen push naar main en workflow_dispatch mogen de deployworkflow starten."
);
assertNotMatch(
  workflow,
  /^\s*pull_request(?:_target)?:/m,
  "Pull requests mogen geen deployment starten."
);
assertMatch(
  workflow,
  /workflow_dispatch:\n {4}inputs:\n {6}deploy_target:[\s\S]*?options:\n {10}- staging\n {10}- production\n/,
  "Een handmatige deployment moet expliciet staging of production kiezen."
);
assertMatch(
  workflow,
  /deploy-production:\n {4}name: Deploy production \(explicit dispatch\)\n {4}needs: deploy-staging\n {4}if: \$\{\{ github\.event_name == 'workflow_dispatch' && inputs\.deploy_target == 'production' \}\}/,
  "Production mag uitsluitend na een expliciete production-dispatch starten."
);

const publicationProbeWorkflow = await readFile(new URL("../.github/workflows/probe-publication-runtime.yml", import.meta.url), "utf8");
assertMatch(publicationProbeWorkflow, /^on:\n {2}workflow_dispatch:\n/m, "Publicatiediagnose mag uitsluitend handmatig starten.");
assertNotMatch(publicationProbeWorkflow, /^\s*(pull_request(?:_target)?|push|schedule|workflow_call):/m, "Geen indirecte of PR-trigger voor beschermde publicatiediagnose.");
assertMatch(publicationProbeWorkflow, /^permissions:\n {2}contents: read\n/m, "Publicatiediagnose heeft alleen contents: read.");
assertEqual([...publicationProbeWorkflow.matchAll(/^\s*permissions:/gm)].length, 1, "Geen aanvullende diagnosepermissions.");
assertMatch(publicationProbeWorkflow, /environment: \$\{\{ inputs\.target_environment \}\}/, "Diagnose gebruikt een beschermd Environment.");
assertMatch(publicationProbeWorkflow, /timeout-minutes: 5/, "Diagnose heeft een begrensde jobduur.");
assertMatch(publicationProbeWorkflow, /ref: \$\{\{ github\.sha \}\}\n {10}persist-credentials: false/, "Checkout moet dezelfde trusted workflow-SHA gebruiken zonder blijvende credentials.");
assertEqual([...publicationProbeWorkflow.matchAll(/secrets\./g)].length, 1, "Diagnose krijgt uitsluitend de SQL-secret.");
assertMatch(publicationProbeWorkflow, /SUPABASE_DB_URL: \$\{\{ secrets\.SUPABASE_DB_URL \}\}/, "Diagnose mist de beschermde SQL-binding.");
assertNotMatch(publicationProbeWorkflow, /\$\{\{ inputs\.[^}]+\}\}[^\n]*\n?(?:[^\n]*run:)/, "Geen inputinterpolatie in shellcommando's.");

const runtimeProbeWorkflow = await readFile(new URL("../.github/workflows/probe-runtime-database.yml", import.meta.url), "utf8");
for (const [source, mode, entrypoint] of [
  [publicationProbeWorkflow, "publication", "probe-publication-runtime"],
  [runtimeProbeWorkflow, "runtime", "probe-runtime-database"]
]) {
  assertMatch(source, /^on:\n {2}workflow_dispatch:\n/m, "De begrensde diagnose heeft uitsluitend een handmatige trigger.");
  assertNotMatch(source, /^\s*(pull_request(?:_target)?|push|schedule|workflow_call):/m, "Diagnose mag niet indirect starten.");
  assertMatch(source, /^jobs:\n {2}probe:\n/m, "De vaste diagnose heeft één expliciet probejob.");
  const probeJob = source.match(/^jobs:\n {2}probe:\n([\s\S]*)/m)?.[1] ?? "";
  assertNotMatch(probeJob, /^ {0,2}[^\s#]/m, "Er zijn geen aanvullende diagnosejobs of root-overrides.");
  assertMatch(probeJob, /^ {4}if: \$\{\{ always\(\) && github\.ref == 'refs\/heads\/main' && \(inputs\.quiesce_worker \|\| !cancelled\(\)\) \}\}$/m, "Het probejob zelf bewaart trusted main en de expliciete cancellationgrens.");
  assertNotMatch(source, /^\s*(?:continue-on-error|shell):/m, "Diagnose staat geen failureomzetting of shelloverride toe.");
  const quiesceInput = source.match(/^ {6}quiesce_worker:\n(?: {8}[^\n]*\n)*/m)?.[0] ?? "";
  assertMatch(quiesceInput, /^ {8}type: boolean\n {8}default: false$/m, "Workerquiescence is uitsluitend expliciet en standaard uit in zijn eigen inputblok.");
  assertMatch(source, /^ {2}group: \$\{\{ inputs\.quiesce_worker && 'deploy-veyocast-main' \|\| format\('[^']+', inputs\.target_environment, inputs\.tenant_id\) \}\}\n {2}cancel-in-progress: false$/m, "Quiescence deelt het exclusieve deploymentownership zonder cancellation.");
  const fixedDispatch = [
    '          case "$QUIESCE_WORKER" in',
    `            true) exec bash scripts/probe-with-quiesced-worker.sh ${mode} "$TARGET_ENVIRONMENT" "$EXPECTED_RUNTIME_SHA" "$TENANT_ID" ;;`,
    `            false) exec node scripts/${entrypoint}.mjs "$TARGET_ENVIRONMENT" "$EXPECTED_RUNTIME_SHA" "$TENANT_ID" ;;`,
    "            *) echo 'PROBE_SCOPE_INVALID' >&2; exit 64 ;;",
    "          esac"
  ].join("\n");
  assertEqual(source.split(fixedDispatch).length - 1, 1, "Alleen de twee vaste execbranches met expliciet gequote argumenten zijn toegestaan.");
  const probeSteps = readStepBlocks(source);
  const criticalSteps = probeSteps.filter((step) => step.includes("scripts/probe-with-quiesced-worker.sh"));
  assertEqual(criticalSteps.length, 1, "Precies één vaste critical step bezit de workerquiescence.");
  const criticalStep = criticalSteps[0];
  assertEqual(readRunScript(criticalStep), fixedDispatch.split("\n").map((line) => line.slice(10)).join("\n"), "De volledige critical scriptbody bevat uitsluitend de vaste dispatch.");
  assertMatch(criticalStep, /^ {8}if: \$\{\{ always\(\) && steps\.install_client\.outcome == 'success' && \(inputs\.quiesce_worker \|\| !cancelled\(\)\) \}\}$/m, "De critical step zelf vereist installsuccess en bewaart het herstel bij cancellation.");
  const installStep = probeSteps[probeSteps.indexOf(criticalStep) - 1] ?? "";
  assertMatch(installStep, /^ {6}- name: Install pinned diagnostic client\n {8}if: \$\{\{ success\(\) && !cancelled\(\) \}\}\n {8}id: install_client$/m, "De voorafgaande install bezit het expliciete annuleerbare armingpoint.");
  assertEqual(readRunScript(installStep), "pnpm --filter veyocast-platform install --frozen-lockfile --child-concurrency=1", "De arminginstall gebruikt uitsluitend de vaste gepinde client.");
  assertEqual(probeSteps.filter((step) => /^ {8}id: install_client$/m.test(step)).length, 1, "Het installarmingpoint is uniek.");
  const cancellationStep = probeSteps.find((step) => step.startsWith("      - name: Preserve ordinary workflow cancellation\n")) ?? "";
  assertMatch(cancellationStep, /^ {8}if: \$\{\{ cancelled\(\) && inputs\.quiesce_worker \}\}\n {8}run: \|\n {10}echo '\{"event":"quiesced_worker_probe","phase":"workflow","code":"PROBE_WORKFLOW_CANCELLED"\}' >&2\n {10}exit 1$/m, "Workflowcancellation blijft een failure in zijn eigen markerstep na workerherstel.");
  assertNotMatch(source, /\bset\s+-[A-Za-z]*x[A-Za-z]*(?:\s|$)|\bset\s+-o\s+xtrace\b/, "De diagnose mag geen shelltracing activeren.");
}

const steps = readStepBlocks(workflow);
for (const step of steps) {
  const script = readRunScript(step);
  if (!script) continue;

  const result = spawnSync("bash", ["-n"], {
    encoding: "utf8",
    input: script
  });
  if (result.status !== 0) {
    const name = step.match(/^ {6}- name: ([^\n]+)/m)?.[1] ?? "onbekend";
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
    /\n {10}fetch-depth: 0\n/,
    "Checkout moet de volledige historie ophalen."
  );
  assertMatch(
    step,
    /\n {10}persist-credentials: false\n/,
    "Checkoutcredentials mogen niet persistent blijven."
  );
}
assertMatch(
  checkoutSteps[0] ?? "",
  /\n {10}ref: main\n/,
  "Preflight moet de vertrouwde main-workflow uitchecken."
);

const cleanupSteps = steps.filter((step) =>
  step.includes("name: Remove stale workspace files")
);
assertEqual(cleanupSteps.length, 4, "Iedere checkout moet direct worden opgeschoond.");
for (const step of cleanupSteps) {
  assertMatch(
    step,
    /\n {8}run: git clean -ffdx\n*$/,
    "Cleanup moet beperkt blijven tot git clean."
  );
  assertNotMatch(
    step,
    /rm\s+-rf|\.git|git\s+config/i,
    "Cleanup mag checkout of Gitconfig niet wijzigen."
  );
}

const nodeSetupPositions = steps.flatMap((step, index) =>
  step.includes("name: Setup Node.js") ? [index] : []
);
const pnpmSetupPositions = steps.flatMap((step, index) =>
  step.includes("name: Setup pnpm") ? [index] : []
);
assertEqual(
  nodeSetupPositions.length,
  4,
  "Iedere deployjob moet de project-Node-toolchain activeren."
);
assertEqual(
  pnpmSetupPositions.length,
  4,
  "Iedere deployjob moet de gepinde pnpm-toolchain activeren."
);
for (let index = 0; index < nodeSetupPositions.length; index += 1) {
  if ((nodeSetupPositions[index] ?? Number.POSITIVE_INFINITY) >=
      (pnpmSetupPositions[index] ?? Number.NEGATIVE_INFINITY)) {
    fail(
      "Setup Node.js moet vóór Setup pnpm draaien, zodat pnpm nooit de interne runner-npm gebruikt."
    );
  }
}
for (const position of pnpmSetupPositions) {
  assertMatch(
    steps[position] ?? "",
    /\n {10}cache: true\n/,
    "pnpm/action-setup moet de pnpm-store veilig cachen."
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
    /\n {10}GH_TOKEN: \$\{\{ github\.token \}\}\n/,
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
    /\n {10}unset auth_header\n/,
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
  /\bset\s+-[^\n]*x\b|\bset\s+-[A-Za-z]*x[A-Za-z]*(?:\s|$)|\bset\s+-o\s+xtrace\b/,
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
  /name: Deploy production \(explicit dispatch\)[\s\S]*?needs: deploy-staging/,
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
      /^ {6}- name: [^\n]+\n[\s\S]*?(?=^ {6}- name: |(?![\s\S]))/gm
    )
  ].map((match) => match[0]);
}

function readRunScript(step) {
  const lines = step.split("\n");
  const runIndex = lines.findIndex((line) => line.startsWith("        run: "));
  if (runIndex < 0) return null;

  const declaration = lines[runIndex]?.slice("        run: ".length) ?? "";
  if (declaration !== "|") return declaration;

  const scriptLines = [];
  for (const line of lines.slice(runIndex + 1)) {
    if (line.trim() && !line.startsWith("          ")) break;
    scriptLines.push(line.startsWith("          ") ? line.slice(10) : line);
  }
  return scriptLines.join("\n").trimEnd();
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
