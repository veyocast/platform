import audit from "../../../../packages/content-templates/src/sites-system-assets.json";
import {createPlayerMediaStore,type PlayerMediaStore} from "./player-media-store";
import {downloadMedia} from "./media-download";
import {sha256Hex} from "./player-cache";
export const sitesSystemAssetCacheName="veyocast-player-sites-system-v1";
export const sitesSystemAssetMaximumBytes=64*1024*1024;
export const sitesSystemAssetMetadata=audit.files.map(asset=>({path:asset.path,checksumSha256:asset.sha256,bytes:asset.bytes,mimeType:asset.mimeType}));
/** Fixed audited assets only. This cache is separate from playlist retention. */
export async function prepareSitesSystemAssets({signal,store=createPlayerMediaStore(sitesSystemAssetCacheName),download=downloadMedia}:{signal?:AbortSignal;store?:PlayerMediaStore;download?:typeof downloadMedia}={}):Promise<{urls:Record<string,string>;dispose:()=>void}|null>{
 const controller=new AbortController();const abort=()=>controller.abort();signal?.addEventListener("abort",abort,{once:true});if(signal?.aborted)controller.abort();const timeout=setTimeout(abort,30000);const objectUrls:string[]=[];
 try{
  const unique=[...new Map(sitesSystemAssetMetadata.map(asset=>[asset.checksumSha256,asset])).values()];if(unique.reduce((sum,asset)=>sum+asset.bytes,0)>sitesSystemAssetMaximumBytes)throw Error("SITES_SYSTEM_BUDGET_INVALID");
  const urlsByHash=new Map<string,string>();
  for(const asset of unique){if(controller.signal.aborted)throw Error("SITES_SYSTEM_PREPARE_CANCELLED");const key=`/__veyocast-player-cache/${asset.checksumSha256}`;let cached=await store.get(key);if(cached){const bytes=await cached.clone().arrayBuffer();if(bytes.byteLength!==asset.bytes||await sha256Hex(bytes)!==asset.checksumSha256){await store.delete(key);cached=undefined;}}
   if(!cached){const result=await download(asset.path,asset.checksumSha256,asset.bytes,controller.signal);if(result.bytes.byteLength!==asset.bytes||await sha256Hex(result.bytes)!==asset.checksumSha256)throw Error("SITES_SYSTEM_ASSET_INVALID");cached=new Response(result.bytes,{headers:{"Content-Type":asset.mimeType,"Content-Length":String(asset.bytes)}});await store.put(key,cached.clone());}
   const url=URL.createObjectURL(new Blob([await cached.arrayBuffer()],{type:asset.mimeType}));objectUrls.push(url);urlsByHash.set(asset.checksumSha256,url);
  }
  const retained=new Set(unique.map(asset=>`/__veyocast-player-cache/${asset.checksumSha256}`));for(const key of await store.keys())if(key.startsWith("/__veyocast-player-cache/")&&!retained.has(key))await store.delete(key);
  if(controller.signal.aborted)throw Error("SITES_SYSTEM_PREPARE_CANCELLED");
  return {urls:Object.fromEntries(sitesSystemAssetMetadata.map(asset=>[asset.path,urlsByHash.get(asset.checksumSha256)!])),dispose:()=>objectUrls.forEach(url=>URL.revokeObjectURL(url))};
 }catch{objectUrls.forEach(url=>URL.revokeObjectURL(url));return null;}finally{clearTimeout(timeout);signal?.removeEventListener("abort",abort);}
}
