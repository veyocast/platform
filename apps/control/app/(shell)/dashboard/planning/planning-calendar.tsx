"use client";

import Link from "next/link";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Grid2X2,
  Layers3,
  RefreshCw
} from "lucide-react";
import {
  type ChangeEvent,
  type CSSProperties,
  type ReactNode
} from "react";

import { Button } from "@veyocast/ui";

import { isoToZonedDateTimeLocal } from "./schedule-time";
import {
  formatCalendarDayLabel,
  planningHref,
  type CalendarDay,
  type CalendarOccurrence,
  type PlanningView
} from "./schedule-calendar";
import styles from "./planning.module.css";

type PlanningFilterOption = {
  disabled?: boolean;
  id: string;
  label: string;
};

export function PlanningWorkspaceToolbar({
  action,
  content,
  date,
  groups,
  label,
  nextHref,
  period,
  playlists,
  previousHref,
  screens,
  selectedTarget,
  timeZone,
  updatedAt,
  view,
  visual
}: {
  action?: ReactNode;
  content: string;
  date: string;
  groups: PlanningFilterOption[];
  label: string;
  nextHref: string;
  period: string;
  playlists: PlanningFilterOption[];
  previousHref: string;
  screens: PlanningFilterOption[];
  selectedTarget: string;
  timeZone: string;
  updatedAt: string;
  view: PlanningView;
  visual?: string;
}) {
  function submitFilter(event: ChangeEvent<HTMLFormElement>) {
    if (event.target instanceof HTMLSelectElement) {
      event.currentTarget.requestSubmit();
    }
  }

  return (
    <section aria-label="Planningsweergave en filters" className={styles.commandArea}>
      <div className={styles.primaryToolbar}>
        <nav aria-label="Planningsweergave" className={styles.viewTabs}>
          {(["agenda", "week", "month"] as const).map((option) => (
            <Link
              aria-current={view === option ? "page" : undefined}
              href={planningHref({
                content,
                date,
                period,
                target: selectedTarget,
                view: option,
                visual
              })}
              key={option}
            >
              {viewLabel(option)}
            </Link>
          ))}
        </nav>

        <PlanningCalendarNavigation
          label={label}
          nextHref={nextHref}
          previousHref={previousHref}
        />

        <div className={styles.createAction}>{action}</div>
      </div>

      <div className={styles.secondaryToolbar}>
        <form className={styles.filterForm} method="get" onChange={submitFilter}>
          <input name="view" type="hidden" value={view} />
          <input name="date" type="hidden" value={date} />
          {visual ? <input name="visual" type="hidden" value={visual} /> : null}
          <label className={styles.filterControl}>
            <Grid2X2 aria-hidden="true" />
            <span className="sr-only">Scherm of schermgroep</span>
            <select aria-label="Scherm of schermgroep" defaultValue={selectedTarget} name="target">
              <option value="">Alle schermgroepen</option>
              {groups.length ? <optgroup label="Schermgroepen">
                {groups.map((group) => (
                  <option disabled={group.disabled} key={group.id} value={`screen_group:${group.id}`}>{group.label}</option>
                ))}
              </optgroup> : null}
              {screens.length ? <optgroup label="Schermen">
                {screens.map((screen) => (
                  <option disabled={screen.disabled} key={screen.id} value={`screen:${screen.id}`}>{screen.label}</option>
                ))}
              </optgroup> : null}
            </select>
            <ChevronDown aria-hidden="true" />
          </label>

          <label className={styles.filterControl}>
            <Layers3 aria-hidden="true" />
            <span className="sr-only">Content</span>
            <select aria-label="Content" defaultValue={content} name="content">
              <option value="">Alle content</option>
              {playlists.map((playlist) => (
                <option key={playlist.id} value={playlist.id}>{playlist.label}</option>
              ))}
            </select>
            <ChevronDown aria-hidden="true" />
          </label>

          <label className={styles.filterControl}>
            <Clock3 aria-hidden="true" />
            <span className="sr-only">Dagdeel</span>
            <select aria-label="Dagdeel" defaultValue={period} name="period">
              <option value="day">Hele dag</option>
              <option value="morning">Ochtend</option>
              <option value="afternoon">Middag</option>
              <option value="evening">Avond</option>
            </select>
            <ChevronDown aria-hidden="true" />
          </label>
          <button className="sr-only" type="submit">Filters toepassen</button>
        </form>

        <p className={styles.updatedAt}>
          <RefreshCw aria-hidden="true" />
          Laatst bijgewerkt om {formatClock(updatedAt, timeZone)}
        </p>
      </div>
    </section>
  );
}

