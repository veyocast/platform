import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { resolve, sep } from "node:path";
import { fileURLToPath, URL } from "node:url";
import process from "node:process";
import { clearTimeout, setTimeout } from "node:timers";

// Test-only chosen Sync 8b1fdf Source runtime. No provider, auth or mutable production
// service is connected. Source JSX/CSS and all locked asset bytes stay intact.
const repository = fileURLToPath(new URL("../../", import.meta.url));
const source = resolve(repository, "docs/sync-v1-rebuild/handoff/reference/sites-sync");
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
const lifetime = setTimeout(() => shutdown(), 45 * 60_000);
try {
  const packageRoot=resolve(repository,"docs/sync-v1-rebuild/handoff");
  const handoff=JSON.parse(await readFile(resolve(packageRoot,"manifests/sites-files.json"),"utf8"));
  const revision="8b1fdf1f8637dda23d48ecdaf08e0e5978e2707a";
  if(handoff.sources.find(item=>item.source==="sites-sync")?.commit!==revision)throw new Error("Unexpected chosen Sync revision");
  const files=handoff.files.filter(file=>file.path.startsWith("reference/sites-sync/"));
  if(files.length!==60)throw new Error("Chosen Sync inventory must contain all 60 files");
  const assets=new Map();
  const mime={"webp":"image/webp","png":"image/png","svg":"image/svg+xml","woff2":"font/woff2","ttf":"font/ttf","ico":"image/x-icon","txt":"text/plain"};
  for(const file of files){
    const path=resolve(packageRoot,file.path);
    if(!path.startsWith(source+sep))throw new Error("Invalid chosen Sync path");
    const bytes=await readFile(path);
    if(bytes.length!==file.bytes||createHash("sha256").update(bytes).digest("hex")!==file.sha256)throw new Error("Chosen Sync checksum mismatch: "+file.path);
    const publicPrefix="reference/sites-sync/public/";
    if(file.path.startsWith(publicPrefix)){
      const extension=file.path.split(".").at(-1),mimeType=mime[extension];
      if(mimeType)assets.set("/"+file.path.slice(publicPrefix.length),{bytes,mimeType});
    }
  }
  const output = await build({
    stdin:{contents:`import './src/main';import{createElement}from'react';import{createRoot}from'react-dom/client';import{EmptyState}from'./src/ui';
// The prototype has no zero-row branch on Sources/Support. For those explicit
// production states, compare its unchanged shared EmptyState component too.
window.__veyocastReferenceEmpty=(props)=>{if(!['Plug','MessageSquare'].includes(props.icon)||typeof props.title!=='string'||props.title.length>160||typeof props.description!=='string'||props.description.length>512)throw Error('Invalid readonly reference state');const admin=document.querySelector('.admin-page');const anchor=props.icon==='Plug'?admin?.querySelector('.ad-source-grid'):null;const parent=props.icon==='MessageSquare'?admin?.querySelector('.ad-ticket-list'):admin;if(!parent||parent.querySelector('.empty'))throw Error('Unexpected reference state');const host=document.createElement('div');host.dataset.sourceEmptyReference='true';if(anchor)anchor.after(host);else parent.append(host);createRoot(host).render(createElement(EmptyState,props));};`,resolveDir:source,loader:"tsx"},
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
    const item = asset ?? (path === "/reference.js" ? { bytes: javascript, mimeType: "text/javascript" } : path === "/reference.css" ? { bytes: stylesheet, mimeType: "text/css" } : path === "/" ? { bytes: '<!doctype html><html lang="nl" data-design-system="sync"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>VeyoCast chosen Sync Source reference</title><link rel="stylesheet" href="/reference.css"></head><body><div id="root"></div><script src="/reference.js"></script></body></html>', mimeType: "text/html" } : null);
    if (!item) { response.writeHead(404, headers); response.end(); return; }
    response.writeHead(200, { ...headers, "Content-Type": item.mimeType });
    response.end(request.method === "HEAD" ? undefined : item.bytes);
  });
  server.requestTimeout = 30_000;
  server.headersTimeout = 10_000;
  server.keepAliveTimeout = 1000;
  server.once("error", error => { process.stderr.write(`Original Source server failed: ${error.code ?? "UNKNOWN"}.\n`); shutdown(1); });
  server.listen(port, "127.0.0.1", () => process.stdout.write(JSON.stringify({ status: "ready", origin: `http://127.0.0.1:${port}`, sourceRevision:revision,verifiedSourceFiles: files.length, verifiedAssets: assets.size }) + "\n"));
} catch (error) {
  process.stderr.write(`Original Source runtime failed: ${error.message}.\n`);
  shutdown(1);
}
