"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireTenantCapability, requireTenantControlSession } from "../../../../lib/control-session";
import { createControlSupabaseClient } from "../../../../lib/supabase/server";
import { zonedLocalDateTimeToIso } from "./schedule-time";

export type ScheduleConflictInput = {
  endsAtIso: string | null;
  excludeScheduleId?: string | null;
  startsAtIso: string;
  targetId: string;
  targetKind: "screen" | "screen_group";
};

export type ScheduleConflict = {
  endsAt: string | null;
  priority: number;
  scheduleId: string;
  scheduleName: string;
  screenId: string;
  screenName: string;
  source: string;
  startsAt: string;
};

export type ScheduleConflictCheck = {
  conflicts: ScheduleConflict[];
  error: string | null;
};

type ScheduleCommandResult = {
  actualRevision?: unknown;
  outcome?: unknown;
  scheduleId?: unknown;
};

type PlanningWriter = Awaited<ReturnType<typeof planningWriter>>;

export async function checkScheduleConflicts(
  input: ScheduleConflictInput
): Promise<ScheduleConflictCheck> {
  const session = await requireTenantControlSession("tenant.release.read");
  const supabase = await createControlSupabaseClient();
  if (!session.isLive || !session.tenantId || !supabase) {
    return { conflicts: [], error: "De conflictcontrole is alleen beschikbaar in een actieve livesessie." };
  }
  const normalized = normalizeConflictInput(input);
  if (!normalized) {
    return { conflicts: [], error: "De doelkeuze of periode is ongeldig. Controleer de invoer." };
  }
  return runConflictCheck(supabase, session.tenantId, normalized);
}

export async function createContentSchedule(formData: FormData) {
  await saveContentSchedule(formData, "create");
}

export async function updateContentSchedule(formData: FormData) {
  await saveContentSchedule(formData, "update");
}

export async function setContentScheduleEnabled(formData: FormData) {
  const context = await planningWriter();
  const scheduleId = requiredUuid(formData, "scheduleId");
  const expectedRevision = revisionValue(formData);
  const operation = formData.get("enabled") === "true" ? "enable" : "disable";

  if (operation === "enable") {
    const schedule = await loadScheduleForCommand(context, scheduleId);
    const conflicts = await runConflictCheck(context.supabase, context.session.tenantId, {
      endsAtIso: schedule.ends_at,
      excludeScheduleId: schedule.id,
      startsAtIso: schedule.starts_at,
      targetId: schedule.target_kind === "screen"
        ? schedule.target_screen_id
        : schedule.target_screen_group_id,
      targetKind: schedule.target_kind
    });
    if (conflicts.error) fail(conflicts.error);
    if (conflicts.conflicts.length > 0 && formData.get("confirmConflicts") !== "yes") {
      fail("Deze planning overlapt bestaande planningen. Open de planning, bekijk de betrokken schermen en bevestig daarna bewust de prioriteit.");
    }
  }

  const { data, error } = await context.supabase.rpc("mutate_content_schedule_v1", {
    p_expected_revision: expectedRevision,
    p_idempotency_key: idempotencyValue(formData),
    p_operation: operation,
    p_payload: {},
    p_schedule_id: scheduleId,
    p_tenant_id: context.session.tenantId
  });
  if (error) fail(scheduleFailure(error.code));
  const result = commandResult(data);
  if (!result || result.outcome === "conflict") {
    fail(conflictMessage(result?.actualRevision));
  }
  complete(operation === "enable"
    ? "De planning is ingeschakeld. De immutable doelschermsnapshot is opnieuw vastgelegd."
    : "De planning is uitgeschakeld. Actieve players behouden hun laatst bekende geldige release.");
}

