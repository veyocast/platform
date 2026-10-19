"use server";
import {createHash} from 'node:crypto';
import {revalidatePath} from 'next/cache';
import {playerDynamicTemplatePayloadSchema,syncDynamicConfigurationSchema,syncDynamicRequestSchema,syncSlideAssets,type PlayerDynamicTemplateAsset} from '@veyocast/contracts';
import {projectSyncDynamicSnapshot} from '@veyocast/content-templates/sync-dynamic-projector';
import {requireTenantControlSession} from '../../../../lib/control-session';
import {createControlSupabaseClient} from '../../../../lib/supabase/server';
import {collectPreviewMediaAssetIds,loadPreviewAssets} from '../../../../lib/dynamic-preview-assets';
import {syncDynamicCommandSchema,type SyncDynamicCommand,type SyncDynamicRequest} from './sync-dynamic-command';
import {loadSyncSportlinkOptions} from './sync-sportlink-data';

export async function loadSyncDynamicBindingOptionsAction(input:{sourceId:string}){
 const session=await requireTenantControlSession('tenant.dynamic_slide.write');
 if(!session.isLive||!session.tenantId||!input||Object.keys(input).length!==1||typeof input.sourceId!=='string'||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(input.sourceId))return{ok:false,error:'Kies een beschikbare Sportlink-bron binnen je vereniging.'}as const;
 const client=await createControlSupabaseClient();if(!client)return{ok:false,error:'De veilige gegevensverbinding ontbreekt. Je selectie blijft behouden; probeer opnieuw.'}as const;
 try{return{ok:true,options:await loadSyncSportlinkOptions(client,session.tenantId,input.sourceId)}as const;}
 catch(error){return{ok:false,error:error instanceof Error&&/^(De Sportlink|Teams en dataset|Deze bron|Een team|De bronselectie)/.test(error.message)?error.message:'De bronselectie kon niet worden gelezen. Je ontwerp blijft behouden; probeer opnieuw.'}as const;}
}

export async function mutateSyncDynamicAuthoringAction(input:SyncDynamicCommand){
 const session=await requireTenantControlSession('tenant.dynamic_slide.write');
 const parsed=syncDynamicCommandSchema.safeParse(input);
 if(!session.isLive||!session.tenantId||session.tenantStatus!=='active'||!parsed.success)return{ok:false,rejected:true,error:'Controleer je sessie, rechten en ontwerpkeuze. Je invoer blijft behouden.'}as const;
 const client=await createControlSupabaseClient();
 if(!client)return{ok:false,error:'De veilige verbinding ontbreekt. Bevestig dezelfde opdracht opnieuw zodra je verbonden bent.'}as const;
 const value=parsed.data;
 const sourceReview=value.action==='save'&&'configuration'in value.request&&Boolean(value.request.configuration.menuPriceSourceReview);
 const result=await client.rpc('mutate_sync_dynamic_authoring_v1',{p_tenant_id:session.tenantId,p_action:value.action,p_slide_id:value.slideId,p_version_id:value.versionId,p_expected_revision:value.expectedRevision,p_request:value.request,p_idempotency_key:value.idempotencyKey});
 if(result.error?.code==='40001'&&sourceReview)return{ok:false,rejected:true,conflict:true,error:'De nieuwe bronprijzen of conceptversie zijn gewijzigd. Lees het voorbeeld opnieuw en bevestig de actuele bron en prijzen.'}as const;
 if(result.error)return{ok:false,rejected:['22023','23514','42501','23503','23505','P0002','55000'].includes(result.error.code),error:'De bronopdracht kon niet worden bevestigd. Controleer de selectie en je rechten; probeer dezelfde opdracht opnieuw bij verbindingsverlies.'}as const;
 const data=result.data as Record<string,unknown>|null;
 if(!data||typeof data.slideId!=='string')return{ok:false,error:'Het ontvangstbewijs is onvolledig. Bevestig dezelfde opdracht opnieuw.'}as const;
 const canonicalConfiguration=data.configuration&&typeof data.configuration==='object'&&!Array.isArray(data.configuration)?data.configuration as Record<string,unknown>:undefined;
 if(data.outcome==='conflict')return{ok:false,rejected:true,conflict:true,error:'Dit concept is intussen gewijzigd. Je invoer blijft behouden; lees de actuele versie voordat je verdergaat.'}as const;
 const canonicalPriceSet=canonicalConfiguration?.menuPriceSet as Record<string,unknown>|undefined;
 if(sourceReview&&(!canonicalConfiguration||!syncDynamicConfigurationSchema.safeParse(canonicalConfiguration.syncConfiguration).success||!canonicalPriceSet||canonicalPriceSet.dataSourceId!==('dataSourceId'in value.request?value.request.dataSourceId:undefined)||typeof canonicalPriceSet.hash!=='string'||!/^[a-f0-9]{64}$/.test(canonicalPriceSet.hash)))return{ok:false,error:'De nieuwe bron en prijsset zijn niet volledig bevestigd. Controleer dezelfde opdracht opnieuw.'}as const;
 for(const path of['/dashboard/slides','/dashboard/content',`/dashboard/slides/${data.slideId}`,`/dashboard/slides/${data.slideId}/edit`])revalidatePath(path);
 return{ok:true,slideId:data.slideId,editRevision:typeof data.editRevision==='number'?data.editRevision:undefined,...(canonicalConfiguration?{configuration:canonicalConfiguration}:{})}as const;
}

