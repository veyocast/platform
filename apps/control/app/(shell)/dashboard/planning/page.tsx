import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  CalendarClock,
  ChevronRight,
  Clock3,
  Layers3,
  Repeat2
} from "lucide-react";

import { hasCapability } from "@veyocast/auth";
import { Button, DialogTrigger, PageHeader } from "@veyocast/ui";

import { requireTenantControlSession } from "../../../../lib/control-session";
import { loadContentSchedules } from "./data";
import {
  ContentScheduleDialog,
  RecurringPlanningDialog
} from "./planning-dialogs";
import planningStyles from "./planning.module.css";
import {
  FilteredPlanningEmpty,
  PlanningCalendar,
  PlanningAgenda,
  PlanningWorkspaceToolbar
} from "./planning-calendar";
import {
  buildCalendarDays,
  nextScheduleOccurrence,
  normalizePlanningView,
  normalizeReferenceDate,
  planningHref,
  scheduleMatchesPlanningTarget,
  shiftReferenceDate,
  type PlanningView
} from "./schedule-calendar";
import { isoToZonedDateTimeLocal, zonedLocalDateTimeToIso } from "./schedule-time";
import type { ContentScheduleListItem } from "./planning-types";

type PlanningPageProps = {
  searchParams: Promise<{
    content?: string;
    edit?: string;
    date?: string;
    fout?: string;
    nieuw?: string;
    period?: string;
    succes?: string;
    target?: string;
    view?: string;
    visual?: string;
  }>;
};