async function saveContentSchedule(formData: FormData, operation: "create" | "update") {
  const context = await planningWriter();
  const input = await scheduleInput(context, formData);
  const scheduleId = operation === "update" ? requiredUuid(formData, "scheduleId") : null;
  const expectedRevision = operation === "update" ? revisionValue(formData) : 0;
  const conflicts = await runConflictCheck(context.supabase, context.session.tenantId, {
    endsAtIso: input.endsAt,
    excludeScheduleId: scheduleId,
    startsAtIso: input.startsAt,
    targetId: input.targetId,
    targetKind: input.targetKind
  });
  if (conflicts.error) fail(conflicts.error);
  if (conflicts.conflicts.length > 0 && formData.get("confirmConflicts") !== "yes") {
    fail("Deze periode overlapt bestaande planningen. Bekijk de conflictcontrole en bevestig de zichtbare prioriteit voordat je opslaat.");
  }

  const { data, error } = await context.supabase.rpc("mutate_content_schedule_v1", {
    p_expected_revision: expectedRevision,
    p_idempotency_key: idempotencyValue(formData),
    p_operation: operation,
    p_payload: {
      enabled: input.enabled,
      endsAt: input.endsAt,
      name: input.name,
      priority: input.priority,
      recurrence: input.recurrence,
      releaseId: input.releaseId,
      scheduleKind: input.scheduleKind,
      source: input.source,
      startsAt: input.startsAt,
      targetId: input.targetId,
      targetKind: input.targetKind,
      timezoneName: input.timezoneName
    },
    p_schedule_id: scheduleId,
    p_tenant_id: context.session.tenantId
  });
  if (error) fail(scheduleFailure(error.code));
  const result = commandResult(data);
  if (!result || result.outcome === "conflict") {
    fail(conflictMessage(result?.actualRevision));
  }
  complete(operation === "create"
    ? "De planning is opgeslagen met een immutable snapshot van de huidige doelschermen."
    : "De planning en doelschermsnapshot zijn veilig bijgewerkt.");
}

async function scheduleInput(context: PlanningWriter, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2 || name.length > 120) {
    fail("Gebruik een planningsnaam van 2 tot en met 120 tekens.");
  }
  const target = String(formData.get("target") ?? "").split(":");
  const targetKind = target[0];
  const targetId = target[1] ?? "";
  if ((targetKind !== "screen" && targetKind !== "screen_group") || !uuidPattern.test(targetId)) {
    fail("Kies een geldig scherm of een geldige schermgroep.");
  }
  const releaseId = requiredUuid(formData, "releaseId");
  const timezoneName = await loadTenantTimezone(context);
  let startsAt: string;
  let endsAt: string | null;
  try {
    startsAt = zonedLocalDateTimeToIso(String(formData.get("startsAtLocal") ?? ""), timezoneName);
    const localEnd = String(formData.get("endsAtLocal") ?? "").trim();
    endsAt = localEnd ? zonedLocalDateTimeToIso(localEnd, timezoneName) : null;
  } catch (error) {
    fail(error instanceof Error ? error.message : "De gekozen periode is ongeldig.");
  }
  if (endsAt && new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
    fail("Het einde moet na het begin liggen.");
  }

  const scheduleKind = String(formData.get("scheduleKind") ?? "");
  if (!["once", "daily", "weekly", "custom"].includes(scheduleKind)) {
    fail("Kies een geldige herhaling.");
  }
  const recurrence = scheduleKind === "once"
    ? {}
    : recurrenceValue(formData, scheduleKind);
  const priority = Number.parseInt(String(formData.get("priority") ?? "100"), 10);
  if (!Number.isInteger(priority) || priority < 0 || priority > 1000) {
    fail("De prioriteit moet tussen 0 en 1000 liggen.");
  }
  const source = String(formData.get("source") ?? "publisher");
  if (source !== "publisher" && source !== "override") {
    fail("Kies een normale planning of een tijdelijke override.");
  }

  return {
    enabled: formData.get("enabled") !== "false",
    endsAt,
    name,
    priority,
    recurrence,
    releaseId,
    scheduleKind,
    source,
    startsAt,
    targetId,
    targetKind: targetKind as "screen" | "screen_group",
    timezoneName
  };
}

