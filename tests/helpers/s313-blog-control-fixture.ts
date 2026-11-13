import {execFileSync} from "node:child_process";
import {createHash, randomUUID} from "node:crypto";
import {readFile} from "node:fs/promises";
import {createServer} from "node:http";
import {createRequire} from "node:module";
import {extname, join, resolve, sep} from "node:path";

import {validateArticleDraft, type BlogEntry} from "../../packages/blog/src/index";
import {blogDemoArticles} from "../../docs/s313-blog-socialhero/reference/broncode/app/(marketing)/blog/_blog/blog-seed";

const root=process.cwd();
const reference="docs/s313-blog-socialhero/reference/broncode/app/(shell)/dashboard/blog/_components";
const require=createRequire(join(root,"package.json"));
const compiler=require.resolve("esbuild",{paths:[require.resolve("tsx")]});
const fingerprint=(bytes:string|Uint8Array)=>createHash("sha256").update(bytes).digest("hex");

/** Native UI/browser acceptance only. All API, media and session boundaries are
 * explicit, isolated fixtures; this host cannot prove Auth, RLS or DB behavior. */
export async function startS313BlogControlFixture(){
  const ids=blogDemoArticles.map((_,index)=>`31310000-0000-4000-8000-${String(index+1).padStart(12,"0")}`);
  const shareIds=ids.map(id=>id.replace("31310000","31320000"));
  const seeds:BlogEntry[]=blogDemoArticles.map((article,index)=>({
    id:ids[index]!,externalId:`s313-control-fixture-${index}`,draftRevision:1,publishedRevision:1,
    publishedSlug:article.slug,publicUrl:`https://veyocast.nl/blog/${article.slug}`,
    publishedAt:article.publishedAt,updatedAt:article.publishedAt,
    draft:validateArticleDraft({type:article.type,locale:article.locale,title:article.title,slug:article.slug,excerpt:article.excerpt,
      content:article.content,seoTitle:article.seoTitle,seoDescription:article.seoDescription,authorId:"redactie",
      categoryId:article.category,tags:article.tags,hero:{assetId:ids[index]!,alt:article.hero.alt,
        focalPoint:{x:article.hero.x,y:article.hero.y}},ogImageAssetId:shareIds[index]!})
  }));
  const prototypeEntries=blogDemoArticles.map((article,index)=>{
    const {publishedAt,...draft}=article;
    return {id:ids[index],draft,live:draft,revision:1,publishedRevision:1,publishedAt,updatedAt:publishedAt,source:"manual"};
  });
  let entries=structuredClone(seeds);
  const receipts=new Map<string,BlogEntry>();
  const uploads=new Map<string,{bytes:Uint8Array;type:string}>();
  const calls:Array<{method:string;path:string;body?:unknown}>=[];
  const entry=`import React from'react';import{createRoot}from'react-dom/client';
import{getCapabilitiesForRoles}from'@veyocast/auth';
import{ControlShell}from'./apps/control/app/(shell)/_components/control-shell';
import{getNavigationGroupsForRoles}from'./apps/control/app/(shell)/_lib/control-navigation';
import{BlogAdmin}from'./apps/control/app/(shell)/platform/blog/_components/blog-admin';
import{BlogDocument}from'./apps/control/app/(shell)/platform/blog/_components/blog-editor';
import{BlogAdmin as PrototypeAdmin}from'./${reference}/blog-admin';
const variant=new URLSearchParams(location.search).get('variant')||'candidate';
window.__s313Path=variant==='baseline'?'/platform/system':'/platform/blog';
const capabilities=getCapabilitiesForRoles(['platform_owner']);
const session={assuranceLevel:'aal2',nextAssuranceLevel:'aal2',capabilities,email:'redactie@voorbeeld.invalid',isLive:true,organization:'VeyoCast platform',roles:['platform_owner'],tenant:'',tenantId:null,tenantMemberships:[],tenantRoleLabel:'Platformbeheerder',tenantSlug:null,tenantStatus:null,timezoneName:'Europe/Amsterdam',userId:'31310000-0000-4000-8000-000000000100',userName:'VeyoCast redactie'};
let navigation=getNavigationGroupsForRoles(capabilities);if(variant==='baseline')navigation=navigation.map(group=>({...group,items:group.items.filter(item=>item.href!=='/platform/blog')}));
async function main(){const response=await fetch('/api/platform/blog');const {entries}=await response.json();let content=variant==='baseline'?<section><h1>Systeem</h1><p>Bestaande toepassingsshell · expliciete browserfixture.</p></section>:variant==='prototype'?<PrototypeAdmin initialEntries={${JSON.stringify(prototypeEntries)}} canonicalOrigin='https://veyocast.nl'/>:variant==='render'?<section><h1>Opgeslagen artikel</h1><BlogDocument content={entries[0].draft.content}/></section>:<BlogAdmin initialEntries={entries} canonicalOrigin='https://veyocast.nl' canWrite={variant!=='readonly'} canPublish={variant!=='readonly'}/>;
createRoot(document.getElementById('root')).render(<ControlShell session={session} navigationGroups={navigation}uploadQueue={[]}visualQaEnabled={false}>{content}</ControlShell>)}main().catch(error=>{document.getElementById('root').textContent=error.message});`;
  const program=String.raw`const{build}=require(${JSON.stringify(compiler)}),fs=require('node:fs'),path=require('node:path');const result=await build({stdin:{contents:${JSON.stringify(entry)},resolveDir:process.cwd(),loader:'tsx'},nodePaths:[process.cwd()+'/apps/control/node_modules',process.cwd()+'/node_modules/.pnpm/node_modules'],bundle:true,alias:{'@tiptap/react':process.cwd()+'/apps/control/node_modules/@tiptap/react'},write:false,outfile:'s313-control.js',platform:'browser',format:'iife',jsx:'automatic',loader:{'.module.css':'local-css','.css':'css'},define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'isolated-browser-boundaries',setup(b){b.onLoad({filter:/reference.*blog-editor\.tsx$/},a=>({contents:fs.readFileSync(a.path,'utf8').replace('    immediatelyRender: false,','    immediatelyRender: false, onCreate: ({editor}) => {editor.commands.setMeta("s313-fixture-mount",true)},'),loader:'tsx'}));b.onResolve({filter:/^\//},()=>({external:true}));b.onResolve({filter:/^next\/(navigation|link|image)$/},a=>({path:a.path,namespace:'next'}));b.onLoad({filter:/.*/,namespace:'next'},a=>({contents:a.path.endsWith('navigation')?'export const usePathname=()=>window.__s313Path;export const useSearchParams=()=>new URLSearchParams(location.search);export const useRouter=()=>({push(){},replace(){},refresh(){}});':'import React from"react";export default function View({children,priority,unoptimized,fill,...props}){return React.createElement('+JSON.stringify(a.path.endsWith('image')?'img':'a')+',props,children)}',resolveDir:process.cwd(),loader:'js'}));b.onResolve({filter:/actions$/},a=>{const file=path.resolve(a.resolveDir,a.path)+'.ts';return fs.existsSync(file)?{path:file,namespace:'commands'}:undefined});b.onLoad({filter:/.*/,namespace:'commands'},a=>({contents:[...fs.readFileSync(a.path,'utf8').matchAll(/export (?:async )?function (\w+)/g)].map(x=>'export async function '+x[1]+'(){throw Error("Server action is outside the isolated browserfixture");}').join(';'),loader:'js'}));}}]});process.stdout.write(JSON.stringify({js:result.outputFiles.find(x=>x.path.endsWith('.js')).text,css:result.outputFiles.find(x=>x.path.endsWith('.css')).text}));`;
  const bundle=JSON.parse(execFileSync(process.execPath,["-e",`(async()=>{${program}})().catch(error=>{console.error(error.message);process.exitCode=1})`],{cwd:root,encoding:"utf8",timeout:60_000,maxBuffer:32*1024*1024})) as {js:string;css:string};
  const cssFiles=["tokens/veyocast-design-tokens.css","packages/ui/src/styles.css","apps/control/app/globals.css","apps/control/app/fieldflow.css","apps/control/app/sync-source.css","apps/control/app/sync-adapter.css","apps/control/app/(shell)/dashboard/studio/sync-retained-studio.css","apps/control/app/sync-auth.css"];
  const css=(await Promise.all(cssFiles.map(async file=>(await readFile(join(root,file),"utf8")).replace(/^@import[^;]+;/gmu,"")))).join("\n")+"\n"+bundle.css;
  const mime:Record<string,string>={".svg":"image/svg+xml",".webp":"image/webp",".jpg":"image/jpeg",".png":"image/png",".woff2":"font/woff2"};
  const publicRoots=[join(root,"apps/control/public"),join(root,"docs/s313-blog-socialhero/reference/broncode/public")];
  const html='<!doctype html><html lang="nl-NL" data-design-system="fieldflow"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>VeyoCast Control · expliciete browserfixture</title><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>';
  const server=createServer(async(request,response)=>{
    const url=new URL(request.url??"/","http://localhost"),headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"};
    const json=(status:number,body:unknown)=>response.writeHead(status,{...headers,"Content-Type":"application/json"}).end(JSON.stringify(body));
    try{
      if(url.pathname==="/fixture.js"||url.pathname==="/fixture.css"){response.writeHead(200,{...headers,"Content-Type":url.pathname.endsWith("js")?"text/javascript":"text/css"}).end(url.pathname.endsWith("js")?bundle.js:css);return;}
      if(url.pathname==="/api/platform/blog"||url.pathname==="/api/blog-demo"){
        if(request.method==="GET"){json(200,{entries:url.pathname.endsWith("blog-demo")?prototypeEntries:entries});return;}
        if(request.method!=="POST"||url.pathname.endsWith("blog-demo")){json(405,{error:{code:"FIXTURE_READ_ONLY",message:"Prototype writes are outside browser acceptance."}});return;}
        const chunks=[];for await(const chunk of request)chunks.push(chunk);const body=JSON.parse(Buffer.concat(chunks).toString());
        calls.push({method:"POST",path:url.pathname,body});
        if(receipts.has(body.idempotencyKey)){json(200,{entry:receipts.get(body.idempotencyKey)});return;}
        const draft=validateArticleDraft(body.draft,body.action==="publish");
        const previous=entries.find(entry=>entry.externalId===body.externalId);
        if(previous&&body.expectedRevision!==previous.draftRevision){json(409,{error:{code:"REVISION_CONFLICT",message:"De fixture heeft een andere revisie. Heropen het artikel."}});return;}
        const revision=(previous?.draftRevision??0)+1,id=previous?.id??randomUUID(),externalId=previous?.externalId??`fixture-${id}`;
        const entry:BlogEntry={id,externalId,draftRevision:revision,publishedRevision:body.action==="publish"?revision:previous?.publishedRevision??null,
          publishedSlug:body.action==="publish"?draft.slug:previous?.publishedSlug??null,publicUrl:body.action==="publish"?`https://veyocast.nl/blog/${draft.slug}`:previous?.publicUrl??null,
          publishedAt:body.action==="publish"?"2026-11-13T12:00:00.000Z":previous?.publishedAt??null,updatedAt:"2026-11-13T12:00:00.000Z",draft};
        entries=[entry,...entries.filter(record=>record.id!==id)];receipts.set(body.idempotencyKey,entry);json(200,{entry});return;
      }
      if(url.pathname==="/api/platform/blog/media"&&request.method==="POST"){
        const chunks=[];for await(const chunk of request)chunks.push(chunk);const bytes=Buffer.concat(chunks);
        const form=await new Request(url,{method:"POST",headers:request.headers as Record<string,string>,body:bytes}).formData(),file=form.get("file");
        if(!(file instanceof File)||!["image/jpeg","image/png","image/webp"].includes(file.type)){json(422,{error:{code:"INVALID_MEDIA",message:"Kies een geldig beeld."}});return;}
        const assetId=randomUUID();uploads.set(assetId,{bytes:new Uint8Array(await file.arrayBuffer()),type:file.type});calls.push({method:"POST",path:url.pathname,body:{assetId,type:file.type,bytes:file.size}});
        json(200,{assetId,width:1200,height:1800,type:file.type,url:`/api/blog/media/${assetId}`});return;
      }
      let path=url.pathname;const asset=/^\/api\/blog\/media\/([\da-f-]{36})$/u.exec(path);
      if(asset){const uploaded=uploads.get(asset[1]!);if(uploaded){response.writeHead(200,{...headers,"Content-Type":uploaded.type}).end(uploaded.bytes);return;}const index=ids.indexOf(asset[1]!);if(index>=0)path=blogDemoArticles[index]!.hero.src;else if(shareIds.includes(asset[1]!))path=String(blogDemoArticles[shareIds.indexOf(asset[1]!)]!.socialImage);else{response.writeHead(404,headers).end();return;}}
      if(path.startsWith("/api/")){json(200,url.pathname==="/api/control/notifications"?{notifications:[]}:{});return;}
      if(["/assets/","/fonts/","/fieldflow/","/blog-assets/"].some(prefix=>path.startsWith(prefix))){
        for(const publicRoot of publicRoots){const target=resolve(publicRoot,`.${path}`);if(!target.startsWith(publicRoot+sep)||!mime[extname(target)])continue;try{const file=await readFile(target);response.writeHead(200,{...headers,"Content-Type":mime[extname(target)]!}).end(file);return;}catch{/* Try the explicit reference media root. */}}
        response.writeHead(404,headers).end();return;
      }
      response.writeHead(200,{...headers,"Content-Type":"text/html"}).end(html);
    }catch(error){json(422,{error:{code:"FIXTURE_VALIDATION",message:error instanceof Error?error.message:"Fixture request failed"}});}
  });
  await new Promise<void>(ready=>server.listen(0,"127.0.0.1",ready));const address=server.address();if(!address||typeof address==="string")throw Error("No browserfixture TCP address.");
  return {origin:`http://127.0.0.1:${address.port}`,calls,reset(){entries=structuredClone(seeds);receipts.clear();uploads.clear();calls.length=0;},
    provenance:{type:"native-control-component-fixture",session:"Explicit platform-owner fixture; no Auth/DB/RLS claim",transport:"In-memory HTTP fixture, schema-validated saves, raw isolated file upload; no storage/decoder claim",shellSha256:fingerprint(await readFile(join(root,"apps/control/app/(shell)/_components/control-shell.tsx"))),candidateSha256:fingerprint(await readFile(join(root,"apps/control/app/(shell)/platform/blog/_components/blog-admin.tsx"))),prototypeMountAdapter:"Prototype-only onCreate metadata transaction wakes useEditorState after immediatelyRender:false; source files, document and UI unchanged",prototypeSha256:fingerprint(await readFile(join(root,reference,"blog-admin.tsx"))),datasetSha256:fingerprint(await readFile(join(root,"docs/s313-blog-socialhero/reference/broncode/app/(marketing)/blog/_blog/blog-seed.ts"))),cssSha256:fingerprint(css),baseline:"Same unchanged native Control shell, existing platform navigation with the new blog link omitted; explanatory fixture content",dataset:"Exact supplied prototype article text, dates, imagery, categories and tags; identity/media paths mapped to the shared contract"},
    close:()=>new Promise<void>((done,reject)=>{server.closeAllConnections();server.close(error=>error?reject(error):done());})};
}