export default async function PlanningPage({ searchParams }: PlanningPageProps) {
  const session = await requireTenantControlSession("tenant.release.read");
  const query = await searchParams;
  const visualReference = isReferenceVisual(query.visual);
  const currentTime = visualReference
    ? new Date("2026-08-24T08:42:00.000Z")
    : new Date();
  const loadedData = session.isLive && session.tenantId
    ? await loadContentSchedules(session.tenantId)
    : emptyPlanningData();
  const data = visualReference ? createReferencePlanningData() : loadedData;
  const now = currentTime.getTime();
  const view = query.view ? normalizePlanningView(query.view) : "week";
  const referenceDate = normalizeReferenceDate(
    query.date ?? (visualReference ? "2026-08-24" : undefined),
    data.timezoneName,
    currentTime
  );
  const selectedTarget = normalizeTargetFilter(query.target, data.screens, data.groups);
  const selectedContent = data.releases.some((release) => release.playlistId === query.content)
    ? query.content ?? ""
    : "";
  const selectedPeriod = normalizePeriod(query.period);
  const filteredSchedules = data.schedules.filter((schedule) =>
    (!selectedTarget || scheduleMatchesPlanningTarget(schedule, selectedTarget, data.groups)) &&
    (!selectedContent || schedule.playlistId === selectedContent) &&
    scheduleMatchesPeriod(schedule, selectedPeriod, data.timezoneName)
  );
  const canWrite = session.isLive && session.tenantStatus === "active" &&
    hasCapability(session.capabilities, "tenant.playlist.write");
  const canOpenReferenceEditor = canWrite || visualReference;
  const defaultStartAt = query.nieuw === "1" && query.date ? zonedLocalDateTimeToIso(`${referenceDate}T09:00`,data.timezoneName) : new Date(now + 60 * 60 * 1000).toISOString();
  const editingSchedule = data.schedules.find(schedule=>schedule.id===query.edit);
  const calendarDays = buildCalendarDays(
    filteredSchedules,
    view === "agenda" ? "week" : view,
    referenceDate,
    data.timezoneName,
    currentTime
  );
  const hrefContext = {
    content: selectedContent,
    date: referenceDate,
    period: selectedPeriod,
    target: selectedTarget,
    view,
    visual: visualReference ? "reference" : undefined
  } as const;

  if (data.error && !visualReference) {
    return (
      <div className={planningStyles.planningPage}>
        <PageHeader
          description="Bepaal waar en wanneer content zichtbaar wordt."
          eyebrow="VeyoCast FieldFlow"
          title="Planning"
        />
        <section className={planningStyles.loadFailure} role="alert">
          <CalendarClock aria-hidden="true" />
          <div>
            <h2>Planning tijdelijk niet beschikbaar</h2>
            <p><strong>Oorzaak:</strong> {data.error}</p>
            <p><strong>Gevolg:</strong> Tijdvakken, automatiseringen en de volgende publicatie worden niet als leeg gepresenteerd.</p>
            <p><strong>Herstel:</strong> Laad de beveiligde planning opnieuw. Blijft dit gebeuren, controleer dan de datasessie.</p>
          </div>
          <Button asChild variant="secondary"><Link href="/dashboard/planning">Opnieuw proberen</Link></Button>
        </section>
      </div>
    );
  }

  return (
    <div className={planningStyles.planningPage}>
      <div className={planningStyles.readHeading}><PageHeader description="Bepaal waar en wanneer content zichtbaar wordt." eyebrow="VeyoCast FieldFlow" title="Planning"/></div>

      {query.fout ? <p className="notice notice--critical" role="alert"><strong>Planning niet opgeslagen.</strong> {query.fout}</p> : null}
      {query.succes ? <p className="notice notice--success" role="status">{query.succes}</p> : null}
      {data.error && !visualReference ? <p className="notice notice--critical" role="alert"><strong>Planning niet geladen.</strong> {data.error}</p> : null}
      {!session.isLive && !visualReference ? <p className="notice notice--warning" role="status">Configureer Supabase en log in om echte planningen te beheren.</p> : null}
      {session.isLive && !canWrite ? <p className="notice notice--info" role="status">Je kunt de planning bekijken. Playlistbewerkingsrechten zijn nodig om tijdvakken te wijzigen.</p> : null}

      {editingSchedule && canWrite ? <div style={{display:"none"}}><ContentScheduleDialog key={editingSchedule.id} defaultOpen defaultStartAt={defaultStartAt} disabled={false} groups={data.groups} releases={data.releases} screens={data.screens} schedule={editingSchedule} timezoneName={data.timezoneName}/></div> : null}

      <PlanningWorkspaceToolbar
        action={(
          <ContentScheduleDialog
            defaultOpen={query.nieuw === "1"}
            defaultStartAt={defaultStartAt}
            defaultTarget={selectedTarget}
            disabled={!canOpenReferenceEditor}
            groups={data.groups}
            releases={data.releases}
            screens={data.screens}
            timezoneName={data.timezoneName}
            triggerLabel="Nieuw moment"
          />
        )}
        content={selectedContent}
        date={referenceDate}
        groups={data.groups.map((group) => ({
          disabled: group.memberCount === 0,
          id: group.id,
          label: group.name
        }))}
        label={planningPeriodLabel(calendarDays, referenceDate, view)}
        nextHref={planningHref({
          ...hrefContext,
          date: shiftReferenceDate(referenceDate, view === "agenda" ? "week" : view, 1)
        })}
        period={selectedPeriod}
        playlists={data.releases.map((release) => ({
          id: release.playlistId,
          label: release.label
        }))}
        previousHref={planningHref({
          ...hrefContext,
          date: shiftReferenceDate(referenceDate, view === "agenda" ? "week" : view, -1)
        })}
        screens={data.screens.map((screen) => ({
          disabled: screen.disabled,
          id: screen.id,
          label: screen.name
        }))}
        selectedTarget={selectedTarget}
        timeZone={data.timezoneName}
        updatedAt={currentTime.toISOString()}
        view={view}
        visual={visualReference ? "reference" : undefined}
      />

      {view === "agenda" ? (
        <section className={planningStyles.agendaPanel}><PlanningAgenda days={calendarDays} timeZone={data.timezoneName}/></section>
      ) : selectedTarget || selectedContent || selectedPeriod !== "day" ? (
        filteredSchedules.length ? (
          <PlanningCalendar
            currentTimeIso={currentTime.toISOString()}
            days={calendarDays}
            timeZone={data.timezoneName}
            view={view}
          />
        ) : (
          <FilteredPlanningEmpty clearHref={planningHref({
            date: referenceDate,
            view,
            visual: visualReference ? "reference" : undefined
          })} />
        )
      ) : (
        <PlanningCalendar
          currentTimeIso={currentTime.toISOString()}
          days={calendarDays}
          timeZone={data.timezoneName}
          view={view}
        />
      )}

      <PlanningInsights
        currentTime={currentTime}
        management={row=><RecurringPlanningDialog schedules={filteredSchedules} defaultStartAt={defaultStartAt} disabled={!canWrite} groups={data.groups} releases={data.releases} screens={data.screens} timezoneName={data.timezoneName}>{row}</RecurringPlanningDialog>}
        schedules={filteredSchedules}
        timeZone={data.timezoneName}
      />
    </div>
  );
}

