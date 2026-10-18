import Link from "next/link";
import { ArrowRight, CalendarDays, ChevronLeft, ChevronRight, Clock3, Layers3, Play, Plus, RefreshCw, RotateCcw, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import type { ContentScheduleListItem } from "./planning-types";
import { planningHref, type CalendarDay, type PlanningHrefOptions } from "./schedule-calendar";
import { SyncPlanningFilters } from "./sync-planning-filters";

type Props = {
  canWrite: boolean;
  context: PlanningHrefOptions;
  days: CalendarDay[];
  dialogs: ReactNode;
  groups: { id: string; name: string; memberCount: number }[];
  management: ReactNode;
  nextHref: string;
  notice: ReactNode;
  periodLabel: string;
  previousHref: string;
  releases: { playlistId: string; label: string }[];
  schedules: ContentScheduleListItem[];
  screens: { id: string; name: string; disabled: boolean }[];
  timeZone: string;
  today: string;
};

// The Sync presentation uses the existing recurrence expansion, timezone and
// guarded dialog/actions. No prototype schedule or second write model is used.
export function SyncPlanning({ canWrite, context, days, dialogs, groups, management, nextHref, notice, periodLabel, previousHref, releases, schedules, screens, timeZone, today }: Props) {
  const base = planningHref(context);
  const newHref = (day?: string) => `${planningHref({ ...context, date: day ?? context.date })}&nieuw=1`;
  const editHref = (id: string) => `${base}&edit=${encodeURIComponent(id)}`;
  const active = schedules.filter(schedule => schedule.enabled).length;
  return <div className="px-pages sync-planning">
    <header className="section-header"><div><div className="eyebrow">BROADCAST PLANNING</div><h1>Het juiste verhaal. Op het juiste moment.</h1><p>Een wedstrijdmiddag, sponsoravond of terugkerend clubprogramma. Plan het één keer.</p></div><div className="header-actions">{canWrite ? <Link className="btn btn-primary" href={newHref()}><Plus size={17} />Planning toevoegen</Link> : <button className="btn btn-primary" disabled type="button"><Plus size={17} />Planning toevoegen</button>}</div></header>
    {notice}{dialogs}
    <div className="px-planning-summary"><div><CalendarDays size={23} /><span><strong>{active} actieve planningen</strong><small>Eenmalig en terugkerend</small></span></div><div><Clock3 size={23} /><span><strong>{timeZone}</strong><small>Lokale clubtijd, inclusief zomertijd</small></span></div><div><RotateCcw size={23} /><span><strong>Altijd een vervolg</strong><small>Na afloop terug naar de vaste playlist</small></span></div></div>
    <section className="card px-calendar" aria-label="Planningkalender">
      <div className="px-calendar-toolbar"><div className="row"><Link className="px-icon-button" href={previousHref} aria-label="Vorige week"><ChevronLeft size={18} /></Link><Link className="px-icon-button" href={nextHref} aria-label="Volgende week"><ChevronRight size={18} /></Link><h2 className="sync-period-title">{context.view === "month" || !days.length ? periodLabel : `${dayLabel(days[0]!.date, "monthDay")} — ${dayLabel(days.at(-1)!.date, "full")}`}</h2><Link className="btn btn-ghost" href={planningHref({ ...context, date: today })}>Vandaag</Link></div><div className="row">
        <SyncPlanningFilters className="sync-planning-toolbar-filter"><input name="view" type="hidden" value={context.view} /><input name="date" type="hidden" value={context.date} />{context.content ? <input name="content" type="hidden" value={context.content} /> : null}{context.period ? <input name="period" type="hidden" value={context.period} /> : null}<select aria-label="Planning per scherm" name="target" defaultValue={context.target ?? ""}><option value="">Alle schermen</option>{screens.map(screen => <option key={screen.id} disabled={screen.disabled} value={`screen:${screen.id}`}>{screen.name}</option>)}{groups.length ? <optgroup label="Schermgroepen">{groups.map(group => <option key={group.id} value={`screen_group:${group.id}`} disabled={!group.memberCount}>{group.name}</option>)}</optgroup> : null}</select><button className="sync-sr-only" type="submit">Schermfilter toepassen</button></SyncPlanningFilters>
        <nav className="px-view-toggle" aria-label="Planningsweergave">{([['week', 'Week'], ['agenda', 'Lijst']] as const).map(([view, label]) => <Link key={view} className={context.view === view ? "active" : ""} aria-current={context.view === view ? "page" : undefined} href={planningHref({ ...context, view })}>{label}</Link>)}</nav>
      </div></div>
      {context.view === "week" ? <div className="px-week-grid" tabIndex={0} role="region" aria-label="Weekplanning, horizontaal verschuifbaar">{days.map(day => <div className={`px-week-day ${day.isToday ? "today" : ""}`} key={day.date}><div className="px-day-heading"><span>{dayLabel(day.date, "weekday")}</span><b>{dayLabel(day.date, "day")}</b>{canWrite ? <Link aria-label={`Planning op ${dayLabel(day.date, "full")} toevoegen`} href={newHref(day.date)}><Plus size={13} /></Link> : null}</div><div className="px-day-events">{day.occurrences.map((item, index) => <Link aria-disabled={!canWrite || undefined} href={canWrite ? editHref(item.scheduleId) : `${base}#schedule-${item.scheduleId}`} className={`px-calendar-event color-${index % 3} ${item.enabled ? "" : "disabled"}`} key={`${item.scheduleId}-${item.startsAt}`}><span>{clock(item.startsAt, timeZone)} — {item.endsAt ? clock(item.endsAt, timeZone) : "doorlopend"}</span><strong>{item.name}</strong><small>{item.targetName} · prioriteit {item.priority}{!item.enabled ? " · Gepauzeerd" : ""}</small>{item.isRecurring ? <span className="px-repeat-tag"><RefreshCw size={11} />Terugkerend</span> : null}</Link>)}{!day.occurrences.length ? canWrite ? <Link className="px-empty-day" href={newHref(day.date)}><Plus size={16} /><span>Geen planning</span></Link> : <div className="px-empty-day"><span>Geen planning</span></div> : null}</div></div>)}</div> : <div className="px-schedule-list">{schedules.map(schedule => <Link id={`schedule-${schedule.id}`} key={schedule.id} className="px-schedule-row" href={canWrite ? editHref(schedule.id) : `${base}#schedule-${schedule.id}`}><span className="px-schedule-date"><b>{datePart(schedule.startsAt, timeZone, "day")}</b>{datePart(schedule.startsAt, timeZone, "month")}</span><span><strong>{schedule.name}</strong><small>{datePart(schedule.startsAt, timeZone, "full")} · {clock(schedule.startsAt, timeZone)} — {schedule.endsAt ? clock(schedule.endsAt, timeZone) : "doorlopend"} · {schedule.timezoneName}</small></span><span className={`badge badge-${schedule.enabled ? "blue" : "neutral"}`}>{!schedule.enabled ? "Gepauzeerd" : recurrence(schedule.scheduleKind)}</span><span className="px-row-targets">{schedule.targetName}</span><ChevronRight size={17} /></Link>)}{!schedules.length ? <div className="px-empty-small"><CalendarDays size={32} /><h3>Ruimte voor wat komen gaat</h3><p>Voeg je eerste planning toe.</p>{canWrite ? <Link className="btn btn-primary" href={newHref()}>Planning toevoegen</Link> : null}</div> : null}</div>}
      <div className="px-calendar-footer"><details className="sync-planning-advanced"><summary title="Open alle planningsfilters en maandweergave"><i />Een planning heeft voorrang op de vaste playlist.</summary><SyncPlanningFilters><input name="view" type="hidden" value={context.view} /><input name="date" type="hidden" value={context.date} /><input name="target" type="hidden" value={context.target ?? ""} /><label>Content<select aria-label="Content" name="content" defaultValue={context.content ?? ""}><option value="">Alle content</option>{releases.map(release => <option key={release.playlistId} value={release.playlistId}>{release.label}</option>)}</select></label><label>Dagdeel<select aria-label="Dagdeel" name="period" defaultValue={context.period ?? "day"}><option value="day">Hele dag</option><option value="morning">Ochtend</option><option value="afternoon">Middag</option><option value="evening">Avond</option></select></label><button className="btn btn-secondary" type="submit">Filters toepassen</button><Link className="btn btn-ghost" href={planningHref({ ...context, view: "month" })}>Maandweergave</Link></SyncPlanningFilters>{management}</details><span><ShieldCheck size={14} />Scherm gaat vóór groep; daarna geldt de prioriteit.</span></div>
    </section>

    <div className="grid-2"><section className="card px-planning-tip"><Layers3 size={23} /><h2>Laat de dag vanzelf verlopen</h2><p className="muted">Welkom voor de wedstrijd, het programma tijdens de rust en clubnieuws na afloop. Je vaste playlist vangt de momenten ertussen op.</p>{canWrite ? <Link className="btn btn-ghost" href={newHref()}>Maak een wedstrijdplanning <ArrowRight size={16} /></Link> : null}</section><section className="card px-planning-tip"><Play size={23} /><h2>Bekijk de hele schermervaring</h2><p className="muted">Van de eerste verbinding tot offline doorspelen. Ontdek hoe een veilige publicatie op een scherm terechtkomt.</p><Link className="btn btn-ghost" href="/dashboard/screens">Schermen bekijken <ArrowRight size={16} /></Link></section></div>
  </div>;
}

function dayLabel(date: string, kind: "weekday" | "day" | "monthDay" | "full") {
  return new Intl.DateTimeFormat("nl-NL", { timeZone: "UTC", ...(kind === "weekday" ? { weekday: "short" } as const : kind === "day" ? { day: "numeric" } as const : kind === "monthDay" ? {day:"numeric",month:"long"} as const : { dateStyle: "long" } as const) }).format(new Date(`${date}T12:00:00Z`));
}
function datePart(iso: string, timeZone: string, kind: "day" | "month" | "full") {
  return new Intl.DateTimeFormat("nl-NL", { timeZone, ...(kind === "day" ? { day: "numeric" } as const : kind === "month" ? { month: "short" } as const : { dateStyle: "medium" } as const) }).format(new Date(iso));
}
function clock(iso: string, timeZone: string) { return new Intl.DateTimeFormat("nl-NL", { timeZone, hour: "2-digit", minute: "2-digit" }).format(new Date(iso)); }
function recurrence(kind: string) { return kind === "once" ? "Eenmalig" : kind === "daily" ? "Dagelijks" : kind === "weekly" ? "Wekelijks" : "Gekozen weekdagen"; }