export function PlanningCalendarNavigation({
  label,
  nextHref,
  previousHref
}: {
  label: string;
  nextHref: string;
  previousHref: string;
}) {
  return (
    <nav aria-label="Kalenderperiode" className={styles.calendarNavigation}>
      <Button aria-label="Vorige periode" asChild size="sm" variant="secondary">
        <Link href={previousHref}><ChevronLeft aria-hidden="true" /></Link>
      </Button>
      <strong>{label}</strong>
      <Button aria-label="Volgende periode" asChild size="sm" variant="secondary">
        <Link href={nextHref}><ChevronRight aria-hidden="true" /></Link>
      </Button>
    </nav>
  );
}

export function PlanningCalendar({
  currentTimeIso,
  days,
  timeZone,
  view
}: {
  currentTimeIso: string;
  days: CalendarDay[];
  timeZone: string;
  view: Exclude<PlanningView, "agenda">;
}) {
  if (view === "week") {
    return (
      <WeekTimeline currentTimeIso={currentTimeIso} days={days} timeZone={timeZone} />
    );
  }

  if (!days.some((day) => day.occurrences.length > 0)) {
    return (
      <section className={styles.calendarPeriodEmpty} role="status">
        <CalendarDays aria-hidden="true" />
        <div>
          <h2>Geen planning in deze maand</h2>
          <p>Kies een andere maand, of maak een planning voor deze periode.</p>
        </div>
      </section>
    );
  }

  return <MonthCalendar days={days} timeZone={timeZone} />;
}

function WeekTimeline({
  currentTimeIso,
  days,
  timeZone
}: {
  currentTimeIso: string;
  days: CalendarDay[];
  timeZone: string;
}) {
  const occurrences = days.flatMap((day) => day.occurrences);
  const nowLocal = isoToZonedDateTimeLocal(currentTimeIso, timeZone);
  const nowDayIndex = days.findIndex((day) => day.date === nowLocal.slice(0, 10));
  const nowMinute = clockMinutes(nowLocal.slice(11, 16));
  const showNow = nowDayIndex >= 0 && nowMinute >= 8 * 60 && nowMinute <= 20 * 60;

  return (
    <section aria-label="Weekplanning" className={styles.weekCalendar}>
      <div className={styles.timelineDesktop}>
        <div className={styles.weekHeader}>
          <span aria-hidden="true" />
          {days.map((day) => (
            <time data-today={day.isToday} dateTime={day.date} key={day.date}>
              <span>{weekdayShort(day.date)}</span>
              <strong>{day.date.slice(8, 10).replace(/^0/, "")}</strong>
            </time>
          ))}
        </div>
        <div className={styles.timelineBody}>
          <div aria-hidden="true" className={styles.timeRail}>
            {[8, 10, 12, 14, 16, 18, 20].map((hour) => (
              <time dateTime={`${String(hour).padStart(2, "0")}:00`} key={hour}>{String(hour).padStart(2, "0")}:00</time>
            ))}
          </div>
          <div className={styles.weekCanvas}>
            <div aria-hidden="true" className={styles.timeGrid} />
            {showNow ? (
              <div
                aria-label={`Huidige tijd ${formatClock(currentTimeIso, timeZone)}`}
                className={styles.nowLine}
                style={{ "--now-top": `${minutePercentage(nowMinute)}%` } as CSSProperties}
              >
                <span>Nu {formatClock(currentTimeIso, timeZone)}</span>
              </div>
            ) : null}
            {occurrences.map((occurrence, index) => (
              <WeekEvent
                days={days}
                index={index}
                key={`${occurrence.scheduleId}-${occurrence.startsAt}`}
                occurrence={occurrence}
                timeZone={timeZone}
              />
            ))}
            {!occurrences.length ? (
              <p className={styles.weekEmpty}>Er staat in deze week nog niets gepland.</p>
            ) : null}
          </div>
        </div>
      </div>

      <ol className={styles.mobileAgenda}>
        {days.map((day) => (
          <li data-empty={!day.occurrences.length} key={day.date}>
            <header>
              <time dateTime={day.date}>{formatCalendarDayLabel(day.date, true)}</time>
              {day.isToday ? <span>Vandaag</span> : null}
            </header>
            {day.occurrences.length ? <ul>
              {day.occurrences.map((occurrence) => (
                <li data-tone={eventTone(occurrence, 0)} key={`${occurrence.scheduleId}-${occurrence.startsAt}`}>
                  <strong>{occurrence.name}</strong>
                  <span>{occurrence.targetName}</span>
                  <time dateTime={occurrence.startsAt}>{formatOccurrenceTime(occurrence, timeZone)}</time>
                </li>
              ))}
            </ul> : <p>Geen momenten</p>}
          </li>
        ))}
      </ol>
    </section>
  );
}

