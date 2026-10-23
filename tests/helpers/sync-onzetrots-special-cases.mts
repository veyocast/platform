import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {chromium} from '@playwright/test';
import {syncSlidePollSchema,syncSlidePresentationSchema,type SyncContentFamily,type SyncOnzeTrotsPresentation} from '../../packages/contracts/src/index';
import {selectSyncOnzeTrotsVisitors} from '../../packages/content-templates/src/sync-onzetrots-motion';
import {createSyncStudioDocument} from '../../packages/studio/src/sync';
import {createSyncTemplatePreview} from '../../apps/control/app/(shell)/dashboard/studio/sync-template-preview';
import {createSyncSlideCapture} from '../../apps/media-worker/src/sync-dom-capture';

const directory=process.argv[2];
if(!directory)throw Error('Provide a new owned evidence directory');
const output=resolve(directory);await mkdir(output,{recursive:false});
const cases:Array<{name:string;presentation:SyncOnzeTrotsPresentation;elapsedMs:number}>=[];
function sample(family:SyncContentFamily){
 const presentation=structuredClone(createSyncTemplatePreview(family));
 if(presentation.rendererVersion!=='sync-onzetrots-v1')throw Error('Approved fixture identity required');
 return presentation;
}
for(const own of ['first','middle','last']as const){
 const presentation=sample('standings'),standing=presentation.rich!.standings!;
 if(own!=='middle'){
  const row=standing.rows.find(row=>row.teamId===standing.ownTeamId)!;
  const others=standing.rows.filter(item=>item!==row);
  standing.rows=(own==='first'?[row,...others]:[...others,row]).map((item,index)=>({...item,position:index+1}));
 }
 // The initial hold is visible after the entrance has completed. At exactly
 // zero the real Worker correctly renders the first transparent intro frame.
 for(const elapsedMs of own==='middle'?[1200,20000]:[1200])cases.push({name:`standings-own-${own}-${elapsedMs}ms`,presentation,elapsedMs});
}
for(let count=0;count<=4;count++){
 const presentation=sample('welcome'),rich=presentation.rich!;
 rich.fixtures=selectSyncOnzeTrotsVisitors(rich.fixtures!,rich.visitorsSelection!).slice(0,count);
 if(rich.fixtures.length!==count)throw Error('Insufficient verified display-only visitor fixtures');
 cases.push({name:`welcome-${count}`,presentation,elapsedMs:1200});
}
for(const[family,counts]of [['birthdays',[2,6]],['activities',[4,6]],['agenda',[0,6]]]as const)for(const count of counts){
 const presentation=sample(family);presentation.orientation='portrait';
 if(family==='birthdays')presentation.rich!.birthdays=presentation.rich!.birthdays!.slice(0,count);
 else presentation.rich!.activities=presentation.rich!.activities!.slice(0,count);
 cases.push({name:`${family}-${count}-portrait`,presentation,elapsedMs:1200});
}
for(const orientation of ['landscape','portrait']as const){
 const presentation=sample('engage');presentation.orientation=orientation;
 presentation.poll=syncSlidePollSchema.parse({id:'28500000-0000-4000-8000-000000000024',title:'W'.repeat(160),status:'live',visibility:'live',optionsPerPage:4,publicUrl:'https://example.org/engage/own-campaign',options:Array.from({length:24},(_,index)=>({id:`28500000-0000-4000-8000-${String(index+1).padStart(12,'0')}`,label:`Keuze ${String(index+1).padStart(2,'0')} `+'Z'.repeat(151),votes:index+1}))});
 cases.push({name:`engage-long-${orientation}`,presentation,elapsedMs:1200});
}
const manifest=[];
for(const entry of cases){
 const presentation=syncSlidePresentationSchema.parse(entry.presentation),document=createSyncStudioDocument(presentation);
 const capture=await createSyncSlideCapture({presentation,durationMs:document.motion.durationMs,executablePath:chromium.executablePath()});
 try{
  const bytes=await capture.renderPng(entry.elapsedMs),filename=entry.name+'.png';
  await writeFile(join(output,filename),bytes,{flag:'wx'});
  manifest.push({filename,family:presentation.family,orientation:presentation.orientation,elapsedMs:entry.elapsedMs,width:document.artboard.width,height:document.artboard.height,sha256:createHash('sha256').update(bytes).digest('hex')});
  await writeFile(join(output,'special-cases.json'),JSON.stringify({rendererVersion:presentation.rendererVersion,sourceRevision:presentation.sourceRevision,fixtures:'Verified approved display-only fixtures; no production tenant data',cases:manifest},null,2)+'\n');
  process.stdout.write(`${manifest.length}/${cases.length} ${filename}\n`);
 }finally{await capture.close();}
}
