import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import test from "node:test";
import { prepareWorkerRuntime } from "./prepare-worker-runtime.mjs";

function fixture(run) {
  const temporary = mkdtempSync(join(tmpdir(), "veyocast-worker-runtime-"));
  const root = join(temporary, "source"), output = join(temporary, "runtime");
  const file = (path, contents = "original bytes") => { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), contents); };
  const manifest = (path, value) => file(`${path}/package.json`, JSON.stringify(value));
  const link = (path, target) => { mkdirSync(dirname(join(root, path)), { recursive: true }); symlinkSync(relative(dirname(join(root, path)), join(root, target)), join(root, path)); };
  manifest("", { name: "workspace", version: "1.0.0", private: true });
  file("pnpm-lock.yaml", "locked exact dependency versions\n");
  file("tsconfig.base.json", "{\"compilerOptions\":{\"jsx\":\"react-jsx\"}}");
  file("apps/player/public/fonts/approved.ttf"); file("apps/player/public/themes/locked.png");
  manifest("apps/media-worker", { name: "@veyocast/media-worker", version: "1.0.0", type: "module",
    dependencies: { "@veyocast/contracts": "workspace:*", runtime: "1.0.0" }, devDependencies: { tsx: "1.0.0", vitest: "1.0.0" } });
  file("apps/media-worker/src/index.ts", "export const worker = true;");
  file("apps/media-worker/src/index.test.ts"); file("apps/media-worker/test/private-fixture.json");
  manifest("packages/contracts", { name: "@veyocast/contracts", version: "1.0.0", type: "module", exports: { ".": "./src/index.js" }, dependencies: { runtime: "1.0.0" } });
  file("packages/contracts/src/index.js", "export const contract = 'retained';");
  file("packages/contracts/src/schema.json", "{\"retained\":true}");
  file("packages/contracts/src/index.test.ts");
  manifest("node_modules/.pnpm/runtime@1/node_modules/runtime", { name: "runtime", version: "1.0.0", main: "index.js", dependencies: { leaf: "1.0.0" }, optionalDependencies: { "unsupported-platform": "1.0.0" }, peerDependencies: { "optional-peer": "1.0.0" }, peerDependenciesMeta: { "optional-peer": { optional: true } } });
  file("node_modules/.pnpm/runtime@1/node_modules/runtime/index.js", "module.exports = require('leaf');");
  file("node_modules/.pnpm/runtime@1/node_modules/runtime/native.node");
  manifest("node_modules/.pnpm/leaf@1/node_modules/leaf", { name: "leaf", version: "1.0.0", main: "index.js", dependencies: { runtime: "1.0.0" } });
  file("node_modules/.pnpm/leaf@1/node_modules/leaf/index.js", "module.exports = 'leaf';");
  manifest("node_modules/.pnpm/tsx@1/node_modules/tsx", { name: "tsx", version: "1.0.0", main: "index.js" });
  file("node_modules/.pnpm/tsx@1/node_modules/tsx/index.js", "module.exports = 'loader';");
  manifest("node_modules/.pnpm/vitest@1/node_modules/vitest", { name: "vitest", version: "1.0.0" });
  file("apps/control/server-secret.ts"); file("docs/large-evidence.bin"); file(".env.production", "not for runtime packaging");
  link("apps/media-worker/node_modules/@veyocast/contracts", "packages/contracts");
  link("apps/media-worker/node_modules/runtime", "node_modules/.pnpm/runtime@1/node_modules/runtime");
  link("apps/media-worker/node_modules/tsx", "node_modules/.pnpm/tsx@1/node_modules/tsx");
  link("apps/media-worker/node_modules/vitest", "node_modules/.pnpm/vitest@1/node_modules/vitest");
  link("packages/contracts/node_modules/runtime", "node_modules/.pnpm/runtime@1/node_modules/runtime");
  link("node_modules/.pnpm/runtime@1/node_modules/leaf", "node_modules/.pnpm/leaf@1/node_modules/leaf");
  link("node_modules/.pnpm/leaf@1/node_modules/runtime", "node_modules/.pnpm/runtime@1/node_modules/runtime");
  try { return run({ root, output, temporary, file, manifest, link, prepare: () => prepareWorkerRuntime({ root, output }) }); }
  finally { rmSync(temporary, { recursive: true, force: true }); }
}

