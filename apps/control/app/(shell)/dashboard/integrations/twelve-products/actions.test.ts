import { beforeEach, describe, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({ capability: vi.fn(), rpc: vi.fn(), from: vi.fn(), eq: vi.fn(), revalidate: vi.fn() }));
vi.mock("../../../../../lib/control-session", () => ({ requireTenantCapability: f.capability }));
vi.mock("../../../../../lib/supabase/server", () => ({ createControlSupabaseClient: async () => ({ rpc: f.rpc, from: (table: string) => { f.from(table); const query = { select: () => query, eq: (key: string, value: unknown) => { f.eq(key, value); return query; }, is: () => query, maybeSingle: async () => ({data:{name:"Stored product",description:null,category:"Dranken",price_cents:235,vat_rate:9,unit:"stuk",barcode:null,source_external_id:"0123"},error:null}) }; return query; } }) }));
vi.mock("next/cache", () => ({ revalidatePath: f.revalidate }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); } }));
import { manageProduct, setProductAvailability, updateProduct } from "./actions";
const tenant="a1910000-0000-4000-8000-000000009001", product="a1910000-0000-4000-8000-000000009002", source="a1910000-0000-4000-8000-000000009003", command="a1910000-0000-4000-8000-000000009004";
function form(values: Record<string,string>) { const result=new FormData(); for(const [key,value]of Object.entries(values))result.set(key,value);return result; }
beforeEach(()=>{vi.resetAllMocks();f.capability.mockResolvedValue({isLive:true,tenantId:tenant});f.rpc.mockResolvedValue({data:{outcome:"updated"},error:null});});
describe("product commands use integer prices and server authorization",()=>{
 it("keeps comma-decimal prices exact and preserves article identity through the guarded command",async()=>{
  await expect(manageProduct(form({action:"update",productId:product,revision:"4",name:"Club product",price:"2,35",vatRate:"9",externalId:"ART-42",active:"on",idempotencyKey:command}))).rejects.toThrow("succes=product");
  expect(f.capability).toHaveBeenCalledWith("tenant.product.write");expect(f.rpc).toHaveBeenCalledWith("manage_tenant_product_v2",expect.objectContaining({p_tenant_id:tenant,p_product_id:product,p_expected_revision:4,p_idempotency_key:command,p_values:expect.objectContaining({priceCents:235,externalId:"ART-42",active:true})}));
 });
 it("rejects fractional-cent and malformed prices before storage",async()=>{
  for(const price of ["2,355","1e3","-1","1,234.56"]) await expect(manageProduct(form({action:"update",productId:product,revision:"4",name:"Product",price}))).rejects.toThrow("fout=invoer");
  expect(f.rpc).not.toHaveBeenCalled();
 });
 it("creates only through the selected manual source with revision zero and stable idempotency",async()=>{
  f.rpc.mockResolvedValue({data:{outcome:"created"},error:null});await expect(manageProduct(form({action:"create",dataSourceId:source,revision:"0",name:"Nieuw product",price:"0,00",active:"on",idempotencyKey:command}))).rejects.toThrow("succes=product");
  expect(f.rpc).toHaveBeenCalledWith("manage_tenant_product_v2",expect.objectContaining({p_product_id:null,p_data_source_id:source,p_expected_revision:0,p_values:expect.objectContaining({priceCents:0})}));
 });
 it("reports conflicts without saved success or page invalidation",async()=>{
  f.rpc.mockResolvedValue({data:{outcome:"conflict",actualRevision:6},error:null});await expect(manageProduct(form({action:"delete",productId:product,revision:"4",idempotencyKey:command}))).rejects.toThrow("fout=conflict");expect(f.revalidate).not.toHaveBeenCalled();
 });
 it("removes using the guarded archive response and no invented product fields",async()=>{
  f.rpc.mockResolvedValue({data:{outcome:"archived",frozenPublicationsPreserved:true},error:null});await expect(manageProduct(form({action:"delete",productId:product,revision:"4",idempotencyKey:command}))).rejects.toThrow("succes=verwijderd");expect(f.rpc).toHaveBeenCalledWith("manage_tenant_product_v2",expect.objectContaining({p_action:"delete",p_values:{}}));
 });
 it("keeps the historical edit action equally strict about fractional cents",async()=>{await expect(updateProduct(form({productId:product,revision:"4",name:"Product",price:"2.355"}))).rejects.toThrow("fout=invoer");expect(f.rpc).not.toHaveBeenCalled();});
});

describe("beschikbaarheidsrij gebruikt bestaande atomic CAS-command",()=>{
 it("wijzigt uitsluitend de gevraagde beschikbaarheid naast werkelijk ingelezen productwaarden",async()=>{
  f.rpc.mockResolvedValue({data:{outcome:"updated",revision:5},error:null});expect(await setProductAvailability({productId:product,expectedRevision:4,active:false,idempotencyKey:command})).toEqual({ok:true,active:false,revision:5});expect(f.eq).toHaveBeenCalledWith("tenant_id",tenant);expect(f.rpc).toHaveBeenCalledWith("manage_tenant_product_v2",expect.objectContaining({p_expected_revision:4,p_idempotency_key:command,p_values:expect.objectContaining({active:false,priceCents:235,externalId:"0123"})}));
 });
 it("laat stale conflicts en verbindingsproblemen zonder vals success of invalidatie",async()=>{
  f.rpc.mockResolvedValue({data:{outcome:"conflict",actualRevision:6},error:null});expect(await setProductAvailability({productId:product,expectedRevision:4,active:false,idempotencyKey:command})).toMatchObject({ok:false,conflict:true});expect(f.revalidate).not.toHaveBeenCalled();f.rpc.mockRejectedValue(new Error("private-db-detail"));const result=await setProductAvailability({productId:product,expectedRevision:4,active:false,idempotencyKey:command});expect(result).toMatchObject({ok:false});expect(JSON.stringify(result)).not.toContain("private-db-detail");
 });
});
