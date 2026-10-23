import Link from 'next/link';
import {notFound,redirect} from 'next/navigation';
import {Button} from '@veyocast/ui';
import {syncDynamicConfigurationSchema,syncSlideAssets,type SyncSlidePresentation} from '@veyocast/contracts';
import {requireTenantControlSession} from '../../../../../../lib/control-session';
import {createControlSupabaseClient} from '../../../../../../lib/supabase/server';
import {loadStudioProject,loadStudioMediaAssets} from '../../../studio/data';
import {SyncDynamicEditor} from '../../sync-dynamic-editor';
import {syncConnectedAuthoringType} from '../../sync-sportlink-binding';

export default async function NewSyncSourcePage({searchParams}:{searchParams:Promise<{project?:string;family?:string}>}){
 const session=await requireTenantControlSession('tenant.dynamic_slide.write'),query=await searchParams;
 if(!session.isLive||!session.tenantId)return <p role="alert" className="notice notice--critical">Een beveiligde tenantsessie is nodig. Meld je opnieuw aan om een bronontwerp te maken.</p>;
 const client=await createControlSupabaseClient();if(!client)return <p role="alert" className="notice notice--critical">De veilige verbinding ontbreekt. Probeer opnieuw zodra je verbonden bent.</p>;
 let presentation:SyncSlidePresentation;
 if(query.project){
  if(!/^[a-f0-9-]{36}$/i.test(query.project))notFound();
  const project=await loadStudioProject(session.tenantId,true,query.project);
  if(!project.project?.document.syncPresentation)notFound();
  presentation=project.project.document.syncPresentation;
 }else{
  if(query.family&&!syncConnectedAuthoringType(query.family))notFound();
  redirect(`/dashboard/studio/new?family=${encodeURIComponent(query.family??'menu')}&mode=connected`);
 }
 const slideType=syncConnectedAuthoringType(presentation.family,presentation.rendererVersion);
 if(!slideType)return <><p role="status" className="notice">Open voor dit brontype de bestaande bronselectie. Het handmatige ontwerp blijft behouden.</p><Button asChild variant="secondary"><Link href="/dashboard/sources">Bronnen beheren</Link></Button></>;
 const seed={...presentation,name:query.project?presentation.name.slice(0,112)+' · bron':presentation.name,rows:[],news:[],ownRowIndexes:[],home:undefined,away:undefined,match:undefined,poll:undefined,youtubeUrl:undefined,...(presentation.rendererVersion==='sync-onzetrots-v1'?{rich:undefined}:{}),state:'ready' as const};
 const secondsPerPage=5;
 const configuration=syncDynamicConfigurationSchema.parse({schemaVersion:1,kind:'dynamic',rendererVersion:seed.rendererVersion,sourceRevision:seed.sourceRevision,slideType,secondsPerPage,seed});
 const [sources,templates,media]=await Promise.all([
  client.from('dynamic_data_sources').select('id,name,kind,provider_status,last_successful_sync_at,last_error_code').eq('tenant_id',session.tenantId).in('kind',slideType==='menu'?['manual_products','twelve_excel']:slideType==='news'?['rss']:slideType==='ledscores_live_match'?['ledscores']:['sportlink']).eq('status','active').order('name').limit(200),
  client.from('dynamic_templates').select('current_published_version_id,orientation,slug').eq('slide_type',slideType).eq('status','published').order('slug').limit(100),
  loadStudioMediaAssets(client,session.tenantId,syncSlideAssets(seed).flatMap(asset=>asset.kind==='tenant'?[asset.mediaAssetId]:[])),
 ]);
 if(sources.error||templates.error)return <p role="alert" className="notice notice--critical">De gecontroleerde bronnen en templates konden niet worden geladen. Er is niets aangemaakt; probeer opnieuw.</p>;
 const template=templates.data.find(value=>value.orientation===seed.orientation&&value.slug.includes('-dark-'))??templates.data.find(value=>value.orientation===seed.orientation);
 const connections=slideType==='ledscores_live_match'?await client.from('ledscores_connections').select('data_source_id').eq('tenant_id',session.tenantId).eq('status','active').limit(201):null;
 if(connections?.error||connections&&connections.data.length>200)return <p role="alert" className="notice notice--critical">De beschikbare wedstrijdbronnen konden niet volledig worden bevestigd. Je oorspronkelijke ontwerp blijft behouden; controleer de bron en probeer opnieuw.</p>;
 const availableSources=connections?sources.data.filter(source=>connections.data.some(connection=>connection.data_source_id===source.id)):sources.data;
 if(!template?.current_published_version_id||!availableSources.length)return <><p role="status" className="notice">Voor dit ontwerp is eerst een actieve {slideType==='menu'?'productbron':slideType==='news'?'nieuwsbron':slideType==='ledscores_live_match'?'vrijgegeven LED Scores-bron':'Sportlink-bron'} en een gepubliceerd template in het gekozen formaat nodig. Je oorspronkelijke ontwerp blijft behouden.</p><Button asChild variant="secondary"><Link href="/dashboard/sources">Bronnen beheren</Link></Button></>;
 return <SyncDynamicEditor tenantId={session.tenantId} slideId={null}versionId={null}createKey={query.project??(['menu','news'].includes(slideType)?slideType:`${slideType}:${presentation.family}`)}initialRevision={0}initialRequest={{templateVersionId:template.current_published_version_id,dataSourceId:'',configuration:{maxItems:200,syncConfiguration:configuration,...(slideType==='ledscores_live_match'?{liveMatch:{template:'scoreboard',showClock:true,showTimeline:false,timelineLimit:0,outsideMatchBehavior:'last_known',staleBehavior:'freeze'}}:{})}}}sources={availableSources}templates={templates.data}assets={media.assets}error={media.error}/>;
}
