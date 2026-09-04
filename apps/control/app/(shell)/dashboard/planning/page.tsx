import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck2,
  CalendarClock,
  CircleCheck,
  Sparkles
} from "lucide-react";

import { hasCapability } from "@veyocast/auth";
import { Button, PageHeader, StatusPill } from "@veyocast/ui";

import { requireTenantControlSession } from "../../../../lib/control-session";
import styles from "../publisher-resources.module.css";
import { loadContentSchedules } from "./data";
import {
  ContentScheduleDialog,
  ScheduleStateDialog
} from "./planning-dialogs";
import planningStyles from "./planning.module.css";
import {
  FilteredPlanningEmpty,
  PlanningCalendar,
  PlanningWorkspaceToolbar
} from "./planning-calendar";
import {
  buildCalendarDays,
  isScheduleActiveAt,
  nextScheduleOccurrence,
  normalizePlanningView,
  normalizeReferenceDate,
  planningHref,
  scheduleMatchesPlanningTarget,
  shiftReferenceDate,
  type PlanningView
} from "./schedule-calendar";
import { isoToZonedDateTimeLocal } from "./schedule-time";
import type { ContentScheduleListItem } from "./planning-types";

type PlanningPageProps = {
  searchParams: Promise<{
    content?: string;
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
  const active = filteredSchedules.filter((schedule) =>
    isScheduleActiveAt(schedule, currentTime, data.timezoneName)
  ).length;
  const canWrite = session.isLive && session.tenantStatus === "active" &&
    hasCapability(session.capabilities, "tenant.playlist.write");
  const canOpenReferenceEditor = canWrite || visualReference;
  const defaultStartAt = new Date(now + 60 * 60 * 1000).toISOString();
  const calendarDays = view === "agenda" ? [] : buildCalendarDays(
    filteredSchedules,
    view,
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
      <PageHeader
        description="Bepaal waar en wanneer content zichtbaar wordt."
        eyebrow="VeyoCast FieldFlow"
        title="Planning"
      />

      {query.fout ? <p className="notice notice--critical" role="alert"><strong>Planning niet opgeslagen.</strong> {query.fout}</p> : null}
      {query.succes ? <p className="notice notice--success" role="status">{query.succes}</p> : null}
      {data.error && !visualReference ? <p className="notice notice--critical" role="alert"><strong>Planning niet geladen.</strong> {data.error}</p> : null}
      {!session.isLive && !visualReference ? <p className="notice notice--warning" role="status">Configureer Supabase en log in om echte planningen te beheren.</p> : null}
      {session.isLive && !canWrite ? <p className="notice notice--info" role="status">Je kunt de planning bekijken. Playlistbewerkingsrechten zijn nodig om tijdvakken te wijzigen.</p> : null}

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
        filteredSchedules.length ? (
          <ol aria-label="Geplande content" className={styles.scheduleList}>
            {filteredSchedules.map((schedule) => (
              <li className={styles.scheduleRow} key={schedule.id}>
                <span className={styles.scheduleIdentity}><strong>{schedule.name}</strong><small>{schedule.targetKind === "screen" ? "Scherm" : "Schermgroep"} · {schedule.targetName}</small></span>
                <span className={styles.scheduleContent}><strong>{schedule.playlistName}</strong><small>Immutable versie {schedule.releaseVersion} · prioriteit {schedule.priority} · {sourceLabel(schedule.source)}</small></span>
                <span className={styles.scheduleTiming}><strong>{scheduleKindLabel(schedule.scheduleKind)}</strong><small>{formatScheduleWindow(schedule.startsAt, schedule.endsAt, schedule.timezoneName)}</small></span>
                <span className={planningStyles.rowActions}>
                  <StatusPill label={schedule.enabled ? "Actief" : "Uitgeschakeld"} tone={schedule.enabled ? "success" : "neutral"} />
                  {canWrite && schedule.source !== "fallback" ? (
                    <>
                      <ContentScheduleDialog
                        defaultStartAt={defaultStartAt}
                        disabled={false}
                        groups={data.groups}
                        releases={data.releases}
                        schedule={schedule}
                        screens={data.screens}
                        timezoneName={data.timezoneName}
                      />
                      <ScheduleStateDialog schedule={schedule} timezoneName={data.timezoneName} />
                    </>
                  ) : null}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <AgendaEmpty hasAnySchedules={data.schedules.length > 0} />
        )
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
        active={active}
        currentTime={currentTime}
        reference={visualReference}
        schedules={filteredSchedules}
        timeZone={data.timezoneName}
      />
    </div>
  );
}

function PlanningInsights({
  active,
  currentTime,
  reference,
  schedules,
  timeZone
}: {
  active: number;
  currentTime: Date;
  reference: boolean;
  schedules: ContentScheduleListItem[];
  timeZone: string;
}) {
  const enabled = schedules.filter((schedule) => schedule.enabled);
  const next = enabled
    .flatMap((schedule) => {
      const occurrence = nextScheduleOccurrence(schedule, currentTime, timeZone);
      return occurrence ? [{ occurrence, schedule }] : [];
    })
    .sort((left, right) =>
      left.occurrence.startsAt.localeCompare(right.occurrence.startsAt)
    )[0] ?? null;
  const recurring = enabled.filter((schedule) => schedule.scheduleKind !== "once").slice(0, 3);

  return (
    <div className={planningStyles.insightsGrid}>
      <section className={planningStyles.insightCard} aria-labelledby="smart-planning-title">
        <header>
          <div>
            <p>Automatisering</p>
            <h2 id="smart-planning-title">Slimme planning</h2>
          </div>
          <span>{reference ? 3 : active || recurring.length} actief</span>
        </header>
        {recurring.length ? <ul>
          {recurring.map((schedule) => (
            <li key={schedule.id}>
              <Sparkles aria-hidden="true" />
              <span><strong>{schedule.name}</strong><small>{schedule.targetName} · {scheduleKindLabel(schedule.scheduleKind)}</small></span>
              <CircleCheck aria-label="Actief" />
            </li>
          ))}
        </ul> : <p className={planningStyles.insightEmpty}>Nog geen terugkerende automatisering ingesteld.</p>}
      </section>

      <section className={planningStyles.insightCard} aria-labelledby="next-publication-title">
        <header>
          <div>
            <p>Hierna</p>
            <h2 id="next-publication-title">Volgende publicatie</h2>
          </div>
        </header>
        {next ? (
          <Link className={planningStyles.nextPublication} href={`/dashboard/planning?view=agenda`}>
            <CalendarCheck2 aria-hidden="true" />
            <span>
              <strong>{next.occurrence.name}</strong>
              <small>{formatScheduleWindow(
                next.occurrence.startsAt,
                next.occurrence.endsAt,
                timeZone
              )} · {next.schedule.targetName}</small>
            </span>
            <ArrowRight aria-hidden="true" />
          </Link>
        ) : <p className={planningStyles.insightEmpty}>Er staat na dit moment geen publicatie klaar.</p>}
      </section>
    </div>
  );
}

function AgendaEmpty({ hasAnySchedules }: { hasAnySchedules: boolean }) {
  return (
    <section className={styles.empty} role="status">
      <CalendarClock aria-hidden="true" />
      <h2>{hasAnySchedules ? "Geen momenten voor deze filters" : "Nog geen planning"}</h2>
      <p>{hasAnySchedules
        ? "Pas de doelgroep, content of het dagdeel aan."
        : "Publiceer eerst een playlistversie. Alleen immutable releases kunnen veilig worden ingepland."}</p>
      {!hasAnySchedules ? <Button asChild variant="secondary"><Link href="/dashboard/playlists">Naar playlists</Link></Button> : null}
    </section>
  );
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

function sourceLabel(value: string) {
  if (value === "override") return "Tijdelijke override";
  if (value === "fallback") return "Fallback";
  return "Normale planning";
}

function scheduleKindLabel(value: string) {
  return ({ custom: "Aangepast", daily: "Dagelijks", once: "Eenmalig", weekly: "Wekelijks" } as Record<string, string>)[value] ?? value;
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
