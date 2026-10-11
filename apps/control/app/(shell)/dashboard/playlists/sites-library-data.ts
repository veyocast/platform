import"server-only";
import{createControlSupabaseClient}from"../../../../lib/supabase/server";
import type{PlaylistListFilter,PlaylistListRow}from"./data";

export async function loadSitesPlaylistList(tenantId:string,filter:PlaylistListFilter){
 const supabase=await createControlSupabaseClient();if(!supabase)throw new Error('De beveiligde datasessie ontbreekt.');
 const page=Math.max(1,Math.min(5001,filter.page??1));
 const result=await supabase.rpc('list_publisher_playlists_v1',{p_tenant_id:tenantId,p_offset:(page-1)*20,p_search:filter.query||null,p_status:filter.status??'all',p_sort:filter.sort??'updated',p_assignment:filter.assignment??'all'});
 if(result.error)throw new Error('De playlistbibliotheek kon niet volledig worden geladen. Probeer opnieuw.');
 const value=result.data as{total:number;rows:Array<Omit<PlaylistListRow,'coverPreviewUrls'|'warningCount'>&{coverAssetIds:string[]}>};
 const ids=[...new Set(value.rows.flatMap(row=>row.coverAssetIds))];
 const variants=ids.length?await supabase.from('media_variants').select('asset_id,storage_path,variant_type').eq('tenant_id',tenantId).in('asset_id',ids).in('variant_type',['thumbnail','original']):{data:[],error:null};
 if(variants.error)throw new Error('De privévoorbeelden konden niet volledig worden geladen.');
 const urls=new Map<string,string>();await Promise.all(ids.map(async id=>{const variant=variants.data?.find(item=>item.asset_id===id&&item.variant_type==='thumbnail')??variants.data?.find(item=>item.asset_id===id&&item.variant_type==='original');if(!variant)return;const signed=await supabase.storage.from('tenant-media').createSignedUrl(variant.storage_path,600);if(signed.data?.signedUrl)urls.set(id,signed.data.signedUrl);}));
 return{error:null,page,pageCount:Math.max(1,Math.ceil(value.total/20)),total:Number(value.total),rows:value.rows.map((row):PlaylistListRow=>({...row,revision:Number(row.revision),itemCount:Number(row.itemCount),totalDurationSeconds:Number(row.totalDurationSeconds),assignedScreenCount:Number(row.assignedScreenCount),coverPreviewUrls:row.coverAssetIds.flatMap(id=>urls.has(id)?[urls.get(id)!]:[]),warningCount:0}))};
}
