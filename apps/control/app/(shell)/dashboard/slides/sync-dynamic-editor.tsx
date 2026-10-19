"use client";
import {useEffect,useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {Button} from '@veyocast/ui';
import {syncDynamicConfigurationSchema,syncDynamicRequestSchema,syncDynamicFamilies,syncSlidePresentationSchema,type SyncDynamicConfiguration,type SyncSlidePresentation,type PlayerDynamicTemplateAsset} from '@veyocast/contracts';
import {SyncStudioFrame} from '../studio/sync-studio-frame';
import {SyncStudioField as Field} from '../studio/sync-studio-field';
import {mutateSyncDynamicAuthoringAction,previewSyncDynamicAuthoringAction,loadSyncDynamicBindingOptionsAction} from './sync-dynamic-actions';
import {syncDynamicCommandSchema,type SyncDynamicCommand,type SyncDynamicRequest} from './sync-dynamic-command';
import type {loadSyncDynamicEditorData} from './sync-dynamic-data';
import {clearSyncSportlinkBinding,compileSyncSportlinkBinding,isSyncSportlinkType,readSyncSportlinkSelection,syncSportlinkSelectionPolicy,type SyncSportlinkOptions,type SyncSportlinkSelection} from './sync-sportlink-binding';
import {SyncSportlinkControls} from './sync-sportlink-controls';

type Props=Omit<NonNullable<Awaited<ReturnType<typeof loadSyncDynamicEditorData>>>,'slideId'|'versionId'>&{tenantId:string;slideId:string|null;versionId:string|null;createKey?:string};
type Draft={request:SyncDynamicRequest;seconds:string};
const serial=(value:unknown)=>JSON.stringify(value);

/** UI scratch is recoverable input only. The canonical writer/receipt remains
 * authoritative, and preview reads never enqueue a snapshot or render. */
export function SyncDynamicEditor(props:Props){
 const router=useRouter();
 const initial:Draft={request:props.initialRequest,seconds:String((props.initialRequest.configuration.syncConfiguration as SyncDynamicConfiguration).secondsPerPage)};
 const [draft,setDraft]=useState(initial),[past,setPast]=useState<Draft[]>([]),[future,setFuture]=useState<Draft[]>([]);
 const [revision,setRevision]=useState(props.initialRevision),[baseline,setBaseline]=useState(serial(initial)),[hydrated,setHydrated]=useState(false);
 const [busy,setBusy]=useState(false),[attempt,setAttempt]=useState<SyncDynamicCommand|null>(null),[conflict,setConflict]=useState(false);
 const [message,setMessage]=useState<string|null>(null),[error,setError]=useState<string|null>(props.error),[previewError,setPreviewError]=useState<string|null>(null);
 const [preview,setPreview]=useState<Awaited<ReturnType<typeof previewSyncDynamicAuthoringAction>>|null>(null),[previewing,setPreviewing]=useState(false);
 const [previewKey,setPreviewKey]=useState('');
 const [bindingOptions,setBindingOptions]=useState<SyncSportlinkOptions|null>(null),[bindingsLoading,setBindingsLoading]=useState(false),[bindingsError,setBindingsError]=useState<string|null>(null);
 const recoveryKey=`veyocast.sync.dynamic.draft.v1:${props.tenantId}:${props.slideId??props.createKey??'new'}:${props.versionId??'new'}`;
 const [savedSource,setSavedSource]=useState({sourceId:props.initialRequest.dataSourceId,priceSet:props.initialRequest.configuration.menuPriceSet});
 const [confirmedPriceReview,setConfirmedPriceReview]=useState<string|null>(null);
 const [uncertainPriceAttempt,setUncertainPriceAttempt]=useState(false);
 const cfg=draft.request.configuration.syncConfiguration as SyncDynamicConfiguration;
 const sport=isSyncSportlinkType(cfg.slideType),optionsReady=bindingOptions?.sourceId===draft.request.dataSourceId;
 const compiled=useMemo(()=>{
  const configuration={...draft.request.configuration,syncConfiguration:{...cfg,secondsPerPage:Number(draft.seconds)}};
  if(!sport)return{request:{...draft.request,configuration},error:null};
  try{const value=compileSyncSportlinkBinding(configuration.syncConfiguration,configuration,readSyncSportlinkSelection(cfg,configuration),optionsReady?bindingOptions!.teams:[]);return{request:{...draft.request,configuration:value},error:null};}
  catch{return{request:{...draft.request,configuration},error:'Kies de teams en een beschikbare competitie voor dit ontwerp.'};}
 },[draft,cfg,sport,optionsReady,bindingOptions]);
 const request=compiled.request,previewCurrent=previewKey===serial(request);
 const menuSource=['menu','price_list'].includes(cfg.slideType),sourceChanged=Boolean(props.slideId)&&menuSource&&request.dataSourceId!==savedSource.sourceId;
 const priceReviewHash=preview?.ok?preview.priceReviewHash:undefined;
 const sourceReviewKey=sourceChanged&&previewCurrent&&!previewing&&!previewError&&priceReviewHash?serial({request,priceReviewHash}):null;
 const sourcePricesConfirmed=Boolean(sourceReviewKey&&confirmedPriceReview===sourceReviewKey);
 const valid=syncDynamicConfigurationSchema.safeParse(request.configuration.syncConfiguration).success&&syncDynamicRequestSchema.safeParse(request).success&&(!sport||Boolean(optionsReady)&&!bindingsLoading&&!bindingsError&&!compiled.error);
 const dirty=serial(draft)!==baseline,locked=busy||Boolean(attempt)||conflict;
 const draftRef=useRef(draft);draftRef.current=draft;
 const allowNavigation=useRef(false);
 useEffect(()=>{
  try{const raw=sessionStorage.getItem(recoveryKey);if(raw&&raw.length<300000){const saved=JSON.parse(raw),candidate=saved.draft as Draft;
   const seed=syncSlidePresentationSchema.safeParse((candidate?.request?.configuration?.syncConfiguration as SyncDynamicConfiguration)?.seed);
   if(seed.success&&typeof candidate.seconds==='string'&&typeof candidate.request.templateVersionId==='string'&&typeof candidate.request.dataSourceId==='string'){
    setDraft(candidate);if(saved.attempt&&syncDynamicCommandSchema.safeParse(saved.attempt).success&&saved.attempt.slideId===props.slideId&&saved.attempt.versionId===props.versionId){setAttempt(saved.attempt);setUncertainPriceAttempt(Boolean(saved.attempt.request?.configuration?.menuPriceSourceReview));}
    setMessage('Je bewaarde invoer is hersteld. Een onbekende opdracht wordt met hetzelfde ontvangstbewijs gecontroleerd.');
   }
  }}catch{setError('De tijdelijke invoer kon niet worden gelezen. De serverversie blijft behouden; controleer je ontwerp.');}
  setHydrated(true);
 },[recoveryKey,props.slideId,props.versionId]);
 useEffect(()=>{if(!hydrated||allowNavigation.current)return;try{if(!dirty&&!attempt)sessionStorage.removeItem(recoveryKey);else sessionStorage.setItem(recoveryKey,serial({draft,attempt}));}catch{setError('Je browser kan de tijdelijke invoer niet bewaren. Houd deze pagina open en bevestig opslaan voordat je vertrekt.');}},[draft,attempt,dirty,hydrated,recoveryKey]);
 useEffect(()=>{if(!dirty&&!attempt)return;const leave=(event:BeforeUnloadEvent)=>{if(allowNavigation.current)return;event.preventDefault();event.returnValue='';};window.addEventListener('beforeunload',leave);return()=>window.removeEventListener('beforeunload',leave);},[dirty,attempt]);
 useEffect(()=>{
  if(!valid||!hydrated){setPreviewing(false);return;}let cancelled=false;setPreviewing(true);
  const timer=window.setTimeout(()=>{void previewSyncDynamicAuthoringAction(request).then(result=>{if(cancelled)return;if(result.ok){setPreview(result);setPreviewKey(serial(request));setPreviewError(null);}else setPreviewError(result.error);}).catch(()=>{if(!cancelled)setPreviewError('De actuele bron kon niet worden gelezen. Je invoer en de laatste volledige preview blijven behouden.');}).finally(()=>{if(!cancelled)setPreviewing(false);});},400);
  return()=>{cancelled=true;window.clearTimeout(timer);};
 },[request,valid,hydrated]);
 useEffect(()=>{
  if(!sport||!draft.request.dataSourceId){setBindingOptions(null);setBindingsLoading(false);setBindingsError(null);return;}
  let cancelled=false;setBindingsLoading(true);setBindingsError(null);
  void loadSyncDynamicBindingOptionsAction({sourceId:draft.request.dataSourceId}).then(result=>{if(cancelled)return;if(result.ok)setBindingOptions(result.options);else{setBindingOptions(null);setBindingsError(result.error);}}).catch(()=>{if(!cancelled){setBindingOptions(null);setBindingsError('De teamselectie is niet bevestigd. Je invoer blijft behouden; controleer de bron en probeer opnieuw.');}}).finally(()=>{if(!cancelled)setBindingsLoading(false);});
  return()=>{cancelled=true;};
 },[sport,draft.request.dataSourceId]);
 function edit(next:Draft){if(locked)return;setPast(values=>[...values.slice(-19),draftRef.current]);setFuture([]);setDraft(next);setMessage(null);setError(null);}
 function patch(patch:Partial<SyncSlidePresentation>){
  const seed={...cfg.seed,...patch};
  const template=props.templates.find(value=>value.current_published_version_id===draft.request.templateVersionId&&value.orientation===seed.orientation)??props.templates.find(value=>value.orientation===seed.orientation);
  if(!template?.current_published_version_id){setError('Voor deze oriëntatie is nog geen gepubliceerd brontemplate beschikbaar. De huidige keuze blijft behouden.');return;}
  edit({...draft,request:{...draft.request,templateVersionId:template.current_published_version_id,configuration:{...draft.request.configuration,syncConfiguration:{...cfg,seed}}}});
 }
 function changeBinding(selection:SyncSportlinkSelection){
  const maximum=syncSportlinkSelectionPolicy(cfg).maximum;if(selection.contexts.length>maximum){setError(`Kies maximaal ${maximum} teams voor dit ontwerp. Je vorige selectie blijft behouden; maak de selectie kleiner.`);return;}
  const prior=draft.request.configuration.birthday as Record<string,unknown>|undefined;
  const configuration={...clearSyncSportlinkBinding(draft.request.configuration),teamSelection:{mode:selection.mode,teamContexts:selection.contexts},...(cfg.slideType==='sport_birthdays'?{birthday:{...prior,period:{days:selection.birthdayDays,mode:selection.birthdayDays===21?'next_21_days':selection.birthdayDays===14?'next_14_days':'next_7_days'}}}:{})};
  edit({...draft,request:{...draft.request,configuration}});
 }
 function changeSource(sourceId:string){
  let configuration=sport?clearSyncSportlinkBinding(draft.request.configuration):{...draft.request.configuration};
  if(menuSource){
   const {menuPriceSet:_oldSet,menuPriceSourceReview:_oldReview,...ordinary}=configuration;void _oldSet;void _oldReview;configuration=ordinary;
   if(sourceId===savedSource.sourceId&&savedSource.priceSet)configuration={...configuration,menuPriceSet:savedSource.priceSet};
   setConfirmedPriceReview(null);
  }
  edit({...draft,request:{...draft.request,dataSourceId:sourceId,configuration}});
 }
 async function command(action:'save'|'publish'){
  if(busy||conflict||!hydrated||(!attempt&&!valid))return;
  if(!attempt&&sourceChanged&&!sourcePricesConfirmed){setError('Controleer de nieuwe bronprijzen en bevestig dat je ze wilt overnemen. De opgeslagen bron en publicaties blijven behouden.');return;}
  const reviewedRequest=sourceChanged?{...request,configuration:{...request.configuration,menuPriceSourceReview:{sourceId:request.dataSourceId,priceReviewHash,confirmed:true}}}:request;
  const next:SyncDynamicCommand=attempt??{action:props.slideId?action:'create',slideId:props.slideId,versionId:props.versionId,expectedRevision:revision,request:action==='publish'?{}:reviewedRequest,idempotencyKey:crypto.randomUUID()};
  try{sessionStorage.setItem(recoveryKey,serial({draft,attempt:next}));}catch{setError('Het opdrachtbewijs kan niet lokaal worden bewaard. Maak browseropslag vrij en probeer opnieuw; er is niets verstuurd.');return;}
  setAttempt(next);setBusy(true);setError(null);
  try{const result=await mutateSyncDynamicAuthoringAction(next);
   const priceChangeAttempt='configuration'in next.request&&Boolean(next.request.configuration.menuPriceSourceReview);
   if(!result.ok){setError(result.error);if(result.rejected){if(!priceChangeAttempt||!uncertainPriceAttempt||('conflict'in result&&result.conflict))setAttempt(null);if('conflict'in result&&result.conflict)setConflict(true);}else if(priceChangeAttempt)setUncertainPriceAttempt(true);return;}
   setAttempt(null);setUncertainPriceAttempt(false);
   if(next.action==='create'){
    allowNavigation.current=true;sessionStorage.removeItem(recoveryKey);router.replace('/dashboard/slides/'+result.slideId);return;
   }else if(next.action==='publish'){
    sessionStorage.removeItem(recoveryKey);setBaseline(serial(draft));setMessage('De volledige bronuitvoer wordt voorbereid. Bekijk de status voordat je deze versie aan een playlist toevoegt.');setConflict(true);
   }else{
    if(!Number.isInteger(result.editRevision)){setError('De server bevestigde geen volledige revisie. Controleer dezelfde opdracht opnieuw.');setAttempt(next);if(priceChangeAttempt)setUncertainPriceAttempt(true);return;}
    const savedConfiguration='configuration'in result?result.configuration:undefined;
    const savedRequest='configuration'in next.request?next.request:request;
    const canonicalDraft=savedConfiguration?{...draft,request:{...savedRequest,configuration:savedConfiguration}}:draft;
    if(savedConfiguration){setDraft(canonicalDraft);setSavedSource({sourceId:savedRequest.dataSourceId,priceSet:savedConfiguration.menuPriceSet});setConfirmedPriceReview(null);}
    setRevision(result.editRevision!);setBaseline(serial(canonicalDraft));setMessage('Je bronontwerp is opgeslagen. De gepubliceerde scherminhoud blijft behouden.');
    if(result.editRevision!<props.initialRevision){setConflict(true);setMessage('De oorspronkelijke opdracht is bevestigd. Lees de actuele serverversie voordat je verder bewerkt.');}
   }
  }catch{if('configuration'in next.request&&next.request.configuration.menuPriceSourceReview)setUncertainPriceAttempt(true);setError('Het antwoord is verloren gegaan. Je invoer en oorspronkelijke opdracht blijven behouden; bevestig dezelfde opdracht opnieuw.');}
  finally{setBusy(false);}
 }
 const facts=preview?.ok?preview.presentation:null;
 const display:SyncSlidePresentation=facts?{...cfg.seed,rows:facts.rows,news:facts.news,ownRowIndexes:facts.ownRowIndexes,home:facts.home,away:facts.away,match:facts.match,state:facts.state,club:facts.club}: {...cfg.seed,state:'empty'};
 const previewAssets:Record<string,PlayerDynamicTemplateAsset>=preview?.ok?preview.assets:{};
 const source=props.sources.find(source=>source.id===draft.request.dataSourceId);
 return <SyncStudioFrame presentation={cfg.seed} previewPresentation={display} initialTab={props.slideId?'content':'data'} primarySaveLabel={props.slideId?'Opslaan':'Maken en voorbereiden'} connectedData allowedFamilies={syncDynamicFamilies[cfg.slideType]}
  assets={props.assets} resolveAsset={asset=>asset.kind==='system'?asset.path:previewAssets[asset.mediaAssetId]?.url??props.assets.find(value=>value.id===asset.mediaAssetId)?.sourceUrl??undefined}
  secondsPerPage={draft.seconds} onSecondsChange={seconds=>edit({...draft,seconds})} onChange={patch}
  scratch={{rowsText:'',lineupText:''}} onScratchChange={()=>undefined}
  revision={revision} readOnly={conflict} busy={locked||!hydrated} dirty={dirty||Boolean(attempt)} canSave={valid&&!conflict&&(!sourceChanged||sourcePricesConfirmed||Boolean(attempt))&&(dirty||Boolean(attempt))&&(Boolean(props.slideId)||Boolean(attempt)||Boolean(facts)&&previewCurrent&&!previewing&&!previewError)}
  canUndo={past.length>0} canRedo={future.length>0}
  onUndo={()=>{const previous=past.at(-1);if(previous&&!locked){setPast(values=>values.slice(0,-1));setFuture(values=>[draft,...values]);setDraft(previous);}}}
  onRedo={()=>{const next=future[0];if(next&&!locked){setFuture(values=>values.slice(1));setPast(values=>[...values,draft]);setDraft(next);}}}
  onSave={()=>void command(attempt?.action==='publish'?'publish':'save')} saveLabel={attempt?'Opdracht bevestigen':'Opslaan'}
  feedback={<>{message&&<p role="status" className="notice notice--success">{message}</p>}{error&&<p role="alert" className="notice notice--critical">{error}</p>}{previewError&&<p role="status" className="notice notice--warning">{previewError}</p>}{attempt&&!busy&&<Button onClick={()=>void command(attempt.action==='publish'?'publish':'save')}>Dezelfde opdracht bevestigen</Button>}{conflict&&<><p className="notice">Bij openen van de serverversie wordt je tijdelijke invoer vervangen door het opgeslagen ontwerp.</p><Button onClick={()=>{allowNavigation.current=true;sessionStorage.removeItem(recoveryKey);window.location.reload();}} variant="secondary">Serverversie openen</Button></>}</>}
  outputControls={props.slideId?<><Button disabled={busy||Boolean(attempt)||dirty||!valid||conflict||previewing||!previewCurrent||Boolean(previewError)||!facts} onClick={()=>void command('publish')}>Afspeeluitvoer voorbereiden</Button><Button asChild variant="ghost"><Link href={`/dashboard/slides/${props.slideId}`}>Versiestatus bekijken</Link></Button></>:<p className="vc-property-hint">Maken en voorbereiden bewaart een nieuw gekoppeld bronontwerp en maakt de volledige afspeeluitvoer gereed. Voeg het daarna bewust aan een playlist toe.</p>}
  sourceControls={<><Field label="Gekoppelde bron"><select value={draft.request.dataSourceId} onChange={event=>changeSource(event.target.value)}>{!source&&<option value={draft.request.dataSourceId}>{draft.request.dataSourceId?'Bron nu niet beschikbaar':'Kies een bron'}</option>}{props.sources.map(source=><option key={source.id}value={source.id}>{source.name}</option>)}</select></Field>
   {sourceChanged&&<div className="vc-source-binding"><strong>Nieuwe bron en prijzen overnemen</strong><p>Je gepubliceerde menu’s houden hun vastgelegde prijzen. Controleer het volledige voorbeeld van de nieuwe bron; opslaan legt deze bronprijzen vast in dit concept.</p><label className="check-row"><input type="checkbox" checked={sourcePricesConfirmed} disabled={!sourceReviewKey||locked} onChange={event=>setConfirmedPriceReview(event.target.checked?sourceReviewKey:null)}/><span>Ik heb de nieuwe bron en prijzen gecontroleerd</span></label></div>}
   {sport&&<SyncSportlinkControls cfg={cfg}configuration={draft.request.configuration}options={optionsReady?bindingOptions:null}loading={bindingsLoading}error={bindingsError??compiled.error}onChange={changeBinding}/>}
   <div className="vc-source-binding"><strong>{!source?'Kies een bron':previewing?'Brongegevens controleren':previewError?'Broncontrole nodig':facts?.state==='empty'?'Nu geen inhoud':facts?'Gecontroleerde brongegevens':'Brongegevens nog niet bevestigd'}</strong><p>{!source?'Kies de gecontroleerde bron die dit ontwerp moet gebruiken.':previewError?'De broncontrole is niet bevestigd. Je invoer en de laatste volledige preview blijven behouden.':previewing?'De bronselectie wordt gecontroleerd; de laatste volledige preview blijft beschikbaar.':source.last_error_code?'De bron meldt een probleem. De laatst beschikbare volledige inhoud blijft behouden.':'De beschikbare brongegevens komen via de bestaande koppeling.'}</p></div>
   <div className="vc-form-grid"><Field label="Rijen per pagina"><input type="number"min={1}max={8}value={cfg.seed.rowsPerPage}onChange={event=>patch({rowsPerPage:Math.min(8,Math.max(1,Number(event.target.value)||1))})}/></Field><Field label="Bronregels"><input readOnly value={facts?.family==='rss'?facts.news.length:facts?.rows.length??0}/></Field></div>
   <Button asChild variant="secondary"><Link href="/dashboard/sources">Bronnen beheren</Link></Button>
  </>}/>
}
