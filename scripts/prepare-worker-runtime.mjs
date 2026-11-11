import { constants, cpSync, existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, symlinkSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createRequire, isBuiltin } from "node:module";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

function fail(code) { throw new Error(code); }
function inside(root, path) { return path === root || path.startsWith(`${root}${sep}`); }

export function prepareWorkerRuntime({ root = process.cwd(), output } = {}) {
  root = realpathSync(root);
  if (!output || !isAbsolute(output) || resolve(output) !== output || inside(root, output)
    || inside(output, root) || lstatSync(output, { throwIfNoEntry: false })) fail("WORKER_RUNTIME_OUTPUT_INVALID");
  let ancestor = dirname(output);
  while (!existsSync(ancestor)) ancestor = dirname(ancestor);
  if (realpathSync(ancestor) !== ancestor) fail("WORKER_RUNTIME_OUTPUT_INVALID");
  const store = realpathSync(join(root, "node_modules/.pnpm"));
  if (inside(store, output) || inside(output, store)) fail("WORKER_RUNTIME_OUTPUT_INVALID");
  const sourcePath = path => {
    if (inside(store, path)) return join("node_modules/.pnpm", relative(store, path));
    if (inside(root, path)) return relative(root, path);
    fail("WORKER_RUNTIME_SOURCE_ESCAPE");
  };
  const packages = new Map(), links = new Map();
  const find = (directory, name) => {
    if (!/^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/iu.test(name)) fail("WORKER_RUNTIME_PACKAGE_INVALID");
    for (const modules of createRequire(join(directory, "package.json")).resolve.paths(`${name}/package.json`) ?? []) {
      const path = join(modules, name);
      if (existsSync(join(path, "package.json"))) {
        const target = realpathSync(path);
        sourcePath(path); sourcePath(target);
        links.set(sourcePath(path), sourcePath(target));
        return target;
      }
    }
    return null;
  };
  const visit = directory => {
    if (packages.has(directory)) return;
    sourcePath(directory);
    const manifest = JSON.parse(readFileSync(join(directory, "package.json"), "utf8"));
    if (typeof manifest.name !== "string" || typeof manifest.version !== "string") fail("WORKER_RUNTIME_PACKAGE_INVALID");
    const workspace = inside(root, directory) && !inside(store, directory);
    if (workspace && directory !== join(root, "apps/media-worker") && !inside(join(root, "packages"), directory)) fail("WORKER_RUNTIME_WORKSPACE_INVALID");
    packages.set(directory, { manifest, workspace });
    for (const name of new Set([...Object.keys(manifest.dependencies ?? {}),
      ...Object.keys(manifest.optionalDependencies ?? {}), ...Object.keys(manifest.peerDependencies ?? {})])) {
      const dependency = find(directory, name);
      if (dependency) visit(dependency);
      else if (!Object.hasOwn(manifest.optionalDependencies ?? {}, name)
        && !manifest.peerDependenciesMeta?.[name]?.optional && !isBuiltin(name)) fail("WORKER_RUNTIME_DEPENDENCY_MISSING");
    }
  };
  const worker = join(root, "apps/media-worker");
  visit(worker);
  const loader = find(worker, "tsx");
  if (!loader) fail("WORKER_RUNTIME_LOADER_MISSING");
  visit(loader);
  links.set("node_modules/tsx", sourcePath(loader));
  if (packages.get(worker).manifest.name !== "@veyocast/media-worker") fail("WORKER_RUNTIME_PACKAGE_INVALID");
  const resources = ["package.json", "tsconfig.base.json", "apps/player/public"];
  for (const entry of [...resources, "pnpm-lock.yaml"]) if (!existsSync(join(root, entry))) fail("WORKER_RUNTIME_ASSET_MISSING");
  let files = 0, bytes = 0;
  const copy = (source, destination, workspace = false) => cpSync(source, destination, {
    recursive: true, force: false, errorOnExist: true, mode: constants.COPYFILE_FICLONE,
    filter: path => {
      const local = relative(source, path).split(sep);
      if (workspace && local.some(component => component === "node_modules" || component === "__tests__"
        || /\.test\.[cm]?[jt]sx?$/u.test(component))) return false;
      const stat = lstatSync(path);
      if (stat.isSymbolicLink()) {
        links.set(sourcePath(path), sourcePath(realpathSync(path)));
        return false;
      }
      if (!stat.isDirectory() && !stat.isFile()) fail("WORKER_RUNTIME_FILE_INVALID");
      if (stat.isFile()) { files++; bytes += stat.size; }
      return true;
    }
  });
  mkdirSync(output, { recursive: true });
  for (const [directory, { workspace }] of packages) {
    const destination = join(output, sourcePath(directory));
    if (!workspace) copy(directory, destination);
    else for (const entry of ["package.json", "src", "tsconfig.json", "tsconfig.build.json"]) {
      if (existsSync(join(directory, entry))) copy(join(directory, entry), join(destination, entry), true);
    }
  }
  for (const entry of resources) {
    copy(join(root, entry), join(output, entry));
  }
  for (const [path, target] of links) {
    const destination = join(output, path), resolved = join(output, target);
    if (!existsSync(resolved)) fail("WORKER_RUNTIME_LINK_INVALID");
    mkdirSync(dirname(destination), { recursive: true });
    symlinkSync(relative(dirname(destination), resolved), destination, "dir");
  }
  const manifest = { schemaVersion: 1,
    lockfileSha256: createHash("sha256").update(readFileSync(join(root, "pnpm-lock.yaml"))).digest("hex"),
    files, bytes, packages: [...packages].map(([path, { manifest }]) => ({ name: manifest.name, version: manifest.version, path: sourcePath(path) }))
      .sort((left, right) => left.path.localeCompare(right.path)) };
  writeFileSync(join(output, "WORKER_RUNTIME_MANIFEST.json"), JSON.stringify(manifest, null, 2));
  return manifest;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const manifest = prepareWorkerRuntime({ output: process.argv[2] });
    process.stdout.write(`${JSON.stringify({ event: "worker_runtime_prepared", packages: manifest.packages.length, files: manifest.files, bytes: manifest.bytes, lockfileSha256: manifest.lockfileSha256 })}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error && /^[A-Z_]+$/u.test(error.message) ? error.message : "WORKER_RUNTIME_PREPARATION_FAILED"}\n`);
    process.exitCode = 1;
  }
}
