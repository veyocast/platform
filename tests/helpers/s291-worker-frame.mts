import {readFile,writeFile}from'node:fs/promises';
import{chromium}from'@playwright/test';
import{syncSlidePresentationSchema,syncSlideMinimumDurationMs}from'../../packages/contracts/src/index';
import{buildSyncCaptureHtml,createSyncSlideCapture}from'../../apps/media-worker/src/sync-dom-capture';
const input=syncSlidePresentationSchema.parse(JSON.parse(await readFile(process.argv[2]!,'utf8')));
if(process.argv[4]==='html'){await writeFile(process.argv[3]!,buildSyncCaptureHtml(input,{},Number(process.argv[5]??0)));process.exit(0);}
const capture=await createSyncSlideCapture({presentation:input,durationMs:Math.max(12000,syncSlideMinimumDurationMs(input)),executablePath:chromium.executablePath(),sceneState:{paused:true,pausedAtMs:1200,introFinished:true}});
try{await writeFile(process.argv[3]!,await capture.renderPng(1200));}finally{await capture.close();}