test("copies only the installed runtime closure, real source, native bytes, fonts and assets", () => fixture(({ root, output, prepare }) => {
  const manifest = prepare();
  assert.equal(manifest.packages.length, 5);
  assert.deepEqual(manifest.packages.map(entry => entry.name).sort(), ["@veyocast/contracts", "@veyocast/media-worker", "leaf", "runtime", "tsx"]);
  for (const path of ["apps/media-worker/src/index.ts", "packages/contracts/src/schema.json", "apps/player/public/fonts/approved.ttf",
    "apps/player/public/themes/locked.png", "node_modules/.pnpm/runtime@1/node_modules/runtime/native.node"]) {
    assert.deepEqual(readFileSync(join(output, path)), readFileSync(join(root, path)));
  }
  for (const path of ["apps/control", "docs", ".env.production", "apps/media-worker/src/index.test.ts", "apps/media-worker/test",
    "packages/contracts/src/index.test.ts", "node_modules/.pnpm/vitest@1"]) assert.equal(existsSync(join(output, path)), false, path);
  assert.equal(manifest.lockfileSha256, createHash("sha256").update(readFileSync(join(root, "pnpm-lock.yaml"))).digest("hex"));
  assert.deepEqual(JSON.parse(readFileSync(join(output, "WORKER_RUNTIME_MANIFEST.json"))), manifest);
}));

test("the isolated graph resolves transitive cycles, scoped exports and the root TS loader without the source", () => fixture(({ root, output, prepare }) => {
  prepare(); rmSync(root, { recursive: true });
  const require = createRequire(join(output, "apps/media-worker/package.json"));
  assert.equal(require("runtime"), "leaf");
  assert.ok(require.resolve("@veyocast/contracts").startsWith(output));
  assert.equal(createRequire(join(output, "package.json"))("tsx"), "loader");
  assert.equal(realpathSync(join(output, "apps/media-worker/node_modules/@veyocast/contracts")), join(output, "packages/contracts"));
}));

test("preserves supported optional dependencies and peer bindings without copying absent platform binaries", () => fixture(({ manifest, file, link, prepare }) => {
  manifest("node_modules/.pnpm/peer@1/node_modules/optional-peer", { name: "optional-peer", version: "1.0.0" });
  file("node_modules/.pnpm/peer@1/node_modules/optional-peer/index.js");
  link("node_modules/.pnpm/runtime@1/node_modules/optional-peer", "node_modules/.pnpm/peer@1/node_modules/optional-peer");
  const result = prepare();
  assert.ok(result.packages.some(entry => entry.name === "optional-peer"));
  assert.equal(result.packages.some(entry => entry.name === "unsupported-platform"), false);
}));

test("required missing dependencies fail before creating runtime output", () => fixture(({ root, output, manifest, prepare }) => {
  manifest("node_modules/.pnpm/runtime@1/node_modules/runtime", { name: "runtime", version: "1.0.0", dependencies: { missing: "1.0.0" } });
  assert.throws(prepare, /WORKER_RUNTIME_DEPENDENCY_MISSING/);
  assert.equal(existsSync(output), false);
  assert.equal(existsSync(join(root, "apps/media-worker/src/index.ts")), true);
}));

test("package metadata exports do not interfere with dependency closure discovery", () => fixture(({ manifest, prepare }) => {
  manifest("node_modules/.pnpm/leaf@1/node_modules/leaf", { name: "leaf", version: "1.0.0", exports: { ".": "./index.js" } });
  assert.ok(prepare().packages.some(entry => entry.name === "leaf"));
}));

test("preserves the exact installed virtual store even when the local store is shared outside the checkout", () => fixture(({ root, output, temporary, prepare }) => {
  const store = join(root, "node_modules/.pnpm"), shared = join(temporary, "shared-store");
  renameSync(store, shared); symlinkSync(shared, store);
  prepare(); rmSync(root, { recursive: true }); rmSync(shared, { recursive: true });
  assert.equal(createRequire(join(output, "apps/media-worker/package.json"))("runtime"), "leaf");
}));

