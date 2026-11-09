"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect,useState } from "react";
import type { MatchdayWorkspace } from "@veyocast/contracts";
import { Button,Dialog,DialogBody,DialogContent,DialogDescription,DialogHeader,DialogTitle } from "@veyocast/ui";
import { closeMatchday,setMatchdayEnabled } from "./actions";
import { MatchdayDraftEditor } from "./draft-editor";
import { MatchdayOperator } from "./operator";
import { MatchdayDeliveries } from "./delivery-view";
import { displayTime } from "./labels";
import { useMatchdayCommand } from "./use-command";
import styles from "./matchday.module.css";

export function MatchdayWorkbench({workspace,tenantName,timezone,actorScope,canReadScreens=false}:{canReadScreens?:boolean;workspace:MatchdayWorkspace;tenantName:string;timezone:string;actorScope:string}){
 const router=useRouter(),command=useMatchdayCommand(actorScope);
 const[tab,setTab]=useState<"operate"|"configure"|"history">("operate"),[online,setOnline]=useState(true);
 useEffect(()=>{const sync=()=>setOnline(navigator.onLine);sync();window.addEventListener("online",sync);window.addEventListener("offline",sync);return()=>{window.removeEventListener("online",sync);window.removeEventListener("offline",sync);};},[]);
 useEffect(()=>{if(tab!=="operate"||command.blocked||command.confirmation||!online)return;const timer=setInterval(()=>router.refresh(),5000);return()=>clearInterval(timer);},[tab,command.blocked,command.confirmation,online,router]);
 const blocked=command.blocked||!online,selected=workspace.selected,publication=selected?.publication;
 function toggleFeature(){const input={enabled:!workspace.enabled,expectedRevision:workspace.settingsRevision,requestId:crypto.randomUUID(),reason:workspace.enabled?"Wedstrijddag uitschakelen en geldige planning herstellen":"Wedstrijddag voor deze vereniging inschakelen"};command.confirm(workspace.enabled?"Wedstrijddag uitschakelen?":"Wedstrijddag inschakelen?",workspace.enabled?"Actieve tijdelijke acties worden beëindigd en de geldige planning wordt per doelscherm hersteld. Bestaande content en historie blijven bewaard.":"De werkplek wordt beschikbaar. Schermen veranderen pas na een afzonderlijke gecontroleerde publicatie.",()=>setMatchdayEnabled(input,actorScope));}
 function close(operation:"close"|"cancel"){if(!publication)return;const input={runbookId:selected!.id,publicationId:publication.id,expectedRevision:selected!.objectRevisions.find(item=>item.key===`publication:${publication.id}`)?.revision??0,requestId:crypto.randomUUID(),operation,reason:operation==="close"?"Draaiboek handmatig afgesloten":"Draaiboekuitvoering geannuleerd"};command.confirm(operation==="close"?"Draaiboek afsluiten?":"Uitvoering annuleren?",`${publication.configuration.name}\n${publication.targets.map(target=>target.screenName).join(", ")}\nToekomstige fases en tijdelijke acties stoppen. Elk scherm hervat de dan geldende planning; de werkplek wacht op afzonderlijk Playerbewijs.`,()=>closeMatchday(input,actorScope));}
 return <div className={styles.page}><header className={styles.header}><div><Link href="/dashboard">Vandaag</Link><h1>Wedstrijddag</h1><p>{tenantName} · laatst gecontroleerd {displayTime(workspace.generatedAt,timezone)}</p></div>{workspace.permissions.canManageFeature?<Button variant="secondary" disabled={blocked} onClick={toggleFeature}>{workspace.enabled?"Werkplek uitschakelen":"Werkplek inschakelen"}</Button>:null}</header>
 <p>Bedien het sportpark vanuit één bevestigd draaiboek. De bestaande Onze wedstrijddag-slide blijft beschikbaar in Content.</p>
 {selected?.readScope==="delegated"?<p className={styles.notice}>Alleen toegewezen wedstrijden en schermen</p>:null}
 {!online?<div className={styles.notice} role="status">Je bent offline. De laatst geladen status blijft leesbaar; beheeracties zijn geblokkeerd tot de verbinding terug is.</div>:null}
 {!workspace.enabled?<div className={styles.notice}><h2>Wedstrijddag staat uit</h2><p>Gewone planning, Sportlink-slides, menu’s en LED-publicaties blijven beschikbaar. Een beheerder kan deze werkplek inschakelen.</p><Link href="/dashboard/planning">Gewone planning openen</Link></div>:null}
 {command.message?<div className={styles.notice} role="status"><p>{command.message}</p>{command.retry?<Button variant="secondary" disabled={command.pending||!online} onClick={command.retrySame}>Dezelfde opdracht opnieuw proberen</Button>:null}</div>:null}
 <label className={styles.field}>Draaiboek<select value={selected?.id??""} onChange={event=>router.push(`/dashboard/matchday${event.target.value?`?runbook=${encodeURIComponent(event.target.value)}`:""}`)} disabled={blocked}><option value="">Nieuw draaiboek</option>{workspace.runbooks.map(row=><option key={row.id} value={row.id}>{row.name} · {displayTime(row.startsAt,timezone)} · {row.status}</option>)}</select></label>
 <nav className={styles.tabs} aria-label="Draaiboekonderdelen">{([['operate','Bedienen'],['configure','Instellen'],['history','Historie']] as const).map(([value,label])=><Button key={value} variant="secondary" aria-pressed={tab===value} onClick={()=>setTab(value)} disabled={command.pending}>{label}</Button>)}</nav>
 {tab==="configure"&&workspace.permissions.canEdit?<MatchdayDraftEditor key={`${selected?.id??"new"}:${selected?.draftRevision??0}`} workspace={workspace} timezone={timezone} actorScope={actorScope} blocked={blocked} confirm={command.confirm}/>:null}
 {tab==="configure"&&!workspace.permissions.canEdit?<p>Je kunt dit draaiboek binnen je toewijzing bedienen. Configureren vereist aanvullend beheerrecht.</p>:null}
 {tab==="operate"?<><MatchdayOperator workspace={workspace} timezone={timezone} actorScope={actorScope} blocked={blocked||!workspace.enabled} confirm={command.confirm}/><MatchdayDeliveries workspace={workspace} timezone={timezone} canReadScreens={canReadScreens}/>{publication&&workspace.permissions.canPublish?<section className={styles.panel}><h2>Uitvoering beëindigen</h2><p>Herstel wordt per scherm bevestigd; historie blijft bewaard.</p><div className={styles.actions}><Button variant="secondary" disabled={blocked||["closed","cancelled"].includes(publication.status)} onClick={()=>close("close")}>Afsluiten en planning hervatten</Button><Button variant="secondary" disabled={blocked||["closed","cancelled"].includes(publication.status)} onClick={()=>close("cancel")}>Uitvoering annuleren</Button></div></section>:null}</>:null}
 {tab==="history"?<section className={styles.panel}><h2>Historie</h2>{selected?.audit.length?<ul className={styles.list}>{selected.audit.map(row=><li key={row.id}><strong>{row.action}</strong><span>{row.actorLabel} · {displayTime(row.at,timezone)}</span>{row.beforeText?<p>Hiervoor: {row.beforeText}</p>:null}{row.afterText?<p>Daarna: {row.afterText}</p>:null}</li>)}</ul>:<p>Nog geen toegestane historie beschikbaar voor dit draaiboek.</p>}</section>:null}
 <Dialog open={Boolean(command.confirmation)} onOpenChange={open=>{if(!open)command.cancel();}}><DialogContent><DialogHeader><DialogTitle>{command.confirmation?.title??"Opdracht bevestigen"}</DialogTitle><DialogDescription>Controleer de bestemming en het begrensde tijdvenster.</DialogDescription></DialogHeader><DialogBody><p className={styles.summary}>{command.confirmation?.summary}</p><div className={styles.actions}><Button variant="secondary" onClick={command.cancel}>Terug</Button><Button onClick={command.accept}>Bevestigen</Button></div></DialogBody></DialogContent></Dialog>
 </div>;
}