function PlanningInsights({currentTime,management,schedules,timeZone}:{currentTime:Date;management:(row:ReactNode)=>ReactNode;schedules:ContentScheduleListItem[];timeZone:string}) {
 const enabled=schedules.filter(schedule=>schedule.enabled);
 const next=enabled.flatMap(schedule=>{const occurrence=nextScheduleOccurrence(schedule,currentTime,timeZone);return occurrence?[{occurrence,schedule}]:[];}).sort((a,b)=>a.occurrence.startsAt.localeCompare(b.occurrence.startsAt))[0]??null;
 return <div className={planningStyles.insightsGrid}>
  <section className={planningStyles.insightCard}><header><div><p>Automatisering</p><h2>Slimme planning</h2></div><span>{enabled.filter(schedule=>schedule.scheduleKind!=="once").length} actief</span></header>
   {management(<div className={planningStyles.insightRow}><span className={planningStyles.automationIcon}><Repeat2 aria-hidden="true" size={22}/></span><div><strong>Je club in het juiste ritme</strong><p>Terugkerende momenten houden je schermen automatisch actueel.</p></div><DialogTrigger asChild><button type="button" aria-label="Terugkerende momenten beheren"><ChevronRight aria-hidden="true" size={20}/></button></DialogTrigger></div>)}
  </section>
  <section className={planningStyles.insightCard}><header><div><p>Hierna</p><h2>Volgende publicatie</h2></div><Clock3 aria-hidden="true" size={19}/></header>
   <div className={planningStyles.insightRow}><span className={planningStyles.automationIcon}><Layers3 aria-hidden="true" size={22}/></span><div><strong>{next?.occurrence.name??"Nog geen moment gepland"}</strong><p>{next?`${formatScheduleWindow(next.occurrence.startsAt,next.occurrence.endsAt,timeZone)} · ${next.schedule.targetName}`:"Plan het eerste moment voor je schermen."}</p></div></div><Link className={planningStyles.insightLink} href="/dashboard/studio">Bekijk content in Studio <ArrowRight aria-hidden="true" size={16}/></Link>
  </section>
 </div>;
}

function normalizeTargetFilter(
  value: string | undefined,
  screens: { id: string }[],
  groups: { id: string }[]
) {
  if (!value) return "";
  const [kind, id] = value.split(":");
  if (kind === "screen" && screens.some((screen) => screen.id === id)) return value;
  if (kind === "screen_group" && groups.some((group) => group.id === id)) return value;
  return "";
}

function normalizePeriod(value: string | undefined) {
  return value === "morning" || value === "afternoon" || value === "evening"
    ? value
    : "day";
}

function scheduleMatchesPeriod(
  schedule: ContentScheduleListItem,
  period: string,
  timeZone: string
) {
  if (period === "day") return true;
  const recurrenceStart = typeof schedule.recurrence.startTime === "string"
    ? schedule.recurrence.startTime
    : isoToZonedDateTimeLocal(schedule.startsAt, timeZone).slice(11, 16);
  const hour = Number(recurrenceStart.slice(0, 2));
  if (period === "morning") return hour < 12;
  if (period === "afternoon") return hour >= 12 && hour < 18;
  return hour >= 18;
}

function planningPeriodLabel(
  days: { date: string }[],
  referenceDate: string,
  view: PlanningView
) {
  if (view === "month") {
    return new Intl.DateTimeFormat("nl-NL", {
      month: "long",
      timeZone: "UTC",
      year: "numeric"
    }).format(new Date(`${referenceDate.slice(0, 7)}-15T12:00:00.000Z`));
  }
  const first = days[0]?.date ?? referenceDate;
  const last = days.at(-1)?.date ?? referenceDate;
  const firstDate = new Date(`${first}T12:00:00.000Z`);
  const lastDate = new Date(`${last}T12:00:00.000Z`);
  const sameMonth = first.slice(0, 7) === last.slice(0, 7);
  const firstLabel = new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: sameMonth ? undefined : "long",
    timeZone: "UTC"
  }).format(firstDate);
  const lastLabel = new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
    year: "numeric"
  }).format(lastDate);
  return `${firstLabel} — ${lastLabel}`;
}

