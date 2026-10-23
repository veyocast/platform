import {mkdir,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {chromium} from '@playwright/test';
import {createSyncTemplatePreview} from '../../apps/control/app/(shell)/dashboard/studio/sync-template-preview';
import {createSyncStudioDocument} from '../../packages/studio/src/sync';
import {createSyncSlideCapture} from '../../apps/media-worker/src/sync-dom-capture';
const output=resolve(process.argv[2]??'');if(!process.argv[2])throw Error('Owned output required');
await mkdir(output,{recursive:false});
const presentation=createSyncTemplatePreview('free');
const capture=await createSyncSlideCapture({presentation,durationMs:createSyncStudioDocument(presentation).motion.durationMs,executablePath:chromium.executablePath()});
try{for(const time of [425,1575,2425,3500])await writeFile(join(output,`${time}.png`),await capture.renderPng(time),{flag:'wx'});}finally{await capture.close();}
