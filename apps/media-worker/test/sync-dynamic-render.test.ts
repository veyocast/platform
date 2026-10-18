import {beforeAll,expect,it,vi} from 'vitest';
import {writeFile,access} from 'node:fs/promises';
import {dirname} from 'node:path';
import sharp from 'sharp';
import {syncSlidePresentationSchema} from '@veyocast/contracts';
import {renderSyncDynamicArtifact} from '../src/sync-dynamic-render';
import type {ClaimedDynamicRenderJob} from '../src/dynamic-render-backend';
import type {StudioExternalRenderer} from '../src/studio-render-image';
import type {encodeStudioMp4} from '../src/studio-render-video';
let png:Uint8Array;
const now=new Date('2026-10-18T12:00:00Z');
beforeAll(async()=>{png=new Uint8Array(await sharp({create:{width:1920,height:1080,channels:3,background:'#123456'}}).png().toBuffer());});
function fixture(count=5){
 const seed=syncSlidePresentationSchema.parse({schemaVersion:1,rendererVersion:'sync-v1',sourceRevision:'8b1fdf1f8637dda23d48ecdaf08e0e5978e2707a',family:'fixtures',orientation:'landscape',theme:'fieldflow',name:'Eigen bronontwerp',title:'Eigen programma',club:{name:'Club A'},style:{motion:'geen'}});
 const job:ClaimedDynamicRenderJob={jobId:'10000000-0000-4000-8000-000000000226',snapshotId:'20000000-0000-4000-8000-000000000226',tenantId:'30000000-0000-4000-8000-000000000226',outputMediaAssetId:'40000000-0000-4000-8000-000000000226',templateVersionId:'50000000-0000-4000-8000-000000000226',templateSlug:'actual-registered-template',snapshotHash:'a'.repeat(64),orientation:'landscape',slideName:'Eigen programma',markup:'unused canonical slot',css:'',manifest:{engine:'veyocast-safe-template-v1',schemaVersion:1,canvas:{width:1920,height:1080},slideType:'sport_program',allowedFields:[{path:'sport.title',type:'string',required:false}],maxCollectionItems:40},snapshotData:{type:'sport_program',brand:{clubName:'Club A'},syncConfiguration:{schemaVersion:1,kind:'dynamic',rendererVersion:'sync-v1',sourceRevision:seed.sourceRevision,slideType:'sport_program',seed,secondsPerPage:3},sport:{items:Array.from({length:count},(_,i)=>({id:`match-${i}`,primary:`Thuis ${i}`,secondary:`Uit ${i}`,homeTeam:`Thuis ${i}`,awayTeam:`Uit ${i}`,kickoffTime:'14:00',kickoffAt:'2026-10-20T12:00:00Z',date:'20-10-2026',field:String(i+1),status:'scheduled'}))}}};
 const close=vi.fn(async()=>{}),renderPng=vi.fn(async()=>png),renderRgba=vi.fn(async()=>new Uint8Array(1920*1080*4));
 const captureFactory=vi.fn(async()=>({close,renderPng,renderRgba}));
 const renderer:StudioExternalRenderer={renderPng:vi.fn(async()=>png),renderRgba};
 return {job,captureFactory,close,renderPng,renderRgba,renderer,now};
}
it('requests a complete multipage video and validates the full duration before returning an artifact',async()=>{
 const f=fixture(),validateMp4=vi.fn(async()=>({} as never)),encode=vi.fn(async(input:Parameters<typeof encodeStudioMp4>[0])=>{await input.renderFrame!(0);await input.renderFrame!(5999);await writeFile(input.outputPath,Buffer.from('controlled-encoder-result'));return {frameCount:180,outputPath:input.outputPath};});
 const result=await renderSyncDynamicArtifact({...f,assets:{},storageOrigin:undefined,encode,validateMp4});
 expect(result).toMatchObject({mimeType:'video/mp4',durationMs:6000,presentation:{rows:expect.any(Array),sourceRevision:'8b1fdf1f8637dda23d48ecdaf08e0e5978e2707a'}});expect(result.presentation.rows).toHaveLength(5);
 expect(f.captureFactory).toHaveBeenCalledWith(expect.objectContaining({durationMs:6000,presentation:expect.objectContaining({rows:expect.arrayContaining([expect.arrayContaining(['Thuis 4'])])})}));
 expect(encode.mock.calls[0]![0].document.motion.durationMs).toBe(6000);expect(validateMp4).toHaveBeenCalledWith(expect.objectContaining({durationMs:6000,expectedWidth:1920,expectedHeight:1080}));expect(f.close).toHaveBeenCalledTimes(1);await expect(access(dirname(encode.mock.calls[0]![0].outputPath))).rejects.toMatchObject({code:'ENOENT'});
});
it('retains a real PNG for one static page without invoking video encoding',async()=>{
 const f=fixture(1),encode=vi.fn();const result=await renderSyncDynamicArtifact({...f,assets:{},storageOrigin:undefined,encode});expect(result.mimeType).toBe('image/png');expect(result.durationMs).toBe(3000);expect(result.byteLength).toBe(png.byteLength);expect(result.poster.checksumSha256).toBe(result.checksumSha256);expect(encode).not.toHaveBeenCalled();
});
it('rejects missing real template identity, mismatched source type and a sequence exceeding 120 seconds before allocating a browser',async()=>{
 const f=fixture();delete f.job.templateVersionId;await expect(renderSyncDynamicArtifact({...f,assets:{},storageOrigin:undefined})).rejects.toMatchObject({code:'sync_dynamic_configuration_invalid',retryable:false});expect(f.captureFactory).not.toHaveBeenCalled();
 const oversized=fixture(161);await expect(renderSyncDynamicArtifact({...oversized,assets:{},storageOrigin:undefined})).rejects.toMatchObject({code:'sync_dynamic_configuration_invalid'});expect(oversized.captureFactory).not.toHaveBeenCalled();
 const mismatched=fixture();mismatched.job.manifest.slideType='sport_results';await expect(renderSyncDynamicArtifact({...mismatched,assets:{},storageOrigin:undefined})).rejects.toMatchObject({code:'sync_dynamic_configuration_invalid'});expect(mismatched.captureFactory).not.toHaveBeenCalled();
});
it('closes the capture and removes only its owned work directory after encoding fails',async()=>{
 const f=fixture();let directory='';const encode=vi.fn(async(input:Parameters<typeof encodeStudioMp4>[0])=>{directory=dirname(input.outputPath);throw Error('controlled encoding failure');});
 await expect(renderSyncDynamicArtifact({...f,assets:{},storageOrigin:undefined,encode})).rejects.toThrow('controlled encoding failure');expect(f.close).toHaveBeenCalledOnce();expect(directory).toContain('veyocast-studio-render-sync-dynamic-');await expect(access(directory)).rejects.toMatchObject({code:'ENOENT'});
});

it('renders retries at the frozen snapshot time and rejects a missing production timestamp',async()=>{
 const f=fixture(5);(f.job.snapshotData as Record<string,unknown>).generatedAt=now.toISOString();
 const encode=vi.fn(async(input:Parameters<typeof encodeStudioMp4>[0])=>{await writeFile(input.outputPath,Buffer.from('controlled-complete-video'));return {frameCount:180,outputPath:input.outputPath};});
 const result=await renderSyncDynamicArtifact({...f,now:undefined,assets:{},storageOrigin:undefined,encode,validateMp4:vi.fn(async()=>({}as never))});expect(result.presentation.rows).toHaveLength(5);expect(result.durationMs).toBe(6000);
 const missing=fixture();await expect(renderSyncDynamicArtifact({...missing,now:undefined,assets:{},storageOrigin:undefined})).rejects.toMatchObject({code:'sync_dynamic_configuration_invalid'});expect(missing.captureFactory).not.toHaveBeenCalled();
});
