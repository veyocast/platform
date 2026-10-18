import { readFileSync } from "node:fs";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { parseCaseInventory, validateCaseInventory } from "./sites-case-inventory.mjs";

// This is the chosen Sync workplace cohort. Historical screen-renderer gates
// retain their original Source revision and strict frame comparison verifier.
export function verifySyncComparison(report, rows) {
  const expected = rows.filter(row => row.case_id.startsWith("RESP-"));
  const criteria = ["noHorizontalOverflow", "assetsLoaded", "shellAndControlGeometry", "activeNavigation", "sourceHeadingOrder", "sourceSectionGeometry", "mobileTouchTargets", "browserErrors", "accessibility"];
  const fail = message => { throw new Error(`Incomplete chosen Sync comparison: ${message}`); };
  if (expected.length !== 66 || report.schemaVersion !== 1 || report.sourceRevision !== "8b1fdf1f8637dda23d48ecdaf08e0e5978e2707a"
    || report.sourceFilesUnchanged !== true || report.assertionVersion !== "s226-sync-responsive-v4"
    || !/^[a-f0-9]{64}$/u.test(report.comparisonFingerprint ?? "")) fail("source/cohort identity");
  if (!Array.isArray(report.results) || report.results.length !== 66 || new Set(report.results.map(row => row.caseId)).size !== 66) fail("all 66 original IDs required");
  for (const original of expected) {
    const row = report.results.find(row => row.caseId === original.case_id);
    if (!row || row.status !== "PASS" || row.viewport !== original.viewport || row.originalRoute !== original.reference_route
      || criteria.some(key => row.criteria?.[key] !== true) || Object.values(row.criteria ?? {}).some(value => value !== true)
      || !Array.isArray(row.unmet) || row.unmet.length || !Array.isArray(row.errors) || row.errors.length
      || !Array.isArray(row.differences) || row.differences.length || !Array.isArray(row.headingDifferences) || row.headingDifferences.length
      || !Array.isArray(row.accessibility?.source) || !Array.isArray(row.accessibility?.current) || row.accessibility.current.length) fail(original.case_id);
    if (!row.source || !row.current || row.source.overflow !== 0 || row.current.overflow !== 0
      || !Array.isArray(row.current.images) || row.current.images.some(image => image.loaded !== true)
      || !Array.isArray(row.current.mobileTargets) || row.current.mobileTargets.some(target => target.width < 44 || target.height < 44)) fail(`${original.case_id}: raw production checks`);
    const settings = original.reference_route === "#/dashboard/settings";
    if (row.sourceContentAvailable !== !settings || settings && !row.scope?.includes("content parity is N_A")) fail(`${original.case_id}: explicit content scope`);
    if (original.reference_route !== "#/website" && (!row.touchCanonComparison?.scope?.includes("Counterfactual") || !row.touchCanonComparison.measurement)) fail(`${original.case_id}: touch canon disclosure`);
    if (["#/dashboard/sources", "#/dashboard/support"].includes(original.reference_route)
      && row.referenceState?.kind !== "canonical-Source-EmptyState") fail(`${original.case_id}: explicit original component state`);
    if (original.reference_route === "#/dashboard/sources" && (!Array.isArray(row.copyComparisons) || row.copyComparisons.length !== 1
      || row.copyComparisons[0].selector !== ".ad-demo-label" || row.copyComparisons[0].production !== "Opgeslagen bronstatus"
      || row.copyComparisons[0].reference !== "Interactieve demo · geen externe verbindingen")) fail(`${original.case_id}: factual copy exception`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const current = readFileSync("docs/sites-v11-overname/inventory/VISUAL-CASES.csv", "utf8");
  validateCaseInventory(current, readFileSync("docs/sites-v11-overname/handoff/VISUAL-CASES.original.csv", "utf8"));
  verifySyncComparison(JSON.parse(readFileSync(process.argv[2], "utf8")), parseCaseInventory(current));
  process.stdout.write("Verified all 66 chosen Sync responsive cases with explicit scope and raw accessibility checks.\n");
}
