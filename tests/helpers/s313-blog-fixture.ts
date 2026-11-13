import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { extname, join, resolve, sep } from "node:path";

const root = process.cwd();
const reference = "docs/s313-blog-socialhero/reference/broncode/app/(marketing)/blog/_blog";
const baseline = "4f44bbdd68d22ca2aca42f01a8d68dbe1a120770";
const require = createRequire(join(root, "package.json"));
const compiler = require.resolve("esbuild", { paths: [require.resolve("tsx")] });
const fingerprint = (bytes: string | Uint8Array) => createHash("sha256").update(bytes).digest("hex");

// Native supplied React components over explicit read-only prototype content.
// Only Next Link and the server data/media transport are replaced. No source,
// build output, production storage or application state is changed by this host.
export async function startS313BlogFixture() {
  // Keep the exact inspected source available to shallow CI clones too.
  const baselineShell = await readFile(join(root, "tests/helpers/s313-blog-baseline.tsx.txt"), "utf8");
  if (fingerprint(baselineShell) !== "8c4fd87029fe19bcfcbf9136a5c14a300e48095e3074cf6400972f6d958af538") throw new Error("The recorded 4f44 shell source changed.");
  const entry = `import React from 'react';import{createRoot}from'react-dom/client';
import BaselineMarketing from 's313-baseline-shell';
import{MarketingChrome}from'./apps/marketing/app/_sync/chrome';
import{BlogIndexPage as CandidateIndex,BlogArticlePage as CandidateArticle}from'./apps/marketing/app/blog/_blog/blog-public';
import{BlogIndexPage as PrototypeIndex,BlogArticlePage as PrototypeArticle}from'./${reference}/blog-public';
import{blogDemoArticles}from'./${reference}/blog-seed';
const q=new URLSearchParams(location.search),variant=q.get('variant')||'candidate',view=q.get('view')||'index';
const ids=blogDemoArticles.map((_,index)=>'31300000-0000-4000-8000-'+String(index+1).padStart(12,'0'));
const articles=blogDemoArticles.map((post,index)=>({...post,externalId:'s313-fixture-'+index,revision:1,updatedAt:post.publishedAt,hero:{...post.hero,assetId:ids[index],src:'/api/blog/media/'+ids[index],width:1600,height:2000,type:'image/webp'},socialImage:{src:'/api/blog/media/'+ids[index]+'-og',width:1200,height:630,type:'image/jpeg'}}));
let content;
if(variant==='baseline'){content=<BaselineMarketing page='/'/>}else{const prototype=variant==='prototype',Index=prototype?PrototypeIndex:CandidateIndex,Article=prototype?PrototypeArticle:CandidateArticle,posts=prototype?blogDemoArticles:articles;content=<MarketingChrome controlOrigin='https://control.veyocast.nl'>{view==='detail'?<Article article={posts[0]} related={posts.slice(1)} canonicalUrl='https://veyocast.nl/blog/clubtv-inrichten-wedstrijddag'/>:<Index articles={posts} category={q.get('categorie')||undefined}/>}</MarketingChrome>}
window.__s313Fixture={variant,view,source:'native-component-fixture',articleCount:articles.length};createRoot(document.getElementById('root')).render(content);`;
  const program = `const {build}=require(${JSON.stringify(compiler)});const path=require('node:path');const root=${JSON.stringify(root)};const output=await build({stdin:{contents:${JSON.stringify(entry)},resolveDir:root,loader:'tsx'},nodePaths:[root+'/apps/marketing/node_modules',root+'/node_modules/.pnpm/node_modules'],bundle:true,write:false,outfile:'s313-fixture.js',platform:'browser',format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},loader:{'.module.css':'local-css','.css':'css'},plugins:[{name:'readonly-fixture-boundaries',setup(b){b.onResolve({filter:/^\\//},()=>({external:true}));b.onResolve({filter:/^s313-baseline-shell$/},()=>({path:'baseline',namespace:'baseline'}));b.onLoad({filter:/.*/,namespace:'baseline'},()=>({contents:${JSON.stringify(baselineShell)},resolveDir:root+'/apps/marketing/app/_sync',loader:'tsx'}));b.onResolve({filter:/inquiry-form$/},()=>({path:'unused-form',namespace:'unused'}));b.onLoad({filter:/.*/,namespace:'unused'},()=>({contents:'export function DemoForm(){throw Error("Form is outside this read-only fixture")}',loader:'js'}));b.onResolve({filter:/blog-source$/},()=>({path:'blog-transport',namespace:'data'}));b.onLoad({filter:/.*/,namespace:'data'},()=>({contents:'export const blogImageUrl=id=>"/api/blog/media/"+encodeURIComponent(id)',loader:'js'}));b.onResolve({filter:/^next\\/navigation$/},()=>({path:'navigation',namespace:'navigation'}));b.onLoad({filter:/.*/,namespace:'navigation'},()=>({contents:'export function usePathname(){return "/blog"}',loader:'js'}));b.onResolve({filter:/^next\\/link$/},()=>({path:'link',namespace:'link'}));b.onLoad({filter:/.*/,namespace:'link'},()=>({contents:'import React from "react";export default function Link(props){return React.createElement("a",props)}',resolveDir:root+'/apps/marketing',loader:'js'}));}}]});process.stdout.write(JSON.stringify({js:output.outputFiles.find(f=>f.path.endsWith('.js')).text,css:output.outputFiles.find(f=>f.path.endsWith('.css')).text}));`;
  let serialized: string;
  try {
    serialized = execFileSync(process.execPath, ["-e", `(async()=>{${program}})().catch(error=>{console.error(error.message);process.exitCode=1})`], { cwd: root, encoding: "utf8", timeout: 60_000, maxBuffer: 32 * 1024 * 1024 });
  } catch {
    throw new Error("The read-only S313 componentfixture did not compile; see the compiler diagnostics above.");
  }
  const bundle = JSON.parse(serialized) as { js: string; css: string };
  const tokens = await readFile(join(root, "tokens/veyocast-design-tokens.css"), "utf8");
  const globals = (await readFile(join(root, "apps/marketing/app/globals.css"), "utf8")).replace(/^@import[^;]+;/gmu, "");
  const preflight = await readFile(require.resolve("tailwindcss/preflight.css", { paths: [join(root, "apps/marketing")] }), "utf8");
  const sharedCss = await Promise.all(["runtime", "accessibility", "retained"].map((name) => readFile(join(root, `apps/marketing/app/_sync/${name}.css`), "utf8")));
  const css = [preflight, tokens, globals, ...sharedCss, bundle.css].join("\n");
  const photos = ["FF-PHOTO-04-matchday-live-4x5.webp", "FF-PHOTO-05-sponsor-hub-4x5.webp", "FF-PHOTO-08-portrait-entrance-4x5.webp"];
  const social = ["clubtv-wedstrijddag-og.jpg", "sponsoren-clubscherm-og.jpg", "schermen-clubhuis-og.jpg"];
  const publicRoots = [join(root, "apps/marketing/public"), join(root, "docs/s313-blog-socialhero/reference/broncode/public")];
  const mime: Record<string, string> = { ".svg": "image/svg+xml", ".webp": "image/webp", ".jpg": "image/jpeg", ".png": "image/png", ".woff2": "font/woff2", ".ttf": "font/ttf" };
  const html = '<!doctype html><html lang="nl-NL" data-design-system="fieldflow"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>VeyoCast S313 native componentfixture</title><link rel="stylesheet" href="/s313.css"></head><body><div id="root"></div><script src="/s313.js"></script></body></html>';
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
    if (!["GET", "HEAD"].includes(request.method ?? "")) { response.writeHead(405, headers).end(); return; }
    if (url.pathname === "/s313.js" || url.pathname === "/s313.css") {
      response.writeHead(200, { ...headers, "Content-Type": url.pathname.endsWith("js") ? "text/javascript" : "text/css" }).end(request.method === "HEAD" ? undefined : url.pathname.endsWith("js") ? bundle.js : css); return;
    }
    let path = url.pathname;
    const match = /^\/api\/blog\/media\/31300000-0000-4000-8000-(\d{12})(-og)?$/u.exec(path);
    if (match) { const index = Number(match[1]) - 1; path = match[2] ? `/blog-assets/${social[index]}` : `/fieldflow/photos/${photos[index]}`; }
    if (path.startsWith("/assets/") || path.startsWith("/fieldflow/") || path.startsWith("/blog-assets/")) {
      for (const publicRoot of publicRoots) {
        const target = resolve(publicRoot, `.${path}`);
        if (!target.startsWith(publicRoot + sep) || !mime[extname(target)]) continue;
        try { const bytes = await readFile(target); response.writeHead(200, { ...headers, "Content-Type": mime[extname(target)]! }).end(request.method === "HEAD" ? undefined : bytes); return; } catch { /* Fall through to the isolated prototype asset root. */ }
      }
      response.writeHead(404, headers).end(); return;
    }
    response.writeHead(200, { ...headers, "Content-Type": "text/html" }).end(request.method === "HEAD" ? undefined : html);
  });
  await new Promise<void>((ready) => server.listen(0, "127.0.0.1", ready));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Fixture server has no TCP address.");
  return {
    origin: `http://127.0.0.1:${address.port}`,
    provenance: { type: "native-component-fixture", baselineCommit: baseline, baselineShellSha256: fingerprint(baselineShell), candidateShellSha256: fingerprint(await readFile(join(root, "apps/marketing/app/_sync/Marketing.tsx"))), prototypeComponentSha256: fingerprint(await readFile(join(root, reference, "blog-public.tsx"))), prototypeDatasetSha256: fingerprint(await readFile(join(root, reference, "blog-seed.ts"))), cssSha256: fingerprint(css), note: "Actual React source with read-only data and media transport; Next Link rendered as native anchor. Tailwind preflight plus unchanged canonical/global/runtime/accessibility/retained CSS. Not a Next runtime or database acceptance proof." },
    close: () => new Promise<void>((done, reject) => { server.closeAllConnections(); server.close((error) => error ? reject(error) : done()); })
  };
}
