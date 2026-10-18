"use client";

import { useRef, useState } from "react";
import { Button, FilterBar, Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle, StatusPill } from "@veyocast/ui";

import { opportunityStages, sponsorCrmHref, sponsorCrmPageSize, taskStatuses, type SponsorCrmData, type SponsorCrmFilter } from "./sponsor-crm";
import styles from "./sponsor-crm.module.css";

const stageLabels: Record<string, string> = { lead: "Nieuw", contacted: "Contact gelegd", proposal: "Voorstel", won: "Gewonnen", lost: "Verloren" };
const taskLabels: Record<string, string> = { open: "Open", done: "Afgerond", dismissed: "Vervallen" };

export function SponsorCrmOverview({ data, filter }: { data: SponsorCrmData; filter: SponsorCrmFilter }) {
  const [selected, setSelected] = useState<{ kind: "opportunity" | "task"; id: string } | null>(null);
  const returnFocus = useRef<HTMLButtonElement | null>(null);
  function openRecord(kind: "opportunity" | "task", id: string, trigger: HTMLButtonElement) {
    returnFocus.current = trigger;
    setSelected({ kind, id });
  }
  const opportunity = selected?.kind === "opportunity" ? data.opportunities.find(item => item.id === selected.id) : null;
  const task = selected?.kind === "task" ? data.tasks.find(item => item.id === selected.id) : null;
  const activeCount = Number(Boolean(filter.query)) + Number(filter.stage !== "all") + Number(filter.status !== "all");

  return <section aria-labelledby="sponsor-crm-title" className={styles.overview} id="kansen">
    <header><h2 id="sponsor-crm-title">Pipeline en taken</h2><p>Beperkt overzicht van vastgelegde kansen en opvolgtaken. Open een regel om de beschikbare gegevens te bekijken.</p></header>
    <form action="/dashboard/sponsors#kansen" method="get" role="search" aria-label="Kansen en taken filteren">
      <input name="crm" type="hidden" value="1" />
      <FilterBar activeCount={activeCount} clearHref="/dashboard/sponsors?crm=1#kansen" defaultOpen={activeCount > 0}
        filterLabel="Kansen- en taakfilters"
        primary={<label className={styles.search}><span>Zoeken in kansen en taken</span><input defaultValue={filter.query} maxLength={120} name="crmQuery" placeholder="Naam van kans of taak" type="search" /></label>}
        results={data.error ? "Niet beschikbaar" : `${data.opportunityCount} ${data.opportunityCount === 1 ? "kans" : "kansen"} · ${data.taskCount} ${data.taskCount === 1 ? "taak" : "taken"}`}
        actions={<Button type="submit" variant="secondary">Filters toepassen</Button>}>
        <label className={styles.field}><span>Kansfase</span><select defaultValue={filter.stage} name="crmStage"><option value="all">Alle fasen</option>{opportunityStages.map(stage => <option key={stage} value={stage}>{stageLabels[stage]}</option>)}</select></label>
        <label className={styles.field}><span>Taakstatus</span><select defaultValue={filter.status} name="crmStatus"><option value="all">Alle statussen</option>{taskStatuses.map(status => <option key={status} value={status}>{taskLabels[status]}</option>)}</select></label>
      </FilterBar>
    </form>
    {data.error ? <p className={styles.message} role="alert">Kansen en taken konden niet worden geladen. Er zijn geen gegevens gewijzigd. Vernieuw de pagina om het opnieuw te proberen.</p> : <div className={styles.columns}>
      <section aria-labelledby="sponsor-opportunities-title"><h3 id="sponsor-opportunities-title">Kansen</h3>
        <ul className={styles.list}>{data.opportunities.map(item => <li key={item.id}><div><strong>{item.name}</strong><span className={styles.meta}>{money(item.estimated_value_cents)} · Volgende actie: {date(item.next_action_at)}</span></div><div className={styles.rowActions}><StatusPill label={stageLabels[item.stage] ?? "Fase onbekend"} tone={item.stage === "won" ? "success" : "neutral"} /><Button aria-label={`Kans ${item.name} openen`} onClick={event => openRecord("opportunity", item.id, event.currentTarget)} variant="secondary">Openen</Button></div></li>)}</ul>
        {!data.opportunities.length ? <p className={styles.message}>{activeCount ? "Geen kansen voor deze filters. Pas de zoekopdracht of fase aan." : "Nog geen kansen vastgelegd."}</p> : null}
        <Pagination count={data.opportunityCount} filter={filter} kind="opportunity" page={filter.opportunityPage} />
      </section>
      <section aria-labelledby="sponsor-tasks-title"><h3 id="sponsor-tasks-title">Taken</h3>
        <ul className={styles.list}>{data.tasks.map(item => <li key={item.id}><div><strong>{item.title}</strong><span className={styles.meta}>Uiterlijk: {date(item.due_at)}</span></div><div className={styles.rowActions}><StatusPill label={taskLabels[item.status] ?? "Status onbekend"} tone={item.status === "done" ? "success" : item.status === "open" ? "info" : "neutral"} /><Button aria-label={`Taak ${item.title} openen`} onClick={event => openRecord("task", item.id, event.currentTarget)} variant="secondary">Openen</Button></div></li>)}</ul>
        {!data.tasks.length ? <p className={styles.message}>{activeCount ? "Geen taken voor deze filters. Pas de zoekopdracht of status aan." : "Nog geen taken vastgelegd."}</p> : null}
        <Pagination count={data.taskCount} filter={filter} kind="task" page={filter.taskPage} />
      </section>
    </div>}
    <Sheet open={Boolean(opportunity || task)} onOpenChange={open => { if (!open) setSelected(null); }}><SheetContent className={styles.inspector} onCloseAutoFocus={event => { event.preventDefault(); returnFocus.current?.focus(); }}>
      <SheetHeader><SheetTitle>{opportunity?.name ?? task?.title ?? "Gegevens"}</SheetTitle><SheetDescription>{opportunity ? "Vastgelegde kans" : "Vastgelegde opvolgtaak"} · Alleen bekijken</SheetDescription></SheetHeader>
      <SheetBody><dl className={styles.details}>{opportunity ? <><dt>Fase</dt><dd>{stageLabels[opportunity.stage] ?? "Onbekend"}</dd><dt>Geschatte waarde</dt><dd>{money(opportunity.estimated_value_cents)}</dd><dt>Volgende actie</dt><dd>{date(opportunity.next_action_at)}</dd></> : task ? <><dt>Status</dt><dd>{taskLabels[task.status] ?? "Onbekend"}</dd><dt>Uiterlijk</dt><dd>{date(task.due_at)}</dd></> : null}</dl><p>Dit overzicht wijzigt geen kansen, taken of campagnes.</p></SheetBody>
    </SheetContent></Sheet>
  </section>;
}

function Pagination({ count, filter, kind, page }: { count: number; filter: SponsorCrmFilter; kind: "opportunity" | "task"; page: number }) {
  const pages = Math.max(1, Math.ceil(count / sponsorCrmPageSize));
  if (pages <= 1 && page === 1) return null;
  const key = kind === "opportunity" ? "opportunityPage" : "taskPage";
  return <nav aria-label={kind === "opportunity" ? "Kansenpagina's" : "Taakpagina's"} className={styles.pagination}>
    {page > 1 ? <a href={sponsorCrmHref(filter, { [key]: page - 1 })}>Vorige</a> : <span>Vorige</span>}
    <span>Pagina {page} van {pages}</span>
    {page < pages ? <a href={sponsorCrmHref(filter, { [key]: page + 1 })}>Volgende</a> : <span>Volgende</span>}
  </nav>;
}

function date(value: string | null) {
  return value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Amsterdam" }).format(new Date(value)) : "Niet vastgelegd";
}

function money(value: number | string | null) {
  if (value === null) return "Waarde niet vastgelegd";
  const cents = Number(value);
  return Number.isSafeInteger(cents) && cents >= 0 ? new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(cents / 100) : "Waarde niet beschikbaar";
}
