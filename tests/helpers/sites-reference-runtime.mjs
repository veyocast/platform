import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { resolve, sep } from "node:path";
import { fileURLToPath, URL } from "node:url";
import process from "node:process";
import { clearTimeout, setTimeout } from "node:timers";

// Test-only original Source runtime. No provider, auth or mutable production
// service is connected. Source JSX/CSS and all locked asset bytes stay intact.
const repository = fileURLToPath(new URL("../../", import.meta.url));
const source = resolve(repository, "docs/sites-v11-overname/reference/sites");
const require = createRequire(resolve(repository, "package.json"));
const { build, stop } = require(require.resolve("esbuild", { paths: [require.resolve("tsx")] }));
const argumentsList = process.argv.slice(2);
const portIndex = argumentsList.indexOf("--port");
const port = Number(portIndex === -1 ? 4193 : argumentsList[portIndex + 1]);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Expected --port 1024..65535.");
let server;
let closing = false;
function shutdown(code = 0) {
  if (closing) return;
  closing = true;
  clearTimeout(buildDeadline);
  clearTimeout(lifetime);
  stop();
  if (!server) process.exit(code);
  server.close(() => process.exit(code));
  server.closeAllConnections();
  setTimeout(() => process.exit(code), 1000).unref();
}
process.once("SIGTERM", () => shutdown());
process.once("SIGINT", () => shutdown());
const buildDeadline = setTimeout(() => {
  process.stderr.write("Original Source verification/build exceeded 30 seconds.\n");
  shutdown(1);
}, 30_000);
const lifetime = setTimeout(() => shutdown(), 15 * 60_000);
try {
  const handoff = JSON.parse(await readFile(resolve(repository, "docs/sites-v11-overname/handoff/MANIFEST-SHA256.json"), "utf8"));
  const files = handoff.files.filter(record => record.path.startsWith("source/sites/"));
  if (files.length !== 253) throw new Error("Original Source inventory must contain exactly 253 files.");
  for (const file of files) {
    const path = resolve(source, file.path.slice("source/sites/".length));
    if (!path.startsWith(source + sep)) throw new Error("Invalid original Source path.");
    const bytes = await readFile(path);
    if (bytes.length !== file.size || createHash("sha256").update(bytes).digest("hex") !== file.sha256) throw new Error(`Original Source checksum mismatch: ${file.path}`);
  }
  const audited = JSON.parse(await readFile(resolve(repository, "docs/sites-v11-overname/system-assets.json"), "utf8"));
  const assets = new Map();
  for (const asset of audited.files) {
    const path = resolve(source, "public", asset.path.slice(1));
    if (!path.startsWith(resolve(source, "public") + sep)) throw new Error("Invalid audited asset path.");
    const bytes = await readFile(path);
    if (bytes.length !== asset.bytes || createHash("sha256").update(bytes).digest("hex") !== asset.sha256) throw new Error(`Original asset checksum mismatch: ${asset.path}`);
    assets.set(asset.path, { bytes, mimeType: asset.mimeType });
  }
  if (assets.size !== 82) throw new Error("Expected all 82 original locked system assets.");
  const output = await build({
    stdin: { contents: `import React from 'react';import{createRoot}from'react-dom/client';import{Prototype}from'./app/prototype/app';import './app/globals.css';createRoot(document.getElementById('root')).render(React.createElement(Prototype));`, resolveDir: source, loader: "tsx" },
    nodePaths: [resolve(repository, "apps/control/node_modules")],
    bundle: true, write: false, outfile: "reference.js", platform: "browser", format: "iife", jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' },
    loader: { ".module.css": "local-css", ".css": "css" },
    plugins: [{ name: "preserve-original-absolute-asset-urls", setup(builder) { builder.onResolve({ filter: /^\// }, () => ({ external: true })); } }]
  });
  const javascript = output.outputFiles.find(file => file.path.endsWith(".js"))?.contents;
  const stylesheet = output.outputFiles.find(file => file.path.endsWith(".css"))?.contents;
  if (!javascript || !stylesheet) throw new Error("Original Source build omitted JavaScript or CSS.");
  clearTimeout(buildDeadline);
  server = createServer((request, response) => {
    const path = new URL(request.url ?? "/", `http://127.0.0.1:${port}`).pathname;
    const asset = assets.get(path);
    const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
    if (request.method !== "GET" && request.method !== "HEAD") { response.writeHead(405, headers); response.end(); return; }
    const item = asset ?? (path === "/reference.js" ? { bytes: javascript, mimeType: "text/javascript" } : path === "/reference.css" ? { bytes: stylesheet, mimeType: "text/css" } : path === "/" ? { bytes: '<!doctype html><html lang="nl" data-design-system="fieldflow"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>VeyoCast original Source reference</title><link rel="stylesheet" href="/reference.css"></head><body><div id="root"></div><script src="/reference.js"></script></body></html>', mimeType: "text/html" } : null);
    if (!item) { response.writeHead(404, headers); response.end(); return; }
    response.writeHead(200, { ...headers, "Content-Type": item.mimeType });
    response.end(request.method === "HEAD" ? undefined : item.bytes);
  });
  server.requestTimeout = 30_000;
  server.headersTimeout = 10_000;
  server.keepAliveTimeout = 1000;
  server.once("error", error => { process.stderr.write(`Original Source server failed: ${error.code ?? "UNKNOWN"}.\n`); shutdown(1); });
  server.listen(port, "127.0.0.1", () => process.stdout.write(JSON.stringify({ status: "ready", origin: `http://127.0.0.1:${port}`, verifiedSourceFiles: files.length, verifiedAssets: assets.size }) + "\n"));
} catch (error) {
  process.stderr.write(`Original Source runtime failed: ${error.message}.\n`);
  shutdown(1);
}
