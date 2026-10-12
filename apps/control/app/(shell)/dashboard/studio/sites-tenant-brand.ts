import "server-only";
import type {SitesAssetReference} from "@veyocast/contracts";
import type {createControlSupabaseClient} from "../../../../lib/supabase/server";
type Client=NonNullable<Awaited<ReturnType<typeof createControlSupabaseClient>>>;
/** Freeze the authenticated tenant's verified original logo; absent branding never invents a club. */
export async function getVerifiedSitesTenantBrandLogo(client:Client,tenantId:string):Promise<SitesAssetReference|undefined>{
 const brand=await client.from("studio_tenant_brand_kits").select("logo_media_asset_id").eq("tenant_id",tenantId).maybeSingle();
 const id=brand.data?.logo_media_asset_id;if(brand.error||typeof id!=="string")return undefined;
 const asset=await client.from("media_assets").select("id").eq("tenant_id",tenantId).eq("id",id).eq("kind","image").eq("status","ready").is("deleted_at",null).maybeSingle();if(asset.error||!asset.data)return undefined;
 const variant=await client.from("media_variants").select("checksum_sha256,mime_type,file_size_bytes,storage_path").eq("tenant_id",tenantId).eq("asset_id",id).eq("variant_type","original").maybeSingle();
 if(variant.error||!variant.data||!Number.isFinite(Number(variant.data.file_size_bytes))||Number(variant.data.file_size_bytes)<=0||Number(variant.data.file_size_bytes)>24*1024*1024||!/^([a-f0-9]{64})$/.test(variant.data.checksum_sha256??"")||!["image/png","image/jpeg","image/webp"].includes(variant.data.mime_type)||!variant.data.storage_path.startsWith(`tenants/${tenantId}/assets/${id}/`))return undefined;
 return {kind:"tenant",mediaAssetId:id,checksumSha256:variant.data.checksum_sha256};
}
