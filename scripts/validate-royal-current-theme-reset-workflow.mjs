import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const workflowPath = fileURLToPath(
  new URL("../.github/workflows/fieldflow-royal-theme-reset.yml", import.meta.url)
);
const runbookPath = fileURLToPath(
  new URL("../docs/runbooks/fieldflow-royal-theme-reset.md", import.meta.url)
);

const [workflow, runbook] = await Promise.all([
  readFile(workflowPath, "utf8"),
  readFile(runbookPath, "utf8")
]);

for (const [label, source] of [["workflow", workflow], ["runbook", runbook]]) {
  forbid(
    source,
    /ROYAL BLUE RESET|Royal blue|reset_tenant_fieldflow_royal_v1|20260908224609|tenant\.theme\.royal_blue_reset|#4169E1|#7A5CE6|\bInter\b|\bManrope\b|vc-inter-v1|vc-manrope-v1|"schemaVersion"\s*:\s*1/,
    `${label} bevat opnieuw een S159/v1-resetwaarde.`
  );
}

requireText(workflow, "name: FieldFlow ROYAL CURRENT RESET");
requireText(workflow, "description: Typ ROYAL CURRENT RESET");
requireText(workflow, 'if [[ ${CONFIRMATION} != "ROYAL CURRENT RESET" ]]');
requireText(workflow, "where migration.version = '20260909174500'");
requireText(workflow, "where version = '20260909174500'");
requireText(workflow, "routine.proname = 'reset_tenant_fieldflow_royal_v2'");
requireText(workflow, "private.reset_tenant_fieldflow_royal_v2(");
requireText(workflow, "event.action = 'tenant.theme.royal_current_reset'");

for (const fragment of [
  '"accent":"#2459ED"',
  '"support":null',
  '"modePolicy":{"kind":"fixed","mode":"dark"}',
  '"designRevision":"royal-current-v8"',
  '"motionEnabled":true',
  '"background":"club"',
  '"primary":"#2459ED"',
  '"secondary":null',
  '"schemaVersion":2',
  '"baseScale":1.05',
  '"bodyFontRef":"vc-roboto-v1"',
  '"displayFontRef":"vc-roboto-v1"',
  '"sportScale":1.4',
  "profile.color_overrides = '{}'::jsonb",
  "settings.theme_accent = '#2459ED'",
  "settings.theme_support is null",
  "settings.theme_color_overrides = '{}'::jsonb"
]) {
  requireText(workflow, fragment);
}

for (const guard of [
  "permissions:\n  contents: read",
  "if: github.ref == 'refs/heads/main'",
  'if [[ ${EXPECTED_RELEASE_SHA} != "${WORKFLOW_SHA}" ]]',
  'if [[ ${current_main_sha} != "${EXPECTED_RELEASE_SHA}" ]]',
  "https://control.veyocast.nl/api/health",
  "https://player.veyocast.nl/healthz",
  "https://staging-control.veyocast.nl/api/health",
  "https://staging-player.veyocast.nl/healthz",
  "routine.proconfig @> array['search_path=\"\"']::text[]",
  "routine.prosecdef",
  "routine.proowner = (",
  "pg_catalog.has_function_privilege(",
  "convert_from(decode('${tenant_name_b64}', 'base64'), 'UTF8')",
  "convert_from(decode('${reason_b64}', 'base64'), 'UTF8')",
  "convert_from(decode('${operator_b64}', 'base64'), 'UTF8')",
  "convert_from(decode('${run_url_b64}', 'base64'), 'UTF8')",
  "for attempt in $(seq 1 72)",
  "sleep 5"
]) {
  requireText(workflow, guard);
}

forbid(workflow, /^\s*pull_request(?:_target)?:/m, "De tenantreset mag niet vanaf een pull request draaien.");
forbid(workflow, /\bset\s+-[^\n]*x\b|(?:^|\n)\s*(?:printenv|env)(?:\s|$)/m, "De tenantreset mag secrets niet loggen.");

for (const fragment of [
  "# FieldFlow ROYAL CURRENT RESET",
  "`#2459ED`",
  "appearance-schema `2`",
  "designrevision `royal-current-v8`",
  "`private.reset_tenant_fieldflow_royal_v2(...)`",
  "`20260909174500_s161_royal_current_theme.sql`",
  "-f reason='S161 ROYAL CURRENT RESET na geslaagde stagingdeployment'",
  "-f reason='S161 ROYAL CURRENT RESET na goedgekeurde productiedeployment'",
  "-f confirmation='ROYAL CURRENT RESET'"
]) {
  requireText(runbook, fragment);
}

function requireText(source, expected) {
  if (!source.includes(expected)) {
    fail(`Vereiste Royal Current-resetgrens ontbreekt: ${expected}`);
  }
}

function forbid(source, pattern, message) {
  if (pattern.test(source)) fail(message);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