test("declared npm packages sharing a builtin name retain their actual installed implementation", () => fixture(({ root, output, manifest, file, link, prepare }) => {
  manifest("node_modules/.pnpm/runtime@1/node_modules/runtime", { name: "runtime", version: "1.0.0", dependencies: { buffer: "1.0.0" } });
  manifest("node_modules/.pnpm/buffer@1/node_modules/buffer", { name: "buffer", version: "1.0.0", main: "index.js" });
  file("node_modules/.pnpm/buffer@1/node_modules/buffer/index.js", "module.exports = 'npm-buffer';");
  link("node_modules/.pnpm/runtime@1/node_modules/buffer", "node_modules/.pnpm/buffer@1/node_modules/buffer");
  assert.ok(prepare().packages.some(entry => entry.name === "buffer"));
  rmSync(root, { recursive: true });
  assert.equal(createRequire(join(output, "node_modules/.pnpm/runtime@1/node_modules/runtime/package.json"))("buffer/"), "npm-buffer");
}));

test("rejects missing loaders, wrong worker identity and malformed dependency names", () => {
  for (const scenario of ["loader", "identity", "dependency"]) fixture(({ root, output, manifest, prepare }) => {
    if (scenario === "loader") rmSync(join(root, "apps/media-worker/node_modules/tsx"));
    if (scenario === "identity") manifest("apps/media-worker", { name: "wrong", version: "1.0.0" });
    if (scenario === "dependency") manifest("apps/media-worker", { name: "@veyocast/media-worker", version: "1.0.0", dependencies: { "../outside": "1.0.0" } });
    assert.throws(prepare, /WORKER_RUNTIME_(LOADER_MISSING|PACKAGE_INVALID)/);
    assert.equal(existsSync(output), false);
  });
});

test("missing required public assets or lockfile never creates a partial output", () => {
  for (const entry of ["apps/player/public", "tsconfig.base.json", "pnpm-lock.yaml"]) fixture(({ root, output, prepare }) => {
    rmSync(join(root, entry), { recursive: true });
    assert.throws(prepare, /WORKER_RUNTIME_ASSET_MISSING/);
    assert.equal(existsSync(output), false);
  });
});

test("rejects output collisions, source overlap, traversal and symlinked ancestors", () => fixture(({ root, output, temporary }) => {
  mkdirSync(output);
  symlinkSync(root, join(temporary, "source-alias"));
  for (const path of [output, root, join(root, "out"), temporary, "relative", `${output}/../elsewhere`, join(temporary, "source-alias/out")]) {
    assert.throws(() => prepareWorkerRuntime({ root, output: path }), /WORKER_RUNTIME_OUTPUT_INVALID/);
  }
}));

test("rejects dependency symlinks escaping the repository and installed virtual store", () => fixture(({ root, output, temporary, manifest }) => {
  const outside = join(temporary, "untrusted"); mkdirSync(outside);
  writeFileSync(join(outside, "package.json"), JSON.stringify({ name: "escape", version: "1.0.0" }));
  manifest("apps/media-worker", { name: "@veyocast/media-worker", version: "1.0.0", dependencies: { escape: "1.0.0" } });
  symlinkSync(outside, join(root, "apps/media-worker/node_modules/escape"));
  assert.throws(() => prepareWorkerRuntime({ root, output }), /WORKER_RUNTIME_SOURCE_ESCAPE/);
  assert.equal(existsSync(output), false);
}));

test("Docker keeps all web builds and runtime commands but copies only the prepared Worker runtime", () => {
  const dockerfile = readFileSync("infra/production/Dockerfile", "utf8");
  assert.match(dockerfile, /FROM dependencies AS worker-runtime\nRUN node scripts\/prepare-worker-runtime.mjs \/runtime/);
  const worker = dockerfile.split("FROM base AS media-worker\n")[1];
  assert.match(worker, /ca-certificates chromium ffmpeg/);
  assert.match(worker, /COPY --chown=node:node --from=worker-runtime \/runtime \/app/);
  assert.doesNotMatch(worker, /--from=dependencies \/app/);
  assert.match(worker, /USER node\nCMD \["node", "--import", "tsx", "apps\/media-worker\/src\/index.ts", "--loop"\]/);
  for (const app of ["control", "player", "marketing"]) assert.ok(dockerfile.includes(`pnpm --filter @veyocast/${app} build`));
});