function formatScheduleWindow(start: string, end: string | null, timezone: string) {
  const formatter = new Intl.DateTimeFormat("nl-NL", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone
  });
  return end ? `${formatter.format(new Date(start))} – ${formatter.format(new Date(end))}` : `Vanaf ${formatter.format(new Date(start))}`;
}

function isReferenceVisual(value: string | undefined) {
  return process.env.NODE_ENV !== "production" &&
    process.env.FIELDFLOW_VISUAL_QA === "1" &&
    value === "reference";
}

function emptyPlanningData() {
  return {
    error: null,
    groups: [] as Array<{ id: string; memberCount: number; memberIds: string[]; name: string }>,
    releases: [] as Array<{ id: string; label: string; playlistId: string }>,
    schedules: [] as ContentScheduleListItem[],
    screens: [] as Array<{ disabled: boolean; id: string; name: string; status: string }>,
    timezoneName: "Europe/Amsterdam"
  };
}

function createReferencePlanningData(): ReturnType<typeof emptyPlanningData> {
  const schedule = (
    id: string,
    name: string,
    playlistName: string,
    playlistId: string,
    targetName: string,
    targetId: string,
    startsAt: string,
    endsAt: string | null,
    source: string
  ): ContentScheduleListItem => ({
    enabled: true,
    endsAt,
    id,
    name,
    playlistId,
    playlistName,
    priority: 100,
    recurrence: {},
    releaseId: `${id}-release`,
    releaseVersion: 7,
    revision: 1,
    scheduleKind: "once",
    source,
    startsAt,
    targetId,
    targetKind: "screen_group",
    targetName,
    timezoneName: "Europe/Amsterdam"
  });

  return {
    error: null,
    groups: [
      { id: "visual-group-kantine", memberCount: 5, memberIds: ["visual-screen-1"], name: "Kantine" },
      { id: "visual-group-all", memberCount: 20, memberIds: ["visual-screen-1"], name: "Alle schermen" },
      { id: "visual-group-clubhuis", memberCount: 8, memberIds: ["visual-screen-1"], name: "Clubhuis" }
    ],
    releases: [
      { id: "visual-playlist-training", label: "Trainingstijden", playlistId: "visual-playlist-training" },
      { id: "visual-playlist-programma", label: "Wedstrijdprogramma", playlistId: "visual-playlist-programma" },
      { id: "visual-playlist-sponsor", label: "Sponsor van de week", playlistId: "visual-playlist-sponsor" },
      { id: "visual-playlist-news", label: "Clubnieuws", playlistId: "visual-playlist-news" }
    ],
    schedules: [
      schedule("visual-training", "Trainingstijden", "Trainingstijden", "visual-playlist-training", "Kantine", "visual-group-kantine", "2026-08-24T06:00:00.000Z", "2026-08-24T09:00:00.000Z", "info"),
      schedule("visual-programma", "Wedstrijdprogramma", "Wedstrijdprogramma", "visual-playlist-programma", "Alle schermen", "visual-group-all", "2026-08-26T08:30:00.000Z", null, "publisher"),
      schedule("visual-sponsor", "Sponsor van de week", "Sponsor van de week", "visual-playlist-sponsor", "Clubhuis", "visual-group-clubhuis", "2026-08-28T12:00:00.000Z", "2026-08-28T16:00:00.000Z", "override"),
      schedule("visual-news", "Clubnieuws", "Clubnieuws", "visual-playlist-news", "Kantine", "visual-group-kantine", "2026-08-25T16:00:00.000Z", null, "fallback")
    ],
    screens: [{ disabled: false, id: "visual-screen-1", name: "Kantine TV 1", status: "active" }],
    timezoneName: "Europe/Amsterdam"
  };
}
