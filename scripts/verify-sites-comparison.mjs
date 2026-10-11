import { readFileSync } from "node:fs";
import process from "node:process";
import { pathToFileURL, URL } from "node:url";
import { parseCaseInventory, validateCaseInventory } from "./sites-case-inventory.mjs";

// Fixed QA fixtures, independent of the production pagination helper: 12 sport
// rows / 4 per page, menu / 10 per page, and each TV overflow list spans 2 pages.
export function expectedFixturePages(row) {
  if (row.case_id.startsWith("SPORTLINK-")) return 3;
  if (row.case_id.startsWith("MENU-")) return 2;
  if (row.case_id.startsWith("TV-STATE-") && row.state === "overflow-page-2") {
    const kind = new URL(row.reference_route, "http://reference.invalid").searchParams.get("template");
    return ["welkom", "wedstrijd"].includes(kind) ? 1 : 2;
  }
  return 1;
}

const literalTemplateIds = ["landscape-hd", "portrait-hd"].flatMap(format => [
  ...["matchday", "schedule", "result", "sponsor", "menu", "activity", "volunteer", "welcome", "cancelled", "social", "emergency"].map(category => `sites-v11-${category}-${format}`),
  ...["wedstrijd", "programma", "uitslagen", "stand", "kantine", "clubnieuws", "partners", "welkom"].map(kind => `sites-v11-tv-${kind}-${format}`)
]);

export function verifyComparisonReadbacks(group, report, rows) {
if (report.sourceRevision !== "b1cae899af19fc39908217253094c5240d7359fc") throw new Error("Comparison uses an unexpected Source revision.");
if (group === "responsive") {
  const expected = rows.filter(row => row.case_id.startsWith("RESP-")).map(row => row.case_id);
  const results = report.results;
  const criteria = ["semanticTypography", "panelOrder", "typography", "images", "gutters", "activeTab", "noHorizontalOverflow", "mobileNavigation", "primaryAction"];
  if (!Array.isArray(results) || results.length !== expected.length || new Set(results.map(row => row.caseId)).size !== expected.length
    || report.sourceFilesUnchanged !== true
    || results.some(row => !expected.includes(row.caseId) || row.status !== "PASS" || row.assertionVersion !== "s191-resp-all-criteria-v3"
      || !row.criteria || criteria.some(key => row.criteria[key]?.passed !== true) || Object.values(row.criteria).some(value => value?.passed !== true))) {
    throw new Error("All 66 original responsive cases must have complete passing criteria.");
  }
} else if (group === "literal-starters") {
  const results = report.comparisons;
  if (!Array.isArray(results) || results.length !== 76 || report.exactCount !== 76 || report.differentCount !== 0
    || new Set(results.map(row => `${row.templateId}/${row.themeId}`)).size !== 76 || new Set(results.map(row => row.templateId)).size !== 38
    || results.some(row => !literalTemplateIds.includes(row.templateId) || !["fieldflow", "onzetrots-tv"].includes(row.themeId) || row.status !== "EXACT" || row.changedPixels !== 0)) {
    throw new Error("All 76 literal starter variants must have actual exact comparisons.");
  }
} else {
  const families = {
    "templates-and-tv": /^(?:TEMPLATE-|TV-)/u,
    led: /^LED-/u,
    sportlink: /^SPORTLINK-/u,
    "menu-and-youtube": /^(?:MENU-|YOUTUBE-)/u,
    "menu-category-off": /^MENU-/u,
    "background-contain": /^TV-STATE-(?:0003|0008|0013|0018|0023|0028|0033|0038|0043|0048|0053|0058|0063|0068|0073|0078)$/u
  };
  const family = families[group];
  if (!family) throw new Error("Unknown Source comparison cohort.");
  const expected = rows.filter(row => ["BROADCAST_PARITY", "BROADCAST_AND_CONTRACT"].includes(row.case_kind) && family.test(row.case_id)).map(row => row.case_id);
  const results = report.comparisons;
  const variation = group === "menu-category-off" ? "categories-off" : group === "background-contain" ? "background-contain" : null;
  if (!expected.length || report.assertionMode !== "STRICT" || !Array.isArray(results) || !results.length
    || report.caseCount !== results.length || report.exactCount !== results.length
    || results.some(row => !expected.includes(row.caseId) || row.status !== "EXACT" || row.changedPixels !== 0 || (variation !== null && row.variation !== variation))
    || new Set(results.map(row => row.caseId)).size !== expected.length || new Set(results.map(row => `${row.caseId}/${row.page}`)).size !== results.length) {
    throw new Error("Every original cohort case must have an actual strict exact frame comparison.");
  }
  for (const id of expected) {
    const frames = results.filter(row => row.caseId === id);
    const pages = expectedFixturePages(rows.find(row => row.case_id === id));
    const selectedPages = pages > 1 ? [0, pages - 1] : [0];
    if (frames.length !== selectedPages.length || frames.some(row => row.pages !== pages || !Number.isInteger(row.page) || !selectedPages.includes(row.page))
      || selectedPages.some(page => !frames.some(row => row.page === page))) {
      throw new Error(`Original case lacks its first or last page: ${id}.`);
    }
  }
}
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [group, path] = process.argv.slice(2);
  const current = readFileSync("docs/sites-v11-overname/inventory/VISUAL-CASES.csv", "utf8");
  validateCaseInventory(current, readFileSync("docs/sites-v11-overname/handoff/VISUAL-CASES.original.csv", "utf8"));
  verifyComparisonReadbacks(group, JSON.parse(readFileSync(path, "utf8")), parseCaseInventory(current));
  process.stdout.write(`Verified complete actual Source readbacks: ${group}.\n`);
}