/** Read-only canonical preview. Only authorized output supplies provider IDs. */
export async function previewSyncDynamicAuthoringAction(input:SyncDynamicRequest){
 const session=await requireTenantControlSession('tenant.dynamic_slide.write');
 const request=syncDynamicRequestSchema.safeParse(input);
 const cfg=syncDynamicConfigurationSchema.safeParse(request.success?request.data.configuration.syncConfiguration:null);
 if(!session.isLive||!session.tenantId||!request.success||!cfg.success)return{ok:false,error:'Kies een beschikbare bron en een geldig ontwerp om de actuele inhoud te bekijken.'}as const;
 const client=await createControlSupabaseClient();if(!client)return{ok:false,error:'De veilige gegevensverbinding ontbreekt. Je ontwerp blijft behouden; probeer opnieuw.'}as const;
 const reply=await client.rpc('preview_dynamic_slide_v1',{p_tenant_id:session.tenantId,p_name:cfg.data.seed.name,p_template_version_id:input.templateVersionId,p_data_source_id:input.dataSourceId,p_configuration_json:input.configuration});
 const data=reply.data as Record<string,unknown>|null;
 if(reply.error||!data||!data.data||typeof data.data!=='object')return{ok:false,error:'De actuele bronselectie kon niet worden geladen. Controleer bron, team en periode; het opgeslagen ontwerp is behouden.'}as const;
 const snapshot=data.data as Record<string,unknown>,ids=[...new Set([...collectPreviewMediaAssetIds(snapshot),...syncSlideAssets(cfg.data.seed).flatMap(ref=>ref.kind==='tenant'?[ref.mediaAssetId]:[])])];
 const assets=await loadPreviewAssets(client,session.tenantId,ids);
 if(ids.some(id=>!assets.has(id)))return{ok:false,error:'Een afbeelding uit deze bron is nog niet beschikbaar. De laatste volledige preview blijft staan; ververs na bronherstel.'}as const;
 const payload=playerDynamicTemplatePayloadSchema.safeParse({schemaVersion:1,slideType:data.slideType,orientation:data.orientation,snapshotId:data.previewId,snapshotHash:createHash('sha256').update(JSON.stringify(snapshot)).digest('hex'),templateVersionId:data.templateVersionId,templateSlug:data.templateSlug,data:snapshot,assets:Object.fromEntries(assets)});
 if(!payload.success)return{ok:false,error:'De brongegevens voldoen niet aan het afspeelcontract. Controleer de bron; je ontwerp is behouden.'}as const;
 const projected=projectSyncDynamicSnapshot(payload.data,cfg.data.seed);
 if(!projected.ok)return{ok:false,error:'Deze bronselectie past niet volledig in het ontwerp. Beperk de selectie of verdeel de inhoud over een reeks.'}as const;
 const priceReviewHash=typeof data.priceReviewHash==='string'&&/^[a-f0-9]{64}$/.test(data.priceReviewHash)?data.priceReviewHash:undefined;
 return{ok:true,...(priceReviewHash?{priceReviewHash}:{}),presentation:projected.presentation,assets:Object.fromEntries(assets)as Record<string,PlayerDynamicTemplateAsset>,source:data.source as {providerStatus:string;lastSuccessfulSyncAt:string|null;lastErrorCode:string|null}}as const;
}
