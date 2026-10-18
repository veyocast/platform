"use client";

import { type FormEvent, type ReactNode, useRef, useState } from "react";
import { ArrowRight, ChevronRight, Clock3, Grid2X2, Layers3, Pencil, Plus, Power, PowerOff, Repeat2, Trash2 } from "lucide-react";

import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@veyocast/ui";

import {
  checkScheduleConflicts,
  createContentSchedule,
  deleteContentSchedule,
  setContentScheduleEnabled,
  updateContentSchedule,
  type ScheduleConflict,
  type ScheduleConflictCheck
} from "./actions";
import type { ContentScheduleListItem } from "./planning-types";
import {
  isoToZonedDateTimeLocal,
  zonedLocalDateTimeToIso
} from "./schedule-time";
import styles from "./planning.module.css";


type ReleaseOption = {
  id: string;
  label: string;
  playlistId: string;
};

export function ContentScheduleDialog({defaultOpen=false,defaultStartAt,defaultTarget="",disabled,groups,releases,schedule,screens,triggerLabel,timezoneName}:{
 defaultOpen?:boolean;defaultStartAt:string;defaultTarget?:string;disabled:boolean;groups:{id:string;memberCount:number;memberIds?:string[];name:string}[];releases:ReleaseOption[];schedule?:ContentScheduleListItem;screens:{disabled:boolean;id:string;name:string;status:string}[];triggerLabel?:string;timezoneName:string;
}) {
 const idempotencyKey=useRef<HTMLInputElement>(null);const confirmConflicts=useRef<HTMLInputElement>(null);const form=useRef<HTMLFormElement>(null);const bypassCheck=useRef(false);
 const [step,setStep]=useState(0);const [checking,setChecking]=useState(false);const [conflictCheck,setConflictCheck]=useState<ScheduleConflictCheck|null>(null);
 const [name,setName]=useState(schedule?.name??"");const [playlistId,setPlaylistId]=useState(schedule?.playlistId??"");const [target,setTarget]=useState(schedule?`${schedule.targetKind}:${schedule.targetId}`:defaultTarget||"all:");
 const [scheduleKind,setScheduleKind]=useState(schedule?.scheduleKind??"once");const [enabled,setEnabled]=useState(schedule?.enabled??true);const [calendarTone,setCalendarTone]=useState(schedule?.calendarTone??"green");
 const initialStart=isoToZonedDateTimeLocal(schedule?.startsAt??defaultStartAt,timezoneName);const [date,setDate]=useState(initialStart.slice(0,10));
 const [startTime,setStartTime]=useState(recurrenceString(schedule?.recurrence,"startTime")??initialStart.slice(11,16));
 const [endTime,setEndTime]=useState(recurrenceString(schedule?.recurrence,"endTime")??(schedule?.endsAt?isoToZonedDateTimeLocal(schedule.endsAt,timezoneName).slice(11,16):"22:00"));
 const [validUntil,setValidUntil]=useState(schedule?.endsAt&&schedule.scheduleKind!=="once"?isoToZonedDateTimeLocal(schedule.endsAt,timezoneName):"");
 const [endDate,setEndDate]=useState(schedule?.endsAt&&schedule.scheduleKind==="once"?isoToZonedDateTimeLocal(schedule.endsAt,timezoneName).slice(0,10):initialStart.slice(0,10));
 const selectedWeekdays=schedule?recurrenceWeekdays(schedule.recurrence):[new Date(`${date}T12:00:00Z`).getUTCDay()||7];const isEditing=Boolean(schedule);
 const selectedScreens=target==="all:"?screens.filter(screen=>screen.status==="active"):target.startsWith("screen:")?screens.filter(screen=>screen.id===target.slice(7)):screens.filter(screen=>groups.find(group=>group.id===target.slice(13))?.memberIds?.includes(screen.id));
 const selectedGroup=groups.find(group=>target===`screen_group:${group.id}`);const targetCount=selectedGroup?.memberIds?selectedScreens.filter(screen=>screen.status==="active").length:selectedGroup?.memberCount??selectedScreens.length;
 const targetLabel=target==="all:"?"Alle schermen":selectedGroup?.name??selectedScreens[0]?.name??"Kies een scherm";
 const selectedPlaylist=releases.find(playlist=>playlist.playlistId===playlistId);
 const startsAtLocal=`${date}T${startTime}`;const endsAtLocal=scheduleKind==="once"?`${endDate}T${endTime}`:validUntil;
 function clearConflictReview(){if(confirmConflicts.current)confirmConflicts.current.value="no";setConflictCheck(null);}
 async function onSubmit(event:FormEvent<HTMLFormElement>){
  ensureIdempotencyKey(idempotencyKey.current);
  if(bypassCheck.current){bypassCheck.current=false;return;}
  // A reviewed final submit must reach the existing server action directly.
  // requestSubmit during this submit event is ignored by the browser.
  if(step===2&&conflictCheck&&!conflictCheck.error&&conflictCheck.conflicts.length===0)return;
  event.preventDefault();const currentForm=event.currentTarget;
  const panel=currentForm.querySelector<HTMLElement>(`[data-wizard-step="${step}"]`);
  const invalid=Array.from(panel?.querySelectorAll<HTMLInputElement|HTMLSelectElement>("input,select")??[]).find(input=>!input.checkValidity());if(invalid){invalid.reportValidity();return;}
  if(step===0){if(!targetCount){setConflictCheck({conflicts:[],error:"Kies minimaal één actief scherm. Er is niets opgeslagen."});return;}setStep(1);return;}
  setChecking(true);
  try{
   const values=new FormData(currentForm);const targetParts=target.split(":");
   const result=enabled?await checkScheduleConflicts({endsAtIso:endsAtLocal?zonedLocalDateTimeToIso(endsAtLocal,timezoneName):null,excludeScheduleId:schedule?.id??null,recurrence:conflictRecurrence(values,scheduleKindValue(values.get("scheduleKind"))),scheduleKind:scheduleKindValue(values.get("scheduleKind")),startsAtIso:zonedLocalDateTimeToIso(startsAtLocal,timezoneName),targetId:targetParts[1]??"",targetKind:targetParts[0]==="all"?"all":targetParts[0]==="screen_group"?"screen_group":"screen",timezoneName}):{conflicts:[],error:null};
   setConflictCheck(result);if(!result.error)setStep(2);
  }catch(error){setConflictCheck({conflicts:[],error:error instanceof Error?error.message:"De gekozen periode is ongeldig. Controleer datum en tijd."});}finally{setChecking(false);}
 }
 function confirmAndSubmit(){if(confirmConflicts.current)confirmConflicts.current.value="yes";bypassCheck.current=true;form.current?.requestSubmit();}
 return <Dialog defaultOpen={defaultOpen}><DialogTrigger asChild><Button disabled={disabled||!releases.length||screens.every(screen=>screen.disabled)} size={isEditing?"sm":"md"} variant={isEditing?"secondary":"primary"}>{isEditing?<Pencil aria-hidden="true"/>:<Plus aria-hidden="true"/>}{isEditing?"Bewerken":triggerLabel??"Nieuw moment"}</Button></DialogTrigger>
  <DialogContent className={styles.dialog} size="wide"><DialogHeader><DialogTitle>{isEditing?"Moment bewerken":"Nieuw moment plannen"}</DialogTitle></DialogHeader><DialogBody>
   <form action={isEditing?updateContentSchedule:createContentSchedule} className={styles.form} onChange={clearConflictReview} onSubmit={onSubmit} noValidate ref={form}>
    <input name="idempotencyKey" ref={idempotencyKey} type="hidden"/><input defaultValue="no" name="confirmConflicts" ref={confirmConflicts} type="hidden"/><input name="enabled" type="hidden" value={String(enabled)}/><input name="startsAtLocal" type="hidden" value={startsAtLocal}/><input name="endsAtLocal" type="hidden" value={endsAtLocal}/><input name="windowStartTime" type="hidden" value={startTime}/><input name="windowEndTime" type="hidden" value={endTime}/>
    {schedule?<><input name="scheduleId" type="hidden" value={schedule.id}/><input name="expectedRevision" type="hidden" value={schedule.revision}/></>:null}
    <ol className={styles.wizardSteps}>{["Content & schermen","Wanneer","Controleren"].map((label,index)=><li key={label} aria-current={step===index?"step":undefined} data-done={index<step}><span>{index+1}</span>{label}</li>)}</ol>
    <section className={styles.wizardPanel} data-wizard-step="0" style={{display:step===0?undefined:"none"}}><p className={styles.formIntro}>Wat wil je laten zien, en op welke schermen?</p>
     <div className="field"><label htmlFor="schedule-name">Naam van het moment</label><input autoFocus id="schedule-name" name="name" maxLength={120} minLength={2} required value={name} onChange={event=>setName(event.target.value)} placeholder="Bijvoorbeeld Wedstrijddag Heren 1"/></div>
     <div className="field"><label htmlFor="schedule-content">Content</label><select id="schedule-content" name="playlistId" required value={playlistId} onChange={event=>setPlaylistId(event.target.value)}><option value="">Kies een playlist</option>{releases.map(playlist=><option key={playlist.id} value={playlist.playlistId}>{playlist.label}</option>)}</select></div>
     <div className="field"><label htmlFor="schedule-target">Tonen op</label><select id="schedule-target" name="target" required value={target} onChange={event=>setTarget(event.target.value)}>{!isEditing?<option value="all:">Alle schermen</option>:null}<optgroup label="Schermgroepen">{groups.map(group=><option disabled={!group.memberCount} key={group.id} value={`screen_group:${group.id}`}>{group.name}</option>)}</optgroup><optgroup label="Schermen">{screens.map(screen=><option disabled={screen.disabled} key={screen.id} value={`screen:${screen.id}`}>{screen.name}</option>)}</optgroup></select></div>
     <div className={styles.targetPreview}><Grid2X2 aria-hidden="true" size={20}/><div><strong>{targetCount} {targetCount===1?"scherm":"schermen"} geselecteerd</strong><p>{selectedScreens.map(screen=>screen.name).join(" · ")||(!targetCount?"Deze groep heeft nog geen actieve schermen.":targetLabel)}</p></div></div>
    </section>
    <section className={styles.wizardPanel} data-wizard-step="1" style={{display:step===1?undefined:"none"}}><p className={styles.formIntro}>Plan één moment of maak een terugkerend ritme. We controleren of dezelfde schermen al content tonen.</p>
     <div className={styles.dateFields}><div className="field"><label htmlFor="schedule-date">Begindatum</label><input id="schedule-date" type="date" required value={date} onChange={event=>{if(endDate===date)setEndDate(event.target.value);setDate(event.target.value);}}/></div><div className="field"><label htmlFor="schedule-start">Van</label><input id="schedule-start" type="time" required value={startTime} onChange={event=>setStartTime(event.target.value)}/></div><div className="field"><label htmlFor="schedule-end">Tot</label><input id="schedule-end" type="time" required value={endTime} onChange={event=>setEndTime(event.target.value)}/></div></div>
     <p className={styles.timeHint}>Tijden zijn lokaal · {timezoneName}. De weekplanning toont 08:00 tot 22:00.</p>
     <div className={styles.twoColumns}><div className="field"><label htmlFor="schedule-repeat">Herhaling</label><select id="schedule-repeat" name="scheduleKind" value={scheduleKind} onChange={event=>setScheduleKind(event.target.value)}><option value="once">Eenmalig</option><option value="weekly">Elke week op deze dag</option><option value="daily">Elke dag</option><option value="custom">Specifieke weekdagen</option></select></div><div className="field"><label htmlFor="schedule-tone">Kalenderkleur</label><select id="schedule-tone" name="calendarTone" value={calendarTone} onChange={event=>setCalendarTone(event.target.value as typeof calendarTone)}><option value="green">Groen · Programma</option><option value="blue">Blauw · Informatie</option><option value="orange">Oranje · Speciaal moment</option><option value="petrol">Petrol · Clubnieuws</option></select></div></div>
     {(scheduleKind==="weekly"||scheduleKind==="custom")?<fieldset className={styles.weekdays}><legend>Weekdagen</legend>{weekdayOptions.map(day=><label key={`${schedule?.id??date}:${day.value}`}><input defaultChecked={selectedWeekdays.includes(day.value)} name="weekdays" type="checkbox" value={day.value}/><span>{day.label}</span></label>)}</fieldset>:null}
     <label className={styles.enableField}><input type="checkbox" checked={enabled} onChange={event=>setEnabled(event.target.checked)}/><span>Dit moment is actief</span></label>
     <details><summary>Geavanceerde planning</summary><div className={styles.wizardPanel}>{scheduleKind==="once"?<div className="field"><label htmlFor="schedule-end-date">Einddatum</label><input id="schedule-end-date" type="date" required min={date} value={endDate} onChange={event=>setEndDate(event.target.value)}/></div>:null}{scheduleKind!=="once"?<div className="field"><label htmlFor="schedule-valid-until">Reeks geldig tot</label><input id="schedule-valid-until" type="datetime-local" value={validUntil} onChange={event=>setValidUntil(event.target.value)}/></div>:null}<div className="field"><label htmlFor="schedule-source">Soort planning</label><select id="schedule-source" name="source" defaultValue={schedule?.source??"publisher"}><option value="publisher">Normale planning</option><option value="override">Tijdelijke override</option></select></div><div className="field"><label htmlFor="schedule-priority">Prioriteit</label><input id="schedule-priority" name="priority" required type="number" min={0} max={1000} defaultValue={schedule?.priority??100}/><small>Bij overlap gaat een individueel scherm vóór een groep; vervolgens geldt de hoogste prioriteit.</small></div></div></details>
     {isEditing&&schedule?.scheduleKind!=="once"?<p className={styles.repeatNote}>Wijzigingen gelden voor de volledige reeks.</p>:null}
    </section>
    <section className={styles.wizardPanel} data-wizard-step="2" style={{display:step===2?undefined:"none"}}><div className={styles.reviewGrid}><div><h3>{name}</h3><dl className={styles.reviewFacts}><dt>Content</dt><dd>{selectedPlaylist?.label??"Geen playlist geselecteerd"}</dd><dt>Schermen</dt><dd>{targetLabel} · {targetCount} {targetCount===1?"scherm":"schermen"}</dd><dt>Wanneer</dt><dd>{scheduleKind==="once"?"Eenmalig":scheduleKind==="daily"?"Elke dag":scheduleKind==="weekly"?"Elke week":"Gekozen weekdagen"} · {date}</dd><dt>Tijd</dt><dd>{startTime}–{endTime}</dd><dt>Status</dt><dd>{enabled?"Actief":"Gepauzeerd"}</dd></dl></div><div className={styles.reviewPreview}><div><Layers3 aria-hidden="true" size={28}/><strong>{selectedPlaylist?.label??"Content"}</strong><span>Afspeellijst</span></div></div></div><div className={styles.clearBox}><Clock3 aria-hidden="true" size={18}/>De standaard content blijft buiten dit moment zichtbaar.</div></section>
    {conflictCheck?<ConflictReview check={conflictCheck} onConfirm={step===2&&conflictCheck.conflicts.length?confirmAndSubmit:undefined} timezoneName={timezoneName}/>:null}
    <DialogFooter className={styles.stepActions}>{schedule?<ScheduleDeleteDialog schedule={schedule}/>:null}<span/>{step?<Button type="button" variant="secondary" onClick={()=>{setStep(step-1);clearConflictReview();}}>Vorige</Button>:<DialogClose asChild><Button variant="secondary">Annuleren</Button></DialogClose>}<Button disabled={checking||step===2&&Boolean(conflictCheck?.error||conflictCheck?.conflicts.length)} type="submit">{checking?"Conflicten controleren…":step<2?"Volgende":isEditing?"Wijzigingen opslaan":"Moment inplannen"}{step<2?<ChevronRight aria-hidden="true" size={16}/>:null}</Button></DialogFooter>
   </form>
  </DialogBody></DialogContent></Dialog>;
}

