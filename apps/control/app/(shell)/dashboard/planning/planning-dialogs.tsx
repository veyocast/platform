"use client";

import { type FormEvent, useRef, useState } from "react";
import { CalendarPlus, Pencil, Power, PowerOff } from "lucide-react";

import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@veyocast/ui";

import {
  checkScheduleConflicts,
  createContentSchedule,
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

type TargetOption = {
  disabled?: boolean;
  id: string;
  label: string;
  type: "screen" | "screen_group";
};

type ReleaseOption = {
  id: string;
  label: string;
  playlistId: string;
};

export function ContentScheduleDialog({
  defaultOpen = false,
  defaultStartAt,
  defaultTarget = "",
  disabled,
  groups,
  releases,
  schedule,
  screens,
  timezoneName
}: {
  defaultOpen?: boolean;
  defaultStartAt: string;
  defaultTarget?: string;
  disabled: boolean;
  groups: { id: string; memberCount: number; name: string }[];
  releases: ReleaseOption[];
  schedule?: ContentScheduleListItem;
  screens: { disabled: boolean; id: string; name: string; status: string }[];
  timezoneName: string;
}) {
  const idempotencyKey = useRef<HTMLInputElement>(null);
  const confirmConflicts = useRef<HTMLInputElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const bypassCheck = useRef(false);
  const [scheduleKind, setScheduleKind] = useState(schedule?.scheduleKind ?? "once");
  const [conflictCheck, setConflictCheck] = useState<ScheduleConflictCheck | null>(null);
  const [checking, setChecking] = useState(false);
  const isEditing = Boolean(schedule);
  const startsAt = schedule?.startsAt ?? defaultStartAt;
  const targetOptions: TargetOption[] = [
    ...screens.map((screen) => ({
      disabled: screen.disabled,
      id: screen.id,
      label: screen.name,
      type: "screen" as const
    })),
    ...groups.map((group) => ({
      disabled: group.memberCount === 0,
      id: group.id,
      label: `${group.name} · ${group.memberCount} ${group.memberCount === 1 ? "scherm" : "schermen"}`,
      type: "screen_group" as const
    }))
  ];
  const startTime = recurrenceString(schedule?.recurrence, "startTime") ??
    isoToZonedDateTimeLocal(startsAt, timezoneName).slice(11, 16);
  const endTime = recurrenceString(schedule?.recurrence, "endTime") ?? "23:00";
  const selectedWeekdays = recurrenceWeekdays(schedule?.recurrence);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    ensureIdempotencyKey(idempotencyKey.current);
    if (bypassCheck.current) {
      bypassCheck.current = false;
      return;
    }
    event.preventDefault();
    setChecking(true);
    const values = new FormData(event.currentTarget);
    try {
      const target = String(values.get("target") ?? "").split(":");
      const startsAtIso = zonedLocalDateTimeToIso(
        String(values.get("startsAtLocal") ?? ""),
        timezoneName
      );
      const localEnd = String(values.get("endsAtLocal") ?? "").trim();
      const conflictScheduleKind = scheduleKindValue(values.get("scheduleKind"));
      const result = await checkScheduleConflicts({
        endsAtIso: localEnd
          ? zonedLocalDateTimeToIso(localEnd, timezoneName)
          : null,
        excludeScheduleId: schedule?.id ?? null,
        recurrence: conflictRecurrence(values, conflictScheduleKind),
        scheduleKind: conflictScheduleKind,
        startsAtIso,
        targetId: target[1] ?? "",
        targetKind: target[0] === "screen_group" ? "screen_group" : "screen",
        timezoneName
      });
      setConflictCheck(result);
      if (!result.error && result.conflicts.length === 0) {
        bypassCheck.current = true;
        form.current?.requestSubmit();
      }
    } catch (error) {
      setConflictCheck({
        conflicts: [],
        error: error instanceof Error ? error.message : "De periode is ongeldig."
      });
    } finally {
      setChecking(false);
    }
  }

  function confirmAndSubmit() {
    if (confirmConflicts.current) confirmConflicts.current.value = "yes";
    bypassCheck.current = true;
    form.current?.requestSubmit();
  }

  function clearConflictReview() {
    if (confirmConflicts.current) confirmConflicts.current.value = "no";
    if (conflictCheck) setConflictCheck(null);
  }

  return (
    <Dialog defaultOpen={defaultOpen}>
      <DialogTrigger asChild>
        <Button disabled={disabled || releases.length === 0 || targetOptions.every((target) => target.disabled)} size={isEditing ? "sm" : "md"} variant={isEditing ? "secondary" : "primary"}>
          {isEditing ? <Pencil aria-hidden="true" /> : <CalendarPlus aria-hidden="true" />}
          {isEditing ? "Bewerken" : "Planning maken"}
        </Button>
      </DialogTrigger>
      <DialogContent className={styles.dialog}>
        <DialogHeader>
          <DialogTitle>{isEditing ? `${schedule?.name} bewerken` : "Nieuwe planning"}</DialogTitle>
          <DialogDescription>
            Plan uitsluitend een immutable release. Tijden worden opgeslagen in {timezoneName} en veilig genormaliseerd naar ISO.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <form
            action={isEditing ? updateContentSchedule : createContentSchedule}
            className={styles.form}
            onChange={clearConflictReview}
            onSubmit={onSubmit}
            ref={form}
          >
            <input name="idempotencyKey" ref={idempotencyKey} type="hidden" />
            <input defaultValue="no" name="confirmConflicts" ref={confirmConflicts} type="hidden" />
            <input name="enabled" type="hidden" value={String(schedule?.enabled ?? true)} />
            {schedule ? (
              <>
                <input name="scheduleId" type="hidden" value={schedule.id} />
                <input name="expectedRevision" type="hidden" value={schedule.revision} />
              </>
            ) : null}

            <div className={styles.twoColumns}>
              <div className="field">
                <label htmlFor={`schedule-name-${schedule?.id ?? "new"}`}>Naam</label>
                <input
                  defaultValue={schedule?.name}
                  id={`schedule-name-${schedule?.id ?? "new"}`}
                  maxLength={120}
                  minLength={2}
                  name="name"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor={`schedule-release-${schedule?.id ?? "new"}`}>Immutable release</label>
                <select
                  defaultValue={schedule?.releaseId ?? ""}
                  id={`schedule-release-${schedule?.id ?? "new"}`}
                  name="releaseId"
                  required
                >
                  <option value="">Kies een release</option>
                  {releases.map((release) => <option key={release.id} value={release.id}>{release.label}</option>)}
                </select>
              </div>
            </div>

            <div className="field">
              <label htmlFor={`schedule-target-${schedule?.id ?? "new"}`}>Doel</label>
              <select
                defaultValue={schedule ? `${schedule.targetKind}:${schedule.targetId}` : defaultTarget}
                id={`schedule-target-${schedule?.id ?? "new"}`}
                name="target"
                required
              >
                <option value="">Kies een scherm of groep</option>
                <optgroup label="Schermen">
                  {targetOptions.filter((target) => target.type === "screen").map((target) => (
                    <option disabled={target.disabled} key={target.id} value={`screen:${target.id}`}>{target.label}</option>
                  ))}
                </optgroup>
                <optgroup label="Schermgroepen">
                  {targetOptions.filter((target) => target.type === "screen_group").map((target) => (
                    <option disabled={target.disabled} key={target.id} value={`screen_group:${target.id}`}>{target.label}</option>
                  ))}
                </optgroup>
              </select>
              <small>Groepsleden worden bij opslaan als immutable doelschermsnapshot vastgelegd.</small>
            </div>

            <div className={styles.twoColumns}>
              <div className="field">
                <label htmlFor={`schedule-start-${schedule?.id ?? "new"}`}>Geldig vanaf</label>
                <input
                  defaultValue={isoToZonedDateTimeLocal(startsAt, timezoneName)}
                  id={`schedule-start-${schedule?.id ?? "new"}`}
                  name="startsAtLocal"
                  required
                  type="datetime-local"
                />
              </div>
              <div className="field">
                <label htmlFor={`schedule-end-${schedule?.id ?? "new"}`}>Geldig tot</label>
                <input
                  defaultValue={schedule?.endsAt ? isoToZonedDateTimeLocal(schedule.endsAt, timezoneName) : ""}
                  id={`schedule-end-${schedule?.id ?? "new"}`}
                  name="endsAtLocal"
                  type="datetime-local"
                />
              </div>
            </div>

            <div className={styles.twoColumns}>
              <div className="field">
                <label htmlFor={`schedule-kind-${schedule?.id ?? "new"}`}>Herhaling</label>
                <select
                  id={`schedule-kind-${schedule?.id ?? "new"}`}
                  name="scheduleKind"
                  onChange={(event) => setScheduleKind(event.target.value)}
                  value={scheduleKind}
                >
                  <option value="once">Eenmalig</option>
                  <option value="daily">Dagelijks</option>
                  <option value="weekly">Wekelijks</option>
                  <option value="custom">Specifieke weekdagen</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor={`schedule-source-${schedule?.id ?? "new"}`}>Soort planning</label>
                <select defaultValue={schedule?.source ?? "publisher"} id={`schedule-source-${schedule?.id ?? "new"}`} name="source">
                  <option value="publisher">Normale planning</option>
                  <option value="override">Tijdelijke override</option>
                </select>
              </div>
            </div>

            {scheduleKind !== "once" ? (
              <section className={styles.recurrence} aria-label="Terugkerend tijdvenster">
                <div className={styles.twoColumns}>
                  <div className="field">
                    <label htmlFor={`window-start-${schedule?.id ?? "new"}`}>Iedere keer vanaf</label>
                    <input defaultValue={startTime} id={`window-start-${schedule?.id ?? "new"}`} name="windowStartTime" required type="time" />
                  </div>
                  <div className="field">
                    <label htmlFor={`window-end-${schedule?.id ?? "new"}`}>Iedere keer tot</label>
                    <input defaultValue={endTime} id={`window-end-${schedule?.id ?? "new"}`} name="windowEndTime" required type="time" />
                  </div>
                </div>
                {scheduleKind === "weekly" || scheduleKind === "custom" ? (
                  <fieldset className={styles.weekdays}>
                    <legend>Weekdagen</legend>
                    {weekdayOptions.map((day) => (
                      <label key={day.value}>
                        <input defaultChecked={selectedWeekdays.includes(day.value)} name="weekdays" type="checkbox" value={day.value} />
                        <span>{day.label}</span>
                      </label>
                    ))}
                  </fieldset>
                ) : null}
              </section>
            ) : null}

            <div className="field">
              <label htmlFor={`schedule-priority-${schedule?.id ?? "new"}`}>Prioriteit</label>
              <input
                defaultValue={schedule?.priority ?? 100}
                id={`schedule-priority-${schedule?.id ?? "new"}`}
                max={1000}
                min={0}
                name="priority"
                required
                type="number"
              />
              <small>Individueel scherm gaat vóór groep; daarna geldt hoogste prioriteit en vervolgens de nieuwste planning.</small>
            </div>

            {conflictCheck ? (
              <ConflictReview
                check={conflictCheck}
                onConfirm={conflictCheck.conflicts.length ? confirmAndSubmit : undefined}
                timezoneName={timezoneName}
              />
            ) : null}

            <DialogFooter>
              <Button disabled={checking} type="submit">
                {checking ? "Conflicten controleren…" : isEditing ? "Planning opslaan" : "Planning maken"}
              </Button>
            </DialogFooter>
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
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
