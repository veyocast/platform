/** DOM v2 has no raster to hide an incomplete application shell. Before the
 * candidate can activate, the actual current code/style URLs must be present
 * alongside the same document in the existing offline shell cache. */
export async function hasCompleteSyncDomShell(signal?:AbortSignal):Promise<boolean>{
 if(typeof navigator==='undefined'||!('serviceWorker'in navigator)||typeof document==='undefined'||typeof caches==='undefined')return false;
 if(signal?.aborted)return false;
 let timer:ReturnType<typeof setTimeout>|undefined,settled=false;
 let onAbort:(()=>void)|undefined,onController:(()=>void)|undefined;
 try{
  const registration=await Promise.race([
   (async()=>{
    const registration=await navigator.serviceWorker.ready;
    if(settled||signal?.aborted||!registration.active)return null;
    if(navigator.serviceWorker.controller)return registration;
    // ready can resolve immediately before clients.claim(). Treat control as
    // part of the same preparation, rather than failing and waiting a poll.
    return new Promise<ServiceWorkerRegistration|null>(resolve=>{
     onController=()=>{if(navigator.serviceWorker.controller)resolve(registration);};
     navigator.serviceWorker.addEventListener('controllerchange',onController);onController();
    });
   })(),
   new Promise<null>(resolve=>{timer=setTimeout(()=>resolve(null),15000);onAbort=()=>resolve(null);signal?.addEventListener('abort',onAbort,{once:true});}),
  ]);
  if(!registration?.active||!navigator.serviceWorker.controller||signal?.aborted)return false;
  const origin=location.origin;
  const assets=[...new Set([...document.querySelectorAll<HTMLScriptElement|HTMLLinkElement>('script[src],link[rel="stylesheet"][href]')].flatMap(element=>{
   const url=new URL(element instanceof HTMLScriptElement?element.src:element.href,origin);
   return url.origin===origin&&url.pathname.startsWith('/_next/static/')?[url.href]:[];
  }))];
  if(!assets.length)return false;
  for(const name of await caches.keys()){
   if(!name.startsWith('veyocast-player-shell-'))continue;
   const cache=await caches.open(name);
   // Both supported entrypoints and the exact current navigation can own the
   // matching shell after an app update; '/' may still be the older entry.
   const documents=[...new Set([location.href,new URL(location.pathname,origin).href,new URL('/',origin).href,new URL('/lg',origin).href])];
   let matchingDocument=false;
   for(const path of documents){const shell=await cache.match(path);if(!shell?.ok)continue;const html=await shell.text();if(assets.every(asset=>html.includes(new URL(asset).pathname))){matchingDocument=true;break;}}
   if(!matchingDocument)continue;
   const responses=await Promise.all(assets.map(asset=>cache.match(asset)));
   if(responses.every(response=>response?.ok))return true;
  }
  return false;
 }catch{return false;}finally{settled=true;if(timer)clearTimeout(timer);if(onAbort)signal?.removeEventListener('abort',onAbort);if(onController)navigator.serviceWorker.removeEventListener('controllerchange',onController);}
}