export function ScheduleDeleteDialog({schedule}:{schedule:ContentScheduleListItem}){
 const key=useRef<HTMLInputElement>(null);
 return <Dialog><DialogTrigger asChild><Button type="button" variant="secondary"><Trash2 aria-hidden="true"/>Verwijderen</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Moment verwijderen</DialogTitle><DialogDescription>Dit moment wordt uit de planning verwijderd. Schermen schakelen volgens hun actuele planning terug naar beschikbare content.</DialogDescription></DialogHeader><DialogBody><p>{schedule.name}</p><form action={deleteContentSchedule} onSubmit={()=>ensureIdempotencyKey(key.current)}><input type="hidden" name="scheduleId" value={schedule.id}/><input type="hidden" name="expectedRevision" value={schedule.revision}/><input type="hidden" name="idempotencyKey" ref={key}/><DialogFooter><DialogClose asChild><Button variant="secondary">Annuleren</Button></DialogClose><Button type="submit">Moment verwijderen</Button></DialogFooter></form></DialogBody></DialogContent></Dialog>;
}

export function RecurringPlanningDialog({children,schedules,defaultStartAt,disabled,groups,releases,screens,timezoneName}:{children?:ReactNode;schedules:ContentScheduleListItem[];defaultStartAt:string;disabled:boolean;groups:{id:string;memberCount:number;memberIds?:string[];name:string}[];releases:ReleaseOption[];screens:{disabled:boolean;id:string;name:string;status:string}[];timezoneName:string}) {
 const recurring=schedules.filter(schedule=>schedule.scheduleKind!=="once");
 return <Dialog>{children}<DialogTrigger asChild><button className={styles.insightLink} type="button">Beheer terugkerende momenten <ArrowRight aria-hidden="true" size={16}/></button></DialogTrigger><DialogContent className={styles.dialog} size="wide"><DialogHeader><DialogTitle>Slimme planning</DialogTitle><DialogDescription>Terugkerende momenten blijven actief vanaf de ingestelde datum. Je kunt een reeks tijdelijk pauzeren.</DialogDescription></DialogHeader><DialogBody><div className={styles.recurringList}>
  {recurring.length?recurring.map(schedule=><div key={schedule.id}><span className={styles.automationIcon}><Repeat2 aria-hidden="true" size={20}/></span><div className={styles.recurringIdentity}><strong>{schedule.name}</strong><span>{schedule.scheduleKind==="daily"?"Elke dag":schedule.scheduleKind==="weekly"?"Elke week":"Gekozen weekdagen"} · {recurrenceString(schedule.recurrence,"startTime")??isoToZonedDateTimeLocal(schedule.startsAt,timezoneName).slice(11,16)} · {schedule.targetName}</span></div><span className={styles.switchLabel}>{schedule.enabled?"Actief":"Gepauzeerd"}</span>{!disabled&&schedule.source!=="fallback"?<div className={styles.recurringActions}><ContentScheduleDialog defaultStartAt={defaultStartAt} disabled={disabled} groups={groups} releases={releases} screens={screens} timezoneName={timezoneName} schedule={schedule}/><ScheduleStateDialog schedule={schedule} timezoneName={timezoneName}/></div>:null}</div>):<p className={styles.formIntro}>Nog geen terugkerende momenten gepland.</p>}
 </div><DialogFooter><ContentScheduleDialog defaultStartAt={defaultStartAt} disabled={disabled} groups={groups} releases={releases} screens={screens} timezoneName={timezoneName}/></DialogFooter></DialogBody></DialogContent></Dialog>;
}

