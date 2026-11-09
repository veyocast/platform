"use client";

import { useState,type FormEvent } from "react";
import { matchdayActionInputSchema,type MatchdayAction,type MatchdayActionInput,type MatchdayWorkspace } from "@veyocast/contracts";
import { matchdayActionObjectKey,matchdayPhaseTransitions,matchdayRunState,matchdaySuggestedExpiry } from "@veyocast/domain";
import { Button,MultiSelectDropdown } from "@veyocast/ui";
import { isoToZonedDateTimeLocal,zonedLocalDateTimeToIso } from "../planning/schedule-time";
import { applyMatchdayAction,endMatchdayAction } from "./actions";
import { actionLabels,displayTime,matchLabel,phaseLabels } from "./labels";
import { MatchdayDelegation } from "./delegation";
import type { ConfirmMatchdayCommand } from "./use-command";
import styles from "./matchday.module.css";

type Props={actorScope:string;workspace:MatchdayWorkspace;timezone:string;blocked:boolean;confirm:ConfirmMatchdayCommand};
export function MatchdayOperator({workspace,timezone,blocked,confirm,actorScope}:Props){
 const selected=workspace.selected,publication=selected?.publication;
 const[kind,setKind]=useState<MatchdayActionInput['kind']>("field"),[matchId,setMatchId]=useState(""),[menuKey,setMenuKey]=useState("");
 const[field,setField]=useState(""),[phase,setPhase]=useState("playing"),[kickoff,setKickoff]=useState(""),[endsAt,setEndsAt]=useState("");
 const[screenIds,setScreenIds]=useState<string[]>([]),[reason,setReason]=useState(""),[error,setError]=useState("");
 if(!selected||!publication)return <section className={styles.panel}><h2>Begin met een gecontroleerd draaiboek</h2><p>Kies Instellen om exacte wedstrijden, concrete schermen en gepubliceerde inhoud te kiezen. Een concept stuurt nog niets naar schermen.</p></section>;
 const config=publication.configuration,now=Date.parse(workspace.generatedAt),main=config.matches.find(match=>match.id===config.mainMatchId);
 const active=workspace.enabled&&matchdayRunState(publication.status,config.startsAt,config.endsAt,now)==="active";
 const productAction=kind==="sold_out"||kind==="available";
 const placements=config.roles.find(role=>role.role==="canteen")?.menuFallbacks??[];
 const placementKey=(item:typeof placements[number])=>`menu:${item.menuSnapshotId}:${item.placementId}:${item.productId}`;
 const placement=placements.find(item=>placementKey(item)===menuKey);
 const actualMatchId=kind==="phase"?config.mainMatchId:matchId;
 const objectKey=productAction?menuKey:`match:${actualMatchId??""}:${kind==="field"?"field":"phase"}`;
 const allowed=selected.permittedActions.filter(item=>item.kind===kind&&item.objectId===objectKey&&Date.parse(item.endsAt)>now);
 const allowedIds=new Set(workspace.permissions.canPublish?publication.targets.filter(target=>!productAction||target.role==="canteen").map(target=>target.screenId):allowed.flatMap(item=>item.screenIds));
 const targets=publication.targets.filter(target=>allowedIds.has(target.screenId));
 const actualScreenIds=screenIds.filter(id=>allowedIds.has(id));
 const globalMain=kind==="phase"||((kind==="postponed"||kind==="cancelled")&&actualMatchId===config.mainMatchId);
 const completeMainSelection=!globalMain||publication.targets.every(target=>actualScreenIds.includes(target.screenId));
 const expiry=endsAt||isoToZonedDateTimeLocal(matchdaySuggestedExpiry(kind,config.endsAt,now),timezone);
 const actionKinds=(Object.keys(actionLabels) as Array<MatchdayActionInput['kind']>).filter(value=>workspace.permissions.canPublish||selected.permittedActions.some(item=>item.kind===value&&Date.parse(item.endsAt)>now));
 function selectKind(value:MatchdayActionInput['kind']){setKind(value);setScreenIds([]);setEndsAt("");setError("");}
 function apply(event:FormEvent){event.preventDefault();setError("");try{
  const end=zonedLocalDateTimeToIso(expiry,timezone),base={runbookId:selected!.id,publicationId:publication!.id,requestId:crypto.randomUUID(),expectedRevision:selected!.objectRevisions.find(item=>item.key===objectKey)?.revision??0,screenIds:actualScreenIds,endsAt:end,reason};
  let candidate:unknown;
  if(kind==="sold_out"||kind==="available")candidate=placement?{...base,kind,productId:placement.productId,menuSnapshotId:placement.menuSnapshotId,placementId:placement.placementId}:null;
  else if(kind==="field")candidate={...base,kind,matchId:actualMatchId,field};
  else if(kind==="phase")candidate={...base,kind,matchId:actualMatchId,phase};
  else if(kind==="postponed")candidate={...base,kind,matchId:actualMatchId,newKickoffAt:kickoff?zonedLocalDateTimeToIso(kickoff,timezone):null};
  else candidate={...base,kind,matchId:actualMatchId};
  const parsed=matchdayActionInputSchema.safeParse(candidate);if(!parsed.success){setError("Kies het exacte object, ten minste één toegestaan scherm, een geldige eindtijd en de reden.");return;}
  const input={...parsed.data,expectedRevision:selected!.objectRevisions.find(item=>item.key===matchdayActionObjectKey(parsed.data))?.revision??0},match=config.matches.find(item=>item.id===actualMatchId),label=placement?.productLabel??(match?matchLabel(match,timezone,config.matches):"Hoofdwedstrijd");
  const value=input.kind==="field"?`Nieuw veld: ${input.field}`:input.kind==="phase"?`Nieuwe fase: ${phaseLabels[input.phase]}`:actionLabels[input.kind];
  confirm(`${actionLabels[input.kind]} bevestigen?`,`${label}\n${value}\n${publication!.targets.filter(target=>input.screenIds.includes(target.screenId)).map(target=>target.screenName).join(", ")}\nTot ${displayTime(input.endsAt,timezone)}. Daarna keert de dan geldige bronwaarde of planning terug.\nReden: ${input.reason}`,()=>applyMatchdayAction(input,actorScope));
 }catch{setError("Kies een bestaande lokale datum en tijd binnen het draaiboekvenster.");}}
 function end(action:MatchdayAction){const input={runbookId:selected!.id,publicationId:publication!.id,actionId:action.id,expectedRevision:action.revision,requestId:crypto.randomUUID(),reason:"Tijdelijke actie bewust beëindigd en geldige bron/planning hervat"};confirm("Tijdelijke actie beëindigen?",`${actionLabels[action.kind]} · ${action.value}\n${publication!.targets.filter(target=>action.screenIds.includes(target.screenId)).map(target=>target.screenName).join(", ")}\nDe oude correctie verschijnt niet opnieuw. De actuele bronwaarde of planning keert terug; Playerbewijs volgt per scherm.`,()=>endMatchdayAction(input,actorScope));}
 return <><section className={styles.panel}><div><h2>{main?`${main.homeTeamName} – ${main.awayTeamName}`:config.name}</h2><p className={styles.phase}>{phaseLabels[publication.phase]}</p><p>Fase gegeven door {publication.phaseActor} · {displayTime(publication.phaseChangedAt,timezone)}</p></div>
 <p>Uitvoering: {active?"Actief":publication.status==="cancelled"?"Geannuleerd":publication.status==="closed"||now>=Date.parse(config.endsAt)?"Afgesloten":"Gepland"} · versie {publication.version} · einde {displayTime(config.endsAt,timezone)}</p>
 {main?<p>Bronobservatie: {displayTime(main.observedAt,timezone)} · laatste geslaagde broncontrole: {displayTime(main.lastSuccessfulSyncAt,timezone)}. Een geplande aanvang of lege bron is geen live wedstrijdfase.</p>:null}
 {!active?<div className={styles.notice}>Snelle acties zijn beschikbaar wanneer dit bevestigde draaiboek actief is. Geldige gewone planning blijft leidend.</div>:null}
 {actionKinds.length?<form className={styles.form} onSubmit={apply}><fieldset className={styles.fieldset} disabled={blocked||!active}><legend>Snelle actie</legend><label className={styles.field}>Actie<select value={actionKinds.includes(kind)?kind:""} onChange={event=>selectKind(event.target.value as MatchdayActionInput['kind'])}><option value="" disabled>Kies een toegestane actie</option>{actionKinds.map(value=><option key={value} value={value}>{actionLabels[value]}</option>)}</select></label>
 {productAction?<label className={styles.field}>Product op actief menu<select value={menuKey} required onChange={event=>{setMenuKey(event.target.value);setScreenIds([]);}}><option value="">Kies een exacte menuplaatsing</option>{placements.map(item=><option key={placementKey(item)} value={placementKey(item)}>{item.productLabel}</option>)}</select></label>:kind==="phase"?<p>Hoofdwedstrijd: {main?matchLabel(main,timezone,config.matches):"Onbekend"}</p>:<label className={styles.field}>Wedstrijd<select value={matchId} required onChange={event=>{setMatchId(event.target.value);setScreenIds([]);}}><option value="">Kies de exacte wedstrijd</option>{config.matches.map(match=><option key={match.id} value={match.id}>{matchLabel(match,timezone,config.matches)}</option>)}</select></label>}
 {kind==="field"?<label className={styles.field}>Nieuw veld<input value={field} maxLength={120} required onChange={event=>setField(event.target.value)}/></label>:null}
 {kind==="phase"?<label className={styles.field}>Volgende fase<select value={matchdayPhaseTransitions[publication.phase].includes(phase as typeof publication.phase)?phase:""} required onChange={event=>setPhase(event.target.value)}><option value="" disabled>Kies een passende volgende fase</option>{matchdayPhaseTransitions[publication.phase].map(value=><option key={value} value={value}>{phaseLabels[value]}</option>)}</select></label>:null}
 {kind==="postponed"?<label className={styles.field}>Nieuwe aanvang (optioneel)<input type="datetime-local" value={kickoff} onChange={event=>setKickoff(event.target.value)}/><span>Dit is een tijdelijke mededeling. Toekomstige fases blijven onderdrukt tot een bevoegde gebruiker nieuwe vensters controleert en bevestigt.</span></label>:null}
 {kind==="cancelled"?<p>Toekomstige fases van de hoofdwedstrijd worden onderdrukt. Een vervangende wedstrijd vereist een nieuw, expliciet gecontroleerd draaiboek.</p>:null}
 {globalMain?<p className={styles.notice}>Deze hoofdwedstrijdactie geldt voor alle draaiboekdoelen. Kies ieder bedoeld scherm bewust: {publication.targets.map(target=>target.screenName).join(", ")}. Een gedeeltelijke toewijzing is onvoldoende; vraag zo nodig een volledig bevoegde wedstrijddienst om bevestiging.</p>:null}
 <MultiSelectDropdown label="Doelschermen voor deze actie" allowSelectAll={false} options={targets.map(target=>({value:target.screenId,label:target.screenName}))} value={actualScreenIds} onValueChange={setScreenIds} emptyLabel="Geen toegestane doelen voor dit object en deze actie."/>
 <label className={styles.field}>Einde ({timezone})<input type="datetime-local" required value={expiry} max={isoToZonedDateTimeLocal(config.endsAt,timezone)} onChange={event=>setEndsAt(event.target.value)}/></label><label className={styles.field}>Reden<textarea value={reason} required minLength={2} maxLength={300} onChange={event=>setReason(event.target.value)}/></label>
 <Button type="submit" disabled={actualScreenIds.length===0||!completeMainSelection}>Actie controleren</Button></fieldset>{error?<p role="alert" className={styles.error}>{error}</p>:null}</form>:<p>Je hebt geen geldige actiebevoegdheid voor deze draaiboekpublicatie.</p>}
 </section><section className={styles.panel}><h2>Actieve meldingen</h2>{selected.actions.some(action=>action.status==="active"&&Date.parse(action.endsAt)>now)?<ul className={styles.list}>{selected.actions.filter(action=>action.status==="active"&&Date.parse(action.endsAt)>now).map(action=>{const canEnd=workspace.permissions.canPublish||selected.permittedActions.some(item=>item.kind===action.kind&&item.objectId===action.objectKey&&action.screenIds.every(id=>item.screenIds.includes(id))&&Date.parse(item.endsAt)>now);return <li key={action.id}><strong>{actionLabels[action.kind]} · {action.value}</strong><span>{action.actorLabel} · tot {displayTime(action.endsAt,timezone)}</span><span>{publication.targets.filter(target=>action.screenIds.includes(target.screenId)).map(target=>target.screenName).join(", ")}</span>{canEnd?<Button variant="secondary" disabled={blocked} onClick={()=>end(action)}>Beëindigen en herstellen</Button>:null}</li>;})}</ul>:<p>Geen actuele tijdelijke meldingen.</p>}</section>
 {workspace.permissions.canDelegate?<MatchdayDelegation workspace={workspace} timezone={timezone} actorScope={actorScope} blocked={blocked} confirm={confirm}/>:null}</>;
}
