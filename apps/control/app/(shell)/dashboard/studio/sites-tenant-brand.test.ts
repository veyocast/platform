import {beforeEach,describe,expect,it,vi} from "vitest";
vi.mock("server-only",()=>({}));
import {getVerifiedSitesTenantBrandLogo} from "./sites-tenant-brand";
const tenant="10000000-0000-4000-8000-000000191603",id="20000000-0000-4000-8000-000000191603",sha="a".repeat(64);
let rows:Record<string,Record<string,unknown>|null>,filters:Array<[string,string,unknown]>;
const client={from:(table:string)=>{const query={select:()=>query,eq:(key:string,value:unknown)=>{filters.push([table,key,value]);return query;},is:(key:string,value:unknown)=>{filters.push([table,key,value]);return query;},maybeSingle:async()=>({data:rows[table],error:null})};return query;}} as unknown as Parameters<typeof getVerifiedSitesTenantBrandLogo>[0];
beforeEach(()=>{filters=[];rows={studio_tenant_brand_kits:{logo_media_asset_id:id},media_assets:{id},media_variants:{checksum_sha256:sha,mime_type:"image/png",file_size_bytes:2048,storage_path:`tenants/${tenant}/assets/${id}/original/logo.png`}};});
describe("frozen verified tenant branding",()=>{
 it("binds every lookup to the authenticated tenant and freezes only the verified original identity",async()=>{expect(await getVerifiedSitesTenantBrandLogo(client,tenant)).toEqual({kind:"tenant",mediaAssetId:id,checksumSha256:sha});for(const table of Object.keys(rows))expect(filters).toContainEqual([table,"tenant_id",tenant]);expect(filters).toContainEqual(["media_assets","status","ready"]);expect(filters).toContainEqual(["media_assets","kind","image"]);expect(filters).toContainEqual(["media_assets","deleted_at",null]);expect(filters).toContainEqual(["media_variants","variant_type","original"]);});
 it("keeps absent or inaccessible branding absent",async()=>{rows.media_assets=null;expect(await getVerifiedSitesTenantBrandLogo(client,tenant)).toBeUndefined();expect(filters.some(([table])=>table==="media_variants")).toBe(false);});
 it.each([{checksum_sha256:"bad"},{mime_type:"image/svg+xml"},{file_size_bytes:0},{file_size_bytes:25*1024*1024},{storage_path:`tenants/30000000-0000-4000-8000-000000191603/assets/${id}/original/logo.png`}])("rejects unsafe logo variants: %j",async delta=>{rows.media_variants={...rows.media_variants,...delta};expect(await getVerifiedSitesTenantBrandLogo(client,tenant)).toBeUndefined();});
});
