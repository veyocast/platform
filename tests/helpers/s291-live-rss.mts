import{readFile,writeFile,mkdir}from'node:fs/promises';
import{createHash}from'node:crypto';
import{createServer}from'node:http';
import{renderSyncDynamicArtifact}from'../../apps/media-worker/src/sync-dynamic-render';
import{chromium}from'@playwright/test';
import{prepareRssMediaArtifacts}from'../../apps/media-worker/src/rss-media';
import{projectSyncDynamicSnapshot}from'../../packages/content-templates/src/sync-dynamic-projector';
import{createSyncTemplatePreview}from'../../apps/control/app/(shell)/dashboard/studio/sync-template-preview';
import{createSyncSlideCapture}from'../../apps/media-worker/src/sync-dom-capture';
const directory=process.argv[2]!;await mkdir(directory,{recursive:true});
const parsed=JSON.parse(await readFile(process.argv[3]!,'utf8')),article=parsed.articles[0];
const feed={...parsed,articles:[article],media:{...parsed.media,articleImages:parsed.media.articleImages.filter((image:{externalId:string})=>image.externalId===article.externalId)}};
const artifacts=await prepareRssMediaArtifacts({tenantId:'10000000-0000-4000-8000-000000000291',dataSourceId:'20000000-0000-4000-8000-000000000291',runId:'30000000-0000-4000-8000-000000000291',sourceUrl:'https://www.ad.nl/nieuws/rss.xml'},feed);
const hero=artifacts.find(a=>a.role==='article_hero'),provider=artifacts.find(a=>a.role==='provider_logo'),qr=artifacts.find(a=>a.role==='article_qr');
const assets=Object.fromEntries(artifacts.map(a=>[a.assetId,{url:`https://verified-storage.example/${a.assetId}.webp`,mimeType:a.mimeType,bytes:a.fileSizeBytes,checksumSha256:a.checksumSha256}]));
const sources=Object.fromEntries(artifacts.map(a=>[a.assetId,`data:${a.mimeType};base64,${Buffer.from(a.bytes).toString('base64')}`]));
for(const orientation of['landscape','portrait']as const){
 const seed={...createSyncTemplatePreview('rss'),orientation};
 const data={type:'news',brand:{clubName:seed.club.name},news:{providerLogoMediaAssetId:provider?.assetId,articles:[{...article,heroMediaAssetId:hero?.assetId??null,qrMediaAssetId:qr?.assetId??null}]}};
 const payload={schemaVersion:1 as const,orientation,slideType:'news' as const,snapshotId:'40000000-0000-4000-8000-000000000291',snapshotHash:createHash('sha256').update(JSON.stringify(data)).digest('hex'),templateVersionId:'50000000-0000-4000-8000-000000000291',templateSlug:'controlled-live-feed',assets,data};
 const result=projectSyncDynamicSnapshot(payload,seed);if(!result.ok)throw Error(result.code);
 const capture=await createSyncSlideCapture({presentation:result.presentation,assetSources:sources,executablePath:chromium.executablePath(),durationMs:12000,sceneState:{paused:true,introFinished:true,pausedAtMs:1200}});
 try{await writeFile(`${directory}/ad-${orientation}.png`,await capture.renderPng(1200));}finally{await capture.close();}
 await writeFile(`${directory}/ad-${orientation}.json`,JSON.stringify({sourceUrl:'https://www.ad.nl/nieuws/rss.xml',article:article.link,title:article.title,media:{hero:Boolean(hero),provider:Boolean(provider),qr:Boolean(qr)},presentation:result.presentation},null,2));
}
if(process.argv[4]==='mp4'){
 const server=createServer((request,response)=>{const artifact=artifacts.find(a=>request.url?.endsWith(a.assetId+'.webp'));if(!artifact){response.writeHead(404).end();return;}response.writeHead(200,{'Content-Type':artifact.mimeType}).end(artifact.bytes);});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${(server.address()as{port:number}).port}`;
 try{
  const example=createSyncTemplatePreview('rss'),{rich,...base}=example;void rich;
  const seed={...base,news:[],rows:[],ownRowIndexes:[]};
  const data={type:'news',generatedAt:'2026-10-25T00:00:00Z',brand:{clubName:seed.club.name},syncConfiguration:{schemaVersion:1,kind:'dynamic',rendererVersion:seed.rendererVersion,sourceRevision:seed.sourceRevision,slideType:'news',secondsPerPage:5,seed},news:{providerLogoMediaAssetId:provider?.assetId,articles:[{...article,heroMediaAssetId:hero?.assetId??null,qrMediaAssetId:qr?.assetId??null}]}};
  const verified=Object.fromEntries(artifacts.map(a=>[a.assetId,{...assets[a.assetId],url:`${origin}/storage/v1/object/sign/tenant-media/${a.assetId}.webp`}]));
  const job={jobId:'60000000-0000-4000-8000-000000000291',snapshotId:'40000000-0000-4000-8000-000000000291',tenantId:'10000000-0000-4000-8000-000000000291',outputMediaAssetId:'70000000-0000-4000-8000-000000000291',templateVersionId:'50000000-0000-4000-8000-000000000291',templateSlug:'controlled-live-rss',snapshotHash:createHash('sha256').update(JSON.stringify(data)).digest('hex'),orientation:'landscape' as const,slideName:'Current real RSS',markup:'canonical',css:'',manifest:{engine:'veyocast-safe-template-v1' as const,schemaVersion:1 as const,canvas:{width:1920,height:1080},slideType:'news' as const,allowedFields:[{path:'brand.clubName',type:'string' as const,required:false}],maxCollectionItems:200},snapshotData:data};
  const output=await renderSyncDynamicArtifact({job,assets:verified,storageOrigin:origin,captureFactory:options=>createSyncSlideCapture({...options,executablePath:chromium.executablePath()}),renderer:{renderPng:async()=>{throw Error('Unexpected renderer');},renderRgba:async()=>{throw Error('Unexpected renderer');}}});
  await writeFile(`${directory}/rss-complete.mp4`,output.bytes);await writeFile(`${directory}/rss-poster.png`,output.poster.bytes);await writeFile(`${directory}/export.json`,JSON.stringify({mimeType:output.mimeType,checksumSha256:output.checksumSha256,byteLength:output.byteLength,durationMs:output.durationMs,width:output.width,height:output.height,articleUrl:article.link},null,2));
 }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));}
}
console.log(JSON.stringify({title:article.title,article:article.link,hero:Boolean(hero),provider:Boolean(provider),qr:Boolean(qr)}));
