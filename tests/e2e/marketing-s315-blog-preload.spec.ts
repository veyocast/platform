import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

const fixtureRequire = createRequire(join(process.cwd(), 'package.json'));
const compiler = fixtureRequire.resolve('esbuild', { paths: [fixtureRequire.resolve('tsx')] });
const background = '/fieldflow/photos/FF-PHOTO-01-clubhouse-exterior-21x9.webp';
const image = readFileSync(join('apps/marketing/public', background));
const entry = `import React from'react';import{renderToStaticMarkup}from'react-dom/server';import{BlogIndexPage}from'./apps/marketing/app/blog/_blog/blog-public';process.stdout.write(renderToStaticMarkup(<BlogIndexPage articles={[]}/>));`;
const program = `require(${JSON.stringify(compiler)}).build({stdin:{contents:${JSON.stringify(entry)},resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},nodePaths:[process.cwd()+'/apps/marketing/node_modules'],loader:{'.css':'empty','.module.css':'empty'},plugins:[{name:'server-fixture',setup(build){build.onResolve({filter:/^next\\/link$/},()=>({path:'link',namespace:'fixture'}));build.onResolve({filter:/blog-source$/},()=>({path:'source',namespace:'fixture'}));build.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:args.path==='link'?'import React from"react";export default function Link(props){return React.createElement("a",props)}':'export const blogImageUrl=id=>"/api/blog/media/"+id;',resolveDir:process.cwd()+'/apps/marketing',loader:'js'}));}}]}).then(result=>new Function('require',result.outputFiles[0].text)(require)).catch(error=>{console.error(error);process.exit(1)});`;
const markup = execFileSync(process.execPath, ['-e', program], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });

for (const width of [390, 1440]) {
  test(`blog background starts before its delayed CSS and is fetched only once at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    let releaseStyles!: () => void;
    const stylesReady = new Promise<void>(resolve => { releaseStyles = resolve; });
    let requestedImages = 0;
    await page.route('http://127.0.0.1:3343/**', async route => {
      const path = new URL(route.request().url()).pathname;
      if (path === background) {
        requestedImages += 1;
        await route.fulfill({ contentType: 'image/webp', body: image });
      } else if (path === '/s315.css') {
        await stylesReady;
        await route.fulfill({ contentType: 'text/css', body: `main>section:first-of-type{min-height:350px;background-image:url('${background}')}` });
      } else if (path === '/__s315_blog') {
        await route.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="nl"><head><link rel="stylesheet" href="/s315.css"></head><body>${markup}</body></html>` });
      } else await route.abort();
    });
    try {
      await page.goto('http://127.0.0.1:3343/__s315_blog', { waitUntil: 'commit' });
      await expect.poll(() => requestedImages).toBe(1);
      expect(await page.evaluate(() => performance.getEntriesByType('resource').some(resource => resource.name.endsWith('/s315.css')))).toBe(false);
    } finally {
      releaseStyles();
    }
    await page.waitForLoadState('load');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Het VeyoCast-blog');
    expect(requestedImages).toBe(1);
    expect(await page.evaluate(path => performance.getEntriesByType('resource').filter(resource => resource.name.endsWith(path)).length, background)).toBe(1);
  });
}
