import {afterEach,describe,expect,it,vi} from "vitest";
import {uploadBackground} from "./upload-media";
const id="10000000-0000-4000-8000-000000000217";
const file=(name="clubbeeld.png")=>new File(["bytes"],name,{type:"image/png"});
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json"}});
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();});
describe("Clubverhaal upload acknowledgement",()=>{
 it("binds an opt-in editor upload to its original actor scope",async()=>{
  const fetch=vi.fn().mockResolvedValueOnce(reply({ok:true,data:{assetId:id}})).mockResolvedValueOnce(reply({media:[{id,image:"https://private.example.test/signed.png"}]}));vi.stubGlobal("fetch",fetch);
  await uploadBackground(file(),"tenant:original-actor");expect(fetch.mock.calls[0]![1].headers).toEqual({"X-VeyoCast-Actor-Scope":"tenant:original-actor"});
 });
 it("shows the actual server cause and recovery without querying a fabricated receipt",async()=>{
  const fetch=vi.fn().mockResolvedValue(reply({ok:false,error:{code:"INVALID_FILE",message:"De afbeelding kon niet worden verwerkt.",recovery:"Exporteer het bestand opnieuw."}},422));vi.stubGlobal("fetch",fetch);
  await expect(uploadBackground(file())).rejects.toThrow("De afbeelding kon niet worden verwerkt. Exporteer het bestand opnieuw.");expect(fetch).toHaveBeenCalledTimes(1);
 });
 it("reports a proxy size rejection even if its response is HTML",async()=>{
  vi.stubGlobal("fetch",vi.fn().mockResolvedValue(new Response("<h1>Too large</h1>",{status:413})));
  await expect(uploadBackground(file())).rejects.toThrow("Verklein de afbeelding");
 });
 it("waits for the acknowledged ID's verified library preview and preserves its checksum",async()=>{
  vi.useFakeTimers();const checksum="a".repeat(64);
  const fetch=vi.fn().mockResolvedValueOnce(reply({ok:true,data:{assetId:id,processing:false,title:"Clubbeeld"}})).mockResolvedValueOnce(reply({media:[]})).mockResolvedValueOnce(reply({media:[{id,image:"https://private.example.test/signed.png",checksumSha256:checksum}]}));vi.stubGlobal("fetch",fetch);
  const result=uploadBackground(file());await vi.advanceTimersByTimeAsync(1000);
  await expect(result).resolves.toEqual({assetId:id,previewUrl:"https://private.example.test/signed.png",checksumSha256:checksum});expect(fetch).toHaveBeenCalledTimes(3);
 });
 it("keeps uploaded bytes unselected if the library cannot verify them",async()=>{
  vi.stubGlobal("fetch",vi.fn().mockResolvedValueOnce(reply({ok:true,data:{assetId:id}})).mockResolvedValueOnce(reply({error:"unavailable"},503)));
  await expect(uploadBackground(file())).rejects.toThrow("upload het bestand niet opnieuw");
 });
 it.each(["x.png",`${"a".repeat(180)}.png`])("supplies a valid upload title for filename %s",async name=>{
  const fetch=vi.fn().mockResolvedValueOnce(reply({ok:true,data:{assetId:id}})).mockResolvedValueOnce(reply({media:[{id,image:"https://private.example.test/signed.png"}]}));vi.stubGlobal("fetch",fetch);
  await uploadBackground(file(name));const title=(fetch.mock.calls[0]![1].body as FormData).get("title") as string;expect(title.length).toBeGreaterThanOrEqual(2);expect(title.length).toBeLessThanOrEqual(120);
 });
});