function recurrenceValue(formData: FormData, scheduleKind: string) {
  const startTime = String(formData.get("windowStartTime") ?? "");
  const endTime = String(formData.get("windowEndTime") ?? "");
  if (!timePattern.test(startTime) || !timePattern.test(endTime) || startTime === endTime) {
    fail("Kies een geldig dagelijks tijdvenster met een verschillend begin en einde.");
  }
  if (scheduleKind === "daily") return { endTime, startTime };
  const weekdays = [...new Set(formData.getAll("weekdays").map(Number))].sort();
  if (!weekdays.length || weekdays.some((day) => !Number.isInteger(day) || day < 1 || day > 7)) {
    fail("Kies minimaal één geldige weekdag.");
  }
  return { endTime, startTime, weekdays };
}

async function runConflictCheck(
  supabase: NonNullable<Awaited<ReturnType<typeof createControlSupabaseClient>>>,
  tenantId: string,
  input: ScheduleConflictInput
): Promise<ScheduleConflictCheck> {
  const { data, error } = await supabase.rpc("check_content_schedule_conflicts_v1", {
    p_ends_at: input.endsAtIso,
    p_exclude_schedule_id: input.excludeScheduleId ?? null,
    p_starts_at: input.startsAtIso,
    p_target_id: input.targetId,
    p_target_kind: input.targetKind,
    p_tenant_id: tenantId
  });
  if (error) {
    console.error("Planningsconflictcontrole mislukt", error);
    return {
      conflicts: [],
      error: "De conflictcontrole kon niet veilig worden voltooid. Er is niets opgeslagen; probeer opnieuw."
    };
  }
  const rows = Array.isArray(data) ? data : [];
  const screenIds = [...new Set(rows.flatMap((row) =>
    typeof row.screen_id === "string" ? [row.screen_id] : []
  ))];
  const screenNames = new Map<string, string>();
  if (screenIds.length) {
    const screens = await supabase
      .from("screens")
      .select("id, name")
      .eq("tenant_id", tenantId)
      .in("id", screenIds);
    if (screens.error) {
      console.error("Conflicterende schermnamen laden mislukt", screens.error);
      return {
        conflicts: [],
        error: "De betrokken schermen konden niet volledig worden gecontroleerd. Er is niets opgeslagen."
      };
    }
    for (const screen of screens.data ?? []) screenNames.set(screen.id, screen.name);
  }
  return {
    conflicts: rows.flatMap((row) => {
      if (
        typeof row.schedule_id !== "string" ||
        typeof row.schedule_name !== "string" ||
        typeof row.screen_id !== "string" ||
        typeof row.starts_at !== "string"
      ) return [];
      return [{
        endsAt: typeof row.ends_at === "string" ? row.ends_at : null,
        priority: Number(row.priority),
        scheduleId: row.schedule_id,
        scheduleName: row.schedule_name,
        screenId: row.screen_id,
        screenName: screenNames.get(row.screen_id) ?? "Onbekend scherm",
        source: typeof row.source === "string" ? row.source : "publisher",
        startsAt: row.starts_at
      }];
    }),
    error: null
  };
}

function normalizeConflictInput(input: ScheduleConflictInput): ScheduleConflictInput | null {
  if (
    (input.targetKind !== "screen" && input.targetKind !== "screen_group") ||
    !uuidPattern.test(input.targetId) ||
    (input.excludeScheduleId && !uuidPattern.test(input.excludeScheduleId)) ||
    !validIso(input.startsAtIso) ||
    (input.endsAtIso !== null && !validIso(input.endsAtIso)) ||
    (input.endsAtIso !== null &&
      new Date(input.endsAtIso).getTime() <= new Date(input.startsAtIso).getTime())
  ) return null;
  return input;
}

