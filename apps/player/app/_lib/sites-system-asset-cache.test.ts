import {readFile} from "node:fs/promises";
import {resolve} from "node:path";
import {afterEach,describe,expect,it,vi} from "vitest";
import {prepareSitesSystemAssets,sitesSystemAssetMetadata} from "./sites-system-asset-cache";
import type {PlayerMediaStore} from "./player-media-store";
class MemoryMediaStore implements PlayerMediaStore {
 readonly entries=new Map<string,Response>();
 async get(key:string){return this.entries.get(key)?.clone();}
 async put(key:string,value:Response){this.entries.set(key,value.clone());}
 async delete(key:string){return this.entries.delete(key);}
 async keys(){return [...this.entries.keys()];}
 async resolvePlaybackUrl(key:string){return {url:key};}
}
const trustedDownload=vi.fn(async(path:string)=>{const bytes=await readFile(resolve(process.cwd(),"public",path.slice(1)));return {bytes:Uint8Array.from(bytes).buffer,mimeType:"application/octet-stream"};});
afterEach(()=>{trustedDownload.mockClear();vi.restoreAllMocks();});
describe("the separate trusted Sites system cache",()=>{
 it("verifies the actual audited bytes once per hash and reuses the full offline union",async()=>{
  const store=new MemoryMediaStore();const create=vi.spyOn(URL,"createObjectURL");const revoke=vi.spyOn(URL,"revokeObjectURL");
  const prepared=await prepareSitesSystemAssets({store,download:trustedDownload});expect(prepared).not.toBeNull();expect(Object.keys(prepared!.urls)).toHaveLength(sitesSystemAssetMetadata.length);
  const unique=new Set(sitesSystemAssetMetadata.map(value=>value.checksumSha256));expect(trustedDownload).toHaveBeenCalledTimes(unique.size);expect(store.entries.size).toBe(unique.size);
  for(const [path,url]of Object.entries(prepared!.urls)){expect(path.startsWith("/")).toBe(true);expect(url).toMatch(/^blob:/);}
  const font=sitesSystemAssetMetadata.find(value=>value.mimeType.startsWith("font/"))!;expect(create.mock.calls.some(([blob])=>blob instanceof Blob&&blob.type===font.mimeType)).toBe(true);
  prepared!.dispose();expect(revoke).toHaveBeenCalledTimes(unique.size);trustedDownload.mockClear();
  const offline=await prepareSitesSystemAssets({store,download:trustedDownload});expect(offline).not.toBeNull();expect(trustedDownload).not.toHaveBeenCalled();offline!.dispose();
 },20000);
 it("repairs corrupt cached bytes and preserves the last verified files when a download fails",async()=>{
  const store=new MemoryMediaStore();const first=sitesSystemAssetMetadata[0]!;const key=`/__veyocast-player-cache/${first.checksumSha256}`;await store.put(key,new Response("corrupt"));
  const download=vi.fn(async(path:string)=>{if(path!==first.path)throw Error("PRIVATE_UPSTREAM_MESSAGE");return trustedDownload(path);});const revoke=vi.spyOn(URL,"revokeObjectURL");
  expect(await prepareSitesSystemAssets({store,download})).toBeNull();expect((await store.get(key))?.headers.get("Content-Length")).toBe(String(first.bytes));expect(revoke).toHaveBeenCalled();
 });
 it("does not fetch or create object URLs after cancellation",async()=>{const controller=new AbortController();controller.abort();const create=vi.spyOn(URL,"createObjectURL");expect(await prepareSitesSystemAssets({signal:controller.signal,store:new MemoryMediaStore(),download:trustedDownload})).toBeNull();expect(trustedDownload).not.toHaveBeenCalled();expect(create).not.toHaveBeenCalled();});
});
