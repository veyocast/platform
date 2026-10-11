import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSitesSourceDesign } from "./sites-source-design";
const f=vi.hoisted(()=>({session:vi.fn(),rpc:vi.fn(),asset:vi.fn(),original:vi.fn(),admin:vi.fn(),eq:vi.fn()}));
vi.mock("../../../../../../lib/control-session",()=>({requireTenantControlSession:f.session}));
vi.mock("../../../../../../lib/supabase/server",()=>({createControlSupabaseClient:async()=>({rpc:f.rpc,from:(table:string)=>{const query={select:()=>query,eq:(...args:unknown[])=>{f.eq(table,...args);return query;},is:()=>query,maybeSingle:()=>table==="media_assets"?f.asset():f.original(),in:()=>query,then:(resolve:(value:{data:never[]})=>unknown)=>Promise.resolve(resolve({data:[]}))};return query;}})}));
vi.mock("../../../../../../lib/supabase/admin",()=>({createControlAdminClient:f.admin}));
import { loadCanonicalSitesSportlinkPreview } from "./sites-sportlink-preview-data";
const tenant="a1910000-0000-4000-8000-000000006301",source="a1910000-0000-4000-8000-000000006302",template="a1910000-0000-4000-8000-000000006303",preview="a1910000-0000-4000-8000-000000006304",asset="a1910000-0000-4000-8000-000000006305";
const config=()=>({schemaVersion:1,sitesConfiguration:createSitesSourceDesign("sportlink","Actuele training")});
const input=()=>({sourceId:source,name:"Training",templateVersionId:template,orientation:"landscape"as const,expectedSlideType:"sport_trainings",configuration:config()});
beforeEach(()=>{vi.resetAllMocks();f.session.mockResolvedValue({tenantId:tenant});f.asset.mockResolvedValue({data:{id:asset},error:null});f.original.mockResolvedValue({data:{asset_id:asset},error:null});f.rpc.mockResolvedValue({error:null,data:{previewId:preview,slideType:"sport_trainings",orientation:"landscape",templateSlug:"editorial-arena-trainings",templateVersionId:template,data:{type:"sport_trainings",sitesConfiguration:config().sitesConfiguration,sport:{title:"Actuele training",items:[]}}}});});
describe("Sportlink voorbeeld leest uitsluitend gecontroleerde database-inhoud",()=>{
 it("geeft een echt getypt leeg database-resultaat terug zonder writes of provider/adminverkeer",async()=>{
  const result=await loadCanonicalSitesSportlinkPreview(input());expect(result).toMatchObject({ok:true,payload:{snapshotId:preview,slideType:"sport_trainings",data:{sport:{items:[]}}}});expect(f.rpc).toHaveBeenCalledTimes(1);expect(f.rpc.mock.calls[0]?.[0]).toBe("preview_dynamic_slide_v1");expect(f.admin).not.toHaveBeenCalled();
 });
 it("weigert een verdwenen/cross-tenant achtergrond vóór canonical RPC of adminclient",async()=>{
  f.asset.mockResolvedValue({data:null,error:null});const value=input();value.configuration.sitesConfiguration={...value.configuration.sitesConfiguration,background:{kind:"tenant",mediaAssetId:asset,checksumSha256:"a".repeat(64)}};
  expect(await loadCanonicalSitesSportlinkPreview(value)).toMatchObject({ok:false,message:expect.stringContaining("achtergrond")});expect(f.eq).toHaveBeenCalledWith("media_assets","tenant_id",tenant);expect(f.eq).toHaveBeenCalledWith("media_variants","checksum_sha256","a".repeat(64));expect(f.rpc).not.toHaveBeenCalled();expect(f.admin).not.toHaveBeenCalled();
 });
 it("weigert een geldig database-resultaat dat niet bij de gekozen familie hoort",async()=>{
  f.rpc.mockResolvedValue({error:null,data:{slideType:"sport_program",orientation:"landscape"}});expect(await loadCanonicalSitesSportlinkPreview(input())).toMatchObject({ok:false,message:expect.stringContaining("andere familie")});
 });
 it("houdt onbereikbare RPC en providerloze leegte als concrete herstelbare status",async()=>{
  f.rpc.mockRejectedValueOnce(new Error("SQL-private-data"));const failed=await loadCanonicalSitesSportlinkPreview(input());expect(failed).toMatchObject({ok:false,message:expect.stringContaining("Probeer opnieuw")});expect(JSON.stringify(failed)).not.toContain("SQL-private-data");expect(await loadCanonicalSitesSportlinkPreview(input())).toMatchObject({ok:true});
 });
 it("houdt een achtergrond die nog wordt verwerkt buiten snapshots en herstelt na gereedmelding",async()=>{
  const value=input();value.configuration.sitesConfiguration={...value.configuration.sitesConfiguration,background:{kind:"tenant",mediaAssetId:asset,checksumSha256:"a".repeat(64)}};
  f.asset.mockResolvedValueOnce({data:null,error:null});
  expect(await loadCanonicalSitesSportlinkPreview(value)).toMatchObject({ok:false,message:expect.stringContaining("achtergrond")});expect(f.eq).toHaveBeenCalledWith("media_assets","status","ready");expect(f.rpc).not.toHaveBeenCalled();expect(f.admin).not.toHaveBeenCalled();
  expect(await loadCanonicalSitesSportlinkPreview(value)).toMatchObject({ok:true});expect(f.rpc).toHaveBeenCalledOnce();expect(f.rpc.mock.calls[0]?.[0]).toBe("preview_dynamic_slide_v1");
 });

});
