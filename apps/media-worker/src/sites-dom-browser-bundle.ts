import {build} from "esbuild";
import {fileURLToPath} from "node:url";
let cachedBundle:Promise<string>|undefined;

/** Compiles this fixed trusted entry once per worker; no author-supplied modules. */
export function getSitesBrowserRenderBundle():Promise<string>{
 if(cachedBundle)return cachedBundle;
 const pending=(async()=>{
  let deadline:ReturnType<typeof setTimeout>|undefined;
  try{
   const result=await Promise.race([build({entryPoints:[fileURLToPath(new URL("./sites-dom-browser-renderer.tsx",import.meta.url))],bundle:true,write:false,platform:"browser",format:"iife",jsx:"automatic",minify:true,define:{"process.env.NODE_ENV":"\"production\""},logLevel:"silent"}),new Promise<never>((_,reject)=>{deadline=setTimeout(()=>reject(Error("sites_browser_bundle_timeout")),15000);})]);
   const script=result.outputFiles[0]?.text;
   if(!script||Buffer.byteLength(script)>2*1024*1024)throw Error("sites_browser_bundle_invalid");
   return script;
  }finally{clearTimeout(deadline);}
 })();
 cachedBundle=pending;
 void pending.catch(()=>{if(cachedBundle===pending)cachedBundle=undefined;});
 return pending;
}
