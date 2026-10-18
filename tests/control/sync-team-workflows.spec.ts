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