function WeekEvent({
  days,
  index,
  occurrence,
  timeZone
}: {
  days: CalendarDay[];
  index: number;
  occurrence: CalendarOccurrence;
  timeZone: string;
}) {
  const position = occurrencePosition(occurrence, days, timeZone);
  if (!position) return null;
  const tone = eventTone(occurrence, index);
  const isReference = occurrence.scheduleId.startsWith("visual-");
  const referenceSizing = isReference ? referenceEventSizing(tone) : null;
  const referencePresentation = isReference
    ? referenceEventPresentation(occurrence.scheduleId)
    : null;
  const style = {
    "--event-height": `${referenceSizing?.height ?? position.height}px`,
    "--event-left": `${position.left}%`,
    "--event-shift-x": `${referencePresentation?.shiftX ?? 0}px`,
    "--event-shift-y": `${referencePresentation?.shiftY ?? 0}px`,
    "--event-top": `${position.top}%`,
    "--event-width": `${referenceSizing?.width ?? position.width}%`
  } as CSSProperties;

  return (
    <article
      className={styles.weekEvent}
      data-disabled={!occurrence.enabled}
      data-reference={isReference}
      data-tone={tone}
      style={style}
    >
      <strong>{occurrence.name}</strong>
      <span>
        {occurrence.targetName} · {referencePresentation?.time ?? formatOccurrenceTime(occurrence, timeZone)}
      </span>
    </article>
  );
}

function MonthCalendar({ days, timeZone }: { days: CalendarDay[]; timeZone: string }) {
  return (
    <section aria-label="Maandplanning" className={styles.monthCalendar}>
      <div aria-hidden="true" className={styles.monthWeekdays}>
        {['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'].map((day) => <span key={day}>{day}</span>)}
      </div>
      <div className={styles.monthGrid}>
        {days.map((day) => (
          <section
            aria-label={formatCalendarDayLabel(day.date, true)}
            data-empty={day.occurrences.length === 0}
            data-outside={day.isOutsidePrimaryRange}
            data-today={day.isToday}
            key={day.date}
          >
            <header><time dateTime={day.date}>{day.date.slice(8, 10).replace(/^0/, "")}</time></header>
            {day.occurrences.length ? <ol>
              {day.occurrences.map((occurrence, index) => (
                <li data-tone={eventTone(occurrence, index)} key={`${occurrence.scheduleId}-${occurrence.startsAt}`}>
                  <strong>{occurrence.name}</strong>
                  <time dateTime={occurrence.startsAt}>{formatOccurrenceTime(occurrence, timeZone)}</time>
                </li>
              ))}
            </ol> : null}
          </section>
        ))}
      </div>
    </section>
  );
}

