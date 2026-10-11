import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

// Keep every spec in the gate, while compiling only the application under test.
// Three long-lived development compilers exceeded the bounded CI host's memory.
function specs(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? specs(join(directory, entry.name))
      : entry.name.endsWith(".spec.ts") ? [join(directory, entry.name)] : []);
}
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
const selected = process.env.PLAYWRIGHT_GATE_GROUP?.split(",") ?? Object.keys(groups);
if (!selected.length || selected.some(group => !Object.hasOwn(groups, group))) {
  throw new Error("PLAYWRIGHT_GATE_GROUP must name control, player, marketing or cross.");
}
const results = process.env.PLAYWRIGHT_GATE_OUTPUT ?? join(process.env.RUNNER_TEMP ?? "/tmp", "veyocast-browser-gates");
for (const group of selected) {
  const output = join(results, group);
  mkdirSync(output, { recursive: true });
  process.stdout.write(`Browser gate: ${group}; ${groups[group].length} spec files.\n`);
  const result = spawnSync("pnpm", ["exec", "playwright", "test", ...groups[group], "--project=chromium", "--workers=1", "--timeout=60000", `--output=${output}`], {
    stdio: "inherit",
    env: {
      ...process.env,
      PLAYWRIGHT_APPS: group === "cross" ? "control,marketing,player" : group,
      // Production Player/Marketing tests exercise the built artifacts. Control's
      // intentional no-database fixture remains development-only; authenticated
      // production Control is covered separately with real disposable Supabase.
      PLAYWRIGHT_PRODUCTION_SERVERS: group === "player" || group === "marketing" ? "1" : "0",
      // Keep the guarded development fixture, using one bounded compiler for
      // the route matrix. Production builds and authenticated database gates
      // still exercise the production artifact and actual permissions.
      PLAYWRIGHT_TURBOPACK: group === "control" || group === "cross" ? "1" : "0",
      // The complete Control route gate repeatedly compiles authenticated and
      // guarded no-database routes. Give its single compiler enough heap to
      // avoid Next's automatic restarts interrupting an active navigation.
      NODE_OPTIONS: process.env.NODE_OPTIONS ?? (group === "control" ? "--max-old-space-size=3072" : "--max-old-space-size=2048")
    }
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
