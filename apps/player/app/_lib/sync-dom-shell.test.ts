import{afterEach,expect,it,vi}from'vitest';
import{hasCompleteSyncDomShell}from'./sync-dom-shell';
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});
it('requires the matching document and all current code, including the LG entrypoint after an app update',async()=>{
 class Script{src='https://player.example/_next/static/new.js';}
 const entries=new Map<string,Response>([['https://player.example/',new Response('<script src="/_next/static/old.js"></script>')],['https://player.example/lg',new Response('<script src="/_next/static/new.js"></script>')],['https://player.example/_next/static/new.js',new Response('trusted app bytes')]]);
 vi.stubGlobal('HTMLScriptElement',Script);vi.stubGlobal('document',{querySelectorAll:()=>[new Script()]});vi.stubGlobal('location',{origin:'https://player.example',href:'https://player.example/lg?syncMs=1000',pathname:'/lg'});
 vi.stubGlobal('navigator',{serviceWorker:{ready:Promise.resolve({active:{}}),controller:{}}});vi.stubGlobal('caches',{keys:async()=>['veyocast-player-shell-v5'],open:async()=>({match:async(path:string)=>entries.get(path)?.clone()})});
 expect(await hasCompleteSyncDomShell()).toBe(true);
 entries.delete('https://player.example/_next/static/new.js');expect(await hasCompleteSyncDomShell()).toBe(false);
 entries.set('https://player.example/_next/static/new.js',new Response('trusted app bytes'));entries.delete('https://player.example/lg');expect(await hasCompleteSyncDomShell()).toBe(false);
});
it('removes a completed readiness wait abort handler',async()=>{
 vi.stubGlobal('document',{querySelectorAll:()=>[]});vi.stubGlobal('location',{origin:'https://player.example'});vi.stubGlobal('navigator',{serviceWorker:{ready:Promise.resolve({active:{}}),controller:{}}});vi.stubGlobal('caches',{});
 const signal=new AbortController().signal,add=vi.spyOn(signal,'addEventListener'),remove=vi.spyOn(signal,'removeEventListener');
 expect(await hasCompleteSyncDomShell(signal)).toBe(false);expect(remove).toHaveBeenCalledWith('abort',add.mock.calls[0]![1]);
});

it('includes clients.claim in first-install readiness and releases its controller listener',async()=>{
 class Script{src='https://player.example/_next/static/new.js';}
 class Worker extends EventTarget{controller:object|null=null;ready=Promise.resolve({active:{}});}
 const worker=new Worker(),remove=vi.spyOn(worker,'removeEventListener');
 vi.stubGlobal('HTMLScriptElement',Script);vi.stubGlobal('document',{querySelectorAll:()=>[new Script()]});vi.stubGlobal('location',{origin:'https://player.example',href:'https://player.example/',pathname:'/'});vi.stubGlobal('navigator',{serviceWorker:worker});
 vi.stubGlobal('caches',{keys:async()=>['veyocast-player-shell-v5'],open:async()=>({match:async(path:string)=>new Response(path.endsWith('.js')?'trusted app bytes':'<script src="/_next/static/new.js"></script>')})});
 let completed=false;const preparation=hasCompleteSyncDomShell().then(value=>{completed=true;return value;});await Promise.resolve();expect(completed).toBe(false);
 worker.controller={};worker.dispatchEvent(new Event('controllerchange'));expect(await preparation).toBe(true);expect(remove).toHaveBeenCalledWith('controllerchange',expect.any(Function));
});
