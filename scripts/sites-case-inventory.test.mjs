import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parseCaseInventory, validateCaseInventory } from "./sites-case-inventory.mjs";
import { expectedFixturePages, verifyComparisonReadbacks } from "./verify-sites-comparison.mjs";
import { verifySyncComparison } from "./verify-sync-comparison.mjs";

const original = readFileSync("docs/sites-v11-overname/handoff/VISUAL-CASES.original.csv", "utf8");
const current = readFileSync("docs/sites-v11-overname/inventory/VISUAL-CASES.csv", "utf8");
function encode(rows) {
  const columns = Object.keys(rows[0]);
  return [columns.join(","), ...rows.map(row => columns.map(column => `"${row[column].replaceAll('"', '""')}"`).join(","))].join("\n");
}

test("preserves all original cases, cohorts and immutable fields", () => {
  assert.deepEqual(validateCaseInventory(current, original), { originalCases: 1209, broadcastCases: 548, responsiveCases: 66 });
});
test("rejects silently missing responsive coverage", () => {
  assert.throws(() => validateCaseInventory(encode(parseCaseInventory(current).filter(row => row.case_id !== "RESP-0001")), original), /1209/u);
});
test("rejects changing a broadcast case so the renderer gate skips it", () => {
  const rows = parseCaseInventory(current);
  rows.find(row => row.case_kind === "BROADCAST_PARITY").case_kind = "UNTESTED";
  assert.throws(() => validateCaseInventory(encode(rows), original), /case_kind/u);
});
test("rejects duplicate IDs and reordered original rows", () => {
  const rows = parseCaseInventory(current);
  rows[1].case_id = rows[0].case_id;
  assert.throws(() => validateCaseInventory(encode(rows), original), /duplicate/u);
  const ordered = parseCaseInventory(current);
  [ordered[0], ordered[1]] = [ordered[1], ordered[0]];
  assert.throws(() => validateCaseInventory(encode(ordered), original), /Original case changed/u);
});
test("allows honest status and evidence updates", () => {
  const rows = parseCaseInventory(current);
  rows[0].status = "NOT_RUN"; rows[0].evidence = "Pending actual execution";
  assert.equal(validateCaseInventory(encode(rows), original).originalCases, 1209);
});

function completeResponsiveReport() {
  return {
    sourceRevision: "b1cae899af19fc39908217253094c5240d7359fc", sourceFilesUnchanged: true,
    results: parseCaseInventory(original).filter(row => row.case_id.startsWith("RESP-")).map(row => ({
      caseId: row.case_id, status: "PASS", assertionVersion: "s191-resp-all-criteria-v3",
      criteria: Object.fromEntries(["semanticTypography", "panelOrder", "typography", "images", "gutters", "activeTab", "noHorizontalOverflow", "mobileNavigation", "primaryAction"].map(key => [key, { passed: true }]))
    }))
  };
}
test("requires the actual nested responsive criterion schema for every original case", () => {
  assert.doesNotThrow(() => verifyComparisonReadbacks("responsive", completeResponsiveReport(), parseCaseInventory(original)));
  const report = completeResponsiveReport();
  delete report.results[0].criteria.images;
  assert.throws(() => verifyComparisonReadbacks("responsive", report, parseCaseInventory(original)), /complete passing criteria/u);
});
test("rejects claimed PASS with a failed criterion, missing case or obsolete assertion", () => {
  for (const mutate of [report => { report.results[0].criteria.primaryAction.passed = false; }, report => { report.results.pop(); }, report => { report.results[0].assertionVersion = "outer-geometry-only"; }]) {
    const report = completeResponsiveReport(); mutate(report);
    assert.throws(() => verifyComparisonReadbacks("responsive", report, parseCaseInventory(original)), /complete passing criteria/u);
  }
});

