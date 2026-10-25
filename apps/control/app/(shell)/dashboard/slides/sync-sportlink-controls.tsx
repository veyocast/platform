'use client';
import type {SyncDynamicConfiguration} from '@veyocast/contracts';
import {SyncStudioField as Field} from '../studio/sync-studio-field';
import {readSyncSportlinkSelection,syncSportlinkAutoContext,syncSportlinkSelectionPolicy,type SyncSportlinkOptions,type SyncSportlinkSelection} from './sync-sportlink-binding';

export function SyncSportlinkControls({configuration,cfg,options,loading,error,onChange}:{configuration:Record<string,unknown>;cfg:SyncDynamicConfiguration;options:SyncSportlinkOptions|null;loading:boolean;error:string|null;onChange:(value:SyncSportlinkSelection)=>void}){
 const policy=syncSportlinkSelectionPolicy(cfg);let selection:SyncSportlinkSelection;
 try{selection=readSyncSportlinkSelection(cfg,configuration);}catch{selection={mode:policy.required?'selected':'all',contexts:[],birthdayDays:7};}
 const teams=options?.teams??[],selected=selection.contexts.map(context=>context.providerTeamId);
 function choose(ids:string[]){onChange({...selection,mode:'selected',contexts:ids.map(id=>selection.contexts.find(context=>context.providerTeamId===id)??syncSportlinkAutoContext(id))});}
 return <>
  {loading&&<p role="status"className="vc-property-hint">Teams en bronrechten controleren…</p>}
  {error&&<p role="status"className="vc-property-hint">{error}</p>}
  {!policy.clubOnly&&<>
   {!policy.required&&<Field label="Teamselectie"><select disabled={!options||loading}value={selection.mode}onChange={event=>onChange({...selection,mode:event.target.value as 'all'|'selected',contexts:[]})}><option value="all">Alle toegestane teams</option><option value="selected">Teams kiezen</option></select></Field>}
   {(policy.required||selection.mode==='selected')&&<Field label={policy.single?'Team':'Teams'}><select disabled={!options||loading}multiple={!policy.single}size={policy.single?undefined:Math.min(5,Math.max(2,teams.length))}value={policy.single?selected[0]??'':selected}onChange={event=>choose([...event.target.selectedOptions].map(option=>option.value).filter(Boolean))}>
    {policy.single&&<option value="">Kies een team</option>}{teams.map(team=><option key={team.externalId}value={team.externalId}>{team.name}</option>)}
   </select></Field>}
   {selection.mode==='selected'&&selection.contexts.map(context=>{const team=teams.find(team=>team.externalId===context.providerTeamId);if(!team)return null;const index=context.competitionSelectionMode==='pinned'?team.contexts.findIndex(option=>option.competitionId===context.competitionId&&option.phaseId===context.phaseId&&option.poolId===context.poolId&&option.seasonId===context.seasonId):-1;
    return <Field key={team.externalId}label={`Competitie · ${team.name}`}><select value={index<0?'auto':String(index)}onChange={event=>{const option=event.target.value==='auto'?null:team.contexts[Number(event.target.value)];const next=option?{providerTeamId:team.externalId,competitionSelectionMode:'pinned' as const,competitionId:option.competitionId,phaseId:option.phaseId,poolId:option.poolId,seasonId:option.seasonId}:syncSportlinkAutoContext(team.externalId);onChange({...selection,contexts:selection.contexts.map(current=>current.providerTeamId===team.externalId?next:current)});}}><option value="auto">Actuele competitie automatisch</option>{team.contexts.map((option,index)=><option key={index}value={index}>{option.label}</option>)}</select></Field>;
   })}
  </>}
  {['sport_program','sport_results','sport_match_of_the_day'].includes(cfg.slideType)&&<Field label="Wedstrijden"><select value={selection.matchLocation??'both'} onChange={event=>onChange({...selection,matchLocation:event.target.value as 'both'|'home'|'away'})}><option value="both">Thuis &amp; uit</option><option value="home">Alleen thuis</option><option value="away">Alleen uit</option></select></Field>}
  {cfg.slideType==='sport_visitor_arrivals'&&['visitors','welcome','team-arrivals'].includes(cfg.seed.family)&&<Field label="Dagen vooruit" hint="Alleen bezoekende teams van eigen thuiswedstrijden. Zonder passende teams wordt de slide overgeslagen."><select value={selection.welcomeDays??'legacy'} onChange={event=>onChange({...selection,welcomeDays:event.target.value==='legacy'?undefined:Number(event.target.value)})}>{selection.welcomeDays===undefined&&<option value="legacy">Bestaand: volgende thuiswedstrijden</option>}{selection.welcomeDays!==undefined&&!Number.isInteger(selection.welcomeDays)&&<option value={selection.welcomeDays}>Bestaand: {selection.welcomeDays*1440} minuten</option>}{Array.from({length:42},(_,i)=><option key={i+1} value={i+1}>{i+1} {i===0?'dag':'dagen'}</option>)}</select></Field>}
  {cfg.slideType==='sport_birthdays'&&<Field label="Verjaardagsperiode"><select value={selection.birthdayDays}onChange={event=>onChange({...selection,birthdayDays:Number(event.target.value)as 7|14|21})}><option value={7}>Komende zeven dagen</option><option value={14}>Komende veertien dagen</option><option value={21}>Komende eenentwintig dagen</option></select></Field>}
  {options&&<p className="vc-property-hint">{options.capabilities.filter(right=>right.available&&right.enabled).length} datasets zijn ingeschakeld en beschikbaar. De broncontrole gebruikt uitsluitend toegestane gegevens; ontbrekende gegevens blijven herkenbaar leeg.</p>}
  {options&&cfg.slideType==='sport_birthdays'&&!options.privacyBirthdays&&<p role="status"className="vc-property-hint">Verjaardagsgegevens zijn voor deze bron niet ingeschakeld. Je ontwerp blijft behouden; beheer de toestemming bij Bronnen of gebruik een handmatig ontwerp.</p>}
 </>;
}
