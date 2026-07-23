import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, Filter } from "lucide-react";

import { Button, StatusPill } from "@veyocast/ui";

import {
  formatCalendarDayLabel,
  type CalendarDay,
  type PlanningView
} from "./schedule-calendar";
import styles from "./planning.module.css";

type PlanningFilterOption = {
  disabled?: boolean;
  id: string;
  label: string;
};

export function PlanningWorkspaceToolbar({
  date,
  groups,
  screens,
  selectedTarget,
  view
}: {
  date: string;
  groups: PlanningFilterOption[];
  screens: PlanningFilterOption[];
  selectedTarget: string;
  view: PlanningView;
}) {
  return (
    <section aria-label="Planningsweergave en filters" className={styles.workspaceToolbar}>
      <nav aria-label="Planningsweergave" className={styles.viewTabs}>
        {(["agenda", "week", "month"] as const).map((option) => (
          <Link
            aria-current={view === option ? "page" : undefined}
            href={planningHref({ date, target: selectedTarget, view: option })}
            key={option}
          >
            {viewLabel(option)}
          </Link>
        ))}
      </nav>
      <form className={styles.targetFilter} method="get">
        <input name="view" type="hidden" value={view} />
        <input name="date" type="hidden" value={date} />
        <label htmlFor="planning-target-filter"><Filter aria-hidden="true" />Doel</label>
        <select defaultValue={selectedTarget} id="planning-target-filter" name="target">
          <option value="">Alle schermen en groepen</option>
          <optgroup label="Schermen">
            {screens.map((screen) => (
              <option key={screen.id} value={`screen:${screen.id}`}>{screen.label}</option>
            ))}
          </optgroup>
          <optgroup label="Schermgroepen">
            {groups.map((group) => (
              <option key={group.id} value={`screen_group:${group.id}`}>{group.label}</option>
            ))}
          </optgroup>
        </select>
        <Button size="sm" type="submit" variant="secondary">Toepassen</Button>
        {selectedTarget ? (
          <Button asChild size="sm" variant="ghost">
            <Link href={planningHref({ date, view })}>Wissen</Link>
          </Button>
        ) : null}
      </form>
    </section>
  );
}

export function PlanningCalendarNavigation({
  label,
  nextHref,
  previousHref,
  todayHref
}: {
  label: string;
  nextHref: string;
  previousHref: string;
  todayHref: string;
}) {
  return (
    <header className={styles.calendarNavigation}>
      <div>
        <CalendarDays aria-hidden="true" />
        <h2>{label}</h2>
      </div>
      <nav aria-label="Kalenderperiode">
        <Button aria-label="Vorige periode" asChild size="sm" variant="secondary">
          <Link href={previousHref}><ChevronLeft aria-hidden="true" /></Link>
        </Button>
        <Button asChild size="sm" variant="ghost"><Link href={todayHref}>Vandaag</Link></Button>
        <Button aria-label="Volgende periode" asChild size="sm" variant="secondary">
          <Link href={nextHref}><ChevronRight aria-hidden="true" /></Link>
        </Button>
      </nav>
    </header>
  );
}

export function PlanningCalendar({
  days,
  timeZone,
  view
}: {
  days: CalendarDay[];
  timeZone: string;
  view: Exclude<PlanningView, "agenda">;
}) {
  if (!days.some((day) => day.occurrences.length > 0)) {
    return (
      <section className={styles.calendarPeriodEmpty} role="status">
        <CalendarDays aria-hidden="true" />
        <div>
          <h2>Geen planning in deze periode</h2>
          <p>Kies een andere week of maand, of maak een planning voor deze periode.</p>
        </div>
      </section>
    );
  }
  return (
    <section aria-label={`${viewLabel(view)}planning`} className={styles.calendar} data-view={view}>
      <div aria-hidden="true" className={styles.weekdayHeader}>
        {["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"].map((day) => <span key={day}>{day}</span>)}
      </div>
      <div className={styles.calendarGrid}>
        {days.map((day) => (
          <section
            aria-label={formatCalendarDayLabel(day.date, true)}
            className={styles.calendarDay}
            data-empty={day.occurrences.length === 0}
            data-outside={day.isOutsidePrimaryRange}
            data-today={day.isToday}
            key={day.date}
          >
            <header>
              <time dateTime={day.date}>
                <span className={styles.desktopDayLabel}>{formatCalendarDayLabel(day.date, view === "week")}</span>
                <span className={styles.mobileDayLabel}>{formatCalendarDayLabel(day.date, true)}</span>
              </time>
              {day.isToday ? <span>Vandaag</span> : null}
            </header>
            {day.occurrences.length ? (
              <ol>
                {day.occurrences.map((occurrence) => (
                  <li
                    data-disabled={!occurrence.enabled}
                    data-source={occurrence.source}
                    key={`${occurrence.scheduleId}-${occurrence.startsAt}`}
                  >
                    <div>
                      <strong>{occurrence.name}</strong>
                      <StatusPill
                        label={occurrence.enabled ? sourceLabel(occurrence.source) : "Uitgeschakeld"}
                        tone={occurrence.enabled ? occurrence.source === "override" ? "warning" : "info" : "neutral"}
                      />
                    </div>
                    <time dateTime={occurrence.startsAt}>{formatOccurrenceTime(occurrence.startsAt, occurrence.endsAt, timeZone)}</time>
                    <span>{occurrence.targetName}</span>
                    <small>{occurrence.playlistName} · versie {occurrence.releaseVersion} · prioriteit {occurrence.priority}</small>
                  </li>
                ))}
              </ol>
            ) : <p>Geen planning</p>}
          </section>
        ))}
      </div>
    </section>
  );
}

export function FilteredPlanningEmpty({
  clearHref
}: {
  clearHref: string;
}) {
  return (
    <section className={styles.filteredEmpty} role="status">
      <Filter aria-hidden="true" />
      <div>
        <h2>Geen planning voor dit doel</h2>
        <p>De filter heeft geen directe of via een schermgroep geldende planning gevonden.</p>
      </div>
      <Button asChild variant="secondary"><Link href={clearHref}>Filter wissen</Link></Button>
    </section>
  );
}

export function planningHref({
  date,
  target,
  view
}: {
  date?: string;
  target?: string;
  view: PlanningView;
}) {
  const params = new URLSearchParams({ view });
  if (date) params.set("date", date);
  if (target) params.set("target", target);
  return `/dashboard/planning?${params.toString()}`;
}

function formatOccurrenceTime(start: string, end: string | null, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone
  });
  if (!end) return formatter.format(new Date(start));
  const dayFormatter = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric"
  });
  const crossesDay = dayFormatter.format(new Date(start)) !== dayFormatter.format(new Date(end));
  return `${formatter.format(new Date(start))}–${formatter.format(new Date(end))}${crossesDay ? " volgende dag" : ""}`;
}

function sourceLabel(source: string) {
  if (source === "override") return "Override";
  if (source === "fallback") return "Fallback";
  return "Planning";
}

function viewLabel(view: PlanningView) {
  if (view === "week") return "Week";
  if (view === "month") return "Maand";
  return "Agenda";
}
