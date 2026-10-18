/** Focused cross-module handover checks; no HTTP listener or browser automation.
 * Run: node scripts/qa-handover.mjs
 * Tests only local prototype behavior, not real authentication/devices/providers.
 */
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
import {createServer} from 'vite';
import {JSDOM,VirtualConsole} from 'jsdom';

const dom=new JSDOM('<!doctype html><html><head></head><body><div id="root"></div></body></html>',{url:'https://veyocast.test/?design=sync',pretendToBeVisual:true,virtualConsole:new VirtualConsole()});
const {window}=dom;
for(const key of ['window','document','navigator','location','history','localStorage','HTMLElement','HTMLInputElement','HTMLSelectElement','HTMLTextAreaElement','Element','SVGElement','Node','Event','MouseEvent','FormData','getComputedStyle']) Object.defineProperty(globalThis,key,{configurable:true,writable:true,value:key==='window'?window:window[key]});
window.scrollTo=()=>{};
window.matchMedia=query=>({matches:query.includes('prefers-reduced-motion'),media:query,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
globalThis.requestAnimationFrame=window.requestAnimationFrame.bind(window);
globalThis.cancelAnimationFrame=window.cancelAnimationFrame.bind(window);
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
globalThis.ResizeObserver=class{observe(){} unobserve(){} disconnect(){}};
const [{default:React,act},{createRoot}]=await Promise.all([import('react'),import('react-dom/client')]);
const h=React.createElement,key='veyocast-v1-design-lab-v3',requestKey='veyocast-marketing-inquiries-v1';
let vite,mounted,app,store,Admin,Marketing;
let passed=0;const failures=[];const originalError=console.error;const warnings=[];
console.error=(...args)=>warnings.push(args.map(String).join(' '));
function Probe(){app=store.useApp();return null;}
function fixture(patch){const data=structuredClone(store.seed);patch?.(data);return data;}
async function cleanup(){if(mounted){await act(async()=>mounted.unmount());mounted=null;}document.getElementById('root').replaceChildren();}
async function mount({url='/?design=sync',data=fixture(),component,preserveStorage=false}={}){await cleanup();if(!preserveStorage)localStorage.clear();history.replaceState(null,'',url);localStorage.setItem(key,JSON.stringify(data));mounted=createRoot(document.getElementById('root'));await act(async()=>mounted.render(h(store.AppProvider,null,h(Probe),component)));}
const norm=value=>(value||'').replace(/\s+/g,' ').trim();
function button(label,scope=document){const match=[...scope.querySelectorAll('button')].find(el=>norm(el.textContent)===label||el.getAttribute('aria-label')===label);if(!match)throw Error('Missing button: '+label);return match;}
async function click(el){if(!el||el.disabled)throw Error('Unavailable button: '+el?.textContent);await act(async()=>el.dispatchEvent(new window.MouseEvent('click',{bubbles:true})));}
async function fill(el,value){if(!el)throw Error('Missing form control');const proto=el.tagName==='SELECT'?window.HTMLSelectElement.prototype:el.tagName==='TEXTAREA'?window.HTMLTextAreaElement.prototype:window.HTMLInputElement.prototype;await act(async()=>{Object.getOwnPropertyDescriptor(proto,'value').set.call(el,value);el.dispatchEvent(new window.Event('input',{bubbles:true}));el.dispatchEvent(new window.Event('change',{bubbles:true}));});}
async function check(name,run){try{await run();passed++;process.stdout.write('PASS '+name+'\n');}catch(error){failures.push({name,message:error.message});process.stdout.write('FAIL '+name+': '+error.message+'\n');}finally{await cleanup();}}

try{
 vite=await createServer({root:resolve(dirname(fileURLToPath(import.meta.url)),'..'),server:{middlewareMode:true,hmr:false,watch:null},appType:'custom',logLevel:'error',optimizeDeps:{noDiscovery:true,entries:[]}});
 if(vite.httpServer!==null)throw Error('QA may not start an HTTP listener');
 [store,{AdminPage:Admin},{default:Marketing}]=await Promise.all([vite.ssrLoadModule('/src/store.tsx'),vite.ssrLoadModule('/src/modules/Admin.tsx'),vite.ssrLoadModule('/src/Marketing.tsx')]);

 await check('legacy design link always resolves to the only Sync direction',async()=>{
  await mount({url:'/?design=obsolete&page=playlists&id=p1'});
  assert.deepEqual({designs:store.designs.map(d=>d.id),design:app.design,route:app.route,id:app.selectedId},{designs:['sync'],design:'sync',route:'playlists',id:'p1'});
 });

 await check('Editor and Support preserve complementary content/device permissions',async()=>{
  await mount({data:fixture(d=>{d.settings.sessionRole='Editor';})});
  await act(async()=>app.update(d=>{d.content[0].title='Editor change';}));
  await act(async()=>app.update(d=>{d.screens[0].name='Forbidden editor change';}));
  const editorOK=app.data.content[0].title==='Editor change'&&app.data.screens[0].name!=='Forbidden editor change';
  await act(async()=>app.update(d=>{d.settings.sessionRole='Support';}));
  await act(async()=>app.update(d=>{d.screens[0].lastSeen='Support diagnosis';}));
  await act(async()=>app.update(d=>{d.content[0].title='Forbidden support change';}));
  assert.ok(editorOK&&app.data.screens[0].lastSeen==='Support diagnosis'&&app.data.content[0].title==='Editor change');
 });

 await check('Editor can process a queued mobile upload into the shared media state',async()=>{
  await mount({data:fixture(d=>{d.settings.sessionRole='Editor';d.settings.mobile={queue:[{id:'qa-image',name:'QA image',url:'data:image/png;base64,AA==',size:2,status:'queued'}]};}),component:h(Admin,{section:'mobile'})});
  await click(button('Media'));
  await click(button('Upload verwerken'));
  assert.ok(app.data.settings.mobile.queue[0].status==='ready'&&app.data.media?.some(m=>m.id==='qa-image'));
 });

 await check('custom publishing capability can publish price changes and a new immutable release',async()=>{
  await mount({data:fixture(d=>{d.settings.sessionRole='Prijsbeheer';d.settings.customRoles=[{id:'qa-publisher',name:'Prijsbeheer',permissions:['Content lezen','Publiceren']}];d.products[0].price=4.75;}),component:h(Admin,{section:'products'})});
  await click(button('Prijzen bijwerken'));
  await click(button('Gecontroleerde prijzen publiceren'));
  const priceRelease=app.data.releases.find(r=>r.at==='Zojuist · prijsupdate');
  assert.ok(app.data.settings.menuPriceSnapshot.pr1===4.75&&priceRelease?.priceSnapshot.pr1===4.75&&app.data.screens.find(s=>s.id==='s2').confirmedVersion==='v8');
 });

 await check('renaming the active custom team role preserves member and session capabilities',async()=>{
  await mount({data:fixture(d=>{d.settings.sessionRole='Teamcoördinator';d.settings.customRoles=[{id:'qa-team',name:'Teamcoördinator',permissions:['Content lezen','Team beheren']}];d.members[1].role='Teamcoördinator';}),component:h(Admin,{section:'team'})});
  await click(button('Rollen & rechten'));
  await click(button('Bewerken'));
  await fill(document.querySelector('input[placeholder="Bijvoorbeeld: Kantinebeheer"]'),'Clubcoördinator');
  await click(button('Rol bewaren'));
  assert.ok(app.data.settings.sessionRole==='Clubcoördinator'&&app.data.members[1].role==='Clubcoördinator'&&app.data.settings.customRoles[0].name==='Clubcoördinator');
 });

 await check('same-origin marketing form imports once into the administrative inbox',async()=>{
  await mount({url:'/demo/',component:h(Marketing,{page:'/demo/'})});
  for(const [name,value] of Object.entries({name:'QA Contact',email:'qa@example.test',organization:'QA Club',sector:'Sportvereniging',message:'Bekijk onze schermen'})) await fill(document.querySelector(`[name="${name}"]`),value);
  await click(document.querySelector('input[name="demoAcknowledged"]'));
  const form=document.querySelector('form');await act(async()=>form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));
  const local=JSON.parse(localStorage.getItem(requestKey)||'[]');
  await mount({preserveStorage:true,component:h(Admin,{section:'marketing'})});
  await click(button('Lokale aanvragen ophalen'));await click(button('Lokale aanvragen ophalen'));
  assert.ok(local.length===1&&app.data.requests.length===1&&app.data.requests[0].organization==='QA Club'&&app.data.requests[0].status==='new');
 });

 await check('player deep link follows history and closing removes player from the URL',async()=>{
  await mount({url:'/?design=sync&player=s3'});
  const initial=app.playerId;
  await act(async()=>{history.pushState(null,'','/?design=sync&page=screens&player=s1');window.dispatchEvent(new window.PopStateEvent('popstate'));});
  const next=app.playerId;
  await act(async()=>app.closePlayer());
  assert.ok(initial==='s3'&&next==='s1'&&app.playerId===null&&!new URLSearchParams(location.search).has('player'));
 });
}finally{await cleanup();await vite?.close();dom.window.close();console.error=originalError;}
process.stdout.write(JSON.stringify({passed,failed:failures.length,failures,consoleWarnings:[...new Set(warnings)].length})+'\n');
process.exitCode=failures.length?1:0;