async function planningWriter() {
  const session = await requireTenantCapability("tenant.playlist.write");
  const supabase = await createControlSupabaseClient();
  if (!session.isLive || !session.tenantId || !supabase) {
    fail("Live Supabase is niet beschikbaar. Er is niets gewijzigd.");
  }
  return { session: { ...session, tenantId: session.tenantId }, supabase };
}

async function loadTenantTimezone(context: PlanningWriter) {
  const { data, error } = await context.supabase
    .from("tenant_settings")
    .select("timezone_name")
    .eq("tenant_id", context.session.tenantId)
    .maybeSingle();
  if (error) fail("De verenigingstijdzone kon niet worden gecontroleerd. Er is niets opgeslagen.");
  return data?.timezone_name ?? "Europe/Amsterdam";
}

async function loadScheduleForCommand(context: PlanningWriter, scheduleId: string) {
  const { data, error } = await context.supabase
    .from("content_schedules")
    .select("id, target_kind, target_screen_id, target_screen_group_id, starts_at, ends_at")
    .eq("tenant_id", context.session.tenantId)
    .eq("id", scheduleId)
    .single();
  if (error || !data) fail("De planning bestaat niet meer. Vernieuw de pagina.");
  const targetId = data.target_kind === "screen" ? data.target_screen_id : data.target_screen_group_id;
  if (
    (data.target_kind !== "screen" && data.target_kind !== "screen_group") ||
    !targetId
  ) fail("Het planningsdoel is niet meer geldig.");
  return {
    ...data,
    target_kind: data.target_kind as "screen" | "screen_group",
    target_screen_group_id: data.target_screen_group_id ?? "",
    target_screen_id: data.target_screen_id ?? ""
  };
}

function commandResult(value: unknown): ScheduleCommandResult | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as ScheduleCommandResult;
}

function requiredUuid(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "");
  if (!uuidPattern.test(value)) fail("De gekozen resource is ongeldig. Vernieuw de pagina.");
  return value;
}

function revisionValue(formData: FormData) {
  const revision = Number.parseInt(String(formData.get("expectedRevision") ?? ""), 10);
  if (!Number.isInteger(revision) || revision < 0) {
    fail("De planningsrevisie ontbreekt. Vernieuw de pagina voordat je wijzigt.");
  }
  return revision;
}

function idempotencyValue(formData: FormData) {
  const value = String(formData.get("idempotencyKey") ?? "");
  return uuidPattern.test(value) ? value : randomUUID();
}

function validIso(value: string) {
  return !Number.isNaN(new Date(value).getTime()) && value.includes("T");
}

function scheduleFailure(code: string | undefined) {
  if (code === "42501") return "Je mag planningen niet beheren. Er is niets gewijzigd.";
  if (code === "P0002") return "De planning bestaat niet meer. Vernieuw de pagina.";
  if (code === "23514") {
    return "Het scherm, de groep of de immutable release is niet meer beschikbaar. Controleer je keuzes.";
  }
  if (code === "23505") return "Dit planningsverzoek is al met andere invoer verwerkt. Start de actie opnieuw.";
  return "De planning kon niet veilig worden opgeslagen. Er is niets gedeeltelijk gewijzigd; probeer opnieuw.";
}

function conflictMessage(actualRevision: unknown) {
  const suffix = typeof actualRevision === "number" ? ` De actuele revisie is ${actualRevision}.` : "";
  return `Iemand anders wijzigde deze planning.${suffix} Vernieuw de pagina en controleer de actuele periode.`;
}

function complete(message: string): never {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/planning");
  revalidatePath("/dashboard/screen-groups");
  revalidatePath("/dashboard/screens");
  redirect(`/dashboard/planning?succes=${encodeURIComponent(message)}`);
}

function fail(message: string): never {
  redirect(`/dashboard/planning?fout=${encodeURIComponent(message)}`);
}

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
