import 'server-only';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {SyncSportlinkOptions,SyncSportlinkTeam} from './sync-sportlink-binding';

/** Read only the selected tenant source. Credentials and provider responses are
 * never selected here; actual dataset rights remain canonical SQL authority. */
export async function loadSyncSportlinkOptions(client:SupabaseClient,tenantId:string,sourceId:string):Promise<SyncSportlinkOptions>{
 const source=await client.from('dynamic_data_sources').select('id,kind').eq('tenant_id',tenantId).eq('id',sourceId).eq('status','active').maybeSingle();
 if(source.error||source.data?.kind!=='sportlink')throw Error('De Sportlink-bron is niet beschikbaar voor deze vereniging. Controleer de bron en kies opnieuw.');
 const connection=await client.from('sportlink_connections').select('id,selected_team_codes,privacy_people_enabled,privacy_birthdays_enabled').eq('tenant_id',tenantId).eq('data_source_id',sourceId).eq('status','active').maybeSingle();
 if(connection.error||!connection.data)throw Error('De Sportlink-verbinding is niet actief. Je ontwerp blijft behouden; controleer de bronstatus.');
 const allowed=connection.data.selected_team_codes as string[]|null;
 let teamQuery=client.from('sports_teams').select('external_id,name,metadata').eq('tenant_id',tenantId).eq('source_connection_id',connection.data.id).eq('active',true).order('name');
 if(allowed?.length)teamQuery=teamQuery.in('external_id',allowed);
 const [teamResult,rights]=await Promise.all([
  teamQuery.limit(501),
  client.from('sportlink_capabilities').select('article_key,capability,available,enabled').eq('tenant_id',tenantId).eq('connection_id',connection.data.id).order('article_key').limit(201),
 ]);
 if(teamResult.error||rights.error)throw Error('Teams en datasetrechten konden niet veilig worden gelezen. Je selectie blijft behouden; probeer opnieuw.');
 if((teamResult.data?.length??0)>500||(rights.data?.length??0)>200)throw Error('Deze bron heeft te veel selecties voor één ontwerp. Verfijn de bron bij Bronnen en probeer opnieuw.');
 const teams:SyncSportlinkTeam[]=(teamResult.data??[]).filter(team=>!allowed?.length||allowed.includes(team.external_id)).map(team=>{
  const metadata=team.metadata as {competitionOptions?:unknown}|null,options=Array.isArray(metadata?.competitionOptions)?metadata.competitionOptions:[];
  if(options.length>50)throw Error('Een team heeft te veel competitiecontexten. Verfijn de bronselectie; het opgeslagen ontwerp blijft behouden.');
  const contexts=options.flatMap((value:unknown)=>{
   if(!value||typeof value!=='object'||Array.isArray(value))return[];const item=value as Record<string,unknown>,competitionId=text(item.externalId,200);if(!competitionId)return[];
   return[{competitionId,label:[text(item.name,200),text(item.poolName,200),text(item.season,80)].filter(Boolean).join(' · ')||competitionId,phaseId:text(item.period,200),poolId:text(item.poolExternalId,200),seasonId:text(item.season,80)}];
  });
  return{externalId:team.external_id,name:team.name,contexts};
 });
 const result={sourceId,teams,capabilities:(rights.data??[]).map(row=>({article:row.article_key,capability:row.capability,available:row.available,enabled:row.enabled})),privacyPeople:Boolean(connection.data.privacy_people_enabled),privacyBirthdays:Boolean(connection.data.privacy_birthdays_enabled)};
 if(Buffer.byteLength(JSON.stringify(result),'utf8')>512*1024)throw Error('De bronselectie is te groot. Verfijn teams bij Bronnen en laad opnieuw.');
 return result;
}
function text(value:unknown,maximum:number){return typeof value==='string'&&value.trim().length>0&&value.trim().length<=maximum?value.trim():null;}