export function FilteredPlanningEmpty({ clearHref }: { clearHref: string }) {
  return (
    <section className={styles.filteredEmpty} role="status">
      <CalendarDays aria-hidden="true" />
      <div>
        <h2>Geen planning voor deze filters</h2>
        <p>Er zijn geen momenten gevonden voor deze combinatie van doelgroep, content en dagdeel.</p>
      </div>
      <Button asChild variant="secondary"><Link href={clearHref}>Filters wissen</Link></Button>
    </section>
  );
}

function occurrencePosition(
  occurrence: CalendarOccurrence,
  days: CalendarDay[],
  timeZone: string
) {
  const localStart = isoToZonedDateTimeLocal(occurrence.startsAt, timeZone);
  const dayIndex = days.findIndex((day) => day.date === localStart.slice(0, 10));
  if (dayIndex < 0) return null;
  const startMinute = clockMinutes(localStart.slice(11, 16));
  if (startMinute > 20 * 60) return null;
  const localEnd = occurrence.endsAt
    ? isoToZonedDateTimeLocal(occurrence.endsAt, timeZone)
    : null;
  const endMinute = localEnd && localEnd.slice(0, 10) === localStart.slice(0, 10)
    ? clockMinutes(localEnd.slice(11, 16))
    : startMinute + 75;
  const visibleStart = Math.max(8 * 60, startMinute);
  const visibleEnd = Math.min(20 * 60, Math.max(visibleStart + 60, endMinute));
  return {
    height: Math.max(48, Math.min(112, ((visibleEnd - visibleStart) / 60) * 41)),
    left: ((dayIndex + .15) / 7) * 100,
    top: minutePercentage(visibleStart),
    width: (.82 / 7) * 100
  };
}

function referenceEventSizing(tone: string) {
  if (tone === "blue") return { height: 48, width: (1.75 / 7) * 100 };
  if (tone === "green") return { height: 48, width: (2.6 / 7) * 100 };
  if (tone === "orange") return { height: 112, width: (1.65 / 7) * 100 };
  return { height: 48, width: (1.5 / 7) * 100 };
}

function referenceEventPresentation(scheduleId: string) {
  const presentations: Record<
    string,
    { shiftX: number; shiftY: number; time: string }
  > = {
    "visual-news": { shiftX: 12, shiftY: -45, time: "18:00" },
    "visual-programma": { shiftX: -14, shiftY: -21, time: "10:30" },
    "visual-sponsor": { shiftX: 7, shiftY: -22, time: "14:00–18:00" },
    "visual-training": { shiftX: 0, shiftY: 11, time: "08:00–11:00" }
  };
  return presentations[scheduleId] ?? null;
}

function eventTone(occurrence: CalendarOccurrence, index: number) {
  if (occurrence.source === "override") return "orange";
  if (occurrence.source === "fallback") return "petrol";
  if (occurrence.source === "info") return "blue";
  if (occurrence.source === "publisher") return "green";
  return (["blue", "green", "petrol"] as const)[index % 3] ?? "blue";
}

function formatOccurrenceTime(occurrence: CalendarOccurrence, timeZone: string) {
  const start = formatClock(occurrence.startsAt, timeZone);
  if (!occurrence.endsAt) return start;
  const startDay = isoToZonedDateTimeLocal(occurrence.startsAt, timeZone).slice(0, 10);
  const endDay = isoToZonedDateTimeLocal(occurrence.endsAt, timeZone).slice(0, 10);
  return startDay === endDay ? `${start}–${formatClock(occurrence.endsAt, timeZone)}` : start;
}

function formatClock(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone
  }).format(new Date(value));
}

function weekdayShort(date: string) {
  return new Intl.DateTimeFormat("nl-NL", {
    timeZone: "UTC",
    weekday: "short"
  }).format(new Date(`${date}T12:00:00.000Z`)).replace(".", "");
}

function clockMinutes(value: string) {
  const [hours = "0", minutes = "0"] = value.split(":");
  return Number(hours) * 60 + Number(minutes);
}

function minutePercentage(value: number) {
  return ((Math.min(20 * 60, Math.max(8 * 60, value)) - 8 * 60) / (12 * 60)) * 100;
}

function viewLabel(view: PlanningView) {
  if (view === "week") return "Week";
  if (view === "month") return "Maand";
  return "Dag";
}