function contentA2Proof(route) {
  const filter = route === "#/dashboard/media" ? "media" : "designs";
  const metrics = { height: 44, width: 160, fontSize: 14, clientWidth: 160, scrollWidth: 160, clientHeight: 44, scrollHeight: 44 };
  const types = ["Alles", "Media", "Ontwerpen", "Automatische slides", "Menu’s", "Reeksen"].map((label, index) => ({ ...metrics, label, href: `/dashboard/content?filter=${["all", "media", "designs", "automatic", "menus", "series"][index]}&status=active&page=1` }));
  const statuses = ["Actief", "In bewerking", "Archief"].map((label, index) => ({ ...metrics, label, href: `/dashboard/content?filter=${filter}&status=${["active", "attention", "archive"][index]}&page=1` }));
  return { contract: "S297_CONTENT_A2", pixelParity: false, filter, controls: { types, statuses, context: [{ ...metrics, label: "Context", href: filter === "media" ? "/dashboard/media" : "/dashboard/studio?advanced=1" }] }, search: { filter, status: "active", pageSize: "48" }, accessibility: true, noHorizontalOverflow: true };
}
function chosenSyncReport() {
  return {
    schemaVersion: 1, sourceRevision: "8b1fdf1f8637dda23d48ecdaf08e0e5978e2707a", sourceFilesUnchanged: true,
    assertionVersion: "s297-sync-responsive-v5", comparisonFingerprint: "a".repeat(64),
    results: parseCaseInventory(original).filter(row => row.case_id.startsWith("RESP-")).map(row => ({
      caseId: row.case_id, viewport: row.viewport, originalRoute: row.reference_route, status: "PASS",
      criteria: { ...Object.fromEntries(["noHorizontalOverflow", "assetsLoaded", "shellAndControlGeometry", "activeNavigation", "sourceHeadingOrder", "sourceSectionGeometry", "mobileTouchTargets", "browserErrors", "accessibility"].map(key => [key, true])), ...(["#/dashboard/media", "#/dashboard/studio"].includes(row.reference_route) ? { contentA2Acceptance: true } : {}) },
      intentionalChange: ["#/dashboard/media", "#/dashboard/studio"].includes(row.reference_route) ? contentA2Proof(row.reference_route) : null,
      unmet: [], errors: [], differences: [], headingDifferences: [], accessibility: { source: [], current: [] },
      source: { overflow: 0 }, current: { overflow: 0, images: [{ loaded: true }], mobileTargets: [{ width: 44, height: 44 }] },
      sourceContentAvailable: row.reference_route !== "#/dashboard/settings", scope: "Settings content parity is N_A",
      touchCanonComparison: { scope: "Counterfactual Source hit areas; raw measurements separate", measurement: {} },
      referenceState: { kind: "canonical-Source-EmptyState" },
      copyComparisons: [{ selector: ".ad-demo-label", production: "Opgeslagen bronstatus", reference: "Interactieve demo · geen externe verbindingen" }]
    }))
  };
}
test("chosen Sync retains all original IDs with explicit empty/shell scope and raw accessibility", () => {
  assert.doesNotThrow(() => verifySyncComparison(chosenSyncReport(), parseCaseInventory(original)));
});
test("chosen Sync rejects stale/missing cases and fabricated PASS despite raw accessibility or geometry failure", () => {
  for (const mutate of [
    report => { report.results.pop(); },
    report => { report.sourceRevision = "b1cae899af19fc39908217253094c5240d7359fc"; },
    report => { report.results[0].criteria.shellAndControlGeometry = false; },
    report => { report.results[0].current.mobileTargets[0].width = 32; },
    report => { report.results[0].accessibility.current = [{ id: "color-contrast" }]; },
    report => { report.results[0].sourceContentAvailable = false; },
    report => { delete report.results[0].touchCanonComparison; },
    report => { report.results.find(row => row.originalRoute === "#/dashboard/sources").referenceState.kind = "original-route"; }
  ]) {
    const report = chosenSyncReport(); mutate(report);
    assert.throws(() => verifySyncComparison(report, parseCaseInventory(original)), /Incomplete chosen Sync comparison/u);
  }
});

