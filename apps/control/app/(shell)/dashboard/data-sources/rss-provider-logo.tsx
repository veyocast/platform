import Link from 'next/link';
import {Button} from '@veyocast/ui';
import {createControlSupabaseClient} from '../../../../lib/supabase/server';
import {saveRssProviderLogo} from './actions';

/** Own, already validated media only. A logo choice never fetches the feed. */
export async function RssProviderLogo({tenantId,sourceId,canManage}:{tenantId:string;sourceId:string;canManage:boolean}){
 const client=await createControlSupabaseClient();if(!client)return null;
 const [source,media]=await Promise.all([
  client.from('dynamic_data_sources').select('config_json').eq('tenant_id',tenantId).eq('id',sourceId).eq('kind','rss').maybeSingle(),
  client.from('media_assets').select('id,title').eq('tenant_id',tenantId).eq('kind','image').eq('status','ready').is('deleted_at',null).order('created_at',{ascending:false}).limit(101),
 ]);
 if(source.error||media.error||!source.data)return <p role="status">De logo-instellingen konden niet worden geladen. Probeer opnieuw; je huidige feed blijft behouden.</p>;
 const config=source.data.config_json as Record<string,unknown>|null,selected=typeof config?.providerLogoOverrideMediaAssetId==='string'?config.providerLogoOverrideMediaAssetId:'';
 const assets=(media.data??[]).slice(0,100);
 if(selected&&!assets.some(asset=>asset.id===selected)){
  const saved=await client.from('media_assets').select('id,title').eq('tenant_id',tenantId).eq('id',selected).eq('kind','image').eq('status','ready').is('deleted_at',null).maybeSingle();
  if(saved.data)assets.unshift(saved.data);
 }
 return <form action={saveRssProviderLogo} className="stack">
  <input type="hidden" name="sourceId" value={sourceId}/>
  <label className="demo-field"><span>Logo van de nieuwsleverancier</span><select name="mediaAssetId" defaultValue={selected} disabled={!canManage}>
   <option value="">Logo uit de feed gebruiken</option>{assets.map(asset=><option key={asset.id} value={asset.id}>{asset.title}</option>)}
  </select></label>
  <p>Gebruik het echte uitgeverslogo. Zonder bruikbaar logo toont de nieuwsslide de bronnaam. Upload een ontbrekend leverancierlogo eerst bij <Link href="/dashboard/media">Media</Link>.</p>
  {media.data?.length===101&&<p>De honderd nieuwste afbeeldingen staan in de keuze, samen met je opgeslagen logo.</p>}
  {canManage&&<Button type="submit" variant="secondary">Leverancierlogo opslaan</Button>}
 </form>;
}
