import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
const dir=path.resolve(process.argv[2]||'dist-marketing');
const origin='https://veyocast.dgwebserv.chatgpt.site';
const walk=p=>fs.readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(p,e.name)):[path.join(p,e.name)]);
const files=walk(dir).filter(p=>p.endsWith('index.html'));
assert.equal(files.length,9,'nine public marketing pages');
const titles=new Set(),descriptions=new Set();
for(const file of files){
 const rel=path.relative(dir,file).replace(/index\.html$/,'');
 const doc=new JSDOM(fs.readFileSync(file,'utf8')).window.document;
 assert.equal(doc.documentElement.lang,'nl');assert.equal(doc.querySelectorAll('h1').length,1,rel+' one H1');
 assert.ok(doc.querySelector('main')?.textContent.length>900,rel+' substantive server-rendered content');
 const title=doc.title,desc=doc.querySelector('meta[name=description]')?.content;
 assert.ok(title&&desc);assert.ok(!titles.has(title),'unique title');assert.ok(!descriptions.has(desc),'unique description');titles.add(title);descriptions.add(desc);
 assert.equal(doc.querySelector('link[rel=canonical]')?.href,origin+'/'+rel);
 assert.ok(doc.querySelector('meta[name=robots]')?.content.startsWith('index,follow'));
 const schema=JSON.parse(doc.querySelector('script[type="application/ld+json"]').textContent);
 assert.ok(schema['@graph'].some(x=>x['@type']==='WebPage'));
 for(const el of doc.querySelectorAll('a[href],img[src],link[rel=stylesheet],script[src]')){
  const url=el.getAttribute('href')||el.getAttribute('src');
  if(!url?.startsWith('/')||url.startsWith('//'))continue;
  const target=url.split(/[?#]/)[0];if(!target)continue;
  assert.ok(fs.existsSync(path.join(dir,target))||fs.existsSync(path.join(dir,target,'index.html')),rel+' missing target '+target);
 }
}
const sitemap=fs.readFileSync(path.join(dir,'sitemap.xml'),'utf8');assert.equal((sitemap.match(/<loc>/g)||[]).length,9);
assert.ok(fs.readFileSync(path.join(dir,'robots.txt'),'utf8').includes(origin+'/sitemap.xml'));
assert.ok(fs.readFileSync(path.join(dir,'404.html'),'utf8').includes('noindex,follow'));
assert.ok(!fs.existsSync(path.join(dir,'marketing.html')),'no duplicate template URL');
assert.ok(!fs.existsSync(path.join(dir,'assets/VeyoCast-V1-Sync-Handover.zip')),'private handover absent');
for(const file of walk(dir).filter(p=>p.endsWith('.js'))){const js=fs.readFileSync(file,'utf8');assert.ok(!js.includes('veyocast-v1-design-lab-v3'),'private data store excluded');assert.ok(!js.includes('danny@duindorpsv.nl'),'private account fixtures excluded');}
console.log('PASS: 9 server-rendered pages, unique metadata, canonical/schema, H1, assets/internal links, sitemap, robots, 404 and public/private bundle separation.');