function rendererReport(pattern, variation = "default") {
  const comparisons = parseCaseInventory(original).filter(row => pattern.test(row.case_id)).flatMap(row => {
    const pages = expectedFixturePages(row);
    return (pages > 1 ? [0, pages - 1] : [0]).map(page => ({caseId: row.case_id, page, pages, variation, status: "EXACT", changedPixels: 0}));
  });
  return {sourceRevision: "b1cae899af19fc39908217253094c5240d7359fc", assertionMode: "STRICT", caseCount: comparisons.length, exactCount: comparisons.length, comparisons};
}
test("requires the independently fixed 644 first/last frames and rejects collapsed pagination", () => {
  const rows = parseCaseInventory(original);
  const broadcast = rows.filter(row => ["BROADCAST_PARITY", "BROADCAST_AND_CONTRACT"].includes(row.case_kind));
  assert.equal(broadcast.reduce((count, row) => count + (expectedFixturePages(row) > 1 ? 2 : 1), 0), 644);
  const report = rendererReport(/^SPORTLINK-/u);
  assert.doesNotThrow(() => verifyComparisonReadbacks("sportlink", report, rows));
  report.comparisons = report.comparisons.filter(row => row.page === 0).map(row => ({...row, pages: 1}));
  report.caseCount = report.exactCount = report.comparisons.length;
  assert.throws(() => verifyComparisonReadbacks("sportlink", report, rows), /first or last page/u);
});
test("rejects default capture evidence used to claim additional menu/background variations", () => {
  const rows = parseCaseInventory(original);
  for (const [group, pattern, variation, wrong] of [
    ["menu-category-off", /^MENU-/u, "categories-off", "categories-on"],
    ["background-contain", /^TV-STATE-(?:0003|0008|0013|0018|0023|0028|0033|0038|0043|0048|0053|0058|0063|0068|0073|0078)$/u, "background-contain", "background-cover"]
  ]) {
    const report = rendererReport(pattern, variation);
    assert.doesNotThrow(() => verifyComparisonReadbacks(group, report, rows));
    report.comparisons[0].variation = wrong;
    assert.throws(() => verifyComparisonReadbacks(group, report, rows), /strict exact frame/u);
  }
});

test("S297 changed Content accepts only its explicit replacement region while preserving raw differences", () => {
  const report = chosenSyncReport();
  const content = report.results.find(row => row.originalRoute === "#/dashboard/studio");
  content.differences = [{ selector: ".vc-library-toolbar", property: "y", source: 295, current: 419 }];
  content.headingDifferences = [{ index: 1, property: "y", source: 719, current: 843 }];
  assert.doesNotThrow(() => verifySyncComparison(report, parseCaseInventory(original)));
  assert.equal(content.differences.length, 1);
  assert.equal(content.intentionalChange.pixelParity, false);
});
test("S297 replacement cannot hide missing controls, smaller targets, bad URLs or unrelated geometry", () => {
  for (const mutate of [
    row => { delete row.intentionalChange; },
    row => { row.intentionalChange.pixelParity = true; },
    row => { row.intentionalChange.controls.types.pop(); },
    row => { row.intentionalChange.controls.statuses[0].width = 35; },
    row => { row.intentionalChange.controls.types[0].fontSize = 12; },
    row => { row.intentionalChange.controls.types[0].scrollWidth = 300; },
    row => { row.intentionalChange.controls.context[0].href = "/dashboard/content"; },
    row => { row.intentionalChange.controls.statuses[0].href = "/dashboard/content?filter=menus&status=active&page=1"; },
    row => { row.intentionalChange.controls.types[0].href = "https://other.example/dashboard/content?filter=all&status=active&page=1"; },
    row => { row.intentionalChange.controls.statuses[0].href = "//other.example/dashboard/content?filter=designs&status=active&page=1"; },
    row => { row.intentionalChange.filter = "all"; },
    row => { row.criteria.contentA2Acceptance = false; },
    row => { row.differences = [{ selector: ".nav-panel", property: "width", source: 228, current: 250 }]; },
    row => { row.headingDifferences = [{ index: 0, property: "fontSize", source: "36px", current: "32px" }]; }
  ]) {
    const report = chosenSyncReport();
    mutate(report.results.find(row => row.originalRoute === "#/dashboard/studio"));
    assert.throws(() => verifySyncComparison(report, parseCaseInventory(original)), /Incomplete chosen Sync comparison/u);
  }
  const report = chosenSyncReport();
  report.results[0].intentionalChange = contentA2Proof("#/dashboard/media");
  assert.throws(() => verifySyncComparison(report, parseCaseInventory(original)), /Incomplete chosen Sync comparison/u);
});
