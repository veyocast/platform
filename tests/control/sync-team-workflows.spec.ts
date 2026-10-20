import {readFileSync} from 'node:fs';
import {expect,test} from '@playwright/test';
import {compileResponsive} from '../helpers/control-responsive-fixture';

const bundle=compileResponsive({chosenSync:true});
const styles=['tokens/veyocast-design-tokens.css','packages/ui/src/styles.css','apps/control/app/globals.css','apps/control/app/fieldflow.css','apps/control/app/sync-source.css','apps/control/app/sync-adapter.css'].map(path=>readFileSync(path,'utf8').replace(/@import[^;]+;/g,'')).join('\n');

test('Source Team preserves its three sections and sends Activity filters to the real audit route',async({page})=>{
 await page.route('**/__sync-team?*',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html lang="nl" data-design-system="fieldflow"><head><style>${styles}\n${bundle.css}</style></head><body><div id="root"></div><script>${bundle.js.replace(/<\/script/gi,'<\\/script')}</script></body></html>`}));
 await page.goto('http://127.0.0.1:3313/__sync-team?path=%2Fdashboard%2Fteam');
 const sections=page.getByRole('group',{name:'Teamonderdelen'});
 await expect(sections.getByRole('button')).toHaveText(['Leden','Rollen & rechten','Activiteit']);
 await expect(page.getByRole('table',{name:'Toegang binnen de actieve vereniging.'}).locator('tbody tr')).toHaveCount(0);
 await sections.getByRole('button',{name:'Activiteit',exact:true}).click();
 await expect(page.getByRole('search')).toBeVisible();
 await page.getByRole('searchbox',{name:'Zoeken op activiteit'}).fill('playlist.published');
 let submitted:URL|undefined;
 await page.route('**/dashboard/auditlog?*',route=>{submitted=new URL(route.request().url());return route.fulfill({contentType:'text/html',body:'<main><h1>Activiteit</h1></main>'});});
 await page.getByRole('searchbox',{name:'Zoeken op activiteit'}).press('Enter');
 await expect.poll(()=>submitted?.pathname).toBe('/dashboard/auditlog');
 expect(submitted?.searchParams.get('action')).toBe('playlist.published');
});

// The empty Source comparison cannot expose clipped table labels escaping a
// scrolling frame. Keep the actual Team page and supply the existing populated
// readonly models, including all three membership roles.
const populatedBundle=compileResponsive();
for(const width of [390,1440])test(`populated Team keeps horizontal scrolling inside its table at ${width}px`,async({page},info)=>{
 await page.setViewportSize({width,height:900});await page.emulateMedia({reducedMotion:'reduce'});
 const writes:string[]=[],errors:string[]=[];page.on('request',request=>{if(request.method()!=='GET')writes.push(request.method());});page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/assets/*',route=>{const path=new URL(route.request().url()).pathname;if(!/^\/assets\/[A-Za-z0-9_.-]+$/.test(path))return route.abort();try{return route.fulfill({body:readFileSync('apps/control/public'+path),contentType:path.endsWith('.woff2')?'font/woff2':path.endsWith('.ttf')?'font/ttf':'image/svg+xml'});}catch{return route.abort();}});
 await page.route('**/__sync-team-populated?*',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html lang="nl" data-design-system="fieldflow"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${styles}\n${populatedBundle.css}</style></head><body><div id="root"></div><script>${populatedBundle.js.replace(/<\/script/gi,'<\\/script')}</script></body></html>`}));
 await page.goto('http://127.0.0.1:3313/__sync-team-populated?path=%2Fdashboard%2Fteam');
 const table=page.getByRole('table',{name:'Toegang binnen de actieve vereniging.',exact:true}),main=page.locator('.vx-main'),heading=page.getByRole('heading',{name:'Samen aan het stuur.',exact:true});
 await expect(table.locator('tbody tr')).toHaveCount(3);await page.evaluate(()=>document.fonts.ready);
 const measure=()=>main.evaluate(node=>({client:node.clientWidth,scroll:node.scrollWidth,left:node.scrollLeft}));
 const before=await measure();expect(before.scroll,'Filled Team must not make the main viewport horizontally scrollable').toBeLessThanOrEqual(before.client);expect(before.left).toBe(0);
 const frame=table.locator('..'),headerBefore=(await heading.boundingBox())!,names=await table.locator('tbody td[data-label="Gebruiker"] strong').allTextContents();
 expect(names).toEqual(['Danny Groen','Demo redacteur','Demo vrijwilliger']);
 const scrolling=await frame.evaluate(node=>{node.scrollLeft=node.scrollWidth;return{client:node.clientWidth,scroll:node.scrollWidth,left:node.scrollLeft};});
 if(width===390){expect(scrolling.scroll).toBeGreaterThan(scrolling.client);expect(scrolling.left).toBeGreaterThan(0);}
 expect(await measure()).toEqual(before);expect((await heading.boundingBox())!.x).toBe(headerBefore.x);expect(await table.locator('tbody td[data-label="Gebruiker"] strong').allTextContents()).toEqual(names);
 expect(writes).toEqual([]);expect(errors).toEqual([]);
 await info.attach('populated-team-native-scroll',{body:Buffer.from(JSON.stringify({width,before,scrolling,headerBefore,names})),contentType:'application/json'});
 await info.attach('populated-team-native',{body:await page.screenshot(),contentType:'image/png'});
});
