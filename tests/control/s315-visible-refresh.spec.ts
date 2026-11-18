import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { transpileModule, ModuleKind, ScriptTarget } from 'typescript';
import { expect, test } from '@playwright/test';
import type { watchVisibleRouteRefresh } from '../../apps/control/lib/visible-route-refresh';

type Harness = Window & { refreshCount: number; startRefresh: () => void; stopRefresh: () => void };
const source = transpileModule(readFileSync('apps/control/lib/visible-route-refresh.ts', 'utf8'), {
  compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2022 }
}).outputText;
const fixtureRequire = createRequire(join(process.cwd(), 'package.json'));
const compiler = fixtureRequire.resolve('esbuild', { paths: [fixtureRequire.resolve('tsx')] });
const entry = `import React,{Suspense,use,useState}from'react';import{createRoot}from'react-dom/client';
import{useVisibleRouteRefresh}from'./apps/control/lib/use-visible-route-refresh';
const responses=new Map();let advance;window.refreshCount=0;
window.router={refresh(){window.refreshCount++;let finish;const promise=new Promise(resolve=>{finish=resolve});responses.set(window.refreshCount,promise);window.finishRefresh=()=>finish('gereed');advance();}};
function Read({revision}){if(revision)use(responses.get(revision));return <output>{revision}</output>}
function App(){const[revision,setRevision]=useState(0);const[active,setActive]=useState(true);advance=()=>setRevision(value=>value+1);window.setActive=setActive;
useVisibleRouteRefresh(active,3000);return <main data-active={String(active)}><Suspense fallback={<p>Laden</p>}><Read revision={revision}/></Suspense></main>}
const root=createRoot(document.getElementById('root'));window.unmountRefresh=()=>root.unmount();root.render(<React.StrictMode><App/></React.StrictMode>);`;
const reactBundle = execFileSync(process.execPath, ['-e', `require(${JSON.stringify(compiler)}).build({stdin:{contents:${JSON.stringify(entry)},resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',nodePaths:[process.cwd()+'/apps/control/node_modules'],plugins:[{name:'navigation-fixture',setup(build){build.onResolve({filter:/^next\\/navigation$/},()=>({path:'navigation',namespace:'fixture'}));build.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const useRouter=()=>window.router;'}));}}]}).then(result=>process.stdout.write(result.outputFiles[0].text)).catch(error=>{console.error(error);process.exit(1);});`], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });

test.beforeEach(async ({ page }) => {
  await page.clock.install();
  await page.setContent('<main><h1>Verversingscontrole</h1></main>');
  await page.evaluate(compiled => {
    const exported = {} as { watchVisibleRouteRefresh: typeof watchVisibleRouteRefresh };
    new Function('exports', compiled)(exported);
    const harness = window as Harness;
    harness.refreshCount = 0;
    harness.startRefresh = () => { harness.stopRefresh = exported.watchVisibleRouteRefresh({
      document, window, intervalMs: 3000, refresh: () => { harness.refreshCount += 1; }
    }); };
  }, source);
});

test('a slow refresh receives no overlapping timer or browser-event requests', async ({ page }) => {
  await page.evaluate(() => (window as Harness).startRefresh());
  await page.clock.fastForward(60_000);
  await page.evaluate(() => { window.dispatchEvent(new Event('online'));document.dispatchEvent(new Event('visibilitychange')); });
  expect(await page.evaluate(() => (window as Harness).refreshCount)).toBe(1);
  await page.evaluate(() => { (window as Harness).stopRefresh();(window as Harness).startRefresh(); });
  await page.clock.fastForward(3000);
  expect(await page.evaluate(() => (window as Harness).refreshCount)).toBe(2);
});

test('a hidden tab pauses and resumes once immediately without a request burst', async ({ page }) => {
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    (window as Harness).startRefresh();
  });
  await page.clock.fastForward(60_000);
  expect(await page.evaluate(() => (window as Harness).refreshCount)).toBe(0);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event('online'));
  });
  expect(await page.evaluate(() => (window as Harness).refreshCount)).toBe(1);
  await page.evaluate(() => (window as Harness).stopRefresh());
  await page.clock.fastForward(60_000);
  expect(await page.evaluate(() => (window as Harness).refreshCount)).toBe(1);
});

test('the real React hook waits for a suspended transition, rearms and stops when inactive', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setContent('<div id="root"></div>');
  await page.addScriptTag({ content: reactBundle });
  await expect(page.locator('output')).toHaveText('0');
  await page.clock.fastForward(3000);
  await expect.poll(() => page.evaluate(() => (window as Harness).refreshCount)).toBe(1);
  await page.clock.fastForward(60_000);
  await page.evaluate(() => { window.dispatchEvent(new Event('online'));document.dispatchEvent(new Event('visibilitychange')); });
  expect(await page.evaluate(() => (window as Harness).refreshCount)).toBe(1);
  await expect(page.locator('output')).toHaveText('0');
  await page.evaluate(() => (window as unknown as { finishRefresh: () => void }).finishRefresh());
  await expect(page.locator('output')).toHaveText('1');
  await page.clock.fastForward(3000);
  await expect.poll(() => page.evaluate(() => (window as Harness).refreshCount)).toBe(2);
  await page.evaluate(() => (window as unknown as { finishRefresh: () => void }).finishRefresh());
  await expect(page.locator('output')).toHaveText('2');
  await page.evaluate(() => (window as unknown as { setActive: (value: boolean) => void }).setActive(false));
  await expect(page.locator('main')).toHaveAttribute('data-active', 'false');
  await page.clock.fastForward(60_000);
  expect(await page.evaluate(() => (window as Harness).refreshCount)).toBe(2);
  await page.evaluate(() => (window as unknown as { unmountRefresh: () => void }).unmountRefresh());
  await page.clock.fastForward(60_000);
  expect(await page.evaluate(() => (window as Harness).refreshCount)).toBe(2);
  expect(errors).toEqual([]);
});
