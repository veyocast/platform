import {readFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {createSyncTemplatePreview} from '../../apps/control/app/(shell)/dashboard/studio/sync-template-preview';
import {buildSyncCaptureHtml} from '../../apps/media-worker/src/sync-dom-capture';
import {measureSyncOnzeTrotsV9Layout,measureSyncOnzeTrotsLayout} from '../../packages/content-templates/src/sync-slide-static-view';
import {syncSlidePresentationSchema,syncSlideMinimumDurationMs,syncSlideRendererAssets} from '../../packages/contracts/src/index';
const browser=await chromium.launch({executablePath:chromium.executablePath(),args:['--no-sandbox']});
try{for(const family of ['standings','matchday']as const)for(const orientation of ['landscape','portrait']as const){
const presentation=syncSlidePresentationSchema.parse({...createSyncTemplatePreview(family),orientation}),page=await browser.newPage({viewport:orientation==='portrait'?{width:1080,height:1920}:{width:1920,height:1080}});
const assets=syncSlideRendererAssets(presentation);
await page.route('**/*',async route=>{const path=new URL(route.request().url()).pathname,asset=assets.find(a=>a.path===path);if(!asset){await route.abort();return;}await route.fulfill({body:await readFile('apps/player/public'+path),contentType:asset.mimeType});});
await page.setContent(buildSyncCaptureHtml(presentation));await page.evaluate(async()=>{await Promise.all([...document.fonts].map(f=>f.load()));await document.fonts.ready;});
await page.evaluate(measureSyncOnzeTrotsV9Layout,undefined);
console.log(JSON.stringify({family,orientation,minimum:syncSlideMinimumDurationMs(presentation),layout:await page.evaluate(measureSyncOnzeTrotsLayout,undefined),header:await page.evaluate(()=>[...document.querySelectorAll<HTMLElement>('.slide-header-container,.panel-context,.rank-head,.panel-head,.panel-foot')].map(e=>({className:e.className,height:e.offsetHeight,font:getComputedStyle(e).fontSize})))},null,2));await page.close();}
}finally{await browser.close();}