export function ScheduleStateDialog({
  schedule,
  timezoneName
}: {
  schedule: ContentScheduleListItem;
  timezoneName: string;
}) {
  const idempotencyKey = useRef<HTMLInputElement>(null);
  const confirmConflicts = useRef<HTMLInputElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const bypassCheck = useRef(false);
  const [check, setCheck] = useState<ScheduleConflictCheck | null>(null);
  const [checking, setChecking] = useState(false);
  const willEnable = !schedule.enabled;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    ensureIdempotencyKey(idempotencyKey.current);
    if (!willEnable || bypassCheck.current) {
      bypassCheck.current = false;
      return;
    }
    event.preventDefault();
    setChecking(true);
    const result = await checkScheduleConflicts({
      endsAtIso: schedule.endsAt,
      excludeScheduleId: schedule.id,
      recurrence: schedule.recurrence,
      scheduleKind: scheduleKindValue(schedule.scheduleKind),
      startsAtIso: schedule.startsAt,
      targetId: schedule.targetId,
      targetKind: schedule.targetKind === "screen_group" ? "screen_group" : "screen",
      timezoneName
    });
    setCheck(result);
    setChecking(false);
    if (!result.error && result.conflicts.length === 0) {
      bypassCheck.current = true;
      form.current?.requestSubmit();
    }
  }

  function confirmAndSubmit() {
    if (confirmConflicts.current) confirmConflicts.current.value = "yes";
    bypassCheck.current = true;
    form.current?.requestSubmit();
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          {willEnable ? <Power aria-hidden="true" /> : <PowerOff aria-hidden="true" />}
          {willEnable ? "Inschakelen" : "Uitschakelen"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{schedule.name} {willEnable ? "inschakelen" : "uitschakelen"}</DialogTitle>
          <DialogDescription>
            {willEnable
              ? "VeyoCast controleert opnieuw alle overlappende planningen en legt de actuele groepsleden als snapshot vast."
              : "De planning wordt niet meer gekozen. Een Player houdt zijn geldige actieve release totdat een andere toewijzing wordt toegepast."}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <form action={setContentScheduleEnabled} onSubmit={onSubmit} ref={form}>
            <input name="scheduleId" type="hidden" value={schedule.id} />
            <input name="expectedRevision" type="hidden" value={schedule.revision} />
            <input name="enabled" type="hidden" value={String(willEnable)} />
            <input name="idempotencyKey" ref={idempotencyKey} type="hidden" />
            <input defaultValue="no" name="confirmConflicts" ref={confirmConflicts} type="hidden" />
            {check ? <ConflictReview check={check} onConfirm={check.conflicts.length ? confirmAndSubmit : undefined} timezoneName={timezoneName} /> : null}
            <DialogFooter>
              <Button disabled={checking} type="submit" variant={willEnable ? "primary" : "secondary"}>
                {checking ? "Conflicten controleren…" : willEnable ? "Planning inschakelen" : "Planning uitschakelen"}
              </Button>
            </DialogFooter>
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

function ConflictReview({
  check,
  onConfirm,
  timezoneName
}: {
  check: ScheduleConflictCheck;
  onConfirm?: () => void;
  timezoneName: string;
}) {
  if (check.error) {
    return <div className={styles.conflictError} role="alert"><strong>Controle niet voltooid.</strong><p>{check.error}</p></div>;
  }
  if (!check.conflicts.length) {
    return <p className={styles.conflictClear} role="status">Geen overlappende planning gevonden. Opslaan kan veilig doorgaan.</p>;
  }
  const grouped = groupConflicts(check.conflicts);
  return (
    <section className={styles.conflicts} aria-labelledby="schedule-conflict-title" role="alert">
      <h3 id="schedule-conflict-title">Planning overlapt {grouped.length} bestaande {grouped.length === 1 ? "planning" : "planningen"}</h3>
      <p>Controleer de betrokken schermen. Een individuele planning wint van een groep; daarna gelden prioriteit en nieuwste planning.</p>
      <ul>
        {grouped.map((conflict) => (
          <li key={conflict.scheduleId}>
            <strong>{conflict.scheduleName}</strong>
            <span>{conflict.screenNames.join(", ")}</span>
            <small>{formatWindow(conflict.startsAt, conflict.endsAt, timezoneName)} · prioriteit {conflict.priority} · {sourceLabel(conflict.source)}</small>
          </li>
        ))}
      </ul>
      {onConfirm ? <Button onClick={onConfirm} type="button" variant="secondary">Prioriteit begrijpen en toch opslaan</Button> : null}
    </section>
  );
}

function groupConflicts(conflicts: ScheduleConflict[]) {
  const grouped = new Map<string, ScheduleConflict & { screenNames: string[] }>();
  for (const conflict of conflicts) {
    const current = grouped.get(conflict.scheduleId);
    if (current) {
      if (!current.screenNames.includes(conflict.screenName)) current.screenNames.push(conflict.screenName);
    } else {
      grouped.set(conflict.scheduleId, { ...conflict, screenNames: [conflict.screenName] });
    }
  }
  return [...grouped.values()];
}

function recurrenceString(value: Record<string, unknown> | undefined, key: string) {
  const result = value?.[key];
  return typeof result === "string" ? result : null;
}

function recurrenceWeekdays(value: Record<string, unknown> | undefined) {
  const weekdays = value?.weekdays;
  return Array.isArray(weekdays)
    ? weekdays.filter((day): day is number => Number.isInteger(day) && day >= 1 && day <= 7)
    : [1, 2, 3, 4, 5];
}

function ensureIdempotencyKey(input: HTMLInputElement | null) {
  if (input && !input.value) input.value = crypto.randomUUID();
}

function formatWindow(start: string, end: string | null, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("nl-NL", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone
  });
  return end
    ? `${formatter.format(new Date(start))} – ${formatter.format(new Date(end))}`
    : `Vanaf ${formatter.format(new Date(start))}`;
}

function sourceLabel(source: string) {
  if (source === "override") return "Tijdelijke override";
  if (source === "fallback") return "Fallback";
  return "Normale planning";
}

function scheduleKindValue(value: FormDataEntryValue | null) {
  return value === "daily" || value === "weekly" || value === "custom"
    ? value
    : "once";
}

function conflictRecurrence(
  values: FormData,
  scheduleKind: ReturnType<typeof scheduleKindValue>
) {
  if (scheduleKind === "once") return {};
  const recurrence: Record<string, unknown> = {
    endTime: String(values.get("windowEndTime") ?? ""),
    startTime: String(values.get("windowStartTime") ?? "")
  };
  if (scheduleKind === "weekly" || scheduleKind === "custom") {
    recurrence.weekdays = values.getAll("weekdays").map(Number);
  }
  return recurrence;
}

const weekdayOptions = [
  { label: "Ma", value: 1 },
  { label: "Di", value: 2 },
  { label: "Wo", value: 3 },
  { label: "Do", value: 4 },
  { label: "Vr", value: 5 },
  { label: "Za", value: 6 },
  { label: "Zo", value: 7 }
] as const;
