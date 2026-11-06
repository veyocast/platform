import {createServer,type Server} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {expect,test} from '@playwright/test';

test.use({serviceWorkers:'allow'});
let server:Server,origin:string;
const fontPath='/onzetrots-approved-v1/assets/fonts/club-font-9.ttf';
test.beforeAll(async()=>{
 const publicRoot=resolve(process.cwd(),'apps/player/public');
 server=createServer(async(req,res)=>{
  const pathname=new URL(req.url??'/', 'http://127.0.0.1').pathname;
  if(pathname==='/manifest.webmanifest'){res.writeHead(200,{'Content-Type':'application/manifest+json'});res.end(JSON.stringify({name:'Player shell fixture',start_url:'/'}));return;}
  if(['/','/lg','/lg/legacy'].includes(pathname)){res.writeHead(200,{'Content-Type':'text/html'});res.end('<!doctype html><html lang="nl"><main><h1>Onze club</h1></main></html>');return;}
  const file=resolve(publicRoot,'.'+pathname);
  if(!file.startsWith(publicRoot+'/')){res.writeHead(404);res.end();return;}
  try{const bytes=await readFile(file);res.writeHead(200,{'Content-Type':pathname.endsWith('.js')?'application/javascript':pathname.endsWith('.ttf')?'font/ttf':pathname.endsWith('.svg')?'image/svg+xml':pathname.endsWith('.webmanifest')?'application/manifest+json':'image/png'});res.end(bytes);}catch{res.writeHead(404);res.end();}
 });
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const address=server.address();if(!address||typeof address==='string')throw Error('Missing test server');origin='http://127.0.0.1:'+address.port;
});
test.afterAll(async()=>{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));});

test('upgrades an existing shell cache and decodes the verified Marker font with the network offline',async({page,context})=>{
 await page.goto(origin);
 await page.evaluate(async()=>{const old=await caches.open('veyocast-player-shell-v5');await old.put('/old-shell',new Response('old'));await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready;});
 await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
 const before=await page.evaluate(async fontPath=>{const names=await caches.keys(),cache=await caches.open('veyocast-player-shell-v6');return{oldRemoved:!names.includes('veyocast-player-shell-v5'),fontCached:Boolean(await cache.match(fontPath))};},fontPath);
 expect(before).toEqual({oldRemoved:true,fontCached:true});
 await context.setOffline(true);
 try{
  await page.reload();await expect(page.getByRole('heading',{name:'Onze club'})).toBeVisible();
  const font=await page.evaluate(async fontPath=>{const response=await fetch(fontPath),bytes=await response.arrayBuffer(),hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');const face=await new FontFace('OfflineOnzeTrots',`url(${fontPath})`,{weight:'400'}).load();document.fonts.add(face);document.querySelector('h1')!.style.fontFamily='OfflineOnzeTrots';return{bytes:bytes.byteLength,hash,status:face.status};},fontPath);
  expect(font).toEqual({bytes:73276,hash:'a73712ce4f3b32d3c7a1a657d56c6aaf50c719b7fa7fe0541905fe77f5a9906c',status:'loaded'});
  const cdp=await context.newCDPSession(page);await cdp.send('DOM.enable');await cdp.send('CSS.enable');const{root}=await cdp.send('DOM.getDocument');const{nodeId}=await cdp.send('DOM.querySelector',{nodeId:root.nodeId,selector:'h1'});const{fonts}=await cdp.send('CSS.getPlatformFontsForNode',{nodeId});expect(fonts.length).toBeGreaterThan(0);expect(fonts.every(font=>font.isCustomFont&&font.postScriptName==='PermanentMarker-Regular')).toBe(true);await cdp.detach();
 }finally{await context.setOffline(false);}
});
